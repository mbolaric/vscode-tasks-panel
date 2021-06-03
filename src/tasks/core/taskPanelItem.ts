"use strict";
import { newGuid, IconTheme, getIconPath } from './utils';
import { TreeCollapsibleState } from './configuration';
import * as vscode from 'vscode';

let itemIcons = {
    defaultIcon: {
        light: getIconPath(IconTheme.Light, 'bullet'),
        dark: getIconPath(IconTheme.Dark, 'bullet')
    },
    selectedIcon: {
        light: getIconPath(IconTheme.Light, 'bullet_selected'),
        dark: getIconPath(IconTheme.Dark, 'bullet_selected')
    },
    runningIcon: {
        light: getIconPath(IconTheme.Light, 'bullet_running'),
        dark: getIconPath(IconTheme.Dark, 'bullet_running')
    }
};

export abstract class TaskPanelItemBase extends vscode.TreeItem {
    private _isFolderNode = false;

    constructor(name: string, isFolderNode: boolean, command?: vscode.Command) {
        super(name);
        this._isFolderNode = isFolderNode;
        this.command = command;
        this.id = newGuid();
        this.tooltip = this.label ? this.label.toString() : "";
    }

    public get isFolderNode() {
        return this._isFolderNode;
    }
}

export class TaskPanelRootItem extends TaskPanelItemBase {
    private _children: TaskPanelItemBase[] = [];

    constructor(name: string, initialTreeState: TreeCollapsibleState, icons?: {light: string, dark: string}) {
        super(name, true);
        this.contextValue = "root";
        this.collapsibleState = initialTreeState === TreeCollapsibleState.Expanded 
            ? vscode.TreeItemCollapsibleState.Expanded 
            : vscode.TreeItemCollapsibleState.Collapsed;
        this.iconPath = icons;
    }

    public addChild(child: TaskPanelItemBase) {
        this._children.push(child);
    }

    public getChildren(): TaskPanelItemBase[] {
        return this._children;
    }
}

export class TaskPanelItem extends TaskPanelItemBase {
    private _task?: vscode.Task;
    private _defaultIcon: {light: string, dark: string};
    private _isSelected = false;
    private _isRunning = false;

    constructor(name: string, task: vscode.Task, command?: vscode.Command) {
        super(name, !task);
        this.command = TaskPanelItem.getOnSelectCommand(this);
        this.contextValue = "item";
        this._task = task;
        this._defaultIcon = itemIcons.defaultIcon;
        this.iconPath = this._defaultIcon;
        this.tooltip = this._task ? `${this._task.source}: ${this._task.name}` : super.tooltip;
    }

    private static getOnSelectCommand(taskItem: TaskPanelItem): vscode.Command {
        return {
            title: 'Select Node',
            command: 'bitlab-vscode.taskpanel.onNodeSelect',
            arguments: [taskItem]
        };
    }

    public selected(selected: boolean) {
        this._isSelected = selected;
        if (!this._isRunning) {
            if (this._isSelected) {
                this.iconPath = itemIcons.selectedIcon;
            } else {
                this.iconPath = this._defaultIcon;            
            }
        }
    }

    public running(running: boolean) {
        this._isRunning = running;
        if (this._isRunning) {
            this.iconPath = itemIcons.runningIcon;
        } else if (this._isSelected) {
            this.iconPath = itemIcons.selectedIcon;            
        } else {
            this.iconPath = this._defaultIcon;            
        }
    }

    public get isRunning() {
        return this._isRunning;
    }
    
    public get task(): vscode.Task | undefined {
        return this._task;
    }
}