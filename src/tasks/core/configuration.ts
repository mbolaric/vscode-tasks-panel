'use strict';
import * as vscode from 'vscode';

export enum TreeCollapsibleState {
    Collapsed = 1,
    Expanded = 2
}

export type TreeCollapsState = 'expanded' | 'collapsed';

export enum TaskSearchConditionFlags {
    RootFolder = 1,
    SubFolders = 2,
    RootAndSubFolders = 3
}

export type TaskSearchConditions = 'RootFolder' | 'SubFolders' | 'RootAndSubFolders';

export interface ITasksPanelConfiguration {
    treeCollapsibleState: TreeCollapsibleState;
    searchGruntTasks: boolean;
    searchGulpTasks: boolean;
    searchCondition: TaskSearchConditionFlags;
    searchSubFolders: Array<String> | null;
}

export type TasksPanelConfigurationTypes = boolean | String[] | TreeCollapsibleState | TaskSearchConditionFlags | String[] | null;
type TasksPanelConfigurationKeys = keyof ITasksPanelConfiguration;

export class TasksPanelConfiguration implements vscode.Disposable {
    private _configIsChanged: boolean = true;
    private _configuration: ITasksPanelConfiguration;
    private _onDidChangeConfigurationDispose: vscode.Disposable;

    public static TREE_COLLAPSIBLE_STATE: TasksPanelConfigurationKeys = "treeCollapsibleState";
    public static SEARCH_GRUNT_TASKS: TasksPanelConfigurationKeys = "searchGruntTasks";
    public static SEARCH_GULP_TASKS: TasksPanelConfigurationKeys = "searchGulpTasks";
    public static SEARCH_CONDITION: TasksPanelConfigurationKeys = "searchCondition";
    public static SEARCH_SUB_FOLDERS_PATH: TasksPanelConfigurationKeys = "searchSubFolders";

    constructor() {
        this._configuration = this.loadConfiguration();
        this._onDidChangeConfigurationDispose = vscode.workspace.onDidChangeConfiguration((event) => this.onWorkspaceConfigurationChanged(event));
    }

    private onWorkspaceConfigurationChanged(event: vscode.ConfigurationChangeEvent): void {
        this._configIsChanged = true;
    }

    private getSearchConditionFlagsFromConfig(searchCondition: TaskSearchConditions | undefined): TaskSearchConditionFlags {
        switch(searchCondition) {
            case "RootFolder":
                return TaskSearchConditionFlags.RootFolder;
            case "SubFolders":
                return TaskSearchConditionFlags.SubFolders;
            case "RootAndSubFolders":
                return TaskSearchConditionFlags.RootAndSubFolders;
            default:
                return TaskSearchConditionFlags.RootFolder;
        }
    }
    
    private loadConfiguration(): ITasksPanelConfiguration {
        let configuration: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration('tasks-panel');
        let treeState =  configuration.get<TreeCollapsState>('treeCollapsibleState');
        let searchGruntTasks = configuration.get<boolean>('search.gruntTasks');
        let searchGulpTasks = configuration.get<boolean>('search.gulpTasks');
        let searchCondition = configuration.get<TaskSearchConditions>('search.searchCondition');
        let inSubFolders = configuration.get<Array<String>>('search.inSubFolders');
 
        return {
            treeCollapsibleState: treeState === undefined ? TreeCollapsibleState.Expanded : treeState === 'collapsed' ?  TreeCollapsibleState.Collapsed : TreeCollapsibleState.Expanded,
            searchGruntTasks: searchGruntTasks === undefined ? true : searchGruntTasks,
            searchGulpTasks: searchGulpTasks === undefined ? true : searchGulpTasks,
            searchCondition: this.getSearchConditionFlagsFromConfig(searchCondition),
            searchSubFolders: inSubFolders !== undefined ? inSubFolders : null
        };
    }

    public get<K extends keyof ITasksPanelConfiguration>(key: K): TasksPanelConfigurationTypes {
        if (this._configIsChanged) {
            this._configuration = this.loadConfiguration();
            this._configIsChanged = false;
        }
        return this._configuration[key];
    }

    public get isConfigChanged(): boolean {
        return this._configIsChanged;
    }

    public dispose(): void {
        this._configIsChanged = true;
        this._onDidChangeConfigurationDispose.dispose();
    }
}