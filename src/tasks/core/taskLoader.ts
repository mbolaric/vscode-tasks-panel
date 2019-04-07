"use strict";
import * as fs from 'fs';
import * as cp from 'child_process';
import * as path from 'path';
import { TasksPanelConfiguration } from './configuration';
import { getOrCreateOutputChannel, output, format, IconTheme, getIconPath } from './utils';
import { TreeCollapsibleState, TaskSearchConditionFlags } from './configuration';
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

export interface ITaskFolderInfo {
    folderPath: string;
    displayName: string;
    isRoot: boolean;
}

export class TaskLoaderResult {
    private _workspaceName: string;
    private _loaderKey: string;
    private _tasks: vscode.Task[];
    private _icons?: {light: string, dark: string};
    private _treeCollapsibleState: TreeCollapsibleState;

    constructor(workspaceName: string, loaderKey: string, tasks: vscode.Task[], icons?: {light: string, dark: string}, treeCollapsibleState: TreeCollapsibleState = TreeCollapsibleState.Expanded) {
        this._workspaceName = workspaceName;
        this._loaderKey = loaderKey;
        this._tasks = tasks;
        this._icons = icons;
        this._treeCollapsibleState = treeCollapsibleState;
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

    public get initialTreeCollapsibleState(): TreeCollapsibleState {
        return this._treeCollapsibleState;
    }

    public isEmpty(): boolean {
        return this._workspaceName === "" || this._loaderKey === "";
    }
}

export abstract class TaskLoader implements ITaskLoader {
    private _fileWatchers: vscode.FileSystemWatcher[] | undefined;
    private _promise: Thenable<TaskLoaderResult[]> | undefined;
    private _workspaceFolder: vscode.WorkspaceFolder;
    private _key: string;
    private _initialTreeState: TreeCollapsibleState;
    private _searchRootPaths?: ITaskFolderInfo[];
    
    private BUILD_NAMES: string[] = ['build', 'compile', 'watch'];
    private TEST_NAMES: string[] = ['test'];
    
    constructor(key: string, workspaceFolder: vscode.WorkspaceFolder, private _configuration: TasksPanelConfiguration) {
        this._key = key;
        this._workspaceFolder = workspaceFolder;
        this._initialTreeState = TreeCollapsibleState.Expanded;
    }

    private getInitialTreeState(folder: vscode.WorkspaceFolder): TreeCollapsibleState {
        return this._configuration.get(TasksPanelConfiguration.TREE_COLLAPSIBLE_STATE) as TreeCollapsibleState;
    }

    private createFileWatchers(): vscode.FileSystemWatcher[] {
        if (this._fileWatchers) {
            this.dispose();
        }
        let watchers: vscode.FileSystemWatcher[] = [];
        let folders: ITaskFolderInfo[] = this.getSearchRootPaths;
        folders.forEach((path) => {
            watchers.push(vscode.workspace.createFileSystemWatcher(this.getFilePattern(path.folderPath)));
        });

        return watchers;
    }

    private async filterExistingTaskFiles(): Promise<ITaskFolderInfo[]> {
        let allTaskFolderInfos: ITaskFolderInfo[] = this.getSearchRootPaths;
        let foundWithFiles: ITaskFolderInfo[] = [];
        for (let index = 0; index < allTaskFolderInfos.length; index++) {
            if (await this.isTaskFileExists(allTaskFolderInfos[index].folderPath)) {
                foundWithFiles.push(allTaskFolderInfos[index]);
            }
        }
        return foundWithFiles;
    }

    private async resolveTasks(foundTaskInfos: ITaskFolderInfo[]): Promise<TaskLoaderResult[]> {
        let empty: TaskLoaderResult = TaskLoaderResult.empty();
        let results: TaskLoaderResult[] = [];
        if (foundTaskInfos.length > 0) {
            for (let index = 0; index < foundTaskInfos.length; index++) {
                let resolvedResult = await this.resolveByPath(foundTaskInfos[index]);
                if (resolvedResult !== undefined) {
                    results.push(resolvedResult);
                }                
            }
            return results;
        }
        results.push(empty);
        return results;
    }

    private async resolveTasksInternal(): Promise<TaskLoaderResult[]> {
		const rootPath: string | undefined = this.getRootPath;
		let emptyTasks: TaskLoaderResult = TaskLoaderResult.empty();
		if (!rootPath) {
            this.outputInfo(localize('task-panel.taskloader.rootPathIsNotSet', 'The Root path is not set.'));
			return [emptyTasks];
        }
        let foundTaskInfoWithFiles: ITaskFolderInfo[] = await this.filterExistingTaskFiles();
        if (foundTaskInfoWithFiles.length === 0) {
            this.outputInfo(localize('task-panel.taskloader.taskFileIsNotFound', format('The {0} task definition file is not found.', this.key)));
			return [emptyTasks];
        }
        return this.resolveTasks(foundTaskInfoWithFiles);
    }

    private async addTaskFolderInfo(coll: ITaskFolderInfo[], folderPath: string, displayName: string, isRoot: boolean) {
        coll.push({
            folderPath: folderPath,
            displayName: displayName,
            isRoot: isRoot
        });
    }

    private prepareTaskFolderInfos(): ITaskFolderInfo[] {
        let paths: ITaskFolderInfo[] = [];
        if (this.getRootPath !== undefined) {
            let root: string = this.getRootPath;
            let condition: TaskSearchConditionFlags = this._configuration.get(TasksPanelConfiguration.SEARCH_CONDITION) as TaskSearchConditionFlags;
            if (condition === TaskSearchConditionFlags.RootFolder || condition === TaskSearchConditionFlags.RootAndSubFolders) {
                try {
                    this.addTaskFolderInfo(paths, root, this._workspaceFolder.name, true);
                } catch (error) {
                    this.showErrorInChannel(error);
                }
            }
            
            if (condition === TaskSearchConditionFlags.RootAndSubFolders || condition === TaskSearchConditionFlags.SubFolders) {
                let subFolders: string[] | null = this._configuration.get(TasksPanelConfiguration.SEARCH_SUB_FOLDERS_PATH) as string[];
                if (subFolders !== null) {
                    subFolders.forEach((folder) => {
                        try {
                            this.addTaskFolderInfo(paths, path.join(root, folder), this.format("{0} [{1}]", this._workspaceFolder.name, folder), false);
                        } catch (error) {
                            this.showErrorInChannel(error);
                        }
                    });
                }
            }
        }
        return paths;
    }

    protected get getSearchRootPaths(): ITaskFolderInfo[] {
        if (this._searchRootPaths === undefined) {
            this._searchRootPaths = this.prepareTaskFolderInfos();
        }
        return this._searchRootPaths;
    }

    public async getTasks(reload: boolean = false): Promise<TaskLoaderResult[]> {
        if (!this._promise || reload) {
            this._initialTreeState = this.getInitialTreeState(this._workspaceFolder);
			this._promise = this.resolveTasksInternal();
		}
		return this._promise;
    }
        
    public start(): void {
        this._fileWatchers = this.createFileWatchers();
        this._fileWatchers.forEach((watcher) => {
            watcher.onDidChange(() => {this._promise = undefined; this._searchRootPaths = undefined;});
            watcher.onDidCreate(() => {this._promise = undefined; this._searchRootPaths = undefined;});
            watcher.onDidDelete(() => {this._promise = undefined; this._searchRootPaths = undefined;});
        });
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
        this._searchRootPaths = undefined;
		if (this._fileWatchers) {
            this._fileWatchers.forEach((watcher) => {
                watcher.dispose();
            });
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

    protected getOutputDisplayName(taskFolderInfo?: ITaskFolderInfo) {
        if (taskFolderInfo) {
            return taskFolderInfo.displayName;
        }
        return this.getWorkspaceFolder.name;
    }

    protected outputInfo(message: string, taskFolderInfo?: ITaskFolderInfo): void {
        output(this.format(`[Info] ({0}: {1}) {2}`, this.getOutputDisplayName(taskFolderInfo), this._key, message));
    }

    protected outputError(message: string, taskFolderInfo?: ITaskFolderInfo): void {
        output(this.format(`[Error] ({0}: {1}) {2}`, this.getOutputDisplayName(taskFolderInfo), this._key, message));
    }

    protected showErrorInChannel(error: any): void {
        let channel = getOrCreateOutputChannel();
        if (error.stderr) {
            channel.appendLine(error.stderr);
        }
        if (error.stdout) {
            channel.appendLine(error.stdout);
        }
        if (typeof error === "object" && error instanceof Array) {
            error.forEach((line: string) => {
                channel.appendLine(line);
            });
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

    public get initialTreeCollapsibleState(): TreeCollapsibleState {
        return this._initialTreeState;
    }

    public get configuration(): TasksPanelConfiguration {
        return this._configuration;
    }

    protected abstract async isTaskFileExists(rootPath: string): Promise<boolean>;
    protected abstract getFilePattern(workspacePath: string): string;
    protected abstract async getCommand(rootPath: string | undefined, folderPath: string): Promise<string | undefined>;
    protected abstract async resolveByPath(taskFolderInfo: ITaskFolderInfo): Promise<TaskLoaderResult | undefined>;
}