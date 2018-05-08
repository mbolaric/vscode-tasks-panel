"use strict";
import { TaskPanelItemBase, TaskPanelRootItem, TaskPanelItem } from './core/taskPanelItem';
import { TaskLoaderResult } from './core/taskLoader';
import * as vscode from 'vscode';

export class TaskPanelProvider implements vscode.TreeDataProvider<TaskPanelItemBase> {
    private _onDidChangeTreeData: vscode.EventEmitter<TaskPanelItemBase | null> = new vscode.EventEmitter<TaskPanelItemBase | null>();
	readonly onDidChangeTreeData: vscode.Event<TaskPanelItemBase | null> = this._onDidChangeTreeData.event;

    private _tasks: TaskLoaderResult[] = [];
    private _initialized = false;
    private _rootTreeList: TaskPanelRootItem[] = [];

    public getTreeItem(element: TaskPanelItemBase): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element;
    }

    public getChildren(element?: TaskPanelItemBase | undefined): vscode.ProviderResult<TaskPanelItemBase[]> {
        let list: TaskPanelItemBase[] = [];
        if (this._rootTreeList.length > 0) {
            if (!element) {
                return Promise.resolve(this._rootTreeList);
            }
            return Promise.resolve((<TaskPanelRootItem>element).getChildren());
        }
        if (this._tasks.length === 0) {
            if (this._initialized) {
                vscode.window.showInformationMessage('Tasks are not found.');
            }
			return Promise.resolve(list);
        }
        return new Promise(resolve => {
            this._tasks.forEach((resultItem: TaskLoaderResult) => {
                if (!resultItem.isEmpty()) {
                    let root = new TaskPanelRootItem(resultItem.workspaceName + ": " + resultItem.loaderKey, resultItem.icons);
                    this._rootTreeList.push(root);                
                    resultItem.tasks.forEach((item: vscode.Task) => {
                        root.addChild(new TaskPanelItem(item.name, item));
                    });                
                }
            });
            resolve(this._rootTreeList);
        });
    }

    public updateState(): void {
        this._onDidChangeTreeData.fire();
    }

    public clean() {
        this._rootTreeList = [];
        this._tasks = [];
        this._initialized = false;
        this._onDidChangeTreeData.fire();
    }

    public refresh(tasks: TaskLoaderResult[]): void {
        this._rootTreeList = [];
        this._tasks = tasks;
        this._initialized = true;
        this._onDidChangeTreeData.fire();
    }
}