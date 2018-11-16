import * as vscode from 'vscode';
import { ContentDisplayer } from './contentDisplayer';
import { ContentReader } from './contentReader';
import { SettingsManager } from './settingsManager';
import { LyticsClient } from 'lytics-js/dist/LyticsClient';
import lytics = require("lytics-js/dist/lytics");

export abstract class LyticsExplorerProvider<T> implements vscode.TreeDataProvider<T>, ContentDisplayer {
	abstract getTreeItem(element: T): vscode.TreeItem | Thenable<vscode.TreeItem>;
	abstract getChildren(element?: T): vscode.ProviderResult<T[]>;

	private _onDidChangeTreeData: vscode.EventEmitter<any> = new vscode.EventEmitter<any>();
	readonly onDidChangeTreeData: vscode.Event<any> = this._onDidChangeTreeData.event;
	constructor(private description: string, private contentReader: ContentReader, public context: vscode.ExtensionContext) {
	}

	async getClient(aid: number): Promise<LyticsClient> {
		const token = await SettingsManager.getAccessToken(aid);
		if (token === undefined || token.trim().length === 0) {
			return Promise.reject(`No access token is available for the account: ${aid}`);
		}
		const client = lytics.getClient(token);
		return Promise.resolve(client);
	}

	async confirm(message: string): Promise<boolean> {
		const confirmation = await vscode.window.showQuickPick(['No', 'Yes'], {
			canPickMany: false,
			placeHolder: message
		});
		return Promise.resolve(confirmation === 'Yes');
	}

	async refresh(message?: string) {
		try {
			if (!message) {
				message = `Refreshing ${this.description}.`;
			}
			await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: message,
				cancellable: true
			}, async (progress, token) => {
				this._onDidChangeTreeData.fire();
			});
		}
		catch (err) {
			vscode.window.showErrorMessage(`Refreshing ${this.description} failed: ${err.message}`);
			return Promise.resolve();
		}
	}

	async displayAsReadOnly(uri: vscode.Uri, readFromCache?: boolean): Promise<vscode.TextEditor> {
		if (this.contentReader) {
			this.contentReader.removeFromCache(uri);
		}
		const doc = await vscode.workspace.openTextDocument(uri);
		return vscode.window.showTextDocument(doc, { preview: false });
	}
	getValueInBrackets(value: string): (string | undefined) {
		if (value !== undefined) {
			var matches = value.match(/\[(.*?)\]/);
			if (matches) {
				return matches[1];
			}
		}
		return undefined;
	}
	//const wait = (ms:number) => new Promise(resolve => setTimeout(resolve, ms));
	async wait(ms:number) {
		return new Promise(resolve => setTimeout(resolve, ms));
	}

}
