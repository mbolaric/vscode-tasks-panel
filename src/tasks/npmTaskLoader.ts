import { ITaskFolderInfo, IExtendedTaskDefinition, TaskLoader, TaskLoaderResult } from "./core/taskLoader";
import { TasksPanelConfiguration } from './core/configuration';
import { format } from './core/utils';
import * as path from 'path';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls'; 
import * as fs from 'fs';

const localize = nls.loadMessageBundle();

export class NpmTaskLoader extends TaskLoader {
    
    constructor(workspaceFolder: vscode.WorkspaceFolder, configuration: TasksPanelConfiguration) {
        super("npm", workspaceFolder, configuration);
    }

    protected getFilePattern(workspacePath: string): string {
        return path.join(workspacePath, '[Pp]ackage.json');
    }

    protected async isTaskFileExists(rootPath: string): Promise<boolean> {
		if (!await this.exists(path.join(rootPath, 'package.json')) && !await this.exists(path.join(rootPath, 'Package.json'))) {
			return Promise.resolve(false);
        }
        return Promise.resolve(true);
    }

    private extractTask(taskArray: vscode.Task[], command: string | undefined, line: string, cwd: string): void {
        let source = 'npm';
        let kind: IExtendedTaskDefinition = {
            type: source,
            task: line
        };
        let options: vscode.ShellExecutionOptions = { cwd: cwd, executable: `${command}`, shellArgs: ['run', `${line}`] };
        let task = new vscode.Task(kind, this.getWorkspaceFolder, line, source, new vscode.ShellExecution(`${command} ${line}`, options));
        taskArray.push(task);
        this.setTaskGroup(line, task);
    }

    protected async resolveByPath(taskFolderInfo: ITaskFolderInfo): Promise<TaskLoaderResult | undefined> {
        let command = await this.getCommand(this.getRootPath, taskFolderInfo.folderPath);
        let taskResultWorkspace: string = taskFolderInfo.displayName;
        const packageFilePath = path.join(taskFolderInfo.folderPath, "package.json");
        try {
            this.outputInfo(localize("task-panel.taskloader.startLoadingTasks", "Start loading tasks ..."), taskFolderInfo);
            const fileContent = await fs.readFileSync(packageFilePath, {encoding:'utf8'});
            const jsonContent = JSON.parse(fileContent);
            const scripts = jsonContent.scripts;
            let result: vscode.Task[] = [];
            if (scripts) {
                Object.keys(scripts).forEach((key) => {
                    this.extractTask(result, command, key, taskFolderInfo.folderPath);
                });
                result = this.sortTasksAsc(result);
            }
            this.outputInfo(localize("task-panel.taskloader.finishLoadingTasks", "Finish loading tasks."), taskFolderInfo);
            this.outputInfo(localize("task-panel.taskloader.loadedTasks", format("Loaded {0} tasks.", result.length)), taskFolderInfo);
            return Promise.resolve(new TaskLoaderResult(taskResultWorkspace, this.key, result, this.getTaskIcons("npm"), this.initialTreeCollapsibleState));
        } catch (error) {
            this.showErrorInChannel(error);
        } 
        return Promise.resolve(undefined);
    }

    private async isPnpm(rootPath: string) {
        if (await this.exists(path.join(rootPath, 'pnpm-lock.yaml'))) {
            return true;
        }
        if (await this.exists(path.join(rootPath, 'shrinkwrap.yaml'))) {
            return true;
        }
    
        return false;
    }
    
    private async isYarn(rootPath: string) {
        if (await this.exists(path.join(rootPath, 'yarn.lock'))) {
            return true;
        }
    
        return false;
    }

    protected async getCommand(rootPath: string | undefined, folderPath: string): Promise<string | undefined> {
        let command: string = 'npm';
        
        if (!rootPath) {
            return command;
        }

        if (await this.isYarn(rootPath)) {
            command = 'yarn';
        }
    
        if (await this.isPnpm(rootPath)) {
            command = 'pnpm';
        }
    
        return Promise.resolve(command);
    }
}