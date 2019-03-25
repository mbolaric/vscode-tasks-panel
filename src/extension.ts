'use strict';
import * as nls from 'vscode-nls';
const localize = nls.config(process.env.VSCODE_NLS_CONFIG as nls.Options | undefined)();

import * as vscode from 'vscode';
import { TaskExtension } from './tasks/taskExtension';

let taskExtension: TaskExtension | undefined;

export function activate(context: vscode.ExtensionContext) {
    try {        
        taskExtension = new TaskExtension(context);
        taskExtension.start();
    } catch (error) {
        vscode.window.showErrorMessage(localize('task-panel.extension.cannotActivateExtension', 'Cannot activate task-panel Extension!'));
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