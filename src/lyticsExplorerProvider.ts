import * as vscode from 'vscode';
import { ContentDisplayer } from './contentDisplayer';
import { ContentReader } from './contentReader';

export abstract class LyticsExplorerProvider<T> implements vscode.TreeDataProvider<T>, ContentDisplayer {
    abstract getTreeItem(element: T): vscode.TreeItem | Thenable<vscode.TreeItem>;
    abstract getChildren(element?: T): vscode.ProviderResult<T[]>;

	private _onDidChangeTreeData: vscode.EventEmitter<any> = new vscode.EventEmitter<any>();
	readonly onDidChangeTreeData: vscode.Event<any> = this._onDidChangeTreeData.event;
	constructor(private description:string, private contentReader: ContentReader, public context: vscode.ExtensionContext) {
	}

	async refresh() {
		try {
			await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: `Refreshing ${this.description}.`,
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

    async displayAsReadOnly(uri:vscode.Uri, readFromCache?:boolean): Promise<vscode.TextEditor> {
		if (this.contentReader) {
			this.contentReader.removeFromCache(uri);
		}
		const doc = await vscode.workspace.openTextDocument(uri);
		return vscode.window.showTextDocument(doc, { preview: false });
	}
}
