'use strict';
import * as vscode from 'vscode';
import * as assert from 'assert';
import { TasksPanelConfiguration } from '../../../tasks/core/configuration';
import { TaskLoaderResult, TaskLoader, IExtendedTaskDefinition } from "../../../tasks/core/taskLoader";
import { TasksPanelConfigurationMock } from "../../mocks/core/configuration.mock";

let folder: vscode.WorkspaceFolder = {
    uri: vscode.Uri.file("TEST_FILE"),
    name: "",
    index: 1
};

let configuration: TasksPanelConfiguration = new TasksPanelConfigurationMock();

class TaskLoaderMock extends TaskLoader {
    constructor(private _isTaskFileExists: boolean, folder: vscode.WorkspaceFolder, configuration: TasksPanelConfiguration) {
        super("test", folder, configuration);
    }

    protected async isTaskFileExists(rootPath: string): Promise<boolean> {
        return this._isTaskFileExists;
    }

    protected getFilePattern(workspacePath: string): string {
        return "PATTERN";
    }

    protected async getCommand(rootPath: string | undefined): Promise<string | undefined> {
        return "CMD";
    }

    protected async resolveTasks(): Promise<TaskLoaderResult[]> {
        let def: IExtendedTaskDefinition = {
            type: "source",
            task: "line"
        };
        return [new TaskLoaderResult("WORKSPACE", "KEY", [new vscode.Task(def, "NAME", "SOURCE", undefined)])];
    }
}

suite("TaskLoader Tests", () => {
    let sut: TaskLoader;
    suite("when getTask method is called", () => {
        suite("and task definition file exists", () => {
            suiteSetup(() => {
                sut = new TaskLoaderMock(true, folder, configuration);
            });
            test("the object is created", () => {
                assert(sut !== undefined);
            });
            test("the result data is returned and tasks are returned", (done) => {
                sut.getTasks().then((data) => {
                    assert(data.length > 0);
                    assert(data[0].tasks.length > 0);
                    done();
                });
            });      
        });
        suite("and task definition file not exists", () => {
            suiteSetup(() => {
                sut = new TaskLoaderMock(false, folder, configuration);
            });        
            test("the object is created", () => {
                assert(sut !== undefined);
            });
            test("the result data is returned without tasks", (done) => {
                sut.getTasks().then((data) => {
                    assert(data.length > 0);
                    assert(data[0].tasks.length === 0);
                    done();
                });
            });
        });
    });
});