"use strict";
import * as fs from 'fs';
import * as cp from 'child_process';
import { getOrCreateOutputChannel, output, format, IconTheme, getIconPath } from './utils';
import * as nls from 'vscode-nls';
import * as vscode from 'vscode';

const localize = nls.loadMessageBundle();

export interface ITaskLoader {
    getTasks(reload: boolean): Promise<TaskLoaderResult[]>;
    start(): void;
    dispose(): void;
}

export interface IExtendedTaskDefinition extends vscode.TaskDefinition {
	task: string;
	file?: string;
}

export class TaskLoaderResult {
    private _workspaceName: string;
    private _loaderKey: string;
    private _tasks: vscode.Task[];
    private _icons?: {light: string, dark: string};

    constructor(workspaceName: string, loaderKey: string, tasks: vscode.Task[], icons?: {light: string, dark: string}) {
        this._workspaceName = workspaceName;
        this._loaderKey = loaderKey;
        this._tasks = tasks;
        this._icons = icons;
    }

    public static empty(): TaskLoaderResult {
        return new TaskLoaderResult("", "", []);
    }

    public get workspaceName(): string {
        return this._workspaceName;
    }

    public get icons(): {light: string, dark: string} | undefined {
        return this._icons;
    }

    public get loaderKey() {
        return this._loaderKey;
    }

    public get tasks() {
        return this._tasks;
    }

    public isEmpty(): boolean {
        return this._workspaceName === "" || this._loaderKey === "";
    }
}

export abstract class TaskLoader implements ITaskLoader {
    private _fileWatcher: vscode.FileSystemWatcher | undefined;
    private _promise: Thenable<TaskLoaderResult[]> | undefined;
    private _workspaceFolder: vscode.WorkspaceFolder;
    private _key: string;
    
    private BUILD_NAMES: string[] = ['build', 'compile', 'watch'];
    private TEST_NAMES: string[] = ['test'];
    
    constructor(key: string, workspaceFolder: vscode.WorkspaceFolder) {
        this._key = key;
        this._workspaceFolder = workspaceFolder;
    }

    private createFileWatcher(): vscode.FileSystemWatcher {
        if (this._fileWatcher) {
            this.dispose();
        }
        let pattern = this.getFilePattern(this._workspaceFolder.uri.fsPath);
		return vscode.workspace.createFileSystemWatcher(pattern);
    }

    private async resolveTasksInternal(): Promise<TaskLoaderResult[]> {
		const rootPath: string | undefined = this.getRootPath;
		let emptyTasks: TaskLoaderResult = TaskLoaderResult.empty();
		if (!rootPath) {
            this.outputInfo(localize('task-panel.taskloader.rootPathIsNotSet', 'The Root path is not set.'));
			return [emptyTasks];
        }
        if (!await this.isTaskFileExists(rootPath)) {
            this.outputInfo(localize('task-panel.taskloader.taskFileIsNotFound', format('The {0} task definition file is not found.', this.key)));
			return [emptyTasks];
        }
        return this.resolveTasks();
    }

    public async getTasks(reload: boolean = false): Promise<TaskLoaderResult[]> {
        if (!this._promise || reload) {
			this._promise = this.resolveTasksInternal();
		}
		return this._promise;
    }
        
    public start(): void {
		this._fileWatcher = this.createFileWatcher();
		this._fileWatcher.onDidChange(() => this._promise = undefined);
		this._fileWatcher.onDidCreate(() => this._promise = undefined);
		this._fileWatcher.onDidDelete(() => this._promise = undefined);
    }

    protected isBuildTask(name: string): boolean {
        for (let buildName of this.BUILD_NAMES) {
            if (name.indexOf(buildName) !== -1) {
                return true;
            }
        }
        return false;
    }
    
    protected isTestTask(name: string): boolean {
        for (let testName of this.TEST_NAMES) {
            if (name.indexOf(testName) !== -1) {
                return true;
            }
        }
        return false;
    }

    public dispose(): void {
		this._promise = undefined;
		if (this._fileWatcher) {
			this._fileWatcher.dispose();
		}
    }

    protected sortTasksAsc(tasks: vscode.Task[]) {
        return tasks.sort((a: vscode.Task, b: vscode.Task) => {
            return a.name < b.name ? -1 : 1;
        });
    }

    protected format(message: string, ...args: any[]): string {        
        return format(message, ...args);
    }

    protected exists(file: string): Promise<boolean> {
        return new Promise<boolean>((resolve, _reject) => {
            fs.exists(file, (value) => {
                resolve(value);
            });
        });
    }

    protected exec(command: string, options: cp.ExecOptions): Promise<{ stdout: string; stderr: string }> {
        return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
            cp.exec(command, options, (error, stdout, stderr) => {
                if (error) {
                    reject({ error, stdout, stderr });
                    return;
                }
                resolve({ stdout, stderr });
            });
        });
    }

    protected outputInfo(message: string): void {
        output(this.format(`[Info] ({0}: {1}) {2}`, this.getWorkspaceFolder.name, this._key, message));
    }

    protected outputError(message: string): void {
        output(this.format(`[Error] ({0}: {1}) {2}`, this.getWorkspaceFolder.name, this._key, message));
    }

    protected showErrorInChannel(error: any): void {
        let channel = getOrCreateOutputChannel();
        if (error.stderr) {
            channel.appendLine(error.stderr);
        }
        if (error.stdout) {
            channel.appendLine(error.stdout);
        }
        if (typeof error === "string") {
            channel.appendLine(error);
        }
        channel.appendLine(this.format('Task load for folder {0} failed with error: {1}', this.getWorkspaceFolder.name, error.error ? error.error.toString() : 'unknown'));
        channel.show(true);
    }
    
    protected setTaskGroup(name: string, task: vscode.Task) {
        let lowerCaseTaskName = name.toLowerCase();
        if (this.isBuildTask(lowerCaseTaskName)) {
            task.group = vscode.TaskGroup.Build;
        } else if (this.isTestTask(lowerCaseTaskName)) {
            task.group = vscode.TaskGroup.Test;
        }
    }

    protected getTaskIcons(iconFileName: string): {light: string, dark: string} {
        return {
            light: getIconPath(IconTheme.Light, iconFileName),
            dark: getIconPath(IconTheme.Dark, iconFileName)
        };
    }

    protected get getRootPath(): string | undefined {
        return this._workspaceFolder.uri.scheme === 'file' ? this._workspaceFolder.uri.fsPath : undefined;
    }

    protected get getWorkspaceFolder(): vscode.WorkspaceFolder {
        return this._workspaceFolder;
    }

    public get key(): string {
        return this._key;
    }

    protected abstract async isTaskFileExists(rootPath: string): Promise<boolean>;
    protected abstract getFilePattern(workspacePath: string): string;
    protected abstract async getCommand(rootPath: string | undefined): Promise<string | undefined>;
    protected abstract async resolveTasks(): Promise<TaskLoaderResult[]>;
}