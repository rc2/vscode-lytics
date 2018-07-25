import * as vscode from 'vscode';

export class LyticsUri {
    private readonly _uri: vscode.Uri;
    public isAccountUri: boolean = false;
    public isQueryUri: boolean = false;
    public isStreamUri: boolean = false;
    public isStreamQueriesUri: boolean = false;
    public isStreamFieldUri: boolean = false;
    public isTableUri: boolean = false;
    public isTableFieldUri: boolean = false;
    public isEntityUri: boolean = false;
    public accountId: number = 0;
    public queryAlias: (string | undefined);
    public streamName: (string | undefined);
    public streamFieldName: (string | undefined);
    public tableName: (string | undefined);
    public tableFieldName: (string | undefined);
    public tableFieldValue: (string | undefined);

    constructor(uri: vscode.Uri) {
        this._uri = uri;
        var parts = this._uri.path.substring(1).split('/');
        if (uri.authority === 'accounts') {
            if (parts.length === 1) {
                this.handleAccountsUri();
                return;
            }
        }
        if (parts.length > 1) {
            switch (parts[0]) {
                case 'queries':
                    this.handleQueriesUri();
                    return;
                    break;
                case 'streams':
                    this.handleStreamsUri();
                    return;
                    break;
                case 'tables':
                    this.handleTablesUri();
                    return;
                    break;
            }
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
        if (parts.length === 2) {
            var alias = parts[1].substring(0, parts[1].indexOf('.lql'));
            if (alias.length > 0) {
                this.isQueryUri = true;
                this.queryAlias = alias;
                return;
            }
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
}
