'use strict';

import * as vscode from 'vscode';
import { AccountExplorerProvider } from './accountExplorerProvider';
import { QueryExplorerProvider } from './queryExplorerProvider';
import { StreamExplorerProvider } from './streamExplorerProvider';
import { TableExplorerProvider } from './tableExplorerProvider';
import { StateManager } from './stateManager';

export function activate(context: vscode.ExtensionContext) {
    activateAccounts(context);
}

function activateAccounts(context: vscode.ExtensionContext) {
    const accountExplorerProvider = new AccountExplorerProvider(context);
    let disposable = vscode.window.registerTreeDataProvider('lytics.accounts.explorer', accountExplorerProvider);
    context.subscriptions.push(disposable);

    disposable = vscode.commands.registerCommand('lytics.accounts.refresh',  () => accountExplorerProvider.refresh());
    context.subscriptions.push(disposable);

    disposable = vscode.commands.registerCommand('lytics.accounts.add',  () => accountExplorerProvider.commandAddAccount());
    context.subscriptions.push(disposable);

    disposable = vscode.commands.registerCommand('lytics.accounts.remove', account => accountExplorerProvider.commandRemoveAccount(account));
    context.subscriptions.push(disposable);

    disposable = vscode.commands.registerCommand('lytics.tables.add',  () => tableExplorerProvider.commandAddTable());
    context.subscriptions.push(disposable);

    disposable = vscode.commands.registerCommand('lytics.tables.remove', table => tableExplorerProvider.commandRemoveTable(table));
    context.subscriptions.push(disposable);

    disposable = vscode.commands.registerCommand('lytics.tables.refresh', table => tableExplorerProvider.refresh());
    context.subscriptions.push(disposable);

    disposable = vscode.commands.registerCommand('lytics.accounts.connect', async (account) => {
        let connectedAccount = await accountExplorerProvider.commandConnectAccount(account);
        if (!connectedAccount) {
            return;
        }
        //
        //
        await Promise.all([
            queryExplorerProvider.refresh(),
            streamExplorerProvider.refresh(), 
            tableExplorerProvider.refresh()
        ]);
        //
        //show the connection in the status bar
        status.text = `Lytics account: ${connectedAccount.aid.toString()}`;
        status.show();
    });
    context.subscriptions.push(disposable);

    disposable = vscode.commands.registerCommand('lytics.accounts.disconnect', async (account) => {
        if (!StateManager.account) {
            return;
        }
        accountExplorerProvider.commandDisconnectAccount(account);
        status.text = '';
        status.hide();
        queryExplorerProvider.refresh();
        streamExplorerProvider.refresh();
        tableExplorerProvider.refresh();
    });
    context.subscriptions.push(disposable);

    const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
	status.command = 'lytics.accounts.connected.show';
    context.subscriptions.push(status);
    disposable = vscode.commands.registerCommand('lytics.accounts.connected.show', () => {
        //TODO: implement
        return;
    });
    context.subscriptions.push(disposable);
    
    const queryExplorerProvider = new QueryExplorerProvider(context);
    disposable = vscode.window.registerTreeDataProvider('lytics.queries.explorer', queryExplorerProvider);
    context.subscriptions.push(disposable);
    disposable = vscode.commands.registerCommand('lytics.queries.refresh',  () => queryExplorerProvider.refresh());
    context.subscriptions.push(disposable);
    disposable = vscode.commands.registerCommand('lytics.queries.open',  query => queryExplorerProvider.commandOpenQuery(query));
    context.subscriptions.push(disposable);

    const streamExplorerProvider = new StreamExplorerProvider(context);
    disposable = vscode.window.registerTreeDataProvider('lytics.streams.explorer', streamExplorerProvider);
    context.subscriptions.push(disposable);
    disposable = vscode.commands.registerCommand('lytics.streams.refresh',  () => streamExplorerProvider.refresh());
    context.subscriptions.push(disposable);

    const tableExplorerProvider = new TableExplorerProvider(context);
    disposable = vscode.window.registerTreeDataProvider('lytics.tables.explorer', tableExplorerProvider);
    context.subscriptions.push(disposable);
}

export function deactivate() {
}
