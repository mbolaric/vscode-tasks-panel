"use strict";
import * as path from 'path';
import { TaskLoader, IExtendedTaskDefinition, TaskLoaderResult } from './core/taskLoader';
import * as vscode from 'vscode';

export class GruntTaskLoader extends TaskLoader {
    constructor(workspaceFolder: vscode.WorkspaceFolder) {
        super("grunt", workspaceFolder);
    }

    protected getFilePattern(rootPath: string): string {
        return path.join(rootPath, '[Gg]runtfile.js');
    }

    protected async isTaskFileExists(rootPath: string): Promise<boolean> {
		if (!await this.exists(path.join(rootPath, 'gruntfile.js')) && !await this.exists(path.join(rootPath, 'Gruntfile.js'))) {
			return false;
        }
        return true;
    }

    protected async getCommand(rootPath: string | undefined): Promise<string | undefined> {
		let command: string;
        let platform = process.platform;
        
        if (!rootPath) {
            return undefined;
        }
		if (platform === 'win32' && await this.exists(path.join(rootPath!, 'node_modules', '.bin', 'grunt.cmd'))) {
			command = path.join('.', 'node_modules', '.bin', 'grunt.cmd');
		} else if ((platform === 'linux' || platform === 'darwin') && await this.exists(path.join(rootPath!, 'node_modules', '.bin', 'grunt'))) {
			command = path.join('.', 'node_modules', '.bin', 'grunt');
		} else {
			command = 'grunt';
		}

		return command;
    }

    private extractAliasTask(taskArray: vscode.Task[], command: string | undefined, taskObj: {name: string, info: string}): void {
        let source = this.key;
        let name = taskObj.name;
        let kind: IExtendedTaskDefinition = {
            type: source,
            task: name
        };
        let options: vscode.ShellExecutionOptions = { cwd: this.getRootPath, executable: `${command}`, shellArgs: [`${name}`, '--no-color'] };
        let task = name.indexOf(' ') === -1
            ? new vscode.Task(kind, this.getWorkspaceFolder, name, source, new vscode.ShellExecution(`${command} ${name}`, options))
            : new vscode.Task(kind, this.getWorkspaceFolder, name, source, new vscode.ShellExecution(`${command} "${name}"`, options));
        taskArray.push(task);
        this.setTaskGroup(name, task);
    }

    private extractCoreTask(taskArray: vscode.Task[], command: string | undefined, taskObj: {name: string, info: string, multi: boolean, targets: string[]}): void {
        let source = this.key;
        let name = taskObj.name;
        taskObj.targets.forEach(subTask => {
            let fullName: string = name + ":" + subTask;
            let subTaskName = name.indexOf(' ') === -1 ? `${fullName}` : `"${fullName}"`;
            let kind: IExtendedTaskDefinition = {
                type: source,
                task: fullName
            };
            let options: vscode.ShellExecutionOptions = { cwd: this.getRootPath, executable: `${command}`, shellArgs: [`${subTaskName}`, '--no-color'] };
            let task = new vscode.Task(kind, this.getWorkspaceFolder, fullName, source, new vscode.ShellExecution(`${command} ${subTaskName}`, options));
            taskArray.push(task);
            this.setTaskGroup(fullName, task);
        });
    }

    protected async resolveTasks(): Promise<TaskLoaderResult[]> {
        let empty: TaskLoaderResult = TaskLoaderResult.empty();
        if (this.getRootPath) {
            let command = await this.getCommand(this.getRootPath);
            let supportGruntFilePath =  path.join(__filename, '..', '..', 'resources', 'grunt');
            let commandLoadLine = `${command} --tasks ${supportGruntFilePath} _fetchGruntTasks_`;
            try {
                this.outputInfo(`Start loading tasks ...`);
                let { stdout, stderr } = await this.exec(commandLoadLine, { cwd: this.getRootPath });
                if (stderr) {
                    this.showErrorInChannel(stderr);
                    this.outputError(`Error loading tasks.`);
                }
                let result: vscode.Task[] = [];
                if (stdout) {
                    try {
                        let lines = stdout.split(/\r{0,1}\n/);
                        if (lines.length > 2 && lines[1].startsWith("{") && lines[1].endsWith("}")) {
                            let tasksDefObj: {aliasTasks: {name: string, info: string}[], coreTasks: {name: string, info: string, multi: boolean, targets: string[]}[]} = JSON.parse(lines[1]);
                            tasksDefObj.aliasTasks.forEach(item => {
                                this.extractAliasTask(result, command, item);
                            });
                            tasksDefObj.coreTasks.forEach(item => {
                                this.extractCoreTask(result, command, item);
                            });                            
                        } else {
                            this.outputError(`Error loading tasks.`);
                        }
                    } catch (error) {
                        this.showErrorInChannel(error);
                    }
                }
                this.outputInfo(`Finish loading tasks.`);
                this.outputInfo(`Loaded ${result.length} tasks.`);
                return [new TaskLoaderResult(this.getWorkspaceFolder.name, this.key, result, this.getTaskIcons("grunt"))];
            } catch (error) {
                this.showErrorInChannel(error);
            }
        }
        return [empty];
    }
}