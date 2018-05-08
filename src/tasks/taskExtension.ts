"use strict";
import { TaskPanelItem, TaskPanelRootItem } from './core/taskPanelItem';
import { GruntTaskLoader } from './gruntTaskLoader';
import { GulpTaskLoader } from './gulpTaskLoader';
import { TaskManager } from './taskManager';
import * as vscode from 'vscode';

export class TaskExtension {
    private _taskManager: TaskManager;
    
    constructor(private _context: vscode.ExtensionContext) {
        this.registerCommands();
        this._taskManager = new TaskManager(this._context);
        this.registerTasks();
    }
    
    private registerTasks(): void {
        this._taskManager.registerTaskLoader("grunt", GruntTaskLoader);
        this._taskManager.registerTaskLoader("gulp", GulpTaskLoader);
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
            this.onNodeSelect(taskItem);
        }));
    }

    private onNodeSelect(taskItem: TaskPanelItem | TaskPanelRootItem): void {
        this._taskManager.selectTask(taskItem);
     }

    public start(): void {
        this._taskManager.start();
    }

    private execute(taskItem: TaskPanelItem | TaskPanelRootItem): void {
        this._taskManager.executeTask(taskItem);
    }

    private terminate(taskItem: TaskPanelItem | TaskPanelRootItem): void {
        this._taskManager.terminateTask(taskItem);
    }
    
    private restart(taskItem: TaskPanelItem | TaskPanelRootItem): void {
        console.log(taskItem);
    }

    private refresh(): void {
       this._taskManager.refresh();
    }

    public dispose(): void {
       if (this._taskManager) {
           this._taskManager.dispose();
       }
    }
}