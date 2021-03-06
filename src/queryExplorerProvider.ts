import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import qs = require('query-string');
import { StateManager } from './stateManager';
import { Query, LyticsAccount } from 'lytics-js/dist/types';
import { ContentReader } from './contentReader';
import { LyticsExplorerProvider } from './lyticsExplorerProvider';

export class QueryExplorerProvider extends LyticsExplorerProvider<Query> {

	/**
	 * Constructor.
	 * @param contentReader 
	 * @param context 
	 */
	constructor(contentReader: ContentReader, context: vscode.ExtensionContext) {
		super('query list', contentReader, context);
	}

	/**
	 * Inherited from TreeDataProvider.
	 * @param element 
	 */
	getTreeItem(element: any): vscode.TreeItem {
		if (element instanceof QueryGrouping) {
			return new QueryTableTreeItem(element.name);
		}
		if (element.query_type) {
			let item = new QueryTreeItem(element.alias, element);
			item.iconPath = this.getQueryIcon(element);
			return item;
		}
		throw new Error(`The specified element is not supported by the query explorer provider.`);
	}

	/**
	 * Inherited from TreeDataProvider.
	 * @param element 
	 */
	async getChildren(element?: any): Promise<any[]> {
		const account = StateManager.getActiveAccount();
		if (!account) {
			return Promise.resolve([]);
		}
		if (!element) {
			return this.getQueriesGroupedByTable(account);
		}
		if (element instanceof QueryGrouping) {
			return Promise.resolve(element.queries);
		}
	}

	/**
	 * Gets the icon for a query node.
	 * @param node 
	 */
	private getQueryIcon(node: any): any {
		return {
			light: this.context.asAbsolutePath(path.join('resources', 'icons', 'light', 'arrows')),
			dark: this.context.asAbsolutePath(path.join('resources', 'icons', 'dark', 'arrows'))
		};
	}

	/**
	 * Wrapper around the API call to get Lytics queries
	 * grouped by table name. This function provides 
	 * user feedback while data is read from Lytics.
	 * @param account 
	 * @returns Array of query groupings.
	 */
	private async getQueriesGroupedByTable(account: LyticsAccount): Promise<QueryGrouping[]> {
		const map = await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: `Loading queries for account: ${account.aid}`,
			cancellable: true
		}, async (progress, token) => {
			const client = await this.getClient(account.aid);
			return client.getQueriesGroupedByTable();
		});
		if (!map) {
			return Promise.resolve([]);
		}
		const groupings: QueryGrouping[] = [];
		for (let key of map.keys()) {
			let queries = map.get(key);
			if (queries && queries.length > 0) {
				let grouping = new QueryGrouping(key);
				for (var i = 0; i < queries.length; i++) {
					grouping.queries.push(queries[i]);
				}
				grouping.queries.sort((a, b) => {
					if (a.alias < b.alias) {
						return -1;
					}
					if (a.alias > b.alias) {
						return 1;
					}
					return 0;
				});
				groupings.push(grouping);
			}
		}
		groupings.sort((a, b) => {
			if (a.name < b.name) {
				return -1;
			}
			if (a.name > b.name) {
				return 1;
			}
			return 0;
		});
		return Promise.resolve(groupings);
	}

	/**
	 * Wrapper around the API call to get Lytics queries. 
	 * This function provides user feedback while data is 
	 * read from Lytics.
	 * @param account 
	 * @returns Array of queries.
	 */
	private async getQueries(account: LyticsAccount): Promise<Query[]> {
		const queries = await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: `Loading queries for account: ${account.aid}`,
			cancellable: true
		}, async (progress, token) => {
			const client = await this.getClient(account.aid);
			return client.getQueries();
		});
		if (!queries) {
			return Promise.resolve([]);
		}
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

	/**
	 * Wrapper around the API call to get a Lytics query. 
	 * This function provides user feedback while data is 
	 * read from Lytics.
	 * @param alias 
	 * @returns A query.
	 */
	private async getQuery(alias: string): Promise<Query | undefined> {
		const account = StateManager.getActiveAccount();
		if (!account) {
			return Promise.resolve(undefined);
		}
		const client = await this.getClient(account.aid);
		const query = await client.getQuery(alias);
		if (!query) {
			throw new Error(`The query ${alias} does not exist in the Lytics account.`);
		}
		return Promise.resolve(query);
	}

	private async saveQueryToFolder(query: Query, downloadPath: string, rejectIfNotAllowedToOverwrite: boolean = true): Promise<string | undefined> {
		const filePath = path.join(downloadPath, `${query.alias}.lql`);
		if (fs.existsSync(filePath)) {
			const confirmed = await this.confirm(`Do you want to overwrite the file ${query.alias}.lql?`);
			if (!confirmed) {
				if (rejectIfNotAllowedToOverwrite) {
					return Promise.reject({ message: 'file already exists and will not be overwritten' });
				}
				return Promise.resolve(undefined);
			}
		}
		await fs.writeFile(filePath, query.text, err => { });
		return Promise.resolve(filePath);
	}

	private async getFolderPathForDownload(): Promise<string | undefined> {
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

	/**
	 * Displays a quick pick from which the user can select a query.
	 * @param account 
	 * @param message 
	 * @returns The selected query, or undefined if none was selected.
	 */
	private async promptForQuery(account: LyticsAccount, message?: string): Promise<Query | undefined> {
		if (!message) {
			message = `Select a query.`;
		}
		const queries = await this.getQueries(account);
		const values = queries.map(q => q.alias);
		let value = await vscode.window.showQuickPick(values, {
			canPickMany: false,
			placeHolder: message
		});
		if (!value) {
			return Promise.resolve(undefined);
		}
		const query = queries.find(q => q.alias === value);
		return Promise.resolve(query);
	}

	async commandShowQueryInfo(query: Query): Promise<boolean> {
		try {
			const account = StateManager.getActiveAccount();
			if (!account) {
				throw new Error('No account is connected.');
			}
			if (!query) {
				query = await this.promptForQuery(account, `Select the query you want to show.`);
			}
			if (!query) {
				return Promise.resolve(false);
			}
			await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: `Opening query info: ${query.alias}`,
				cancellable: true
			}, async (progress, token) => {
				const uri = vscode.Uri.parse(`lytics://${account.aid}/queries/${query.alias}.json`);
				await this.displayAsReadOnly(uri);
			});
			return Promise.resolve(true);
		}
		catch (err) {
			vscode.window.showErrorMessage(`Open query info failed: ${err.message}`);
			return Promise.resolve(false);
		}
	}

	async commandShowQuery(query: Query): Promise<boolean> {
		try {
			const account = StateManager.getActiveAccount();
			if (!account) {
				throw new Error('No account is connected.');
			}
			if (!query) {
				query = await this.promptForQuery(account, `Select the query you want to show.`);
			}
			if (!query) {
				return Promise.resolve(false);
			}
			await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: `Opening query: ${query.alias}`,
				cancellable: true
			}, async (progress, token) => {
				const uri = vscode.Uri.parse(`lytics://${account.aid}/queries/${query.alias}.lql`);
				await this.displayAsReadOnly(uri);
			});
			return Promise.resolve(true);
		}
		catch (err) {
			vscode.window.showErrorMessage(`Open query failed: ${err.message}`);
			return Promise.resolve(false);
		}
	}
	async commandDownloadQuery(query: Query): Promise<boolean> {
		try {
			const account = StateManager.getActiveAccount();
			if (!account) {
				throw new Error('No account is connected.');
			}
			if (!query) {
				query = await this.promptForQuery(account, 'Select the query you want to download.');
			}
			if (!query) {
				return Promise.resolve(false);
			}
			const downloadPath = await this.getFolderPathForDownload();
			if (!downloadPath || downloadPath.trim().length === 0) {
				return Promise.resolve(false);
			}
			const wasDownloaded = await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: `Downloading query: ${query.alias}`,
				cancellable: true
			}, async (progress, token): Promise<boolean> => {
				const query2 = await this.getQuery(query.alias!);
				if (!query2) {
					return Promise.resolve(false);
				}
				const filePath = await this.saveQueryToFolder(query2, downloadPath);
				if (!filePath) {
					return Promise.resolve(false);
				}
				vscode.window.showInformationMessage(`Query downloaded: ${filePath}`);
				return Promise.resolve(true);
			});
			return Promise.resolve(wasDownloaded);
		}
		catch (err) {
			vscode.window.showErrorMessage(`Downloading query failed: ${err.message}`);
			return Promise.resolve(false);
		}
	}

	async commandDownloadQueries(grouping: QueryGrouping): Promise<boolean> {
		try {
			const account = StateManager.getActiveAccount();
			if (!account) {
				throw new Error('No account is connected.');
			}
			const downloadPath = await this.getFolderPathForDownload();
			if (!downloadPath || downloadPath.trim().length === 0) {
				return Promise.resolve(false);
			}
			let queries: Query[] = [];
			if (!grouping) {
				queries = await this.getQueries(account);
			}
			else {
				queries = grouping.queries;
			}
			var downloadedCount: number = 0;
			var notDownloadedCount: number = 0;
			for (var i = 0; i < queries.length; i++) {
				let query = queries[i];
				let path = await this.saveQueryToFolder(query, downloadPath, false);
				if (!path) {
					notDownloadedCount++;
				}
				else {
					downloadedCount++;
				}
			}
			let message = `${downloadedCount} queries downloaded.`;
			if (notDownloadedCount > 0) {
				message += ` ${notDownloadedCount} queries were not downloaded.`;
			}
			vscode.window.showInformationMessage(message);
			return Promise.resolve(true);
		}
		catch (err) {
			vscode.window.showErrorMessage(`Downloading queries failed: ${err.message}`);
			return Promise.resolve(false);
		}
	}
	async commandTestQueryFunction(): Promise<boolean> {
		try {
			const account = StateManager.getActiveAccount();
			if (!account) {
				throw new Error('No account is connected.');
			}
			const name = await vscode.window.showInputBox({
				prompt: 'Enter the name of the function you want to test.'
			});
			if (name === undefined || name.trim().length === 0) {
				return Promise.resolve(false);
			}
			let sCount: string = '0';
			let count = NaN;
			while (isNaN(count) || count < 0) {
				sCount = await vscode.window.showInputBox({
					prompt: 'Enter the number of parameters you want to specify.',
					value: sCount
				});
				if (sCount === undefined || sCount.trim().length === 0) {
					return Promise.resolve(false);
				}
				count = parseInt(sCount);
			}
			const parameters = new Array<string>(count);
			parameters.fill('???');
			for (var i = 0; i < count; i++) {
				const value = await vscode.window.showInputBox({
					prompt: `Enter the next parameter value: ${this.formatQueryFunctionCall(name, parameters)}`
				});
				if (value === undefined) {
					return Promise.resolve(false);
				}
				parameters[i] = value.replace(/^"(.*)"$/, '$1');
			}
			if (! (await this.confirm(`Do you want to test the command: ${this.formatQueryFunctionCall(name, parameters)}`))) {
				return Promise.resolve(false);
			}
			await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: `Testing query function: ${name}`,
				cancellable: true
			}, async (progress, token) => {
				// const client = await this.getClient(account.aid);
				// const result = await client.testFunction(name, parameters);
				// vscode.window.showWarningMessage(JSON.stringify(result, null, 4));
				// return Promise.resolve(true);
				const params = qs.stringify({
					params: parameters.map(p => encodeURIComponent(p))
				});
				const uri = vscode.Uri.parse(`lytics://${account.aid}/function/${name}.json?${params}`);
				await this.displayAsReadOnly(uri);
			});
			return Promise.resolve(true);
		}
		catch (err) {
			vscode.window.showErrorMessage(`Testing query function failed: ${err.message}`);
			return Promise.resolve(false);
		}
	}
	private formatQueryFunctionCall(name: string, parameters: string[]): string {
		return `${name}(${parameters.map(p => p === "???" ? p : `"${p}"`).join(', ')})`;
	}
}

class QueryGrouping {
	constructor(public readonly name: string) {
	}
	readonly queries: Query[] = [];
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
