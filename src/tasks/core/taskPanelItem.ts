"use strict";
import { newGuid, IconTheme, getIconPath } from './utils';
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
    private _id: string;

    constructor(name: string, isFolderNode: boolean, command?: vscode.Command) {
        super(name);
        this._isFolderNode = isFolderNode;
        this.command = command;
        this._id = newGuid();
    }

    public get id(): string {
        return this._id;
    }

    public get tooltip(): string {
		return this.label ? this.label : "";
    }

    public get isFolderNode() {
        return this._isFolderNode;
    }
}

export class TaskPanelRootItem extends TaskPanelItemBase {
    private _children: TaskPanelItemBase[] = [];

    constructor(name: string, icons?: {light: string, dark: string}) {
        super(name, true);
        this.contextValue = "root";
        this.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
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

    public get tooltip(): string {
		return this._task ? `${this._task.source}: ${this._task.name}` : super.tooltip;
    }
    
    public get task(): vscode.Task | undefined {
        return this._task;
    }
}