'use strict';

import * as vscode from 'vscode';
import { StateManager } from './stateManager';
import { LyticsUri } from './lyticsUri';
import { SettingsManager } from './settingsManager';
import lytics = require("lytics-js/dist/lytics");
import { LyticsAccount } from 'lytics-js/dist/types';
import fs = require('fs');
import { ContentReader } from './contentReader';

export default class LyticsContentProvider implements vscode.TextDocumentContentProvider, ContentReader {
    removeFromCache(uri: vscode.Uri): void {
        this._onDidChange.fire(uri);
    }
    private _onDidChange = new vscode.EventEmitter<vscode.Uri>();
    get onDidChange(): vscode.Event<vscode.Uri> {
        return this._onDidChange.event;
    }
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
            else if (luri.isCampaignVariationOverrideUri && luri.campaignVariationId) {
                return await this.provideTextDocumentContentForCampaignVariationDetailOverride(luri.campaignVariationId, account);
            }
            else if (luri.isContentClassificationUri) {
                if (luri.contentClassificationFilePath) {
                    return await this.provideTextDocumentContentForContentClassificationForFile(luri.contentClassificationFilePath, account);
                }
                else if (luri.useTextFromActiveEditor) {
                    return await this.provideTextDocumentContentForContentClassificationForActiveEditor(account);
                }
            }
            throw new Error(`Invalid uri: ${uri.toString()}`);
        }
        catch (err) {
            vscode.window.showErrorMessage(`Loading data failed: ${err.message}`);
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
        const info = await client.getTableSchemaFieldInfo(tableName, fieldName);
        return Promise.resolve(JSON.stringify(info ? info : {}, null, 4));
    }
    private async provideTextDocumentContentForEntity(tableName: string, fieldName: string, value: string, account: LyticsAccount): Promise<string> {
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
        const variation = await client.getCampaignVariation(campaignVariationId);
        return Promise.resolve(JSON.stringify(variation, null, 4));
    }
    private async provideTextDocumentContentForCampaignVariationDetailOverride(campaignVariationId: string, account: LyticsAccount): Promise<string> {
        const client = lytics.getClient(account.apikey!);
        const override = await client.getCampaignVariationDetailOverride(campaignVariationId);
        return Promise.resolve(JSON.stringify(override, null, 4));
    }
    private async provideTextDocumentContentForContentClassificationForActiveEditor(account: LyticsAccount): Promise<string> {
        const client = lytics.getClient(account.apikey!);
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return Promise.reject('No active text editor is available.');
        }
        const text = editor.document.getText();
        const classification = await client.classifyUsingText(text);
        return Promise.resolve(JSON.stringify(classification, null, 4));
    }
    private async provideTextDocumentContentForContentClassificationForFile(filePath: string, account: LyticsAccount): Promise<string> {
        const client = lytics.getClient(account.apikey!);
        const text = await this.readFileToString(filePath);
        const classification = await client.classifyUsingText(text);
        var str = JSON.stringify(classification, null, 4);
        return Promise.resolve(str);
    }
    private readFileToString(filePath: string): Promise<string> {
        return new Promise(function (resolve, reject) {
            fs.readFile(filePath, (err, data) => {
                err ? reject(err) : resolve(data.toString());
            });
        });
    }
}
