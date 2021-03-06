import * as vscode from 'vscode';
import qs = require('query-string');
import { isArray, isBoolean } from 'util';
export class LyticsUri {
    private readonly _uri: vscode.Uri;
    public isAccountUri: boolean = false;
    public isDocumentTopicsUri: boolean = false;
    public isFunctionUri: boolean = false;
    public isQueryUri: boolean = false;
    public isSegmentUri: boolean = false;
    public isSegmentCollectionUri: boolean = false;
    public isSegmentMLUri: boolean = false;
    public isSettingUri: boolean = false;
    public isStreamUri: boolean = false;
    public isStreamQueriesUri: boolean = false;
    public isStreamFieldUri: boolean = false;
    public isSubscriptionUri: boolean = false;
    public isTableUri: boolean = false;
    public isTableFieldUri: boolean = false;
    public isTopicUri: boolean = false;
    public isCampaignUri: boolean = false;
    public isCampaignVariationUri: boolean = false;
    public isCampaignVariationOverrideUri: boolean = false;
    public isContentClassificationUri: boolean = false;
    public isEntityUri: boolean = false;
    public isHashUri: boolean = false;
    public accountId: number = 0;
    public documentTopicsUrl: (string | undefined);
    public queryAlias: (string | undefined);
    public queryTextMode: boolean = false;
    public queryInfoMode: boolean = false;
    public functionName: (string | undefined);
    public functionParameters: string[] = [];
    public segmentSlugName: (string | undefined);
    public segmentCollectionSlugName: (string | undefined);
    public modelName: (string | undefined);
    public settingSlugName: (string | undefined);
    public streamName: (string | undefined);
    public streamFieldName: (string | undefined);
    public subscriptionSlug: (string | undefined);
    public tableName: (string | undefined);
    public tableFieldName: (string | undefined);
    public tableFieldValue: (string | undefined);
    public topicLabel: (string | undefined);
    public campaignId: (string | undefined);
    public campaignVariationId: (string | undefined);
    public contentClassificationFilePath: (string | undefined);
    public contentClassificationUrl: (string | undefined);
    public useTextFromActiveEditor: boolean = false;
    public hashType: (string | undefined);
    public valueToHash: (string | undefined);    

    constructor(uri: vscode.Uri) {
        this._uri = uri;
        var parts = this._uri.path.substring(1).split('/');
        if (uri.authority === 'accounts') {
            if (parts.length === 1) {
                this.handleAccountsUri();
                return;
            }
        }
        if (uri.authority === 'utils') {
            this.handleUtilsUri();
            return;
        }
        if (parts.length > 1) {
            switch (parts[0]) {
                case 'queries':
                    this.handleQueriesUri();
                    return;
                case 'function':
                    this.handleFunctionUri();
                    return;
                case 'segments':
                    this.handleSegmentsUri();
                    return;
                case 'segmentcollections':
                    this.handleSegmentCollectionsUri();
                    return;
                case 'segmentml':
                    this.handleSegmentMLUri();
                    return;
                case 'settings':
                    this.handleSettingsUri();
                    return;
                case 'streams':
                    this.handleStreamsUri();
                    return;
                case 'subscriptions':
                    this.handleSubscriptionsUri();
                    return;
                case 'tables':
                    this.handleTablesUri();
                    return;
                case 'topics':
                    this.handleTopicsUri();
                    return;
                case 'campaigns':
                    this.handleCampaignsUri();
                    return;
                case 'variations':
                    this.handleCampaignVariationUri();
                    return;
                case 'document':
                    this.handleDocumentUri();
                    return;
                case 'content':
                    if (parts[1] === 'classification') {
                        this.handleContentClassificationUri();
                        return;
                    }
                    break;
            }
        }
    }

    private handleUtilsUri() {
        var parts = this._uri.path.substring(1).split('/');
        // lytics://utils/hash/{hashType}/{value}.json
        if (parts[0] === 'hash') {
            this.isHashUri = true;
            this.hashType = parts[1];
            //the value may contain slashes, so all parts 2+ must be joined
            let valueToHash = parts.slice(2).join('/');
            this.valueToHash = valueToHash.substring(0, valueToHash.indexOf('.json'));
            return;
        }
    }

    private handleAccountsUri() {
        var parts = this._uri.path.substring(1).split('/');
        // lytics://accounts/{aid}.json
        if (parts.length === 1) {
            var aid = parseInt(parts[0].substring(0, parts[0].indexOf('.json')));
            if (aid !== NaN) {
                this.isAccountUri = true;
                this.accountId = aid;
                return;
            }
        }
    }

    private handleQueriesUri() {
        var parts = this._uri.path.substring(1).split('/');
        // lytics://{aid}/queries/default.lql
        // lytics://{aid}/queries/default.json
        if (parts.length === 2) {
            var alias = parts[1].substring(0, parts[1].indexOf('.lql'));
            if (alias.length > 0) {
                this.queryTextMode = true;
            }
            else {
                alias = parts[1].substring(0, parts[1].indexOf('.json'));
                if (alias.length > 0) {
                    this.queryInfoMode = true;
                }
            }
            if (alias.length > 0) {
                this.isQueryUri = true;
                this.queryAlias = alias;
                return;
            }
        }
    }

    private handleFunctionUri() {
        var parts = this._uri.path.substring(1).split('/');
        // lytics://{aid}/function/name.json?params=a&params=b...
        if (parts.length === 2) {
            var name = parts[1].substring(0, parts[1].indexOf('.json'));
            if (name.length > 0) {
                this.isFunctionUri = true;
                this.functionName = name;
                const parsed = qs.parse(this._uri.query);
                if (parsed.params !== undefined) {
                    if (!isArray(parsed.params)) {
                        this.functionParameters.push(parsed.params);
                    }
                    else {
                        this.functionParameters = parsed.params;
                    }
                }
                return;
            }
        }
    }
    private handleSegmentsUri() {
        var parts = this._uri.path.substring(1).split('/');
        // lytics://{aid}/segments/id.json
        if (parts.length === 2) {
            if (parts[1].endsWith('.json')) {
                const segmentId = parts[1].substring(0, parts[1].indexOf('.json')).trim();
                if (segmentId.length > 0) {
                    this.isSegmentUri = true;
                    this.segmentSlugName = segmentId;
                    return;
                }
            }
            return;
        }
    }
    
    private handleSegmentCollectionsUri() {
        var parts = this._uri.path.substring(1).split('/');
        // lytics://{aid}/segmentcollections/id.json
        if (parts.length === 2) {
            if (parts[1].endsWith('.json')) {
                const collectionId = parts[1].substring(0, parts[1].indexOf('.json')).trim();
                if (collectionId.length > 0) {
                    this.isSegmentCollectionUri = true;
                    this.segmentCollectionSlugName = collectionId;
                    return;
                }
            }
            return;
        }
    }

    private handleSegmentMLUri() {
        var parts = this._uri.path.substring(1).split('/');
        //lytics://{aid}/segmentml/{name}.json
        if (parts.length === 2) {
            if (parts[1].endsWith('.json')) {
                const name = parts[1].substring(0, parts[1].indexOf('.json')).trim();
                if (name.length > 0) {
                    this.isSegmentMLUri = true;
                    this.modelName = name;
                    return;
                }
            }
        }
    }

    private handleSettingsUri() {
        var parts = this._uri.path.substring(1).split('/');
        // lytics://{aid}/settings/slug.json
        if (parts.length === 2) {
            if (parts[1].endsWith('.json')) {
                const settingSlug = parts[1].substring(0, parts[1].indexOf('.json')).trim();
                if (settingSlug.length > 0) {
                    this.isSettingUri = true;
                    this.settingSlugName = settingSlug;
                    return;
                }
            }
            return;
        }
    }

    private handleStreamsUri() {
        var parts = this._uri.path.substring(1).split('/');
        // lytics://{aid}/streams/default.json
        if (parts.length === 2) {
            if (parts[1].endsWith('.json')) {
                const streamName = parts[1].substring(0, parts[1].indexOf('.json')).trim();
                if (streamName.length > 0) {
                    this.isStreamUri = true;
                    this.streamName = streamName;
                    return;
                }
            }
            return;
        }
        // lytics://{aid}/streams/default/queries/default-queries.json
        else if (parts.length === 4) {
            if (parts[3].endsWith('.json')) {
                const streamName = parts[1].trim();
                const queriesConstant = parts[2];
                if (streamName.length > 0 && queriesConstant === 'queries') {
                    this.isStreamQueriesUri = true;
                    this.streamName = streamName;
                    return;
                }
            }
            return;
        }
        // lytics://{aid}/streams/default/_uid.json
        else if (parts.length === 3) {
            if (parts[2].endsWith('.json')) {
                const streamName = parts[1].trim();
                const fieldName = parts[2].substring(0, parts[2].indexOf('.json')).trim();
                if (streamName.length > 0 && fieldName.length > 0) {
                    this.isStreamFieldUri = true;
                    this.streamName = streamName;
                    this.streamFieldName = fieldName;
                    return;
                }
            }
            return;
        }
    }

    private handleSubscriptionsUri() {
        var parts = this._uri.path.substring(1).split('/');
        // lytics://{aid}/subscriptions/slug.json
        if (parts.length === 2) {
            if (parts[1].endsWith('.json')) {
                const slug = parts[1].substring(0, parts[1].indexOf('.json')).trim();
                if (slug.length > 0) {
                    this.isSubscriptionUri = true;
                    this.subscriptionSlug = slug;
                    return;
                }
            }
            return;
        }
    }

    private handleTablesUri() {
        var parts = this._uri.path.substring(1).split('/');
        // lytics://{aid}/tables/user.json
        if (parts.length === 2) {
            if (parts[1].endsWith('.json')) {
                const tableName = parts[1].substring(0, parts[1].indexOf('.json')).trim();
                if (tableName.length > 0) {
                    this.isTableUri = true;
                    this.tableName = tableName;
                    return;
                }
            }
            return;
        }
        // lytics://{aid}/tables/user/first_name.json
        else if (parts.length === 3) {
            if (parts[2].endsWith('.json')) {
                const tableName = parts[1].trim();
                const fieldName = parts[2].substring(0, parts[2].indexOf('.json')).trim();
                if (tableName.length > 0 && fieldName.length > 0) {
                    this.isTableFieldUri = true;
                    this.tableName = tableName;
                    this.tableFieldName = fieldName;
                    return;
                }
            }
            return;
        }
        // lytics://{aid}/tables/user/email/test@something.com.json
        else if (parts.length === 4) {
            if (parts[3].endsWith('.json')) {
                const tableName = parts[1].trim();
                const fieldName = parts[2].trim();
                const value = parts[3].substring(0, parts[3].indexOf('.json')).trim();
                if (tableName.length > 0 && fieldName.length > 0 && value.length > 0) {
                    this.isEntityUri = true;
                    this.tableName = tableName;
                    this.tableFieldName = fieldName;
                    this.tableFieldValue = value;
                    return;
                }
            }
            return;
        }
    }

    private handleTopicsUri() {
        var parts = this._uri.path.substring(1).split('/');
        // lytics://{aid}/topics/label.json
        if (parts.length === 2) {
            if (parts[1].endsWith('.json')) {
                const topicLabel = parts[1].substring(0, parts[1].indexOf('.json')).trim();
                if (topicLabel.length > 0) {
                    this.isTopicUri = true;
                    this.topicLabel = topicLabel;
                    return;
                }
            }
            return;
        }
    }
    private handleCampaignsUri() {
        var parts = this._uri.path.substring(1).split('/');
        // lytics://{aid}/campaigns/1234567890.json
        if (parts.length === 2) {
            if (parts[1].endsWith('.json')) {
                const campaignId = parts[1].substring(0, parts[1].indexOf('.json')).trim();
                if (campaignId.length > 0) {
                    this.isCampaignUri = true;
                    this.campaignId = campaignId;
                    return;
                }
            }
            return;
        }
    }
    private handleCampaignVariationUri() {
        var parts = this._uri.path.substring(1).split('/');
        // lytics://{aid}/variation/1234567890.json
        // lytics://{aid}/variation/1234567890.campaign.override
        if (parts.length === 2) {
            var campaignId = '';
            if (parts[1].endsWith('.json')) {
                campaignId = parts[1].substring(0, parts[1].indexOf('.json')).trim();
                this.isCampaignVariationUri = true;
            }
            else if (parts[1].endsWith('.campaign.override')) {
                campaignId = parts[1].substring(0, parts[1].indexOf('.campaign.override')).trim();
                this.isCampaignVariationOverrideUri = true;
            }
            else {
                return;
            }
            if (campaignId.length > 0) {
                this.campaignVariationId = campaignId;
                return;
            }
            return;
        }
    }
    private getValueFromStringOrArray(value:string | string[]): any {
        if (Array.isArray(value)) {
            if (value.length === 0) {
                return undefined;
            }
            return value[0];
        }
        return value;
    }
    private handleContentClassificationUri() {
        var parts = this._uri.path.substring(1).split('/');
        // lytics://{aid}/content/classification/draft/{file name}.json?path={full file path}&active=false
        // lytics://{aid}/content/classification/url/{url}.json
        if (parts.length < 4) {
            return;
        }
        if (parts[2] === 'draft') {
            if (parts[3].endsWith('.json')) {
                const parsed = qs.parse(this._uri.query);
                this.contentClassificationFilePath = this.getValueFromStringOrArray(parsed.path);
                this.useTextFromActiveEditor = this.getValueFromStringOrArray(parsed.active);
                this.isContentClassificationUri = true;
                return;
            }
        }
        else if (parts[2] === 'url') {
            this.contentClassificationUrl = this.getUrlFromUriPath(this._uri, 3);
            this.isContentClassificationUri = true;
        }
    }
    private handleDocumentUri() {
        var parts = this._uri.path.substring(1).split('/');
        // lytics://{aid}/document/topics/{url}.json
        if (parts.length > 2) {
            if (parts[1] === 'topics' && parts[parts.length - 1].endsWith('.json')) {
                this.isDocumentTopicsUri = true;
                this.documentTopicsUrl = this.getUrlFromUriPath(this._uri, 2);
                // const joined = parts.slice(2).join('/');
                // this.documentTopicsUrl = joined.substring(0, joined.indexOf('.json'));
                return;
            }
        }
    }
    private getUrlFromUriPath(uri: vscode.Uri, position: number = 0): string | undefined {
        var parts = uri.path.substring(1).split('/');
        const joined = parts.slice(position).join('/');
        const url = joined.substring(0, joined.indexOf('.json'));
        return url;
    }
}
