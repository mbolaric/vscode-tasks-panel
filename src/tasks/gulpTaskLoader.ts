"use strict";
import * as path from 'path';
import { TasksPanelConfiguration } from './core/configuration';
import { TaskLoader, IExtendedTaskDefinition, TaskLoaderResult } from './core/taskLoader';
import { format } from './core/utils';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';

const localize = nls.loadMessageBundle();

export class GulpTaskLoader extends TaskLoader {
    constructor(workspaceFolder: vscode.WorkspaceFolder, configuration: TasksPanelConfiguration) {
        super("gulp", workspaceFolder, configuration);
    }

    protected getFilePattern(rootPath: string): string {
        return path.join(rootPath, 'gulpfile{.babel.js,.js,.ts}');
    }

    protected async isTaskFileExists(rootPath: string): Promise<boolean> {
		if (!await this.exists(path.join(rootPath, 'gulpfile.js')) && !await this.exists(path.join(rootPath, 'gulpfile.babel.js'))) {
    		return false;
		}
        return true;
    }

    protected async getCommand(rootPath: string | undefined): Promise<string | undefined> {
		let command: string;
		let platform = process.platform;
		if (platform === 'win32' && await this.exists(path.join(rootPath!, 'node_modules', '.bin', 'gulp.cmd'))) {
			command = path.join('.', 'node_modules', '.bin', 'gulp.cmd');
		} else if ((platform === 'linux' || platform === 'darwin') && await this.exists(path.join(rootPath!, 'node_modules', '.bin', 'gulp'))) {
			command = path.join('.', 'node_modules', '.bin', 'gulp');
		} else {
			command = 'gulp';
		}

		return command;
    }

    private extractTask(taskArray: vscode.Task[], command: string | undefined, line: string): void {
        let source = 'gulp';
        let kind: IExtendedTaskDefinition = {
            type: source,
            task: line
        };
        let options: vscode.ShellExecutionOptions = { cwd: this.getRootPath, executable: `${command}`, shellArgs: ['--no-color', `${line}`] };
        let task = new vscode.Task(kind, this.getWorkspaceFolder, line, source, new vscode.ShellExecution(`${command} ${line}`, options));
        taskArray.push(task);
        this.setTaskGroup(line, task);
    }

    protected async resolveTasks(): Promise<TaskLoaderResult[]> {
        let empty: TaskLoaderResult = TaskLoaderResult.empty();
        let command = await this.getCommand(this.getRootPath);
        let loadCommandLine = `${command} --tasks-simple --no-color`;
        try {
            this.outputInfo(localize("task-panel.taskloader.startLoadingTasks", "Start loading tasks ..."));
            let { stdout, stderr } = await this.exec(loadCommandLine, { cwd: this.getRootPath });
            if (stderr && stderr.length > 0) {
                this.showErrorInChannel(stderr);
                this.outputError(localize("task-panel.taskloader.errorLoadingTasks", "Error loading tasks."));
            }
            let result: vscode.Task[] = [];
            if (stdout) {
                let lines = stdout.split(/\r{0,1}\n/);
                for (let line of lines) {
                    if (line.length === 0) {
                        continue;
                    }
                    this.extractTask(result, command, line);
                }
                result = this.sortTasksAsc(result);
            }
            this.outputInfo(localize("task-panel.taskloader.finishLoadingTasks", "Finish loading tasks."));
            this.outputInfo(localize("task-panel.taskloader.loadedTasks", format("Loaded {0} tasks.", result.length)));
            return [new TaskLoaderResult(this.getWorkspaceFolder.name, this.key, result, this.getTaskIcons("gulp"), this.initialTreeCollapsibleState)];
        } catch (error) {
            this.showErrorInChannel(error);
        }
        return [empty];
    }
}