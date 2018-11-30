'use strict';

import * as vscode from 'vscode';
import { StateManager } from './stateManager';
import { LyticsUri } from './lyticsUri';
import { SettingsManager } from './settingsManager';
import lytics = require("lytics-js/dist/lytics");
import { LyticsAccount, TopicUrl, TopicUrlCollection, Subscription, Query } from 'lytics-js/dist/types';
import fs = require('fs');
import { ContentReader } from './contentReader';
import { LyticsUtils } from 'lytics-js/dist/LyticsUtils';

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
            else if (luri.isHashUri && luri.hashType && luri.valueToHash) {
                return await this.provideTextDocumentForHashing(luri.hashType, luri.valueToHash);
            }
            const account = StateManager.getActiveAccount();
            if (!account) {
                throw new Error('No account is connected.');
            }
            //
            //data that requires an account be connected
            if (luri.isQueryUri && luri.queryAlias) {
                if (luri.queryInfoMode) {
                    return await this.provideTextDocumentContentForQueryInfo(luri.queryAlias, account);
                }
                else if (luri.queryTextMode) {
                    return await this.provideTextDocumentContentForQuery(luri.queryAlias, account);
                }
                
            }
            else if (luri.isFunctionUri && luri.functionName) {
                return await this.provideTextDocumentContentForFunctionTest(luri.functionName, luri.functionParameters, account);
            }
            else if (luri.isSegmentUri && luri.segmentSlugName) {
                return await this.provideTextDocumentContentForSegmentInfo(luri.segmentSlugName, account);
            }
            else if (luri.isSegmentCollectionUri && luri.segmentCollectionSlugName) {
                return await this.provideTextDocumentContentForSegmentCollectionInfo(luri.segmentCollectionSlugName, account);
            }
            else if (luri.isSegmentMLUri && luri.modelName) {
                return await this.provideTextDocumentContentForModelInfo(luri.modelName, account);
            }
            else if (luri.isSettingUri && luri.settingSlugName) {
                return await this.provideTextDocumentContentForSettingInfo(luri.settingSlugName, account);
            }
            else if (luri.isStreamUri && luri.streamName) {
                return await this.provideTextDocumentContentForStreamInfo(luri.streamName, account);
            }
            else if (luri.isStreamQueriesUri && luri.streamName) {
                return await this.provideTextDocumentContentForStreamQueries(luri.streamName, account);
            }
            else if (luri.isStreamFieldUri && luri.streamName && luri.streamFieldName) {
                return await this.provideTextDocumentContentForStreamField(luri.streamName, luri.streamFieldName, account);
            }
            else if (luri.isSubscriptionUri && luri.subscriptionSlug) {
                return await this.provideTextDocumentContentForSubscription(luri.subscriptionSlug, account);
            }
            else if (luri.isTableFieldUri && luri.tableName && luri.tableFieldName) {
                return await this.provideTextDocumentContentForTableFieldInfo(luri.tableName, luri.tableFieldName, account);
            }
            else if (luri.isTopicUri && luri.topicLabel) {
                return await this.provideTextDocumentContentForTopicInfo(luri.topicLabel, account);
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
                else if (luri.contentClassificationUrl) {
                    return await this.provideTextDocumentContentForContentClassificationForUrl(luri.contentClassificationUrl, account);
                }
            }
            else if (luri.isDocumentTopicsUri && luri.documentTopicsUrl) {
                return this.provideTextDocumentContentForDocumentTopicsUrl(luri.documentTopicsUrl, account);
            }
            throw new Error(`Invalid uri: ${uri.toString()}`);
        }
        catch (err) {
            vscode.window.showErrorMessage(`Loading data failed: ${err.message}`);
        }
        return Promise.reject();
    }
    private async getAccessToken(aid: number): Promise<string | undefined> {
        const token = await SettingsManager.getAccessToken(aid);
        if (token === undefined || token.trim().length === 0) {
            return Promise.reject(`The account ${aid} does not have an access token specified.`);
        }
        return Promise.resolve(token);
    }
    private async provideTextDocumentContentForAccount(aid: number): Promise<string> {
        const account = await SettingsManager.getAccount(aid);
        if (!account) {
            throw new Error(`The account ${aid} is not defined.`);
        }
        const token = await this.getAccessToken(aid);
        const client = lytics.getClient(token);
        const reloadedAccount = await client.getAccount(aid);
        return Promise.resolve(JSON.stringify(reloadedAccount, null, 4));
    }
    private async getQuery(queryAlias: string, account: LyticsAccount): Promise<Query> {
        const token = await this.getAccessToken(account.aid);
        const client = lytics.getClient(token);
        return client.getQuery(queryAlias);
    }
    private async provideTextDocumentContentForQuery(queryAlias: string, account: LyticsAccount): Promise<string> {
        // const token = await this.getAccessToken(account.aid);
        // const client = lytics.getClient(token);
        // const query = await client.getQuery(queryAlias);
        const query = await this.getQuery(queryAlias, account);
        const text = query ? query.text : '';
        return Promise.resolve(text!);
    }
    private async provideTextDocumentContentForQueryInfo(queryAlias: string, account: LyticsAccount): Promise<string> {
        const query = await this.getQuery(queryAlias, account);
        return Promise.resolve(JSON.stringify(query, null, 4));
    }
    private async provideTextDocumentContentForFunctionTest(name: string, parameters: string[], account: LyticsAccount): Promise<string> {
        const token = await this.getAccessToken(account.aid);
        const client = lytics.getClient(token);
        const result = await client.testFunction(name, parameters);
        return Promise.resolve(JSON.stringify(result, null, 4));
    }
    private async provideTextDocumentContentForSegmentInfo(segmentSlugName: string, account: LyticsAccount): Promise<string> {
        const token = await this.getAccessToken(account.aid);
        const client = lytics.getClient(token);
        let segment = await client.getSegment(segmentSlugName);
        return Promise.resolve(JSON.stringify(segment, null, 4));
    }
    private async provideTextDocumentContentForSegmentCollectionInfo(segmentCollectionSlugName: string, account: LyticsAccount): Promise<string> {
        const token = await this.getAccessToken(account.aid);
        const client = lytics.getClient(token);
        let collection = await client.getSegmentCollection(segmentCollectionSlugName);
        return Promise.resolve(JSON.stringify(collection, null, 4));
    }
    private async provideTextDocumentContentForModelInfo(modelName: string, account: LyticsAccount): Promise<string> {
        const token = await this.getAccessToken(account.aid);
        const client = lytics.getClient(token);
        let model = await client.getSegmentMLModel(modelName);
        return Promise.resolve(JSON.stringify(model, null, 4));
    }
    private async provideTextDocumentContentForSettingInfo(settingSlugName: string, account: LyticsAccount): Promise<string> {
        const token = await this.getAccessToken(account.aid);
        const client = lytics.getClient(token);
        let setting = await client.getAccountSetting(settingSlugName);
        return Promise.resolve(JSON.stringify(setting, null, 4));
    }
    private async provideTextDocumentContentForStreamInfo(streamName: string, account: LyticsAccount): Promise<string> {
        const token = await this.getAccessToken(account.aid);
        const client = lytics.getClient(token);
        let stream = await client.getStream(streamName);
        return Promise.resolve(JSON.stringify(stream, null, 4));
    }
    private async provideTextDocumentContentForStreamQueries(streamName: string, account: LyticsAccount): Promise<string> {
        const token = await this.getAccessToken(account.aid);
        const client = lytics.getClient(token);
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
        const token = await this.getAccessToken(account.aid);
        const client = lytics.getClient(token);
        let field = await client.getStreamField(streamName, fieldName);
        return Promise.resolve(JSON.stringify(field ? field : {}, null, 4));
    }
    private async provideTextDocumentContentForSubscription(subscriptionSlug: string, account: LyticsAccount): Promise<string> {
        const token = await this.getAccessToken(account.aid);
        const client = lytics.getClient(token);
        let subscriptions = await client.getSubscriptions();
        let subscription:(Subscription | undefined);
        if (subscriptions) {
            subscription = subscriptions.find(s => s.slug === subscriptionSlug);
        }
        return Promise.resolve(JSON.stringify(subscription ? subscription : {}, null, 4));
    }
    private async provideTextDocumentContentForTableFieldInfo(tableName: string, fieldName: string, account: LyticsAccount): Promise<string> {
        const token = await this.getAccessToken(account.aid);
        const client = lytics.getClient(token);
        const info = await client.getTableSchemaFieldInfo(tableName, fieldName);
        return Promise.resolve(JSON.stringify(info ? info : {}, null, 4));
    }
    private async provideTextDocumentContentForTopicInfo(topicLabel: string, account: LyticsAccount): Promise<string> {
        const token = await this.getAccessToken(account.aid);
        const client = lytics.getClient(token);
        const settings = SettingsManager.getLyticsApiSettings();
        let collection:(TopicUrlCollection | undefined) = undefined;
        if (settings.maxTopicUrls > 0) {
            collection = await client.getTopicUrls(topicLabel, settings.maxTopicUrls);
        }
        else {
            collection = await client.getTopicUrls(topicLabel);
        }
        return Promise.resolve(JSON.stringify(collection ? collection : {}, null, 4));
    }
    private async provideTextDocumentContentForEntity(tableName: string, fieldName: string, value: string, account: LyticsAccount): Promise<string> {
        const token = await this.getAccessToken(account.aid);
        const client = lytics.getClient(token);
        let entity = await client.getEntity(tableName, fieldName, value, true);
        if (!entity) {
            entity = {};
        }
        return Promise.resolve(JSON.stringify(entity, null, 4));
    }
    private async provideTextDocumentContentForCampaign(campaignId: string, account: LyticsAccount): Promise<string> {
        const token = await this.getAccessToken(account.aid);
        const client = lytics.getClient(token);
        const campaign = await client.getCampaign(campaignId);
        return Promise.resolve(JSON.stringify(campaign, null, 4));
    }
    private async provideTextDocumentContentForCampaignVariation(campaignVariationId: string, account: LyticsAccount): Promise<string> {
        const token = await this.getAccessToken(account.aid);
        const client = lytics.getClient(token);
        const variation = await client.getCampaignVariation(campaignVariationId);
        return Promise.resolve(JSON.stringify(variation, null, 4));
    }
    private async provideTextDocumentContentForCampaignVariationDetailOverride(campaignVariationId: string, account: LyticsAccount): Promise<string> {
        const token = await this.getAccessToken(account.aid);
        const client = lytics.getClient(token);
        const override = await client.getCampaignVariationDetailOverride(campaignVariationId);
        return Promise.resolve(JSON.stringify(override, null, 4));
    }
    private async provideTextDocumentContentForContentClassificationForActiveEditor(account: LyticsAccount): Promise<string> {
        const token = await this.getAccessToken(account.aid);
        const client = lytics.getClient(token);
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return Promise.reject('No active text editor is available.');
        }
        const text = editor.document.getText();
        const classification = await client.classifyUsingText(text);
        return Promise.resolve(JSON.stringify(classification, null, 4));
    }
    private async provideTextDocumentContentForContentClassificationForFile(filePath: string, account: LyticsAccount): Promise<string> {
        const token = await this.getAccessToken(account.aid);
        const client = lytics.getClient(token);
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
    private async provideTextDocumentContentForContentClassificationForUrl(url: string, account: LyticsAccount): Promise<string> {
        const token = await this.getAccessToken(account.aid);
        const client = lytics.getClient(token);
        const classification = await client.classifyUsingUrl(url, true);
        var str = JSON.stringify(classification, null, 4);
        return Promise.resolve(str);
    }
    private async provideTextDocumentContentForDocumentTopicsUrl(url: string, account: LyticsAccount): Promise<string> {
        const token = await this.getAccessToken(account.aid);
        const client = lytics.getClient(token);
        const topics = await client.getDocumentTopics(url);
        return Promise.resolve(JSON.stringify(topics ? topics : {}, null, 4));
    }
    private async provideTextDocumentForHashing(hashType: string, valueToHash: string): Promise<string> {
        let hashedValue:any = undefined;
        if (hashType === 'sip') {
            hashedValue = await LyticsUtils.generateSipHash(valueToHash);
        }
        else {
            throw new Error(`Hash type ${hashType} is not supported.`);
        }
        const result = {
            type: hashType,
            value: valueToHash,
            hashed: hashedValue
        };
        return Promise.resolve(JSON.stringify(result, null, 4));
    }
}
