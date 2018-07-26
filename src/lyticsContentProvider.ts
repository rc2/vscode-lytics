'use strict';

import * as vscode from 'vscode';
import { StateManager } from './stateManager';
import { LyticsClient } from './lyticsClient';
import { Account } from './models';
import { LyticsUri } from './lyticsUri';
import { SettingsManager } from './settingsManager';

export default class LyticsContentProvider implements vscode.TextDocumentContentProvider {

    public async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
        try {
            //
            //data that doesn't require an account be connected
            var luri = new LyticsUri(uri);
            if (luri.isAccountUri && luri.accountId) {
                return await this.provideTextDocumentContentForAccount(luri.accountId);
            }
            const account = StateManager.account;
            if (!account) {
                throw new Error('No account is connected.');
            }
            //
            //data that requires an account be connected
            if (luri.isQueryUri && luri.queryAlias) {
                return await this.provideTextDocumentContentForQuery(luri.queryAlias, account);
            }
            else if (luri.isStreamQueriesUri && luri.streamName) {
                return await this.provideTextDocumentContentForStreamQueries(luri.streamName, account);
            }
            else if (luri.isStreamFieldUri && luri.streamName && luri.streamFieldName) {
                return await this.provideTextDocumentContentForStreamField(luri.streamName, luri.streamFieldName, account);
            }
            else if (luri.isTableFieldUri && luri.tableName && luri.tableFieldName) {
                return await this.provideTextDocumentContentForTableFieldInfo(luri.tableName, luri.tableFieldName, account);
            }
            else if (luri.isEntityUri && luri.tableName && luri.tableFieldName && luri.tableFieldValue) {
                let entity = await this.provideTextDocumentContentForEntity(luri.tableName, luri.tableFieldName, luri.tableFieldValue, account);
                if (!entity) {
                    entity = '';
                }
                return Promise.resolve(entity);
            }
            throw new Error(`Invalid uri: ${uri.toString()}`);
        }
        catch (err) {
            vscode.window.showErrorMessage(`Open query failed: ${err.message}`);
        }
        return Promise.reject();
    }

    private async provideTextDocumentContentForAccount(aid: number): Promise<string> {
        const account = await SettingsManager.getAccount(aid);
        if (!account) {
            throw new Error(`The account ${aid} is not defined.`);
        }
        const client = new LyticsClient(account.apikey);
        const reloadedAccount = await client.getAccount(aid);
        return Promise.resolve(JSON.stringify(reloadedAccount, null, 4));
    }
    private async provideTextDocumentContentForQuery(queryAlias: string, account: Account): Promise<string> {
        const client = new LyticsClient(account.apikey!);
        const query = await client.getQuery(queryAlias);
        return Promise.resolve(JSON.stringify(query, null, 4));
    }
    private async provideTextDocumentContentForStreamQueries(streamName: string, account: Account): Promise<string> {
        const client = new LyticsClient(account.apikey!);
        let queries = await client.getQueries();
        queries = queries.filter(q => q.from === streamName);
        const aliases = queries.map(q => q.alias);
        const result = {
            stream: streamName,
            aliases: aliases
        };
        return Promise.resolve(JSON.stringify(result, null, 4));
    }
    private async provideTextDocumentContentForStreamField(streamName: string, fieldName: string, account: Account): Promise<string> {
        const client = new LyticsClient(account.apikey!);
        let field = await client.getStreamField(streamName, fieldName);
        if (!field) {
            field = {};
        }
        return Promise.resolve(JSON.stringify(field, null, 4));
    }
    private async provideTextDocumentContentForTableFieldInfo(tableName: string, fieldName: string, account: Account): Promise<string> {
        const client = new LyticsClient(account.apikey);
        let info = await client.getTableFieldInfo(tableName, fieldName);
        if (!info) {
            info = {};
        }
        return Promise.resolve(JSON.stringify(info, null, 4));
    }
    private async provideTextDocumentContentForEntity(tableName: string, fieldName: string, value:string, account: Account): Promise<string> {
        const client = new LyticsClient(account.apikey);
        let entity = await client.getEntity(tableName, fieldName, value, true);
        if (!entity) {
            entity = {};
        }
        return Promise.resolve(JSON.stringify(entity, null, 4));
    }
}
