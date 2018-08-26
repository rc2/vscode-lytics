import * as vscode from 'vscode';
import * as path from 'path';
import { SettingsManager } from './settingsManager';
import { StateManager } from './stateManager';
import { LyticsAccount, TableSchemaField, TableSchema } from 'lytics-js/dist/types';
import lytics = require("lytics-js/dist/lytics");
import { LyticsExplorerProvider } from './lyticsExplorerProvider';
import { ContentReader } from './contentReader';

export class TableExplorerProvider extends LyticsExplorerProvider<TableSchema | TableSchemaField> {

	constructor(contentReader: ContentReader, context: vscode.ExtensionContext) {
		super('table list', contentReader, context);
	}

	private mapOfFieldToTable: Map<TableSchemaField, TableSchema> = new Map<TableSchemaField, TableSchema>();

	async getChildren(element?: any): Promise<any[]> {
		const account = StateManager.account;
		if (!account) {
			return Promise.resolve([]);
		}
		if (!element) {
			return this.getTables(account);
		}
		if (element.name) {
			return this.getFields(element, account);
		}
		return Promise.resolve([]);
	}

	async getParent(element?: any): Promise<any> {
		if (!element) {
			return Promise.resolve(undefined);
		}
		if (element.as) {
			return Promise.resolve(this.mapOfFieldToTable.get(element));
		}
		return Promise.resolve(undefined);
	}

	getTreeItem(element: any): vscode.TreeItem {
		if (element.name) {
			return new TableTreeItem(element.name, element);
		}
		if (element.as) {
			var name = element.as;
			if (element.is_by) {
				name = `* ${name}`;
			}
			let item = new TableFieldTreeItem(name, element);
			item.iconPath = this.getIcon(element);
			return item;
		}
		throw new Error(`The specified element is not supported by the table explorer provider.`);
	}
	private getIcon(node: any): any {
		var icon: (string | undefined) = undefined;
		if (node.as) {
			if (node.type.startsWith('[]')) {
				icon = 'array.svg';
			}
			else if (node.type.startsWith('map[')) {
				icon = 'map.svg';
			}
			else {
				icon = `${node.type}.svg`;
			}
		}
		if (!icon) {
			return undefined;
		}
		return {
			light: this.context.asAbsolutePath(path.join('resources', 'icons', 'light', icon)),
			dark: this.context.asAbsolutePath(path.join('resources', 'icons', 'dark', icon))
		};
	}

	private async getTables(account: LyticsAccount): Promise<TableSchema[]> {
		const tables = await SettingsManager.getTables(account.aid);
		return Promise.resolve(tables);
	}

	private async getFields(element: TableSchema, account: LyticsAccount): Promise<TableSchemaField[]> {
		//
		//Schema is loaded because the element parameter is 
		//not fully populated. It only contains information
		//from the settings.
		let fields = await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: `Loading fields for table: ${element.name}.`,
			cancellable: true
		}, async (progress, token) => {
			const client = lytics.getClient(account.apikey!);
			try {
				this.mapOfFieldToTable.clear();
				const table = await client.getTableSchema(element.name!);
				if (!table) {
					return Promise.resolve([]);
				}
				let columns = table.columns;
				columns.forEach(col => {
					this.mapOfFieldToTable.set(col, element);
				});
				columns = columns.sort((a, b) => {
					if (a.as! < b.as!) {
						return -1;
					}
					if (a.as! > b.as!) {
						return 1;
					}
					return 0;
				});
				return Promise.resolve(columns);
			}
			catch (err) {
				vscode.window.showErrorMessage(`Loading table fields failed: ${err.message}`);
				return Promise.resolve();
			}
		});
		if (!fields) {
			fields = [];
		}
		return Promise.resolve(fields);
	}

	async commandAddTable() {
		try {
			const account = StateManager.account;
			if (!account) {
				throw new Error('No account is connected.');
			}
			const name = await vscode.window.showInputBox({ prompt: 'Enter the name of the table you want to add.' });
			if (!name || name.trim().length === 0) {
				return Promise.resolve();
			}
			await SettingsManager.addTable(name, account.aid);
			await this.refresh();
			vscode.window.showInformationMessage(`Table was added: ${name}`);
			return Promise.resolve();
		}
		catch (err) {
			vscode.window.showErrorMessage(`Add table failed: ${err.message}`);
			return Promise.resolve();
		}
	}

	async commandRemoveTable(table: TableTreeItem) {
		try {
			const account = StateManager.account;
			if (!account) {
				throw new Error('No account is connected.');
			}
			if (!table) {
				var name = await vscode.window.showInputBox({ prompt: 'Enter the name of the table you want to remove.' });
				if (!name || name.trim().length === 0) {
					return Promise.resolve();
				}
			}
			else {
				name = table.name;
			}
			await SettingsManager.removeTable(name, account.aid);
			await this.refresh();
			vscode.window.showInformationMessage(`Table was removed: ${name}`);
			return Promise.resolve();
		}
		catch (err) {
			vscode.window.showErrorMessage(`Remove table failed: ${err.message}`);
			return Promise.resolve();
		}
	}

	async commandShowEntitySearch(field: TableSchemaField) {
		try {
			const account = StateManager.account;
			if (!account) {
				throw new Error('No account is connected.');
			}
			const table = await this.getParent(field) as TableSchema;
			if (!table) {
				throw new Error(`No parent was found for field ${field.as}`);
			}
			const value = await vscode.window.showInputBox({
				prompt: `Enter the search value for ${field.as}.`
			});
			if (!value || value.trim().length === 0) {
				return;
			}
			await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: `Loading entity by ${field.as}: ${value}`,
				cancellable: true
			}, async (progress, token) => {
				const uri = vscode.Uri.parse(`lytics://${account.aid}/tables/${table.name}/${field.as}/${value}.json`);
				await this.displayAsReadOnly(uri);
			});
			return Promise.resolve();
		}
		catch (err) {
			vscode.window.showErrorMessage(`Entity search failed: ${err.message}`);
			return Promise.resolve();
		}
	}

	async commandShowFieldInfo(field: TableSchemaField) {
		try {
			const account = StateManager.account;
			if (!account) {
				throw new Error('No account is connected.');
			}
			const table = await this.getParent(field) as TableSchema;
			if (!table) {
				throw new Error(`No parent was found for field ${field.as}`);
			}
			const fieldName = field.as;
			if (!fieldName || fieldName.trim().length === 0) {
				return Promise.resolve();
			}
			await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: `Loading table field info: ${fieldName}`,
				cancellable: true
			}, async (progress, token) => {
				const uri = vscode.Uri.parse(`lytics://${account.aid}/tables/${table.name}/${fieldName}.json`);
				await this.displayAsReadOnly(uri);
			});
		}
		catch (err) {
			vscode.window.showErrorMessage(`Show table field info failed: ${err.message}`);
			return Promise.resolve();
		}
	}

	async commandToggleWhitelist(field: TableSchemaField) {
		try {
			const account = StateManager.account;
			if (!account) {
				throw new Error('No account is connected.');
			}
			var parent = await this.getParent(field) as TableSchema;
			if (!parent || parent.name !== 'user') {
				throw new Error(`Whitelisting currently is only supported for the 'user' table.`);
			}
			const fieldName = field.as;
			if (!fieldName || fieldName.trim().length === 0) {
				return Promise.resolve();
			}
			await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: `Toggling whitelisted field: ${fieldName}`,
				cancellable: true
			}, async (progress, token) => {
				const client = lytics.getClient(account.apikey);
				const fields = await client.getWhitelistFields(account.aid);
				const add = (fields.indexOf(fieldName) === -1);
				var msg = add ? `add the field ${fieldName} to` : `remove the field ${fieldName} from`;
				const confirmation = await vscode.window.showQuickPick(['Cancel', 'Yes'], {
					canPickMany: false,
					placeHolder: `Do you want to ${msg} the whitelist?`
				});
				if (confirmation !== 'Yes') {
					return Promise.resolve();
				}
				await client.setWhitelistFieldStatus(account.aid, fieldName, add);
				msg = add ? 'added to' : 'removed from';
				vscode.window.showInformationMessage(`The field ${fieldName} was ${msg} the whitelist.`);
				return Promise.resolve();
			});
		}
		catch (err) {
			vscode.window.showErrorMessage(`Toggle whitelist failed: ${err.message}`);
			return Promise.resolve();
		}
	}
}

class TableTreeItem extends vscode.TreeItem {
	constructor(
		public readonly name: string,
		element: TableSchema
	) {
		super(name, vscode.TreeItemCollapsibleState.Collapsed);
	}
	contextValue = 'table';
}

class TableFieldTreeItem extends vscode.TreeItem {
	fieldName: string;
	constructor(
		public readonly name: string,
		field: TableSchemaField
	) {
		super(name, vscode.TreeItemCollapsibleState.None);
		this.fieldName = field.as!;
		if (field.is_by) {
			this.contextValue = 'field-identifier';
		}
		else {
			this.contextValue = 'field';
		}
		if (field.shortdesc && field.shortdesc.trim().length > 0) {
			this.tooltip = field.shortdesc;
		}
	}
	contextValue = 'field';
}