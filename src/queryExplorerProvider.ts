import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
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
				title: `Refreshing query list.`,
				cancellable: true
			}, async (progress, token) => {
				this._onDidChangeTreeData.fire();
			});
		}
		catch (err) {
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
		throw new Error(`QueryNode type is not supported: ${element.kind} `);
	}

	private getIcon(node: QueryNode): any {
		return {
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
				title: `Loading queries for account: ${account.aid}`,
				cancellable: true
			}, async (progress, token) => {
				const client = new LyticsClient(account.apikey!);
				try {
					let tables = await client.getQueriesGroupedByTable();
					return Promise.resolve(tables);
				}
				catch (err) {
					vscode.window.showErrorMessage(`Loading tables failed for account ${account.aid}: ${err.message}`);
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

	async commandShowQuery(query: QueryNode) {
		try {
			const account = StateManager.account;
			if (!account) {
				throw new Error('No account is connected.');
			}
			await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: `Opening query: ${query.alias}`,
				cancellable: true
			}, async (progress, token) => {
				const uri = vscode.Uri.parse(`lytics://${account.aid}/queries/${query.alias}.lql`);
				const doc = await vscode.workspace.openTextDocument(uri);
				await vscode.window.showTextDocument(doc, { preview: false });
			});
		}
		catch (err) {
			vscode.window.showErrorMessage(`Open query failed: ${err.message}`);
			return Promise.resolve();
		}
	}
	async getFolderPathForDownload(): Promise<string | undefined> {
		const paths = await vscode.window.showOpenDialog({
			canSelectFiles: false,
			canSelectFolders: true,
			canSelectMany: false,
		});
		if (!paths || paths.length !== 1) {
			return Promise.resolve(undefined);
		}
		return Promise.resolve(paths[0].fsPath);
	}

	async commandDownloadQuery(query: QueryNode) {
		try {
			const account = StateManager.account;
			if (!account) {
				throw new Error('No account is connected.');
			}
			const downloadPath = await this.getFolderPathForDownload();
			if (!downloadPath || downloadPath.trim().length === 0) {
				return Promise.resolve();
			}
			await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: `Downloading query: ${query.alias}`,
				cancellable: true
			}, async (progress, token) => {
				const query2 = await this.getQuery(query.alias);
				if (!query2) {
					return Promise.resolve();
				}
				const filePath = await this.saveQueryToFolder(query2, downloadPath);
				if (filePath) {
					vscode.window.showInformationMessage(`Query downloaded: ${filePath}`);
					return;
				}
			});
		}
		catch (err) {
			vscode.window.showErrorMessage(`Downloading query failed: ${err.message}`);
			return Promise.resolve();
		}
	}
	async commandDownloadQueries(selectedTable: QueryNode) {
		try {
			const account = StateManager.account;
			if (!account) {
				throw new Error('No account is connected.');
			}
			const downloadPath = await this.getFolderPathForDownload();
			if (!downloadPath || downloadPath.trim().length === 0) {
				return Promise.resolve();
			}
			await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: `Downloading queries for table: ${selectedTable.table}`,
				cancellable: true
			}, async (progress, token) => {
				const queries = await this.getQueries(selectedTable.table);
				if (!queries) {
					return Promise.resolve();
				}
				const saved: string[] = [];
				for (let i = 0; i < queries.length; i++) {
					const query = queries[i];
					try {
						const filePath = await this.saveQueryToFolder(query, downloadPath);
						if (filePath) {
							saved.push(query.alias);
						}
					}
					catch (err) {
						vscode.window.showErrorMessage(`Unable to save query ${query.alias}: ${err.message}`);
					}
				}
				if (saved.length > 0) {
					const msg = saved.length === 1 ? 'query was' : 'queries were';
					vscode.window.showInformationMessage(`${saved.length} ${msg} saved to: ${downloadPath}`);
				}
			});
		}
		catch (err) {
			vscode.window.showErrorMessage(`Downloading query failed: ${err.message}`);
			return Promise.resolve();
		}

	}
	async getQueries(tableName: string): Promise<QueryNode[] | undefined> {
		const account = StateManager.account;
		if (!account) {
			return Promise.resolve(undefined);
		}
		const client = new LyticsClient(account.apikey!);
		const tables = await client.getQueriesGroupedByTable();
		if (!tables) {
			return Promise.resolve(undefined);
		}
		const table = tables.find(t => t.table === tableName);
		if (!table) {
			return Promise.resolve(undefined);
		}
		return Promise.resolve(table.queries);
	}

	async getQuery(alias: string): Promise<QueryNode | undefined> {
		const account = StateManager.account;
		if (!account) {
			return Promise.resolve(undefined);
		}
		const client = new LyticsClient(account.apikey!);
		const query = await client.getQuery(alias);
		if (!query) {
			throw new Error(`The query ${alias} does not exist in the Lytics account.`);
		}
		return Promise.resolve(query);
	}
	async saveQueryToFolder(query: QueryNode, downloadPath: string): Promise<string | undefined> {
		const filePath = path.join(downloadPath, `${query.alias}.lql`);
		if (fs.existsSync(filePath)) {
			const confirmation = await vscode.window.showQuickPick(['Ignore', 'Overwrite'], {
				canPickMany: false,
				placeHolder: `Do you want to overwrite the file ${query.alias}.lql?`
			});
			if (confirmation !== 'Overwrite') {
				return Promise.reject({ message: 'file already exists' });
			}
		}
		await fs.writeFile(filePath, query.text, err => { });
		return Promise.resolve(filePath);
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
