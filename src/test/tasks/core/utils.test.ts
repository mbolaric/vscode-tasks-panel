'use strict';
import * as assert from 'assert';
import { newGuid, format, IconTheme, getIconPath, getOrCreateOutputChannel } from '../../../tasks/core/utils';
import * as vscode from 'vscode';

suite("Utils Tests", function () {
    test("Execute 'newGuid' method", function() {
        let result = newGuid();
        assert.equal(result.length, 36);
    });

    test("Execute 'format' method", function() {
        let str = "Test {0}-{1}:";
        let result = format(str, 1, 2);
        assert.equal(result, "Test 1-2:");
    });

    test("Execute 'getIconPath' method", function() {
        let result: string = getIconPath(IconTheme.Dark, "bullet");
        assert(result.indexOf("resources/icons/dark/bullet.svg") > 0);

        result = getIconPath(IconTheme.Light, "bullet");
        assert(result.indexOf("resources/icons/light/bullet.svg") > 0);
    });

    test("Execute 'getOrCreateOutputChannel' method", function() {
        let result: vscode.OutputChannel = getOrCreateOutputChannel();
        assert(result !== undefined);
    });
});