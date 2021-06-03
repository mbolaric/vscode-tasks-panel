"use strict";
import { TasksPanelConfiguration } from './core/configuration';
import { TaskPanelItem, TaskPanelRootItem } from './core/taskPanelItem';
import { GruntTaskLoader } from './gruntTaskLoader';
import { GulpTaskLoader } from './gulpTaskLoader';
import { TaskManager } from './taskManager';
import * as vscode from 'vscode';

export class DoubleClick {
    private _doubleClickTimeout: number;
    private _clickCount = 0;
    private _currentSelectedId: string | null = null;
    private _doubleClickResetTimerId: any;
    
    constructor(doubleClickTimeout: number) {
        this._doubleClickTimeout = doubleClickTimeout;
    }

    private clearCountValues(): void {
        this._currentSelectedId = null;
        this._clickCount = 0;
    }

    private reInitCounting(id: string) {
        clearTimeout(this._doubleClickResetTimerId);
        this._currentSelectedId = id;
        this._clickCount = 1;
        this._doubleClickResetTimerId = setTimeout(() => {
            this.clearCountValues();
        }, this._doubleClickTimeout);
    }

    public isDoubleClick(id: string): boolean {
        let doubleClick: boolean = false;
        if (this._currentSelectedId !== id) {
            this.reInitCounting(id);
            return doubleClick;
        } else {
            this._clickCount++;
        }
        doubleClick = this._clickCount >= 2;
        if (doubleClick) {
            clearTimeout(this._doubleClickResetTimerId);
            this.clearCountValues();
        }
        return doubleClick;
    }
}

export class TaskExtension {
    private _taskManager: TaskManager;
    private _doubleClickChecker: DoubleClick;
    private _taskPanelConfiguration: TasksPanelConfiguration;
    
    constructor(private _context: vscode.ExtensionContext) {
        this._doubleClickChecker = new DoubleClick(500);
        this.registerCommands();
        this._taskPanelConfiguration = new TasksPanelConfiguration();
        this._taskManager = new TaskManager(this._context, this._taskPanelConfiguration);
        this.registerTasks();
    }

    private registerTasks(): void {
        if (this._taskPanelConfiguration.get(TasksPanelConfiguration.SEARCH_GRUNT_TASKS)) {
            this._taskManager.registerTaskLoader("grunt", GruntTaskLoader);
        }
        if (this._taskPanelConfiguration.get(TasksPanelConfiguration.SEARCH_GULP_TASKS)) {
            this._taskManager.registerTaskLoader("gulp", GulpTaskLoader);
        }
    }

    private addForDispose(disposable: vscode.Disposable) {
        this._context.subscriptions.push(disposable);   
    }

    private registerCommands(): void {
        this.addForDispose(vscode.commands.registerCommand('bitlab-vscode.taskpanel.refresh', () => {
            this.refresh();
        }));
        this.addForDispose(vscode.commands.registerCommand('bitlab-vscode.taskpanel.execute', (taskItem: TaskPanelItem | TaskPanelRootItem) => {
            this.execute(taskItem);
        }));
        this.addForDispose(vscode.commands.registerCommand('bitlab-vscode.taskpanel.terminate', (taskItem: TaskPanelItem | TaskPanelRootItem) => {
            this.terminate(taskItem);
        }));
        this.addForDispose(vscode.commands.registerCommand('bitlab-vscode.taskpanel.restart', (taskItem: TaskPanelItem | TaskPanelRootItem) => {
            this.restart(taskItem);
        }));
        this.addForDispose(vscode.commands.registerCommand('bitlab-vscode.taskpanel.onNodeSelect', (taskItem: TaskPanelItem | TaskPanelRootItem) => {
            if (this._doubleClickChecker.isDoubleClick(taskItem.id!)) {
                this.execute(taskItem);
            } else {
                this.onNodeSelect(taskItem);
            }
        }));
    }

    private onNodeSelect(taskItem: TaskPanelItem | TaskPanelRootItem): void {
        this._taskManager.selectTask(taskItem);
     }

    public start(): void {
        this._taskManager.start();
    }

    private reStart(): void {
        this._taskManager.reStart(() => {
            this.registerTasks();
        });
    }

    private execute(taskItem: TaskPanelItem | TaskPanelRootItem): void {
        this._taskManager.executeTask(taskItem);
    }

    private terminate(taskItem: TaskPanelItem | TaskPanelRootItem): void {
        this._taskManager.terminateTask(taskItem);
    }
    
    private restart(taskItem: TaskPanelItem | TaskPanelRootItem): void {
        this._taskManager.restartTask(taskItem);
    }

    private refresh(): void {
        if (this._taskPanelConfiguration.isConfigChanged) {
            this.reStart();
        } else {
            this._taskManager.refresh();
        }
    }

    public dispose(): void {
       if (this._taskManager) {
           this._taskManager.dispose();
       }

       if (this._taskPanelConfiguration) {
            this._taskPanelConfiguration.dispose();
       }
    }
}