'use strict';

import * as vscode from 'vscode';
import { AccountExplorerProvider } from './accountExplorerProvider';
import { QueryEditorProvider } from './queryEditorProvider';
import { QueryExplorerProvider } from './queryExplorerProvider';
import { StreamExplorerProvider } from './streamExplorerProvider';
import { CampaignExplorerProvider } from './campaignExplorerProvider';
import { TableExplorerProvider } from './tableExplorerProvider';
import { TerminalManager } from './terminalManager';
import { StateManager } from './stateManager';
import LyticsContentProvider from './lyticsContentProvider';
import { ContentClassificationManager } from './ContentClassificationManager';

export function activate(context: vscode.ExtensionContext) {
    activateAccounts(context);
    activateContentProviders(context);
}

function activateAccounts(context: vscode.ExtensionContext) {
    const accountExplorerProvider = new AccountExplorerProvider(context);
    let disposable = vscode.window.registerTreeDataProvider('lytics.accounts.explorer', accountExplorerProvider);
    context.subscriptions.push(disposable);

    disposable = vscode.commands.registerCommand('lytics.accounts.refresh', () => accountExplorerProvider.refresh());
    context.subscriptions.push(disposable);

    disposable = vscode.commands.registerCommand('lytics.accounts.add', () => accountExplorerProvider.commandAddAccount());
    context.subscriptions.push(disposable);

    disposable = vscode.commands.registerCommand('lytics.accounts.remove', account => accountExplorerProvider.commandRemoveAccount(account));
    context.subscriptions.push(disposable);

    disposable = vscode.commands.registerCommand('lytics.accounts.show', account => accountExplorerProvider.commandShowAccount(account));
    context.subscriptions.push(disposable);

    disposable = vscode.commands.registerCommand('lytics.tables.add', () => tableExplorerProvider.commandAddTable());
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
            campaignExplorerProvider.refresh(),
            tableExplorerProvider.refresh()
        ]);
        //
        //show the connection in the status bar
        status.text = `Lytics account: ${connectedAccount.aid.toString()}`;
        status.show();
    });
    context.subscriptions.push(disposable);

    disposable = vscode.commands.registerCommand('lytics.accounts.export', accountExplorerProvider.commandExportAccounts);
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
        campaignExplorerProvider.refresh();
    });
    context.subscriptions.push(disposable);

    const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    status.command = 'lytics.accounts.show';
    context.subscriptions.push(status);

    const queryEditorProvider = new QueryEditorProvider(context);
    disposable = vscode.commands.registerCommand('lytics.lql.generate', async uri => queryEditorProvider.commandGenerateLql(uri));
    context.subscriptions.push(disposable);

    disposable = vscode.commands.registerCommand('lytics.queries.upload', async uri => queryEditorProvider.commandUploadQuery(uri));
    context.subscriptions.push(disposable);

    const queryExplorerProvider = new QueryExplorerProvider(context);
    disposable = vscode.window.registerTreeDataProvider('lytics.queries.explorer', queryExplorerProvider);
    context.subscriptions.push(disposable);
    disposable = vscode.commands.registerCommand('lytics.queries.refresh', () => queryExplorerProvider.refresh());
    context.subscriptions.push(disposable);
    disposable = vscode.commands.registerCommand('lytics.queries.download', (table) => queryExplorerProvider.commandDownloadQueries(table));
    context.subscriptions.push(disposable);
    disposable = vscode.commands.registerCommand('lytics.query.open', (query) => queryExplorerProvider.commandShowQuery(query));
    context.subscriptions.push(disposable);
    disposable = vscode.commands.registerCommand('lytics.query.download', (query) => queryExplorerProvider.commandDownloadQuery(query));
    context.subscriptions.push(disposable);

    const streamExplorerProvider = new StreamExplorerProvider(context);
    disposable = vscode.window.registerTreeDataProvider('lytics.streams.explorer', streamExplorerProvider);
    context.subscriptions.push(disposable);
    disposable = vscode.commands.registerCommand('lytics.streams.refresh', () => streamExplorerProvider.refresh());
    context.subscriptions.push(disposable);
    disposable = vscode.commands.registerCommand('lytics.stream.queries', (stream) => streamExplorerProvider.commandShowQueryInfo(stream));
    context.subscriptions.push(disposable);
    disposable = vscode.commands.registerCommand('lytics.stream.field.info', (field) => streamExplorerProvider.commandShowField(field));
    context.subscriptions.push(disposable);

    const tableExplorerProvider = new TableExplorerProvider(context);
    disposable = vscode.window.registerTreeDataProvider('lytics.tables.explorer', tableExplorerProvider);
    context.subscriptions.push(disposable);
    disposable = vscode.commands.registerCommand('lytics.table.field.search', (field) => tableExplorerProvider.commandShowEntitySearch(field));
    context.subscriptions.push(disposable);
    disposable = vscode.commands.registerCommand('lytics.table.field.info', (field) => tableExplorerProvider.commandShowFieldInfo(field));
    context.subscriptions.push(disposable);

    const campaignExplorerProvider = new CampaignExplorerProvider(context);
    disposable = vscode.window.registerTreeDataProvider('lytics.campaigns.explorer', campaignExplorerProvider);
    context.subscriptions.push(disposable);
    disposable = vscode.commands.registerCommand('lytics.campaigns.refresh', () => campaignExplorerProvider.refresh());
    context.subscriptions.push(disposable);
    disposable = vscode.commands.registerCommand('lytics.campaign.info', (campaign) => campaignExplorerProvider.commandShowCampaignInfo(campaign));
    context.subscriptions.push(disposable);
    disposable = vscode.commands.registerCommand('lytics.campaign.variation.info', (variation) => campaignExplorerProvider.commandShowCampaignVariationInfo(variation));
    context.subscriptions.push(disposable);

    const termManager = new TerminalManager();
    context.subscriptions.push(termManager);
    disposable = vscode.commands.registerCommand('lytics.watch.folder', (uri) => termManager.watch(uri));
    context.subscriptions.push(disposable);
    disposable = vscode.commands.registerCommand('lytics.watch.folder.palette', () => termManager.selectAndWatch());
    context.subscriptions.push(disposable);
}
 
function activateContentProviders(context: vscode.ExtensionContext) {
    const lyticsProvider = new LyticsContentProvider();
    let disposable = vscode.workspace.registerTextDocumentContentProvider('lytics', lyticsProvider);
    context.subscriptions.push(disposable);
    const classificationManager = new ContentClassificationManager(lyticsProvider);
    context.subscriptions.push(classificationManager);
    disposable = vscode.commands.registerCommand('lytics.classify.file', (uri) => classificationManager.commandClassifyFileContents(uri));
    context.subscriptions.push(disposable);
    disposable = vscode.commands.registerCommand('lytics.classify.active.editor', (uri) => classificationManager.commandClassifyEditorContents());
    context.subscriptions.push(disposable);
}

export function deactivate() {
}
