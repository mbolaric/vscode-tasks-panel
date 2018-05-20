"use strict";
import * as path from 'path';
import * as vscode from 'vscode';

// rfc4122 section 4.4. (UUID version 4 = xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx)
// The version 4 UUID is meant for generating UUIDs from truly-random or
// pseudo-random numbers.

// The algorithm is as follows:

// o  Set the two most significant bits (bits 6 and 7) of the
//    clock_seq_hi_and_reserved to zero and one, respectively.

// o  Set the four most significant bits (bits 12 through 15) of the
//    time_hi_and_version field to the 4-bit version number from
//    Section 4.1.3.

// o  Set all the other bits to randomly (or pseudo-randomly) chosen
//    values.
export function newGuid() {
    const hexValues = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "A", "B", "C", "D", "E", "F"];
    let hex: string = "";
    let tmp: number;

    for (let i = 0; i < 4; i++) {
        tmp = (4294967296 * Math.random()) | 0;
        hex += hexValues[tmp & 0xF] + hexValues[tmp >> 4 & 0xF] + hexValues[tmp >> 8 & 0xF] + hexValues[tmp >> 12 & 0xF] + hexValues[tmp >> 16 & 0xF] + hexValues[tmp >> 20 & 0xF] + hexValues[tmp >> 24 & 0xF] + hexValues[tmp >> 28 & 0xF];
    }

    // "Set the two most significant bits (bits 6 and 7) of the clock_seq_hi_and_reserved to zero and one, respectively"
    let clockSequenceHi: string = hexValues[8 + (Math.random() * 4) | 0];
    return hex.substr(0, 8) + "-" + hex.substr(9, 4) + "-4" + hex.substr(13, 3) + "-" + clockSequenceHi + hex.substr(16, 3) + "-" + hex.substr(19, 12);
}

let _channel: vscode.OutputChannel | undefined;
export function resetChannel() {
    if (_channel) {
        _channel.dispose();
        _channel = undefined;
    }
}

export function getOrCreateOutputChannel(): vscode.OutputChannel {
	if (!_channel) {
		return vscode.window.createOutputChannel('Tasks Panel');
	}
	return _channel;
}

export function output(message: string, type?: string): void {
    if (!_channel) {
        _channel = getOrCreateOutputChannel();
    }

    if (type) {
        _channel.appendLine(`TP> [${type}] ${message}`);
    } else {
        _channel.appendLine(`TP> ${message}`);
    }
  
    _channel.show(true);
}

export function format(message: string, ...args: any[]): string {
    let result:string;

    if (args.length === 0) {
        result = message;
    } else {
        result = message.replace(/\{(\d+)\}/g, (match, rest) => {
            let index = rest[0];
            return typeof args[index] !== 'undefined' ? args[index] : match;
        });
    }
    return result;
}

export enum IconTheme {
    Dark = "dark",
    Light = "light"
}

export function getIconPath(theme: IconTheme, iconName: string) {
    return path.join(__filename, '..', '..', '..', '..', 'resources', 'icons', `${theme}`, `${iconName}.svg`);
}
