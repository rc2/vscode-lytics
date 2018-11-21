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
import { SegmentExplorerProvider } from './segmentExplorerProvider';
import { TopicExplorerProvider } from './topicExplorerProvider';
import { SubscriptionExplorerProvider } from './subscriptionExplorerProvider';
import { AccountSettingExplorerProvider } from './accountSettingExplorerProvider';
import { isNullOrUndefined } from 'util';
import { UtilitiesProvider } from './utilitiesProvider';
import { SegmentMLExplorerProvider } from './segmentMLExplorerProvider';

const explorers: LyticsExplorerProvider<any>[] = [];

export function activate(context: vscode.ExtensionContext) {
    const contentProvider = new LyticsContentProvider();
    let disposable = vscode.workspace.registerTextDocumentContentProvider('lytics', contentProvider);
    context.subscriptions.push(disposable);
    activateAccountExplorer(contentProvider, context);
    activateCampaignExplorer(contentProvider, context);
    activateQueryEditor(contentProvider, context);
    activateSegmentExplorer(contentProvider, context);
    activateSegmentMLExplorer(contentProvider, context);
    activateAccountSettingExplorer(contentProvider, context);
    activateQueryExplorer(contentProvider, context);
    activateStreamExplorer(contentProvider, context);
    activateSubscriptionExplorer(contentProvider, context);
    activateTableExplorer(contentProvider, context);
    activateTopicExplorer(contentProvider, context);
    activateTerminalManager(contentProvider, context);
    activateClassificationManager(contentProvider, context);
    activateUtilityCommands(contentProvider, context);
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
    disposable = vscode.commands.registerCommand('lytics.account.update', async (account) => await explorer.commandUpdateAccountAccessToken(account));
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

    disposable = vscode.commands.registerCommand('lytics.account.api.http', async (account) => explorer.openEditorForHttpRequest(account));
    context.subscriptions.push(disposable);
}

function activateTableExplorer(lyticsProvider: LyticsContentProvider, context: vscode.ExtensionContext) {
    const explorer = new TableExplorerProvider(lyticsProvider, context);
    explorers.push(explorer);
    var disposable = vscode.window.registerTreeDataProvider('lytics.tables.explorer', explorer);
    context.subscriptions.push(disposable);
    disposable = vscode.commands.registerCommand('lytics.table.add', () => explorer.commandAddTable());
    context.subscriptions.push(disposable);
    disposable = vscode.commands.registerCommand('lytics.table.remove', (table) => explorer.commandRemoveTable(table));
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
    disposable = vscode.commands.registerCommand('lytics.query.info', (query) => explorer.commandShowQueryInfo(query));
    context.subscriptions.push(disposable);
    disposable = vscode.commands.registerCommand('lytics.query.open', (query) => explorer.commandShowQuery(query));
    context.subscriptions.push(disposable);
    disposable = vscode.commands.registerCommand('lytics.query.download', (query) => explorer.commandDownloadQuery(query));
    context.subscriptions.push(disposable);
    disposable = vscode.commands.registerCommand('lytics.query.function', () => explorer.commandTestQueryFunction());
    context.subscriptions.push(disposable);
}

function activateQueryEditor(lyticsProvider: LyticsContentProvider, context: vscode.ExtensionContext) {
    const editor = new QueryEditorProvider(context);
    var disposable = vscode.commands.registerCommand('lytics.lql.generate', async (uri) => editor.commandGenerateLql(uri));
    context.subscriptions.push(disposable);
    disposable = vscode.commands.registerCommand('lytics.query.upload', async (uri) => editor.commandUploadQuery(uri));
    context.subscriptions.push(disposable);
}

function activateSegmentExplorer(lyticsProvider: LyticsContentProvider, context: vscode.ExtensionContext) {
    const explorer = new SegmentExplorerProvider(lyticsProvider, context);
    explorers.push(explorer);
    var disposable = vscode.window.registerTreeDataProvider('lytics.segments.explorer', explorer);
    context.subscriptions.push(disposable);
    disposable = vscode.commands.registerCommand('lytics.segments.refresh', () => explorer.refresh());
    context.subscriptions.push(disposable);
    disposable = vscode.commands.registerCommand('lytics.segment.info', (segment) => explorer.commandShowSegmentInfo(segment));
    context.subscriptions.push(disposable);
}

function activateSegmentMLExplorer(lyticsProvider: LyticsContentProvider, context: vscode.ExtensionContext) {
    const explorer = new SegmentMLExplorerProvider(lyticsProvider, context);
    explorers.push(explorer);
    var disposable = vscode.window.registerTreeDataProvider('lytics.segmentml.explorer', explorer);
    context.subscriptions.push(disposable);
    disposable = vscode.commands.registerCommand('lytics.segmentml.refresh', () => explorer.refresh());
    context.subscriptions.push(disposable);
    disposable = vscode.commands.registerCommand('lytics.segmentml.info', (segment) => explorer.commandShowModelInfo(segment));
    context.subscriptions.push(disposable);
    disposable = vscode.commands.registerCommand('lytics.segmentml.visualize', (segment) => explorer.commandShowModelVisualize(segment, context));
    context.subscriptions.push(disposable);
    disposable = vscode.commands.registerCommand('lytics.segmentml.add', () => explorer.commandAddModel());
    context.subscriptions.push(disposable);
}

function activateAccountSettingExplorer(lyticsProvider: LyticsContentProvider, context: vscode.ExtensionContext) {
    const explorer = new AccountSettingExplorerProvider(lyticsProvider, context);
    explorers.push(explorer);
    var disposable = vscode.window.registerTreeDataProvider('lytics.settings.explorer', explorer);
    context.subscriptions.push(disposable);
    disposable = vscode.commands.registerCommand('lytics.settings.refresh', () => explorer.refresh());
    context.subscriptions.push(disposable);
    disposable = vscode.commands.registerCommand('lytics.setting.edit', (setting) => explorer.commandEditAccountSetting(setting));
    context.subscriptions.push(disposable);
    disposable = vscode.commands.registerCommand('lytics.setting.info', (setting) => explorer.commandShowAccountSettingInfo(setting));
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

function activateSubscriptionExplorer(lyticsProvider: LyticsContentProvider, context: vscode.ExtensionContext) {
    const explorer = new SubscriptionExplorerProvider(lyticsProvider, context);
    explorers.push(explorer);
    var disposable = vscode.window.registerTreeDataProvider('lytics.subscriptions.explorer', explorer);
    context.subscriptions.push(disposable);
    disposable = vscode.commands.registerCommand('lytics.subscriptions.refresh', () => explorer.refresh());
    context.subscriptions.push(disposable);
    disposable = vscode.commands.registerCommand('lytics.subscription.info', (subscription) => explorer.commandShowSubscriptionInfo(subscription));
    context.subscriptions.push(disposable);
    disposable = vscode.commands.registerCommand('lytics.subscription.edit', (subscription) => explorer.commandEditSubscription(subscription));
    context.subscriptions.push(disposable);
    disposable = vscode.commands.registerCommand('lytics.subscription.add', () => explorer.commandAddSubscription());
    context.subscriptions.push(disposable);
    disposable = vscode.commands.registerCommand('lytics.subscription.remove', (subscription) => explorer.commandRemoveSubscription(subscription));
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

function activateTopicExplorer(lyticsProvider: LyticsContentProvider, context: vscode.ExtensionContext) {
    const explorer = new TopicExplorerProvider(lyticsProvider, context);
    explorers.push(explorer);
    var disposable = vscode.window.registerTreeDataProvider('lytics.topics.explorer', explorer);
    context.subscriptions.push(disposable);
    disposable = vscode.commands.registerCommand('lytics.topics.refresh', () => explorer.refresh());
    context.subscriptions.push(disposable);
    disposable = vscode.commands.registerCommand('lytics.topic.info', (topic) => explorer.commandShowTopicInfo(topic));
    context.subscriptions.push(disposable);
    disposable = vscode.commands.registerCommand('lytics.document.topics.info', () => explorer.commandShowTopicsForCrawledUrl());
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
    var disposable = vscode.commands.registerCommand('lytics.classify.file', (uri) => classificationManager.commandClassifyFileContents(uri));
    context.subscriptions.push(disposable);
    disposable = vscode.commands.registerCommand('lytics.classify.url', () => classificationManager.commandClassifyUrlContents());
    context.subscriptions.push(disposable);
}

function activateUtilityCommands(lyticsProvider: LyticsContentProvider, context: vscode.ExtensionContext) {
    const utilProvider = new UtilitiesProvider(lyticsProvider, context);
    var disposable = vscode.commands.registerCommand('lytics.hash.sip', async () => utilProvider.commandGenerateHash());
    context.subscriptions.push(disposable);
}

export function deactivate() {
}
