import * as vscode from 'vscode';
import { StateManager } from './stateManager';
import { ContentReader } from './contentReader';
import { ContentDisplayer } from './contentDisplayer';
const path = require('path');
const qs = require('query-string');

export class ContentClassificationManager implements vscode.Disposable, ContentDisplayer {
	_contentReader:ContentReader;
	constructor(reader:ContentReader) {
		this._contentReader = reader;
	}
	dispose() {
	}
	async displayAsReadOnly(uri:vscode.Uri, readFromCache?:boolean): Promise<vscode.TextEditor> {
		if (this._contentReader) {
			this._contentReader.removeFromCache(uri);
		}
		const doc = await vscode.workspace.openTextDocument(uri);
		return vscode.window.showTextDocument(doc, { preview: false });
	}
	async commandClassifyEditorContents() {
		const editor = vscode.window.activeTextEditor;
		const fullPath = editor ? editor.document.fileName : undefined;
		if (!fullPath) {
			vscode.window.showErrorMessage(`Unable to determine the active document in the editor.`);
			return Promise.resolve();
		}
		const parsed = path.parse(fullPath);
		const fileName = `${parsed.name}${parsed.ext}`;
		const params = {
			active: true
		};
		return this.showClassification(fileName, params);
	}
	private async showClassification(fileName: string, params:any): Promise<boolean> {
		try {
			const account = StateManager.getActiveAccount();
			if (!account) {
				throw new Error('No account is connected.');
			}
			await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: `Classifying content from: ${fileName}`,
				cancellable: true
			}, async (progress, token) => {
				const uri = vscode.Uri.parse(`lytics://${account.aid}/content/classification/draft/${fileName}_classification.json?${qs.stringify(params)}`);
				return this.displayAsReadOnly(uri);
			});
		}
		catch (err) {
			vscode.window.showErrorMessage(`Attempt to classify content failed: ${err.message}`);
			return Promise.resolve(false);
		}
		return Promise.resolve(true);
	}
	async commandClassifyFileContents(uri: vscode.Uri): Promise<boolean> {
		if (!uri) {
			const selection = await vscode.window.showOpenDialog({
				canSelectFiles: true,
				canSelectMany: false,
				canSelectFolders: false
			});
			if (selection && selection.length > 0) {
				uri = selection[0];	
			}
		}
		if (!uri) {
			return Promise.resolve(false);
		}
		const parsed = path.parse(uri.fsPath);
		const fileName = `${parsed.name}${parsed.ext}`;
		const params = {
			path: uri.fsPath,
			active: false
		};
		return this.showClassification(fileName, params);
	}
}