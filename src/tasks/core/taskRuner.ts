"use strict";
import * as cp from 'child_process';
import * as sd from 'string_decoder';
import { TaskPanelItem } from './taskPanelItem';
import { output } from './utils';
import * as vscode from 'vscode';

class Line {
	private stringDecoder: sd.NodeStringDecoder;
    private remaining: string;
    private CarriageReturn: number = 13;
    private LineFeed: number = 10;

	constructor(encoding: string = 'utf8') {
		this.stringDecoder = new sd.StringDecoder(encoding);
		this.remaining = "";
	}

	public write(buffer: NodeBuffer): string[] {
		let result: string[] = [];
		let start = 0;
		let ch: number;
		let idx = start;
		let value = this.remaining ? this.remaining + this.stringDecoder.write(buffer) : this.stringDecoder.write(buffer);

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
		this.remaining = start < value.length ? value.substr(start) : "";
		return result;
	}

	public end(): string {
		return this.remaining;
	}
}

export enum TaskState {
    TaskRun,
    TaskStop,
    TaskTerminated
}

export class TaskRunner {
    private _cache: { [id: string]: {task: TaskPanelItem, closeEvent: vscode.Disposable | undefined, childProcess: cp.ChildProcess} | undefined } = {};  
	private readonly _onDidTaskStateChanged = new vscode.EventEmitter<{task: TaskPanelItem, state: TaskState} | null>();
	public readonly onDidTaskStateChanged: vscode.Event<{task: TaskPanelItem, state: TaskState} | null> = this._onDidTaskStateChanged.event;    
    
    private fireOnDidTaskStateChanged(task: TaskPanelItem, state: TaskState) {
        this._onDidTaskStateChanged.fire({task: task, state: state});
    }

    private outputLog(message: string): void {
        if (message !== "") {
            output('> ' + message);
        }
    }

    private outputInfo(message: string): void {
        output('> ' + message);
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
                            let options: any = defaults;
                            options.windowsVerbatimArguments = true;
                            options.detached = false;
                            let args: string[] = [
                            	'/s',
                            	'/c',
                            ];
                            if (options.shellArgs) {
                                args.concat(options.shellArgs);
                                childProcess = cp.spawn(this.getWindowsShell(), args, options);
                                this.handleSpawn(task, childProcess);                
                            } else {
                                this.outputLog("Task Arguments are not defined!");
                            }
                        } else {
                            childProcess = cp.spawn(options.executable, options.shellArgs, defaults);
                            this.handleSpawn(task, childProcess);
                        }
                    } else {
                        this.outputLog("Executable is not defined!");
                    }
                }
            } catch (error) {
                this.outputLog("Task or Task execution is not defined!");
            }
        }
    }

    public async execute(task: TaskPanelItem): Promise<void> {
        if (!this._cache[task.id]) {
            this.outputInfo(`Executing '${task.label}' ...`);
            this.executeProcess(task);
        } else {
            vscode.window.showInformationMessage(`Task '${task.label}' is already in execution queue.`);
        }
    }

    private addTaskToCache(task: TaskPanelItem, childProcess: cp.ChildProcess) {
        this._cache[task.id] = {task: task, closeEvent: undefined, childProcess: childProcess};
        this.fireOnDidTaskStateChanged(task, TaskState.TaskRun);
    }

    private clearTask(task: TaskPanelItem, terminated: boolean = false) {
        this._cache[task.id] = undefined;        
        delete this._cache[task.id];
        this.fireOnDidTaskStateChanged(task, this.terminate ? TaskState.TaskTerminated : TaskState.TaskStop);
    }

	private handleSpawn(task: TaskPanelItem, childProcess: cp.ChildProcess): void {
        let stdoutLine = new Line();
        let stderrLine = new Line();
        this.addTaskToCache(task, childProcess);
        childProcess.on('close', () => {
            [stdoutLine.end(), stderrLine.end()].forEach((line, index) => {
                if (line) {
                    this.outputLog(line);
                }
            });
            this.clearTask(task);                
            this.outputInfo(`Executing of '${task.label}' is finish.`);
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

    private terminate(taskId: string, process: {task: TaskPanelItem, closeEvent: vscode.Disposable | undefined, childProcess: cp.ChildProcess}, cwd?: string): boolean {
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
                this.clearTask(process.task);
                return false;
            }
        } else {
            try {
                if (process.closeEvent) {
                    process.closeEvent.dispose();
                }
        
                if (process.childProcess) {
                    process.childProcess.kill('SIGKILL');
                }
            } catch (error) {
                this.clearTask(process.task);
                return false;                    
            }
        }
        this.clearTask(process.task);
        this.outputInfo(`Executing of '${process.task.label}' is terminated.`);
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
            process.childProcess.on('exit', () => {
                if (callback) {
                    callback();
                }
                this.fireOnDidTaskStateChanged(task, TaskState.TaskTerminated) ;
            });
            this.terminate(task.id, process, this.getCwdFromTask(task));
        } else {
            vscode.window.showErrorMessage(`Task '${task.label}' are not running.`);
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
}