'use strict';

export enum TreeCollapsibleState {
    Collapsed = 1,
    Expanded = 2
}

export type TreeCollapsState = 'expanded' | 'collapsed';

export interface ITasksPanelConfiguration {
    treeCollapsibleState: TreeCollapsibleState;
    searchGruntTasks: boolean;
    searchGulpTasks: boolean;
}