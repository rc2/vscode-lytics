import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { StateManager } from './stateManager';
import lytics = require("lytics-js/dist/lytics");
import { Query } from 'lytics-js/dist/types';
import { ContentReader } from './contentReader';
import { LyticsExplorerProvider } from './lyticsExplorerProvider';

export class QueryExplorerProvider extends LyticsExplorerProvider<Query> {

	constructor(contentReader: ContentReader, context: vscode.ExtensionContext) {
		super('query list', contentReader, context);
	}

	getTreeItem(element: any): vscode.TreeItem {
		if (element.alias) {
			let item = new QueryTreeItem(element.alias, element);
			item.iconPath = this.getIcon(element);
			return item;
		}
		if (element) {
			return new QueryTableTreeItem(element);
		}
		throw new Error(`The specified element is not supported by the stream explorer provider.`);
	}

	private getIcon(node: Query): any {
		return {
			light: this.context.asAbsolutePath(path.join('resources', 'icons', 'light', 'arrows')),
			dark: this.context.asAbsolutePath(path.join('resources', 'icons', 'dark', 'arrows'))
		};
	}

	private mapOfQueriesForTable: Map<string, Query[]> = new Map<string, Query[]>();

	async getChildren(element?: any): Promise<any[]> {
		const account = StateManager.account;
		if (!account) {
			return Promise.resolve([]);
		}
		if (!element) {
			let map = await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: `Loading queries for account: ${account.aid}`,
				cancellable: true
			}, async (progress, token) => {
				const client = lytics.getClient(account.apikey!);
				try {
					let map = await client.getQueriesGroupedByTable();
					return Promise.resolve(map);
				}
				catch (err) {
					vscode.window.showErrorMessage(`Loading tables failed for account ${account.aid}: ${err.message}`);
					return Promise.resolve();
				}
			});
			if (!map) {
				return Promise.resolve([]);
			}
			this.mapOfQueriesForTable = map;
			const names: string[] = [];
			map.forEach((value: Query[], key: string) => {
				names.push(key);
			});
			names.sort();
			return Promise.resolve(names);
		}
		if (element) {
			if (this.mapOfQueriesForTable.has(element)) {
				const queries = this.mapOfQueriesForTable.get(element)! as Query[];
				queries.sort((a, b) => {
					if (a.alias < b.alias) {
						return -1;
					}
					if (a.alias > b.alias) {
						return 1;
					}
					return 0;
				});
				return Promise.resolve(queries);
			}
		}
		return Promise.resolve([]);
	}

	async commandShowQuery(query: Query) {
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

	async commandDownloadQuery(query: Query) {
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
				const query2 = await this.getQuery(query.alias!);
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
	async commandDownloadQueries(selectedTableName: string) {
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
				title: `Downloading queries for table: ${selectedTableName}`,
				cancellable: true
			}, async (progress, token) => {
				const queries = await this.getQueries(selectedTableName);
				if (!queries) {
					return Promise.resolve();
				}
				const saved: string[] = [];
				for (let i = 0; i < queries.length; i++) {
					const query = queries[i];
					try {
						const filePath = await this.saveQueryToFolder(query, downloadPath);
						if (filePath) {
							saved.push(query.alias!);
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
	async getQueries(tableName: string): Promise<Query[] | undefined> {
		const account = StateManager.account;
		if (!account) {
			return Promise.resolve(undefined);
		}
		const client = lytics.getClient(account.apikey!);
		const tables = await client.getQueriesGroupedByTable();
		if (!tables) {
			return Promise.resolve(undefined);
		}
		const queries = tables.get(tableName);
		return Promise.resolve(queries);
	}

	async getQuery(alias: string): Promise<Query | undefined> {
		const account = StateManager.account;
		if (!account) {
			return Promise.resolve(undefined);
		}
		const client = lytics.getClient(account.apikey!);
		const query = await client.getQuery(alias);
		if (!query) {
			throw new Error(`The query ${alias} does not exist in the Lytics account.`);
		}
		return Promise.resolve(query);
	}
	async saveQueryToFolder(query: Query, downloadPath: string): Promise<string | undefined> {
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
		public readonly name: string
	) {
		super(name, vscode.TreeItemCollapsibleState.Collapsed);
	}
	contextValue = 'table';
}

class QueryTreeItem extends vscode.TreeItem {
	constructor(
		public readonly name: string,
		public readonly element: Query
	) {
		super(name, vscode.TreeItemCollapsibleState.None);
		this.tooltip = element.description;
	}
	contextValue = 'query';
}
