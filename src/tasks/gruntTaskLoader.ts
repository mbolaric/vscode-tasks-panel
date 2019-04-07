"use strict";
import { TasksPanelConfiguration } from './core/configuration';
import * as path from 'path';
import { TaskLoader, IExtendedTaskDefinition, TaskLoaderResult, ITaskFolderInfo } from './core/taskLoader';
import { format } from './core/utils';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';

const localize = nls.loadMessageBundle();

export class GruntTaskLoader extends TaskLoader {

    constructor(workspaceFolder: vscode.WorkspaceFolder, configuration: TasksPanelConfiguration) {
        super("grunt", workspaceFolder, configuration);
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

    protected async getCommand(rootPath: string | undefined, folderPath: string): Promise<string | undefined> {
		let command: string = "grunt";
        let platform = process.platform;
        
        if (!rootPath) {
            return command;
        }
		if (platform === 'win32') {
            if (await this.exists(path.join(folderPath, 'node_modules', '.bin', 'grunt.cmd'))) {
                command = path.join(folderPath, 'node_modules', '.bin', 'grunt.cmd');
            } else if (await this.exists(path.join(rootPath!, 'node_modules', '.bin', 'grunt.cmd'))) {
                command = path.join(rootPath!, 'node_modules', '.bin', 'grunt.cmd');
            }
		} else if ((platform === 'linux' || platform === 'darwin')) {
            if (await this.exists(path.join(folderPath, 'node_modules', '.bin', 'grunt'))) {
                command = path.join(folderPath, 'node_modules', '.bin', 'grunt');
            } else if (await this.exists(path.join(rootPath!, 'node_modules', '.bin', 'grunt'))) {
                command = path.join(rootPath!, 'node_modules', '.bin', 'grunt');
            }
		} else {
			command = 'grunt';
		}

		return command;
    }

    private extractAliasTask(taskArray: vscode.Task[], command: string | undefined, taskObj: {name: string, info: string}, cwd: string): void {
        let source = this.key;
        let name = taskObj.name;
        let kind: IExtendedTaskDefinition = {
            type: source,
            task: name
        };
        let options: vscode.ShellExecutionOptions = { cwd: cwd, executable: `${command}`, shellArgs: [`${name}`, '--no-color'] };
        let task = name.indexOf(' ') === -1
            ? new vscode.Task(kind, this.getWorkspaceFolder, name, source, new vscode.ShellExecution(`${command} ${name}`, options))
            : new vscode.Task(kind, this.getWorkspaceFolder, name, source, new vscode.ShellExecution(`${command} "${name}"`, options));
        taskArray.push(task);
        this.setTaskGroup(name, task);
    }

    private pushTask(taskArray: vscode.Task[], source: string, fullName: string, command: string | undefined, subTaskName: string, cwd: string) {
        let kind: IExtendedTaskDefinition = {
            type: source,
            task: fullName
        };
        let options: vscode.ShellExecutionOptions = { cwd: cwd, executable: `${command}`, shellArgs: [`${subTaskName}`, '--no-color'] };
        let task = new vscode.Task(kind, this.getWorkspaceFolder, fullName, source, new vscode.ShellExecution(`${command} ${subTaskName}`, options));
        taskArray.push(task);
        this.setTaskGroup(fullName, task);
    }

    private extractCoreTask(taskArray: vscode.Task[], command: string | undefined, taskObj: {name: string, info: string, multi: boolean, targets: string[]}, cwd: string): void {
        let source = this.key;
        let name = taskObj.name;
        if (taskObj.targets.length > 0) {
            taskObj.targets.forEach(subTask => {
                let fullName: string = name + ":" + subTask;
                let subTaskName = name.indexOf(' ') === -1 ? `${fullName}` : `"${fullName}"`;
                this.pushTask(taskArray, source, fullName, command, subTaskName, cwd);
            });
        } else {
            this.pushTask(taskArray, source, name, command, name, cwd);
        }
    }

    protected async resolveByPath(taskFolderInfo: ITaskFolderInfo): Promise<TaskLoaderResult | undefined> {
        let command = await this.getCommand(this.getRootPath, taskFolderInfo.folderPath);
        let supportGruntFilePath = path.join(__filename, '..', '..', '..', 'resources', 'grunt');
        let commandLoadLine = `${command} --tasks ${supportGruntFilePath} _fetchGruntTasks_`;        
        let taskResultWorkspace: string = taskFolderInfo.displayName;
        try {
            this.outputInfo(localize("task-panel.taskloader.startLoadingTasks", "Start loading tasks ..."), taskFolderInfo);
            let { stdout, stderr } = await this.exec(commandLoadLine, { cwd: taskFolderInfo.folderPath });
            if (stderr && stderr.length > 0) {
                this.showErrorInChannel(stderr);
                this.outputError(localize("task-panel.taskloader.errorLoadingTasks", "Error loading tasks."), taskFolderInfo);
            }
            let result: vscode.Task[] = [];
            if (stdout) {
                try {
                    let lines = stdout.split(/\r{0,1}\n/);
                    if (lines.length > 2 && lines[1].startsWith("{") && lines[1].endsWith("}")) {
                        let tasksDefObj: {aliasTasks: {name: string, info: string}[], coreTasks: {name: string, info: string, multi: boolean, targets: string[]}[]} = JSON.parse(lines[1]);
                        let aliasTasks: vscode.Task[] = [];
                        let coreTasks: vscode.Task[] = [];
                        tasksDefObj.aliasTasks.forEach(item => {
                            this.extractAliasTask(aliasTasks, command, item, taskFolderInfo.folderPath);
                        });
                        tasksDefObj.coreTasks.forEach(item => {
                            this.extractCoreTask(coreTasks, command, item, taskFolderInfo.folderPath);
                        });
                        aliasTasks = this.sortTasksAsc(aliasTasks);
                        coreTasks = this.sortTasksAsc(coreTasks);
                        result = aliasTasks.concat(coreTasks);                            
                    } else {
                        this.outputError(localize("task-panel.taskloader.errorLoadingTasks", "Error loading tasks."), taskFolderInfo);
                        this.showErrorInChannel(lines);
                    }
                } catch (error) {
                    this.showErrorInChannel(error);
                }
            }
            this.outputInfo(localize("task-panel.taskloader.finishLoadingTasks", "Finish loading tasks."), taskFolderInfo);
            this.outputInfo(localize("task-panel.taskloader.loadedTasks", format("Loaded {0} tasks.", result.length)), taskFolderInfo);
            return new TaskLoaderResult(taskResultWorkspace, this.key, result, this.getTaskIcons("grunt"), this.initialTreeCollapsibleState);
        } catch (error) {
            this.showErrorInChannel(error);
        }
        return undefined;
    }
}