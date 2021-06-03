'use strict';
import { TasksPanelConfiguration, ITasksPanelConfiguration, TasksPanelConfigurationTypes, TaskSearchConditionFlags, TreeCollapsibleState } from '../../../../tasks/core/configuration';

export class TasksPanelConfigurationMock extends TasksPanelConfiguration {
    constructor() {
        super();
    }

    public get<K extends keyof ITasksPanelConfiguration>(key: K): TasksPanelConfigurationTypes {
        switch(key) {
            case "searchCondition":
                return TaskSearchConditionFlags.RootFolder;
            case "searchGruntTasks":
                return false;
            case "searchGulpTasks":
                return true;
            case "treeCollapsibleState":
                return TreeCollapsibleState.Expanded;
            case "searchSubFolders": 
                return [];
        }
        return false;
    }
}