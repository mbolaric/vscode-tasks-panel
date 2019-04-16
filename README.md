# task-panel

An extension that provides list of gulp and grunt tasks found in your workspaces and allow them to be executed.

![usage](images/example.gif)

## Features

- Show tasks in explorer view.
- Run tasks and show output in the Output View.

## Configuration Settings

The Tasks Panel extension comes with a useful configuration settings.
The following settings can be used to control the extension via **File** > **Preferences** > **Settings**:

| Setting                               | Description                                                                    | Default Value      |
| ------------------------------------- | ------------------------------------------------------------------------------ | ------------------ |
| `tasks-panel.treeCollapsibleState`    | Set initial tree collapsible state after panel show tasks.                     | `expanded`         |
| `tasks-panel.search.gruntTasks`       | Enable/Disable the searching for Grunt tasks.                                  | `true`             |
| `tasks-panel.search.gulpTasks`        | Enable/Disable the searching for Gulp tasks.                                   | `true`             |
| `tasks-panel.search.searchCondition`  | A value specifying where extension search for task files.                      | `RootFolder`       |
| `tasks-panel.search.inSubFolders`     | A value specifying sub folders where extension search for task files.          | `null`             |


Example:
```
{
  "tasks-panel.treeCollapsibleState": "expanded"
  "tasks-panel.search.searchCondition": "SubFolders"
  "tasks-panel.search.inSubFolders": [
    "tasks/gulp"
  ],
  "tasks-panel.search.gruntTasks": false,
  "tasks-panel.search.gulpTasks": true
}
```


## Known Issues

- None.

## Release Notes

Tasks Panel support gulp and grunt tasks.

### 0.1.2

- Show tasks in explorer view.
- Run tasks and show output in the Output View.

### 0.1.3

- Fix: grunt tasks are not loaded.

### 0.1.4

- Fix: terminate long running task when vscode is closed.

### 0.1.5

- Fix: Grunt tasks without multiple targets are now shown in the list.

### 0.1.6

- Fix: Can't execute tasks on Windows.

### 0.1.8

- Fix: Wrong encoding in package.json file.
- Fix: Missing dependencies.

### 0.1.9

- Add colorized output.
- Add sorting tasks in ASC order by name (The grunt tasks are sorted in two parts - core and alias tasks).

### 0.1.10

- Add execute task with double click.
- Add configuration for initial state of tasks tree, default value is expanded.

### 0.1.11

- Add Restart function for long running tasks.

### 0.2.0

- Add settings options:
    - Disable/enable gulp and grunt task loading.
    - A possibility to search for tasks in workspace sub folders.