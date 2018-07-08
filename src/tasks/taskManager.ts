"use strict";
import { TaskPanelItem, TaskPanelRootItem } from './core/taskPanelItem';
import { TaskPanelProvider } from './taskPanelProvider';
import { TaskRunner, TaskState } from './core/taskRuner';
import { ITaskLoader, TaskLoaderResult } from './core/taskLoader';
import { output } from './core/utils';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';

const localize = nls.loadMessageBundle();

function resolveTasks(taskLoaders: Map<string, ITaskLoader>, reload: boolean = false): Promise<TaskLoaderResult[]> {
    if (taskLoaders.size === 0) {
        return Promise.resolve([]);
    } else if (taskLoaders.size === 1) {
        return Promise.resolve(taskLoaders.values().next().value.getTasks(reload));
    } else {
        let promises: Promise<TaskLoaderResult[]>[] = [];
        for (let loader of taskLoaders.values()) {
            promises.push(loader.getTasks(reload).then((value) => value, () => []));
        }
        return Promise.all(promises).then((values) => {
            let result: TaskLoaderResult[] = [];
            for (let tasks of values) {
                if (tasks && tasks.length > 0) {
                    result.push(...tasks);
                }
            }
            return result;
        });
    }
}

class TaskDetector implements ITaskLoader {
    private _taskLoaders: Map<string, ITaskLoader>;

    constructor(taskLoaders: Map<string, ITaskLoader>) {
        this._taskLoaders = taskLoaders;
    }

    public start(): void {
        for(let item of this._taskLoaders.values()) {
            item.start();
        }
    }

    public getTasks(reload: boolean = false): Promise<TaskLoaderResult[]> {
        return this.resolveTasks(reload);
    }

    private resolveTasks(reload: boolean): Promise<TaskLoaderResult[]> {
        return resolveTasks(this._taskLoaders, reload);
    }

    public dispose(): void {
        this._taskLoaders.forEach((item) => {
            item.dispose();
        });
        this._taskLoaders.clear();
    }
}

export class TaskManager {
    private _detectors: Map<string, ITaskLoader> = new Map();
    private _loaders: Map<string, Function> = new Map();
    private _taskRunner: TaskRunner;
    private _taskPanelProvider: TaskPanelProvider;
    private _selectedTaskItem: TaskPanelItem | undefined;

    constructor(private _context: vscode.ExtensionContext) {
        this._taskPanelProvider = new TaskPanelProvider();
        this._taskRunner = new TaskRunner();
        this.registerTaskRunnerEvents();
        this.registerTreeProvider();
    }

    private registerTaskRunnerEvents(): void {
        this._taskRunner.onDidTaskStateChanged((e: {task: TaskPanelItem, state: TaskState} | null) => {
            if (e && e.state === TaskState.TaskRun) {
                e.task.running(true);
            } else if (e) {
                e.task.running(false);
            }
            this._taskPanelProvider.updateState();
		});
    }

    private registerTreeProvider() {
        this._context.subscriptions.push(vscode.window.registerTreeDataProvider('bitlab-vscode.taskpanel', this._taskPanelProvider));
    }

    public registerTaskLoader(key: string, loader: Function) {
        this._loaders.set(key, loader);
    }

    private create(ctor: {new(...args: any[]): Function}, ...args: any[]): any {
        let obj = new ctor(...args);
        return obj;
    }

    private createTaskLoaders(workspaceFolder: vscode.WorkspaceFolder): Map<string, ITaskLoader> {
        let loaders: Map<string, ITaskLoader> = new Map<string, ITaskLoader>();
        for(let forCreate of this._loaders.values()) {
            let instance = this.create.apply(null, [forCreate, workspaceFolder]);
            loaders.set(instance.key, instance);
        }
        return loaders;
    }

    private update(reload: boolean = false): void {
        output(localize("task-panel.taskManager.discoveringTaskFile", "Discovering task file ..."));
		if (this._detectors.size > 0) {
			resolveTasks(this._detectors, reload).then((value: TaskLoaderResult[]) => {
                this._taskPanelProvider.refresh(value);
            })
            .catch((reason: any) => {
                this._taskPanelProvider.refresh([]);
                console.log(reason);
            });
		}
		else if (this._detectors.size === 0) {
            output(localize("task-panel.taskManager.taskFileNotFound", "Task file is not found."), "warning");
            this._taskPanelProvider.refresh([]);
		}
    }

    private updateWorkspaceFolders(added: vscode.WorkspaceFolder[], removed: vscode.WorkspaceFolder[]): void {
		for (let remove of removed) {
			let detector = this._detectors.get(remove.uri.toString());
			if (detector) {
				detector.dispose();
				this._detectors.delete(remove.uri.toString());
			}
		}
		for (let add of added) {
			let detector = new TaskDetector(this.createTaskLoaders(add));
            this._detectors.set(add.uri.toString(), detector);
            detector.start();
		}
		this.update();
    }

    public start(): void {
		let folders = vscode.workspace.workspaceFolders;
		if (folders) {
			this.updateWorkspaceFolders(folders, []);
		}
		vscode.workspace.onDidChangeWorkspaceFolders((event) => this.updateWorkspaceFolders(event.added, event.removed));
    }

    private selectCurrentTask(): void {
        if (this._selectedTaskItem) {
            this._selectedTaskItem.selected(true);
        }
    }

    private showErrorTaskNotSelected() {
        vscode.window.showErrorMessage(localize("task-panel.taskManager.taskNotSelected", "Task is not selected!"));
    }

    private runOnSelectedTask(taskItem: TaskPanelItem | TaskPanelRootItem | undefined, callback: (task: TaskPanelItem) => void) {
        if (taskItem !== undefined && taskItem instanceof TaskPanelItem) {
            callback(taskItem);
        } else if (this._selectedTaskItem !== undefined) {
            callback(this._selectedTaskItem);
        } else {
            this.showErrorTaskNotSelected();
        }
    }

    private runSelectedTask(): void {
        if (this._selectedTaskItem) {
            this.selectCurrentTask();
            this._taskRunner.execute(this._selectedTaskItem);
            this._taskPanelProvider.updateState(); 
        } else {
            this.showErrorTaskNotSelected();
        }
    }

    public executeTask(taskItem: TaskPanelItem | TaskPanelRootItem | undefined): void {
        if (taskItem !== undefined && taskItem instanceof TaskPanelItem) {
            this.cleanSelection();
            this._selectedTaskItem = taskItem;
            this.runSelectedTask();
        } else if (this._selectedTaskItem !== undefined) {
            this.runSelectedTask();
        } else {
            this._selectedTaskItem = undefined;
            this.showErrorTaskNotSelected();
        }
        this._taskPanelProvider.updateState();        
    }

    public terminateTask(taskItem: TaskPanelItem | TaskPanelRootItem | undefined): void {
        this.runOnSelectedTask(taskItem, (task: TaskPanelItem) => {
            this._taskRunner.terminateProcess(task);
        });
    }

    public restartTask(taskItem: TaskPanelItem | TaskPanelRootItem | undefined): void {
        this.runOnSelectedTask(taskItem, (task: TaskPanelItem) => {
            this._taskRunner.restartProcess(task);
        });
    }

    private deselectCurrentTask(): void {
        if (this._selectedTaskItem) {
            this._selectedTaskItem.selected(false);
        }
    }

    private cleanSelection() {
        this.deselectCurrentTask();
        this._selectedTaskItem = undefined;
    }

    public selectTask(taskItem: TaskPanelItem | TaskPanelRootItem) {
        if (taskItem instanceof TaskPanelItem) {
            this.deselectCurrentTask();
            this._selectedTaskItem = taskItem;
            taskItem.selected(true);
        } else {
            this.cleanSelection();
        }
        this._taskPanelProvider.updateState();        
    }

    public refresh() {
        this.cleanSelection();
        this._taskRunner.reset();
        this._taskPanelProvider.clean();
        this.update(true);
    }

    public dispose(): void {
        this.cleanSelection();
        this._taskRunner.reset();
        this._taskPanelProvider.clean();
        this._detectors.clear();
    }
}