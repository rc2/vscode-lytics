'use strict';

import * as vscode from 'vscode';
import { StateManager } from './stateManager';
import { LyticsClient } from './lyticsClient';
import { Account, QueryNode } from './models';
import { LyticsUri } from './lyticsUri';
import { SettingsManager } from './settingsManager';

export default class LyticsContentProvider implements vscode.TextDocumentContentProvider {

    private async getAccount(aid: number): Promise<Account | undefined> {
        try {
            const account = await SettingsManager.getAccount(aid);
            if (!account) {
                throw new Error(`The account ${aid} is not defined.`);
            }
            const reloadedAccount = await LyticsClient.getAccount(account.apikey!);
            if (!reloadedAccount) {
                throw new Error(`The account ${aid} was not loaded.`);
            }
            return Promise.resolve(reloadedAccount);
        }
        catch (err) {
            vscode.window.showErrorMessage(`Loading account failed: ${err.message}`);
            return Promise.resolve(undefined);
        }
    }

    private async getQuery(alias: string, account: Account): Promise<QueryNode | undefined> {
        const client = new LyticsClient(account.apikey!);
        try {
            if (!alias) {
                return Promise.resolve(undefined);
            }
            const query = await client.getQuery(alias);
            return Promise.resolve(query);
        }
        catch (err) {
            vscode.window.showErrorMessage(`Loading query failed: ${err.message}`);
            return Promise.resolve(undefined);
        }
    }

    private async getStreamField(streamName: string, fieldName: string, account: Account): Promise<object | undefined> {
        const client = new LyticsClient(account.apikey!);
        try {
            const field = await client.getStreamField(streamName, fieldName);
            return Promise.resolve(field);
        }
        catch (err) {
            vscode.window.showErrorMessage(`Loading stream field failed: ${err.message}`);
            return Promise.resolve(undefined);
        }
    }

    private async getTableFieldInfo(tableName: string, fieldName: string, account: Account): Promise<object | undefined> {
        const client = new LyticsClient(account.apikey!);
        try {
            const field = await client.getTableFieldInfo(tableName, fieldName);
            return Promise.resolve(field);
        }
        catch (err) {
            vscode.window.showErrorMessage(`Loading table field info failed: ${err.message}`);
            return Promise.resolve(undefined);
        }
    }

    public async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
        try {
            var luri = new LyticsUri(uri);
            if (luri.isAccountUri && luri.accountId) {
                return await this.provideTextDocumentContentForAccount(luri.accountId);
            }
            const account = StateManager.account;
            if (!account) {
                throw new Error('No account is connected.');
            }
            if (luri.isQueryUri && luri.queryAlias) {
                return await this.provideTextDocumentContentForQuery(luri.queryAlias, account);
            }
            else if (luri.isStreamFieldUri && luri.streamName && luri.streamFieldName) {
                return await this.provideTextDocumentContentForStreamField(luri.streamName, luri.streamFieldName, account);
            }
            else if (luri.isTableFieldUri && luri.tableName && luri.tableFieldName) {
                return await this.provideTextDocumentContentForTableFieldInfo(luri.tableName, luri.tableFieldName, account);
            }
            throw new Error(`Invalid uri: ${uri.toString()}`);
        }
        catch (err) {
            vscode.window.showErrorMessage(`Open query failed: ${err.message}`);
        }
        return Promise.reject();
    }

    private async provideTextDocumentContentForAccount(aid: number): Promise<string> {
        let reloadedAccount = await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Loading account.',
            cancellable: true
        }, async (progress, token) => {
            return await this.getAccount(aid);
        });
        if (reloadedAccount) {
            return Promise.resolve(JSON.stringify(reloadedAccount, null, 4));
        }
        return Promise.reject();
    }

    private async provideTextDocumentContentForQuery(queryAlias: string, account: Account): Promise<string> {
        let reloadedQuery = await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Loading query.',
            cancellable: true
        }, async (progress, token) => {
            return await this.getQuery(queryAlias, account);
        });
        if (reloadedQuery) {
            return Promise.resolve(reloadedQuery.text);
        }
        return Promise.reject();
    }

    private async provideTextDocumentContentForStreamField(streamName: string, fieldName: string, account: Account): Promise<string> {
        let field = await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Loading stream field.',
            cancellable: true
        }, async (progress, token) => {
            return await this.getStreamField(streamName, fieldName, account);
        });
        if (field) {
            return Promise.resolve(JSON.stringify(field, null, 4));
        }
        return Promise.reject();
    }

    private async provideTextDocumentContentForTableFieldInfo(tableName: string, fieldName: string, account: Account): Promise<string> {
        let field = await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Loading table field.',
            cancellable: true
        }, async (progress, token) => {
            return await this.getTableFieldInfo(tableName, fieldName, account);
        });
        if (field) {
            return Promise.resolve(JSON.stringify(field, null, 4));
        }
        return Promise.reject();
    }
}
