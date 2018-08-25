import * as vscode from 'vscode';
export interface ContentDisplayer {
    displayAsReadOnly(uri:vscode.Uri, readFromCache?:boolean):Promise<vscode.TextEditor>;
}
