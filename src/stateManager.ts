import * as vscode from 'vscode';
import { LyticsAccount } from "lytics-js/dist/types";

export class StateManager {

	constructor() {
    }
    private static _account: (LyticsAccount | undefined);
    static getActiveAccount(): (LyticsAccount | undefined) {
        return this._account;
    }
    static setActiveAccount(account:(LyticsAccount | undefined)) {
        const isConnected = account !== undefined;
        vscode.commands.executeCommand('setContext', 'lyticsAccountConnected', isConnected);
        this._account = account;
    }
    static isActiveAccount(aid: number): boolean {
        if (this._account && this._account.aid === aid) {
            return true;
        }
        return false;
    }
}
