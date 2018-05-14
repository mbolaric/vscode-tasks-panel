'use strict';
import * as vscode from 'vscode';
import * as assert from 'assert';

suite("Extension Tests", function () {
    let extension: vscode.Extension<any> | undefined;
    suiteSetup(async function() { 
        extension = vscode.extensions.getExtension("BitLaboratory.task-panel"); 
        if (extension && !extension.isActive) { 
            await extension.activate(); 
        }
    });
    test("The Extension is activate", function() {
        assert.equal((extension && extension.isActive), true);
    });
});