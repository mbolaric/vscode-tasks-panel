'use strict';
import * as vscode from 'vscode';
import * as assert from 'assert';
import * as sinon from 'sinon';
import * as utils from '../../../../tasks/core/utils';

suite("Utils Tests", function () {
    test("Execute 'newGuid' method", function() {
        let result = utils.newGuid();
        assert.equal(result.length, 36);
    });

    test("Execute 'format' method", function() {
        let str = "Test {0}-{1}:";
        let result = utils.format(str, 1, 2);
        assert.equal(result, "Test 1-2:");
    });

    test("Execute 'getIconPath' method", function() {
        let result: string = utils.getIconPath(utils.IconTheme.Dark, "bullet");
        assert(result.indexOf("resources/icons/dark/bullet.svg") > 0);

        result = utils.getIconPath(utils.IconTheme.Light, "bullet");
        assert(result.indexOf("resources/icons/light/bullet.svg") > 0);
    });

    suite("Execute 'output' method", function () {
        let channelStub: sinon.SinonStub;
        let out: any;
        suiteSetup(() => {
            utils.resetChannel();
            channelStub = sinon.stub(vscode.window, 'createOutputChannel');
            out = {appendLine: sinon.spy(), show: sinon.spy(), dispose: sinon.spy()};
            channelStub.returns(out);
        });
        teardown(() => {
            channelStub.reset();
        });
        suiteTeardown(() => {
            channelStub.restore();
        });
        suite("with type", () => {
            setup(() => {
                utils.output("Test", "type");
            });
            test("and the proper message is send to output", function() {
                assert(out.appendLine.called);
                assert(out.appendLine.calledWith("TP> [type] Test"));
            });    
        });        
        suite("without type", () => {
            setup(() => {
                utils.output("Test");
            });
            test("and the proper message is send to output", function() {
                assert(out.appendLine.called);
                assert(out.appendLine.calledWith("TP> Test"));
            });    
        });
    });
});