import * as vscode from 'vscode';
export interface ContentReader {
    removeFromCache(uri:vscode.Uri):void;
}
