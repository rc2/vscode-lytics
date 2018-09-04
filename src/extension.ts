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
import { LyticsExplorerProvider } from './lyticsExplorerProvider';

const explorers: LyticsExplorerProvider<any>[] = [];

export function activate(context: vscode.ExtensionContext) {
    const contentProvider = new LyticsContentProvider();
    let disposable = vscode.workspace.registerTextDocumentContentProvider('lytics', contentProvider);
    context.subscriptions.push(disposable);
    activateAccountExplorer(contentProvider, context);
    activateCampaignExplorer(contentProvider, context);
    activateQueryEditor(contentProvider, context);
    activateQueryExplorer(contentProvider, context);
    activateStreamExplorer(contentProvider, context);
    activateTableExplorer(contentProvider, context);
    activateTerminalManager(contentProvider, context);
    activateClassificationManager(contentProvider, context);
}

function refreshExplorers(): Promise<any> {
    const promises: Promise<any>[] = [];
    explorers.forEach(explorer => promises.push(explorer.refresh()));
    return Promise.all(promises);
}

function activateAccountExplorer(lyticsProvider: LyticsContentProvider, context: vscode.ExtensionContext) {
    const explorer = new AccountExplorerProvider(lyticsProvider, context);
    let disposable = vscode.window.registerTreeDataProvider('lytics.accounts.explorer', explorer);
    context.subscriptions.push(disposable);

    disposable = vscode.commands.registerCommand('lytics.accounts.refresh', () => explorer.refresh());
    context.subscriptions.push(disposable);
    disposable = vscode.commands.registerCommand('lytics.account.add', () => explorer.commandAddAccount());
    context.subscriptions.push(disposable);
    disposable = vscode.commands.registerCommand('lytics.account.remove', async (account) => await explorer.commandRemoveAccount(account));
    context.subscriptions.push(disposable);
    disposable = vscode.commands.registerCommand('lytics.account.show', async (account) => await explorer.commandShowAccount(account));
    context.subscriptions.push(disposable);

    disposable = vscode.commands.registerCommand('lytics.account.connect', async (account) => {
        const wasConnected = await explorer.commandConnectAccount(account);
        if (!wasConnected) {
            return;
        }
        //
        //refresh the explorers that are populated with account info
        await refreshExplorers();
        //
        //show the connection in the status bar
        account = StateManager.getActiveAccount();
        status.text = `Lytics account: ${account.aid}`;
        status.show();
    });
    context.subscriptions.push(disposable);

    disposable = vscode.commands.registerCommand('lytics.account.disconnect', async (account) => {
        const wasDisconnected = await explorer.commandDisconnectAccount(account);
        if (!wasDisconnected) {
            return;
        }
        //
        //hide the connection in the status bar
        status.text = '';
        status.hide();
        //
        //refresh the explorers that are populated with account info
        await refreshExplorers();
    });
    context.subscriptions.push(disposable);

    disposable = vscode.commands.registerCommand('lytics.accounts.export', explorer.commandExportAccounts);
    context.subscriptions.push(disposable);

    const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    status.command = 'lytics.account.show';
    context.subscriptions.push(status);
}
function activateTableExplorer(lyticsProvider: LyticsContentProvider, context: vscode.ExtensionContext) {
    const explorer = new TableExplorerProvider(lyticsProvider, context);
    explorers.push(explorer);
    var disposable = vscode.window.registerTreeDataProvider('lytics.tables.explorer', explorer);
    context.subscriptions.push(disposable);
    disposable = vscode.commands.registerCommand('lytics.tables.add', () => explorer.commandAddTable());
    context.subscriptions.push(disposable);
    disposable = vscode.commands.registerCommand('lytics.tables.remove', (table) => explorer.commandRemoveTable(table));
    context.subscriptions.push(disposable);
    disposable = vscode.commands.registerCommand('lytics.tables.refresh', () => explorer.refresh());
    context.subscriptions.push(disposable);
    disposable = vscode.commands.registerCommand('lytics.table.field.search', (field) => explorer.commandShowEntitySearch(field));
    context.subscriptions.push(disposable);
    disposable = vscode.commands.registerCommand('lytics.table.field.info', (field) => explorer.commandShowFieldInfo(field));
    context.subscriptions.push(disposable);
    disposable = vscode.commands.registerCommand('lytics.table.field.whitelist', (field) => explorer.commandToggleWhitelist(field));
    context.subscriptions.push(disposable);
}

function activateQueryExplorer(lyticsProvider: LyticsContentProvider, context: vscode.ExtensionContext) {
    const explorer = new QueryExplorerProvider(lyticsProvider, context);
    explorers.push(explorer);
    var disposable = vscode.window.registerTreeDataProvider('lytics.queries.explorer', explorer);
    context.subscriptions.push(disposable);
    disposable = vscode.commands.registerCommand('lytics.queries.refresh', () => explorer.refresh());
    context.subscriptions.push(disposable);
    disposable = vscode.commands.registerCommand('lytics.queries.download', (table) => explorer.commandDownloadQueries(table));
    context.subscriptions.push(disposable);
    disposable = vscode.commands.registerCommand('lytics.query.open', (query) => explorer.commandShowQuery(query));
    context.subscriptions.push(disposable);
    disposable = vscode.commands.registerCommand('lytics.query.download', (query) => explorer.commandDownloadQuery(query));
    context.subscriptions.push(disposable);
}

function activateQueryEditor(lyticsProvider: LyticsContentProvider, context: vscode.ExtensionContext) {
    const editor = new QueryEditorProvider(context);
    var disposable = vscode.commands.registerCommand('lytics.lql.generate', async (uri) => editor.commandGenerateLql(uri));
    context.subscriptions.push(disposable);
    disposable = vscode.commands.registerCommand('lytics.query.upload', async (uri) => editor.commandUploadQuery(uri));
    context.subscriptions.push(disposable);
}

function activateStreamExplorer(lyticsProvider: LyticsContentProvider, context: vscode.ExtensionContext) {
    const explorer = new StreamExplorerProvider(lyticsProvider, context);
    explorers.push(explorer);
    var disposable = vscode.window.registerTreeDataProvider('lytics.streams.explorer', explorer);
    context.subscriptions.push(disposable);
    disposable = vscode.commands.registerCommand('lytics.streams.refresh', () => explorer.refresh());
    context.subscriptions.push(disposable);
    disposable = vscode.commands.registerCommand('lytics.stream.info', (stream) => explorer.commandShowStreamInfo(stream));
    context.subscriptions.push(disposable);
    disposable = vscode.commands.registerCommand('lytics.stream.queries', (stream) => explorer.commandShowQueryInfo(stream));
    context.subscriptions.push(disposable);
    disposable = vscode.commands.registerCommand('lytics.stream.field.info', (field) => explorer.commandShowField(field));
    context.subscriptions.push(disposable);
}
function activateCampaignExplorer(lyticsProvider: LyticsContentProvider, context: vscode.ExtensionContext) {
    const campaignExplorerProvider = new CampaignExplorerProvider(lyticsProvider, context);
    explorers.push(campaignExplorerProvider);
    var disposable = vscode.window.registerTreeDataProvider('lytics.campaigns.explorer', campaignExplorerProvider);
    context.subscriptions.push(disposable);
    disposable = vscode.commands.registerCommand('lytics.campaigns.refresh', () => campaignExplorerProvider.refresh());
    context.subscriptions.push(disposable);
    disposable = vscode.commands.registerCommand('lytics.campaign.info', (campaign) => campaignExplorerProvider.commandShowCampaignInfo(campaign));
    context.subscriptions.push(disposable);
    disposable = vscode.commands.registerCommand('lytics.campaign.variation.info', (variation) => campaignExplorerProvider.commandShowCampaignVariationInfo(variation));
    context.subscriptions.push(disposable);
    disposable = vscode.commands.registerCommand('lytics.campaign.variation.override.download', (variation) => campaignExplorerProvider.commandDownloadCampaignVariationDetailOverride(variation));
    context.subscriptions.push(disposable);
    disposable = vscode.commands.registerCommand('lytics.campaign.variation.override.upload', async (uri) => campaignExplorerProvider.commandUploadCampaignVariationDetailOverride(uri));
    context.subscriptions.push(disposable);
}

function activateTerminalManager(lyticsProvider: LyticsContentProvider, context: vscode.ExtensionContext) {
    const termManager = new TerminalManager();
    context.subscriptions.push(termManager);
    var disposable = vscode.commands.registerCommand('lytics.folder.watch', (uri) => termManager.watch(uri));
    context.subscriptions.push(disposable);
    disposable = vscode.commands.registerCommand('lytics.terminal.open', (account) => termManager.openTerminal(account));
    context.subscriptions.push(disposable);
}

function activateClassificationManager(lyticsProvider: LyticsContentProvider, context: vscode.ExtensionContext) {
    const classificationManager = new ContentClassificationManager(lyticsProvider);
    context.subscriptions.push(classificationManager);
    var disposable = vscode.commands.registerCommand('lytics.file.classify', (uri) => classificationManager.commandClassifyFileContents(uri));
    context.subscriptions.push(disposable);
}

export function deactivate() {
}
