'use strict';

import * as vscode from 'vscode';
import { StateManager } from './stateManager';
import { LyticsUri } from './lyticsUri';
import { SettingsManager } from './settingsManager';
import lytics = require("lytics-js/dist/lytics");
import { LyticsAccount } from 'lytics-js/dist/types';

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
            else if (luri.isCampaignUri && luri.campaignId) {
                return await this.provideTextDocumentContentForCampaign(luri.campaignId, account);
            }
            else if (luri.isCampaignVariationUri && luri.campaignVariationId) {
                return await this.provideTextDocumentContentForCampaignVariation(luri.campaignVariationId, account);
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
        if (!account.apikey) {
            throw new Error(`The account ${aid} does not have an API key specified.`);
        }
        const client = lytics.getClient(account.apikey!);
        const reloadedAccount = await client.getAccount(aid);
        return Promise.resolve(JSON.stringify(reloadedAccount, null, 4));
    }
    private async provideTextDocumentContentForQuery(queryAlias: string, account: LyticsAccount): Promise<string> {
        const client = lytics.getClient(account.apikey!);
        const query = await client.getQuery(queryAlias);
        const text = query ? query.text : '';
        return Promise.resolve(text!);
    }
    private async provideTextDocumentContentForStreamQueries(streamName: string, account: LyticsAccount): Promise<string> {
        const client = lytics.getClient(account.apikey!);
        let queries = await client.getQueries();
        queries = queries.filter(q => q.from === streamName);
        const aliases = queries.map(q => q.alias);
        const result = {
            stream: streamName,
            aliases: aliases
        };
        return Promise.resolve(JSON.stringify(result, null, 4));
    }
    private async provideTextDocumentContentForStreamField(streamName: string, fieldName: string, account: LyticsAccount): Promise<string> {
        const client = lytics.getClient(account.apikey!);
        let field = await client.getStreamField(streamName, fieldName);
        return Promise.resolve(JSON.stringify(field ? field : {}, null, 4));
    }
    private async provideTextDocumentContentForTableFieldInfo(tableName: string, fieldName: string, account: LyticsAccount): Promise<string> {
        const client = lytics.getClient(account.apikey!);
        //let info = await client.getTableFieldInfo(tableName, fieldName);
        const info = await client.getTableSchemaFieldInfo(tableName, fieldName); 
        return Promise.resolve(JSON.stringify(info ? info : {}, null, 4));
    }
    private async provideTextDocumentContentForEntity(tableName: string, fieldName: string, value:string, account: LyticsAccount): Promise<string> {
        const client = lytics.getClient(account.apikey!);
        let entity = await client.getEntity(tableName, fieldName, value, true);
        if (!entity) {
            entity = {};
        }
        return Promise.resolve(JSON.stringify(entity, null, 4));
    }
    private async provideTextDocumentContentForCampaign(campaignId: string, account: LyticsAccount): Promise<string> {
        const client = lytics.getClient(account.apikey!);
        const campaign = await client.getCampaign(campaignId);
        return Promise.resolve(JSON.stringify(campaign, null, 4));
    }
    private async provideTextDocumentContentForCampaignVariation(campaignVariationId: string, account: LyticsAccount): Promise<string> {
        const client = lytics.getClient(account.apikey!);
        const campaign = await client.getCampaignVariation(campaignVariationId);
        return Promise.resolve(JSON.stringify(campaign, null, 4));
    }
}
