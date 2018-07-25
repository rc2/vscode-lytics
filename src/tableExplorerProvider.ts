import * as vscode from 'vscode';
import * as path from 'path';
import { LyticsClient } from './lyticsClient';
import { TableNode, Account } from './models';
import { SettingsManager } from './settingsManager';
import { StateManager } from './stateManager';

export class TableExplorerProvider implements vscode.TreeDataProvider<TableNode> {

	private _onDidChangeTreeData: vscode.EventEmitter<any> = new vscode.EventEmitter<any>();
	readonly onDidChangeTreeData: vscode.Event<any> = this._onDidChangeTreeData.event;

	constructor(private context: vscode.ExtensionContext) {
	}

	async refresh() {
		try {
			await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: 'Refreshing table list.',
				cancellable: true
			}, async (progress, token) => {
				this._onDidChangeTreeData.fire();
			});
		}
		catch (err) {
			vscode.window.showErrorMessage(`Refreshing tables failed: ${err.message}`);
			return Promise.resolve();
		}
	}

	async getChildren(element?: TableNode): Promise<TableNode[]> {
		const account = StateManager.account;
		if (!account) {
			return Promise.resolve([]);
		}
		if (!element) {
			return this.getTables(account);
		}
		if (element.kind === 'table') {
			return this.getFields(element, account);
		}
		return Promise.resolve([]);
	}

	getTreeItem(element: TableNode): vscode.TreeItem {
		if (element.kind === 'table') {
			return new TableTreeItem(element.name, element);
		}
		if (element.kind === 'field') {
			var name = element.as;
			if (element.is_by) {
				name = `* ${name}`;
			}
			let item = new TableFieldTreeItem(name, element);
			item.iconPath = this.getIcon(element);
			return item;
		}
		throw new Error(`TableNode type ${element.kind} is not supported.`);
	}
	private getIcon(node: TableNode): any {
		var icon: (string | undefined) = undefined;
		if (node.kind === 'field') {
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

	async getTables(account: Account): Promise<TableNode[]> {
		const tables = await SettingsManager.getTables(account.aid);
		return Promise.resolve(tables);
	}

	async getFields(element: TableNode, account: Account): Promise<TableNode[]> {
		let fields = await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: `Loading fields for table ${element.name}.`,
			cancellable: true
		}, async (progress, token) => {
			const client = new LyticsClient(account.apikey!);
			try {
				let fields = await client.getTableFields(element.name);
				fields = fields.sort((a, b) => {
					if (a.as < b.as) {
						return -1;
					}
					if (a.as > b.as) {
						return 1;
					}
					return 0;
				});
				return Promise.resolve(fields);
			}
			catch (err) {
				vscode.window.showErrorMessage(`Loading tables failed: ${err.message}`);
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
			vscode.window.showInformationMessage(`Table ${name} was added.`);
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
			vscode.window.showInformationMessage(`Table ${name} was removed.`);
			return Promise.resolve();
		}
		catch (err) {
			vscode.window.showErrorMessage(`Remove table failed: ${err.message}`);
			return Promise.resolve();
		}
	}

	async commandShowEntitySearch(field: TableNode) {
		try {
			const tableName = field.parentName;
			const account = StateManager.account;
			if (!account) {
				throw new Error('No account is connected.');
			}
			const value = await vscode.window.showInputBox({
				prompt: `Enter the search value for ${field.as}.`
			});
			if (!value || value.trim().length === 0) {
				return;
			}
			const uri = vscode.Uri.parse(`lytics://${account.aid}/tables/${tableName}/${field.as}/${value}.json`);
			const doc = await vscode.workspace.openTextDocument(uri);
			const editor = await vscode.window.showTextDocument(doc, { preview: false });
			return Promise.resolve(editor);
		}
		catch (err) {
			vscode.window.showErrorMessage(`Entity search failed: ${err.message}`);
			return Promise.resolve();
		}
	}

	async commandShowFieldInfo(field: TableNode) {
		try {
			const account = StateManager.account;
			if (!account) {
				throw new Error('No account is connected.');
			}
			const fieldName = field.as;
			const tableName = field.parentName;
			if (!fieldName || fieldName.trim().length === 0) {
				return Promise.resolve();
			}
			if (!tableName || tableName.trim().length === 0) {
				return Promise.resolve();
			}
			let fieldInfo = await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: 'Loading table field info.',
				cancellable: true
			}, async (progress, token) => {
				const client = new LyticsClient(account.apikey!);
				try {
					const info = await client.getTableFieldInfo(tableName, fieldName);
					return Promise.resolve(info);
				}
				catch (err) {
					vscode.window.showErrorMessage(`Loading table field info failed: ${err.message}`);
					return Promise.resolve();
				}
			});

			if (fieldInfo) {
				const uri = vscode.Uri.parse(`lytics://${account.aid}/tables/${tableName}/${fieldName}.json`);
				const doc = await vscode.workspace.openTextDocument(uri);
				const editor = await vscode.window.showTextDocument(doc, { preview: false });
				return Promise.resolve(editor);
			}
			return Promise.resolve(fieldInfo);
		}
		catch (err) {
			vscode.window.showErrorMessage(`Open table field failed: ${err.message}`);
			return Promise.resolve();
		}
	}
}

class TableTreeItem extends vscode.TreeItem {
	constructor(
		public readonly name: string,
		element: TableNode
	) {
		super(name, vscode.TreeItemCollapsibleState.Collapsed);
	}
	contextValue = 'table';
}

class TableFieldTreeItem extends vscode.TreeItem {
	fieldName: string;
	constructor(
		public readonly name: string,
		field: TableNode
	) {
		super(name, vscode.TreeItemCollapsibleState.None);
		this.fieldName = field.name;
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