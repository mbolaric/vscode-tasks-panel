'use strict';
import * as vscode from 'vscode';
import { TaskExtension } from './tasks/taskExtension';

let taskExtension: TaskExtension | undefined;

export function activate(context: vscode.ExtensionContext) {

    console.log('Congratulations, your extension "task-panel" is now active!');
    try {
        taskExtension = new TaskExtension(context);
        taskExtension.start();
    } catch (error) {
        vscode.window.showErrorMessage('Cannot activate task-panel Extension!');
    }
}

// this method is called when your extension is deactivated
export function deactivate() {
    if (taskExtension) {
        taskExtension.dispose();
        taskExtension = undefined;
    }
}


// "when": "config.bitlab.task-panel.showPanel == true"