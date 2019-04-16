"use strict";
import * as path from 'path';
import { TasksPanelConfiguration } from './core/configuration';
import { TaskLoader, IExtendedTaskDefinition, TaskLoaderResult, ITaskFolderInfo } from './core/taskLoader';
import { format } from './core/utils';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';

const localize = nls.loadMessageBundle();

export class GulpTaskLoader extends TaskLoader {
    constructor(workspaceFolder: vscode.WorkspaceFolder, configuration: TasksPanelConfiguration) {
        super("gulp", workspaceFolder, configuration);
    }

    protected getFilePattern(rootPath: string): string {
        return path.join(rootPath, '[Gg]ulpfile{.babel.js,.js,.ts}');
    }

    protected async isTaskFileExists(rootPath: string): Promise<boolean> {
        if (await this.exists(path.join(rootPath, 'gulpfile.js')) || 
            await this.exists(path.join(rootPath, 'gulpfile.babel.js')) ||
            await this.exists(path.join(rootPath, 'Gulpfile.js')) ||
            await this.exists(path.join(rootPath, 'Gulpfile.babel.js'))) {
    		return true;
		}
        return false;
    }

    protected async getCommand(rootPath: string | undefined, folderPath: string): Promise<string | undefined> {
		let command: string = 'gulp';
        let platform = process.platform;
        
        if (!rootPath) {
            return command;
        }

		if (platform === 'win32') {
            if (await this.exists(path.join(folderPath, 'node_modules', '.bin', 'gulp.cmd'))) {
                command = path.join(folderPath, 'node_modules', '.bin', 'gulp.cmd');
            } else if (await this.exists(path.join(rootPath!, 'node_modules', '.bin', 'gulp.cmd'))) {
                command = path.join(rootPath!, 'node_modules', '.bin', 'gulp.cmd');
            }
		} else if ((platform === 'linux' || platform === 'darwin')) {
            if (await this.exists(path.join(folderPath, 'node_modules', '.bin', 'gulp'))) {
                command = path.join(folderPath, 'node_modules', '.bin', 'gulp');
            } else if (await this.exists(path.join(rootPath!, 'node_modules', '.bin', 'gulp'))) {
                command = path.join(rootPath!, 'node_modules', '.bin', 'gulp');
            }
		} else {
			command = 'gulp';
		}

		return command;
    }

    private extractTask(taskArray: vscode.Task[], command: string | undefined, line: string, cwd: string): void {
        let source = 'gulp';
        let kind: IExtendedTaskDefinition = {
            type: source,
            task: line
        };
        let options: vscode.ShellExecutionOptions = { cwd: cwd, executable: `${command}`, shellArgs: ['--no-color', `${line}`] };
        let task = new vscode.Task(kind, this.getWorkspaceFolder, line, source, new vscode.ShellExecution(`${command} ${line}`, options));
        taskArray.push(task);
        this.setTaskGroup(line, task);
    }

    protected async resolveByPath(taskFolderInfo: ITaskFolderInfo): Promise<TaskLoaderResult | undefined> {
        let command = await this.getCommand(this.getRootPath, taskFolderInfo.folderPath);
        let loadCommandLine = `${command} --tasks-simple --no-color`;
        let taskResultWorkspace: string = taskFolderInfo.displayName;
        try {
            this.outputInfo(localize("task-panel.taskloader.startLoadingTasks", "Start loading tasks ..."), taskFolderInfo);
            let { stdout, stderr } = await this.exec(loadCommandLine, { cwd: taskFolderInfo.folderPath });
            if (stderr && stderr.length > 0) {
                this.showErrorInChannel(stderr);
                this.outputError(localize("task-panel.taskloader.errorLoadingTasks", "Error loading tasks."), taskFolderInfo);
            }
            let result: vscode.Task[] = [];
            if (stdout) {
                let lines = stdout.split(/\r{0,1}\n/);
                for (let line of lines) {
                    if (line.length === 0) {
                        continue;
                    }
                    this.extractTask(result, command, line, taskFolderInfo.folderPath);
                }
                result = this.sortTasksAsc(result);
            }
            this.outputInfo(localize("task-panel.taskloader.finishLoadingTasks", "Finish loading tasks."), taskFolderInfo);
            this.outputInfo(localize("task-panel.taskloader.loadedTasks", format("Loaded {0} tasks.", result.length)), taskFolderInfo);
            return new TaskLoaderResult(taskResultWorkspace, this.key, result, this.getTaskIcons("gulp"), this.initialTreeCollapsibleState);
        } catch (error) {
            this.showErrorInChannel(error);
        }
        return undefined;
    }
}