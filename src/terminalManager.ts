import * as vscode from 'vscode';
import { StateManager } from './stateManager';
import { LyticsAccount } from 'lytics-js/dist/types';
import { SettingsManager } from './settingsManager';
import { isUndefined } from 'util';
const path = require('path');

export class TerminalManager implements vscode.Disposable {
    private watchTerminals: Map<string, vscode.Terminal> = new Map<string, vscode.Terminal>();
    private accountTerminals: Map<number, vscode.Terminal> = new Map<number, vscode.Terminal>();

    constructor() {
        vscode.window.onDidCloseTerminal(term => {
            const maps: Map<any, vscode.Terminal>[] = [
                this.watchTerminals,
                this.accountTerminals
            ];
            for (var i = 0; i < maps.length; i++) {
                let map = maps[i];
                let keys = Array.from(map.keys());
                for (var key of keys) {
                    const term = map.get(key);
                    if (term) {
                        map.delete(key);
                    }
                }
            }
        });
    }
    private async getTerminalCommandForWatch(account: LyticsAccount, uri: vscode.Uri): Promise<string | undefined> {
        const ext = vscode.extensions.getExtension("AdamConn.vscode-lytics");
        if (!ext) {
            return undefined;
        }
        const pth = path.join(ext.extensionPath, 'node_modules', 'lytics-js', "dist", 'lytics-js-watch.js');
        const token = await SettingsManager.getAccessToken(account.aid);
        const params: string[] = ["-k", token];
        //
        //
        const settings = SettingsManager.getWatchSettings();
        const colorize = settings.colorize;
        if (!isUndefined(colorize) && !colorize) {
            params.push('-C');
        }
        //
        //
        const max = settings.max;
        if (!isNaN(max) && max > 0) {
            params.push('-m');
            params.push(max.toString());
        }
        //
        const cmd = `node ${pth} ${params.join(' ')} '${uri.fsPath}'`;
        return cmd;
    }

    async getFolderPathForWatch(): Promise<string | undefined> {
        const paths = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
        });
        if (!paths || paths.length !== 1) {
            return Promise.resolve(undefined);
        }
        return Promise.resolve(paths[0].fsPath);
    }

    private async promptForFolder(): Promise<vscode.Uri | undefined> {
        const paths = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
        });
        if (!paths || paths.length !== 1) {
            return Promise.resolve(undefined);
        }
        return Promise.resolve(paths[0]);
    }

    async watch(uri: vscode.Uri): Promise<boolean> {
        const account = StateManager.getActiveAccount();
        if (!account) {
            vscode.window.showErrorMessage('Connect a Lytics account before running this command.');
            return;
        }
        if (!uri) {
            uri = await this.promptForFolder();
        }
        if (!uri) {
            return Promise.resolve(false);
        }
        let term = this.watchTerminals.get(uri.fsPath);
        if (!term) {
            const cmd = await this.getTerminalCommandForWatch(account, uri);
            if (!cmd) {
                vscode.window.showErrorMessage('Unable to get terminal command for Lytics Watch.');
                return;
            }
            term = vscode.window.createTerminal(`Lytics Watch [${account.aid} ${uri.fsPath}]`);
            term.sendText(cmd);
            this.watchTerminals.set(uri.fsPath, term);
        }
        term.show(true);
    }

    private async promptForAccount(message?: string): Promise<LyticsAccount | undefined> {
        if (!message) {
            message = `Select an account.`;
        }
        var accounts: LyticsAccount[] = undefined;
        const values: string[] = [];
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Loading accounts.',
            cancellable: true
        }, async (progress, token) => {
            accounts = await SettingsManager.getAccounts();
            accounts.forEach(account => values.push(`${account.aid}: ${account.name}`));
        });

        let value = await vscode.window.showQuickPick(values, {
            canPickMany: false,
            placeHolder: message
        });
        if (!value) {
            return Promise.resolve(undefined);
        }
        const position = value.indexOf(':');
        if (position !== -1) {
            value = value.split(':')[0].trim();
        }
        const aid = Number(value);
        if (isNaN(aid)) {
            throw new Error('An invalid account id was entered.');
        }
        const account = accounts.find(a => a.aid === aid);
        return Promise.resolve(account);
    }
    async openTerminal(account: LyticsAccount): Promise<boolean> {
        if (!account) {
            account = await this.promptForAccount('Select the account a terminal will be opened for.');
        }
        if (!account) {
            return Promise.resolve(false);
        }
        const token = await SettingsManager.getAccessToken(account.aid);
        let term = this.accountTerminals.get(account.aid);
        if (!term) {
            term = vscode.window.createTerminal({
                name: `Lytics Terminal [${account.aid}]`,
                env: {
                    "LIOKEY": token
                }
            });
            this.accountTerminals.set(account.aid, term);
        }
        term.show(true);
    }

    dispose() {
        this.watchTerminals.forEach((terminal: vscode.Terminal, key: string) => {
            terminal.dispose();
        });
    }
}