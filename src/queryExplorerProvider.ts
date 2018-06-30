import * as vscode from 'vscode';
import * as path from 'path';
import { LyticsClient } from './lyticsClient';
import { QueryNode } from './models';
import { StateManager } from './stateManager';

export class QueryExplorerProvider implements vscode.TreeDataProvider<QueryNode> {
	
	private _onDidChangeTreeData: vscode.EventEmitter<any> = new vscode.EventEmitter<any>();
	readonly onDidChangeTreeData: vscode.Event<any> = this._onDidChangeTreeData.event;
	tableNames: (string[] | undefined);
	constructor(private context: vscode.ExtensionContext) {
	}

	async refresh() {
		try {
			await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: 'Refreshing query list.',
				cancellable: true
			}, async (progress, token) => {
				this._onDidChangeTreeData.fire();
			});	
		}
		catch(err) {
			vscode.window.showErrorMessage(`Refreshing queries failed: ${err.message}`);
			return Promise.resolve();
		}
	}

	getTreeItem(element: QueryNode): vscode.TreeItem {
		if (element.kind === 'table') {
			return new QueryTableTreeItem(element.table, element);
		}
		if (element.kind === 'query') {
			let item = new QueryTreeItem(element.alias, element);
			item.iconPath = this.getIcon(element);
			return item;
		}
		throw new Error(`QueryNode type ${element.kind} is not supported.`);
	}

	private getIcon(node: QueryNode): any {
		return  {
			light: this.context.asAbsolutePath(path.join('resources', 'icons', 'light', 'arrows')),
			dark: this.context.asAbsolutePath(path.join('resources', 'icons', 'dark', 'arrows'))
		};
	}
	async getChildren(element?: QueryNode): Promise<QueryNode[]> {
		const account = StateManager.account;
		if (!account) {
			return Promise.resolve([]);
		}
		if (!element) {
			let tables = await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: 'Loading queries.',
				cancellable: true
			}, async (progress, token) => {
				const client = new LyticsClient(account.apikey!);
				try {
					let tables = await client.getQueriesGroupedByTable();
					return Promise.resolve(tables);
				}
				catch(err) {
					vscode.window.showErrorMessage(`Loading tables failed: ${err.message}`);
					return Promise.resolve();
				}
			});
			if (!tables) {
				tables = [];
			}
			return Promise.resolve(tables);
		}
		if (element.kind === 'table') {
			return Promise.resolve(element.queries);
		}
		return Promise.resolve([]);
	}
	async commandOpenQuery(query: QueryNode) {
		try {
			const account = StateManager.account;
			if (!account) {
				throw new Error('No account is connected.');
			}
			if (!query) {
				var alias = await vscode.window.showInputBox({prompt: 'Enter the alias of the query you want to open.'});
			}
			else {
				alias = query.alias;
			}
			if (!alias || alias.trim().length === 0) {
				return Promise.resolve();
			}
			let reloadedQuery = await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: 'Loading query.',
				cancellable: true
			}, async (progress, token) => {
				const client = new LyticsClient(account.apikey!);
				try {
					if (!alias) {
						return Promise.resolve(undefined);
					}
					const query = await client.getQuery(alias);
					return Promise.resolve(query);
				}
				catch(err) {
					vscode.window.showErrorMessage(`Loading tables failed: ${err.message}`);
					return Promise.resolve();
				}
			});
			
			//display text
			//TODO: if already open, prompt to overwrite
			if (reloadedQuery) {
				const uri = vscode.Uri.parse(`untitled:${reloadedQuery.alias}.lql`);
				const doc = await vscode.workspace.openTextDocument(uri);
				const editor = await vscode.window.showTextDocument(doc, 1, false);
				editor.edit(builder => {
					if (!reloadedQuery) {
						return;
					}
					builder.insert(new vscode.Position(0, 0), reloadedQuery.text);
				});
			}
			return Promise.resolve(reloadedQuery);
		}
		catch(err) {
			vscode.window.showErrorMessage(`Open query failed: ${err.message}`);
			return Promise.resolve();
		}
	}
}

class QueryTableTreeItem extends vscode.TreeItem {
	constructor(
		public readonly name: string, 
		element: QueryNode
	) {
		super(name, vscode.TreeItemCollapsibleState.Collapsed);
	}
	contextValue = 'table';
}

class QueryTreeItem extends vscode.TreeItem {
	constructor(
		public readonly name: string, 
		public readonly element: QueryNode
	) {
		super(name, vscode.TreeItemCollapsibleState.None);
		this.tooltip = element.description;
	}
	contextValue = 'query';
}
