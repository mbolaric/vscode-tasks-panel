(function () {
    'use strict';
    var GRUNT_TASK_STRUCTURE_FETCH_TASK = '_fetchGruntTasks_',
        ALIAS_PREFIX = 'Alias for "';

    function isString(value) {
        return typeof value === 'string' || Object.toString.call(value) === '[object String]';
    }

    function isObject(value) {
        return value !== null && typeof value === 'object' && !Array.isArray(value);
    }

    function getFilePath(task) {
        var meta = task.meta;
        if (meta) {
            return meta.filepath;
        }
        return null;
    }

    function isAliasTask(task) {
        return isString(task.info) && task.info.indexOf(ALIAS_PREFIX) === 0;
    }

    function getDependencies(task) {
        if (isAliasTask(task)) {
            var endInd = task.info.lastIndexOf('"');
            if (endInd <= 0) {
                return [];
            }
            var info = task.info.substring(ALIAS_PREFIX.length, endInd);
            return info.split('", "');
        }
        return [];
    }

    function writeToStdOut(str) {
        console.log(str);
    }

    module.exports = function (grunt) {
        grunt.registerTask(GRUNT_TASK_STRUCTURE_FETCH_TASK, 'Get grunt tasks', function () {
            var rawTasks = grunt.config.getRaw(),
                tasks = grunt.task._tasks,
                aliasTasks = [],
                coreTasks = [];

            if (rawTasks !== null && tasks !== null) {
                Object.keys(tasks).forEach(function (taskName) {
                    var task = tasks[taskName];

                    // Exclude this task.
                    if (task !== null && isString(task.name) && task.name !== GRUNT_TASK_STRUCTURE_FETCH_TASK) {
                        var taskNode = { name: taskName, info: task.info, multi: false },
                            filePath = getFilePath(task);
                        if (filePath !== null) {
                            taskNode.filePath = filePath;
                        }
                        if (task.multi === true) {
                            taskNode.multi = true;
                        }

                        if (isAliasTask(task)) {
                            taskNode.dependencies = getDependencies(task);
                            aliasTasks.push(taskNode);
                        }
                        else {
                            taskNode.targets = [];
                            var rawTask = rawTasks[taskName];
                            if (rawTask !== null) {
                                for (var prop in rawTask) {
                                    if (rawTask.hasOwnProperty(prop)) {
                                        // Logic from grunt/lib/grunt/task.js (isValidMultiTaskTarget)
                                        if (prop !== 'options' && prop.indexOf('_') !== 0) {
                                            var target = rawTask[prop];
                                            if (isObject(target) || Array.isArray(target)) {
                                                taskNode.targets.push(prop);
                                            }
                                        }
                                    }
                                }
                            }
                            coreTasks.push(taskNode);
                        }
                    }
                });
            }
            var resultJson = JSON.stringify({
                aliasTasks: aliasTasks,
                coreTasks: coreTasks
            });
            writeToStdOut(resultJson);
        });
    };
}());