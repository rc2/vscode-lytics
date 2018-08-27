import * as vscode from 'vscode';
import { StateManager } from './stateManager';
import { LyticsAccount } from 'lytics-js/dist/types';
import { SettingsManager } from './settingsManager';
import { isUndefined } from 'util';
const path = require('path');

export class TerminalManager implements vscode.Disposable {
    terms: Map<string, vscode.Terminal> = new Map<string, vscode.Terminal>();
    constructor() {
        vscode.window.onDidCloseTerminal(term => {
            let keys = Array.from(this.terms.keys());
            for (var key of keys) {
                const term = this.terms.get(key);
                if (term) {
                    this.terms.delete(key);
                }
            }
        });
    }
    private getTerminalCommand(account:LyticsAccount, uri: vscode.Uri): string | undefined {
        const ext = vscode.extensions.getExtension("AdamConn.vscode-lytics");
        if (!ext) {
            return undefined;
        }
        const pth = path.join(ext.extensionPath, 'node_modules', 'lytics-js', "dist", 'lytics-js-watch.js');
        const params:string[] = ["-k", account.apikey!];
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
    async selectAndWatch() {
        const account = StateManager.account;
        if (!account) {
            vscode.window.showErrorMessage('Connect a Lytics account before running this command.');
            return;
        }
        const path = await this.getFolderPathForWatch();
        if (!path || path.trim().length === 0) {
            return;
        }
        this.watch(vscode.Uri.parse(path));
    }
    watch(uri: vscode.Uri) {
        const account = StateManager.account;
        if (!account) {
            vscode.window.showErrorMessage('Connect a Lytics account before running this command.');
            return;
        }
        let term = this.terms.get(uri.fsPath);
        if (!term) {
            const cmd = this.getTerminalCommand(account, uri);
            if (!cmd) {
                vscode.window.showErrorMessage('Unable to get terminal command for Lytics Watch.');
                return;
            }
            term = vscode.window.createTerminal(`Lytics Watch [${account.aid} ${uri.fsPath}]`);
            term.sendText(cmd);
            this.terms.set(uri.fsPath, term);
        }
        term.show(true);
    }
    dispose() {
        this.terms.forEach((terminal: vscode.Terminal, key: string) => {
            terminal.dispose();
        });
    }
}