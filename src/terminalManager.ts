import * as vscode from 'vscode';
import { StateManager } from './stateManager';

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
    watch(uri: vscode.Uri) {
        const account = StateManager.account;
        if (!account) {
            vscode.window.showErrorMessage('Connect a Lytics account before running this command.');
            return;
        }
        let term = this.terms.get(uri.fsPath);
        if (!term) {
            term = vscode.window.createTerminal(`Lytics Watch [${account.aid} ${uri.fsPath}]`);
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