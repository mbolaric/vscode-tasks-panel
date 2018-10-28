"use strict";
import * as path from 'path';
import * as cp from 'child_process';
import * as sd from 'string_decoder';
import { TaskPanelItem } from './taskPanelItem';
import { output, format } from './utils';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';

const localize = nls.loadMessageBundle();

class Line {
	private _stringDecoder: sd.NodeStringDecoder;
    private _remaining: string;
    private CarriageReturn: number = 13;
    private LineFeed: number = 10;

	constructor(encoding: string = 'utf8') {
		this._stringDecoder = new sd.StringDecoder(encoding);
		this._remaining = "";
	}

	public write(buffer: NodeBuffer): string[] {
		let result: string[] = [];
		let start = 0;
		let ch: number;
		let idx = start;
		let value = this._remaining ? this._remaining + this._stringDecoder.write(buffer) : this._stringDecoder.write(buffer);

		if (value.length < 1) {
			return result;
        }
        
		while (idx < value.length) {
			ch = value.charCodeAt(idx);
			if (ch === this.CarriageReturn || ch === this.LineFeed) {
				result.push(value.substring(start, idx));
				idx++;
				if (idx < value.length) {
					let lastChar = ch;
					ch = value.charCodeAt(idx);
					if ((lastChar === this.CarriageReturn && ch === this.LineFeed) || (lastChar === this.LineFeed && ch === this.CarriageReturn)) {
						idx++;
					}
				}
				start = idx;
			} else {
				idx++;
			}
		}
		this._remaining = start < value.length ? value.substr(start) : "";
		return result;
	}

	public end(): string {
		return this._remaining;
	}
}

export enum TaskState {
    TaskRun,
    TaskStop,
    TaskTerminated
}

type CacheItem = {task: TaskPanelItem, childProcess: cp.ChildProcess, terminated:  false, onTerminateCallback?: Function};

export class TaskRunner {
    private _cache: { [id: string]: CacheItem | undefined } = {};  
	private readonly _onDidTaskStateChanged = new vscode.EventEmitter<{task: TaskPanelItem, state: TaskState} | null>();
	public readonly onDidTaskStateChanged: vscode.Event<{task: TaskPanelItem, state: TaskState} | null> = this._onDidTaskStateChanged.event;    
    
    private fireOnDidTaskStateChanged(task: TaskPanelItem, state: TaskState) {
        this._onDidTaskStateChanged.fire({task: task, state: state});
    }

    private outputLog(message: string): void {
        if (message !== "") {
            output(message);
        }
    }

    private outputInfo(message: string): void {
        output(message);
    }

    private outputError(message: string): void {
        output(message, "ERROR");
    }

    private getWindowsShell(): string {
        return process.env['comspec'] || 'cmd.exe';
    }

    private async executeProcess(task: TaskPanelItem): Promise<void> {
        if (task.task && task.task.execution) {
            try {
                let execution = task.task.execution;
                let options = (<vscode.ShellExecution>execution).options;
                if (options) {
                    let childProcess: cp.ChildProcess;
                    const defaults = {
                        cwd: options.cwd,
                        env: process.env
                    };                 
                    if (options.executable) {
                        if (this.isWindows) {
                            let winOptions: any = defaults;
                            winOptions.windowsVerbatimArguments = true;
                            winOptions.detached = false;
                            let args: string[] = [
                            	'/s',
                                '/c',
                                options.executable
                            ];
                            if (options.shellArgs) {
                                args = args.concat(options.shellArgs);
                                childProcess = cp.spawn(this.getWindowsShell(), args, winOptions);
                                this.handleSpawn(task, childProcess);                
                            } else {
                                this.outputLog(localize("task-panel.taskruner.taskArgumentsAreNotDefined", "Task Arguments are not defined!"));
                            }
                        } else {
                            childProcess = cp.spawn(options.executable, options.shellArgs, defaults);
                            this.handleSpawn(task, childProcess);
                        }
                    } else {
                        this.outputLog(localize("task-panel.taskruner.executableIsNotDefined", "Executable is not defined!"));
                    }
                }
            } catch (error) {
                this.outputLog(localize("task-panel.taskruner.executeProcessError", "Task or Task execution is not defined!"));
            }
        }
    }

    public async execute(task: TaskPanelItem): Promise<void> {
        if (!this._cache[task.id]) {
            this.outputInfo(localize("task-panel.taskruner.taskExecute", format("Executing '{0}' ...", task.label)));
            this.executeProcess(task);
        } else {
            vscode.window.showInformationMessage(localize("task-panel.taskruner.taskExistsInRunningQueue", format("Task '{0}' is already in execution queue.", task.label)));
        }
    }

    private addTaskToCache(task: TaskPanelItem, childProcess: cp.ChildProcess): CacheItem | undefined {
        this._cache[task.id] = {task: task, childProcess: childProcess, terminated: false};
        this.fireOnDidTaskStateChanged(task, TaskState.TaskRun);
        return this._cache[task.id];
    }

    private clearTask(task: TaskPanelItem, terminated: boolean = false) {
        let state: TaskState = terminated ? TaskState.TaskTerminated : TaskState.TaskStop;
        this._cache[task.id] = undefined;
        delete this._cache[task.id];
        this.fireOnDidTaskStateChanged(task, state);
    }

	private handleSpawn(task: TaskPanelItem, childProcess: cp.ChildProcess): void {
        let stdoutLine = new Line();
        let stderrLine = new Line();
        let taskCache: CacheItem | undefined = this.addTaskToCache(task, childProcess);
        childProcess.on('close', () => {
            console.log("close");
            [stdoutLine.end(), stderrLine.end()].forEach((line, index) => {
                if (line) {
                    this.outputLog(line);
                }
            });
            this.clearTask(task, taskCache ? taskCache.terminated : true);
            this.outputInfo(localize("task-panel.taskruner.executeFinish", format("Executing of '{0}' is finish.", task.label)));
            if (taskCache && taskCache.onTerminateCallback) {
                taskCache.onTerminateCallback();
                taskCache.onTerminateCallback = undefined;
            }
        });
        childProcess.stdout.on('data', (data: Buffer) => {
            let lines = stdoutLine.write(data);
            lines.forEach(line => this.outputLog(line));
        });
        childProcess.stderr.on('data', (data: Buffer) => {
            let lines = stderrLine.write(data);
            lines.forEach(line => this.outputLog(line));            
        });
    }

    private killChildProcess(process: {task: TaskPanelItem, childProcess: cp.ChildProcess}) {
        if (process.childProcess) {
            process.childProcess.kill('SIGKILL');
        }
    }

    private terminate(taskId: string, process: {task: TaskPanelItem, childProcess: cp.ChildProcess}, cwd?: string): boolean {
        if (this.isWindows) {
            try {
                let options: any = {
                    stdio: ['pipe', 'pipe', 'ignore']
                };
                if (cwd) {
                    options.cwd = cwd;
                }
                cp.execFileSync('taskkill', ['/T', '/F', '/PID', process.childProcess.pid.toString()], options);
            } catch (err) {
                this.outputError(localize("task-panel.taskruner.cannotTerminateTask", "Cannot terminate task!"));
                return false;
            }
        } else if (this.isLinux || this.isMacintosh) {
            try {
                let cmd = path.join(__filename, '..', '..', '..', '..', 'resources', 'terminateProcess.sh');
                let result = cp.spawnSync(cmd, [process.childProcess.pid.toString()]);
                if (result.error) {
                    this.outputError(result.error.toString());
                    try {
                        this.killChildProcess(process);
                    } catch {
                        this.outputError(localize("task-panel.taskruner.cannotTerminateTask", "Cannot terminate task!"));
                        return false;
                    }
                }
            } catch (err) {
                this.outputError(localize("task-panel.taskruner.cannotTerminateTask", "Cannot terminate task!"));
                return false;                    
            }
        } else {
            try {
                this.killChildProcess(process);
            } catch (error) {
                this.outputError(localize("task-panel.taskruner.cannotTerminateTask", "Cannot terminate task!"));
                return false;                    
            }
        }
        this.clearTask(process.task);
        this.outputInfo(localize("task-panel.taskruner.executeTerminated", format("Executing of '{0}' is terminated.", process.task.label)));
        return true;
    }

    private getCwdFromTask(taskItem: TaskPanelItem): string | undefined {
        let task: vscode.Task | undefined = taskItem.task;
        if (task) {
            let exec = task.execution;
            if (exec) {
                let options = (<vscode.ShellExecution>exec).options;
                if (options) {
                    return options.cwd;
                }
            }
        }
        return undefined;
    }

    public terminateProcess(task: TaskPanelItem, callback?: () => void): void {
        const process = this._cache[task.id];
        if (process) {
            process.onTerminateCallback = callback;
            this.terminate(task.id, process, this.getCwdFromTask(task));
        } else {
            vscode.window.showErrorMessage(localize("task-panel.taskruner.taskIsNotRunning", format("Task '{0}' are not running.", task.label)));
        }
    }

    public restartProcess(task: TaskPanelItem): void {
        const process = this._cache[task.id];
        if (process) {
            this.terminateProcess(task, () => {
                this.executeProcess(task);
            });
        } else {
            vscode.window.showErrorMessage(localize("task-panel.taskruner.taskIsNotRunning", format("Task '{0}' are not running.", task.label)));
        }
    }

    public reset(): void {
        Object.keys(this._cache).forEach(id => {
            let process = this._cache[id];
            if (process) {
                this.terminate(id, process);
            }
        });
    }

    private get isWindows(): boolean {
        return (process.platform === 'win32');
    }

    private get isLinux(): boolean {
        return (process.platform === 'linux');
    }

    private get isMacintosh(): boolean {
        return (process.platform === 'darwin');
    }
}