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
			return this.getTables(account);
		}
		if (element.name) {
			return this.getFields(element, account);
		}
		return Promise.resolve([]);
	}

	/**
	 * Inherited from TreeDataProvider.
	 * @param element 
	 */
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
			item.iconPath = this.getTableFieldIcon(element);
			return item;
		}
		throw new Error(`The specified element is not supported by the table explorer provider.`);
	}

	/**
	 * Gets the parent for the node.
	 * @param node 
	 */
	async getParent(node?: any): Promise<any> {
		if (!node) {
			return Promise.resolve(undefined);
		}
		if (node.as) {
			return Promise.resolve(this.mapOfFieldToTable.get(node));
		}
		return Promise.resolve(undefined);
	}

	/**
	 * Gets the icon for a table field node.
	 * @param node 
	 */
	private getTableFieldIcon(node: any): any {
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

	/**
	 * Displays a quick pick from which the user can select a table.
	 * @param account 
	 * @param message 
	 * @returns The selected table, or undefined if none was selected.
	 */
	private async promptForTable(account: LyticsAccount, message?: string): Promise<TableSchema | undefined> {
		if (!message) {
			message = `Select a table.`;
		}
		const tables = await this.getTables(account);
		const values = tables.map(t => t.name);
		let value = await vscode.window.showQuickPick(values, {
			canPickMany: false,
			placeHolder: message
		});
		if (!value) {
			return Promise.resolve(undefined);
		}
		const table = tables.find(t => t.name === value);
		return Promise.resolve(table);
	}

	/**
	 * Displays a quick pick from which the user can select a field from a table.
	 * @param table
	 * @param identifiersOnly
	 * @param account 
	 * @param message 
	 * @returns The selected field, or undefined if none was selected.
	 */
	private async promptForField(table: TableSchema, identifiersOnly:boolean, account: LyticsAccount, message?: string): Promise<TableSchemaField | undefined> {
		if (!message) {
			message = `Select a table.`;
		}
		const fields = await this.getFields(table, account);
		const values:string[] = [];
		fields.forEach(f => {
			if (!identifiersOnly || f.is_by) {
				values.push(f.as);
			}
		});
		if (values.length === 0) {
			const msg = identifiersOnly ? `table ${table.name} has no identifier fields` : `table ${table.name} has no fields`;
			return Promise.reject({message: msg});
		}
		let value = await vscode.window.showQuickPick(values, {
			canPickMany: false,
			placeHolder: message
		});
		if (!value) {
			return Promise.resolve(undefined);
		}
		const field = fields.find(f => f.as === value);
		return Promise.resolve(field);
	}

	/**
	 * Wrapper around the API call to get the Lytics 
	 * tables that have been added to the account. 
	 * This function provides user feedback while
	 * data is read from Lytics.
	 * @param account 
	 * @returns Array of tables.
	 */
	private async getTables(account: LyticsAccount): Promise<TableSchema[]> {
		let tables = await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: `Loading tables.`,
			cancellable: true
		}, async (progress, token) => {
			const tables = await SettingsManager.getTables(account.aid);
			return Promise.resolve(tables);
		});
		return Promise.resolve(tables);
	}

	/**
	 * Wrapper around the API call to get Lytics table fields. 
	 * This function provides user feedback while data is 
	 * read from Lytics.
	 * @param account 
	 * @returns Array of table fields.
	 */
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
				const columns = table.columns;
				columns.forEach(col => {
					this.mapOfFieldToTable.set(col, element);
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
		const sortedFields = fields.sort((a, b) => {
			const a2 = a.name.toLowerCase();
			const b2 = b.name.toLowerCase();
			if (a2 < b2) {
				return -1;
			}
			if (a2 > b2) {
				return 1;
			}
			return 0;
		});
		return Promise.resolve(sortedFields);
	}

	async commandAddTable(): Promise<boolean> {
		try {
			const account = StateManager.getActiveAccount();
			if (!account) {
				throw new Error('No account is connected.');
			}
			const name = await vscode.window.showInputBox({ prompt: 'Enter the name of the table you want to add.' });
			if (!name || name.trim().length === 0) {
				return Promise.resolve(false);
			}
			await SettingsManager.addTable(name, account.aid);
			await this.refresh();
			vscode.window.showInformationMessage(`Table was added: ${name}`);
			return Promise.resolve(true);
		}
		catch (err) {
			vscode.window.showErrorMessage(`Add table failed: ${err.message}`);
			return Promise.resolve(false);
		}
	}

	async commandRemoveTable(table: TableSchema): Promise<boolean> {
		try {
			const account = StateManager.getActiveAccount();
			if (!account) {
				throw new Error('No account is connected.');
			}
			if (!table) {
				table = await this.promptForTable(account, 'Select the table you want to remove.');
			}
			if (!table) {
				return Promise.resolve(false);
			}
			const confirmed = await this.confirm(`Are you sure you want to remove the table ${table.name}?`);
			if (!confirmed) {
				return Promise.resolve(false);
			}
			await SettingsManager.removeTable(table.name, account.aid);
			await this.refresh();
			vscode.window.showInformationMessage(`Table was removed: ${table.name}`);
			return Promise.resolve(true);
		}
		catch (err) {
			vscode.window.showErrorMessage(`Remove table failed: ${err.message}`);
			return Promise.resolve(false);
		}
	}

	async commandShowEntitySearch(field: TableSchemaField): Promise<boolean> {
		try {
			const account = StateManager.getActiveAccount();
			if (!account) {
				throw new Error('No account is connected.');
			}
			var table: (TableSchema | undefined) = undefined;
			if (!field) {
				table = await this.promptForTable(account, 'Select the table whose field you want to search on.');
				if (table !== undefined) {
					field = await this.promptForField(table, true, account, 'Select the field you want to search on.');
				}
			}
			if (!field) {
				return Promise.resolve(false);
			}
			if (!table) {
				table = await this.getParent(field) as TableSchema;
				if (!table) {
					throw new Error(`No parent was found for field ${field.as}`);
				}
			}
			const value = await vscode.window.showInputBox({
				prompt: `Enter the search value for ${field.as}.`
			});
			if (!value || value.trim().length === 0) {
				return Promise.resolve(false);
			}
			await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: `Loading entity by ${field.as}: ${value}`,
				cancellable: true
			}, async (progress, token) => {
				const uri = vscode.Uri.parse(`lytics://${account.aid}/tables/${table.name}/${field.as}/${value}.json`);
				await this.displayAsReadOnly(uri);
			});
			return Promise.resolve(true);
		}
		catch (err) {
			vscode.window.showErrorMessage(`Entity search failed: ${err.message}`);
			return Promise.resolve(false);
		}
	}

	async commandShowFieldInfo(field: TableSchemaField): Promise<boolean> {
		try {
			const account = StateManager.getActiveAccount();
			if (!account) {
				throw new Error('No account is connected.');
			}
			var table: (TableSchema | undefined) = undefined;
			if (!field) {
				table = await this.promptForTable(account, 'Select the table whose field you want to show.');
				if (table !== undefined) {
					field = await this.promptForField(table, false, account, 'Select the field you want to show.');
				}
			}
			if (!field) {
				return Promise.resolve(false);
			}
			if (!table) {
				table = await this.getParent(field) as TableSchema;
				if (!table) {
					throw new Error(`No parent was found for field ${field.as}`);
				}
			}

			const fieldName = field.as;
			if (!fieldName || fieldName.trim().length === 0) {
				return Promise.resolve(false);
			}
			await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: `Loading table field info: ${fieldName}`,
				cancellable: true
			}, async (progress, token) => {
				const uri = vscode.Uri.parse(`lytics://${account.aid}/tables/${table.name}/${fieldName}.json`);
				await this.displayAsReadOnly(uri);
			});
			return Promise.resolve(true);
		}
		catch (err) {
			vscode.window.showErrorMessage(`Show table field info failed: ${err.message}`);
			return Promise.resolve(false);
		}
	}

	async commandToggleWhitelist(field: TableSchemaField): Promise<boolean> {
		try {
			const account = StateManager.getActiveAccount();
			if (!account) {
				throw new Error('No account is connected.');
			}
			var table: (TableSchema | undefined) = undefined;
			if (!field) {
				const tables = await this.getTables(account);
				table = tables.find(t => t.name === 'user');
				if (!table) {
					//This should not happen.
					throw new Error('The user table was not found.');
				}
				field = await this.promptForField(table, false, account, 'Select the field you want to whitelist.');
			}
			if (!field) {
				return Promise.resolve(false);
			}
			if (!table) {
				table = await this.getParent(field) as TableSchema;
				if (!table) {
					throw new Error(`No parent was found for field ${field.as}`);
				}
			}
			if (table.name !== 'user') {
				throw new Error(`Whitelisting currently is only supported for the 'user' table.`);
			}

			const fieldName = field.as;
			if (!fieldName || fieldName.trim().length === 0) {
				return Promise.resolve(false);
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
				return Promise.resolve(true);
			});
		}
		catch (err) {
			vscode.window.showErrorMessage(`Toggle whitelist failed: ${err.message}`);
			return Promise.resolve(false);
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