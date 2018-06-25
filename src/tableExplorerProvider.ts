import * as vscode from 'vscode';
import * as path from 'path';
import { LyticsClient } from './lyticsClient';
import { TableNode } from './models';
import { SettingsManager } from './settingsManager';
import { StateManager } from './stateManager';

export class TableExplorerProvider implements vscode.TreeDataProvider<TableNode> {
	
	private _onDidChangeTreeData: vscode.EventEmitter<any> = new vscode.EventEmitter<any>();
	readonly onDidChangeTreeData: vscode.Event<any> = this._onDidChangeTreeData.event;
	tableNames: (string[] | undefined);
	constructor(private context: vscode.ExtensionContext) {
	}

	async refresh() {
		try {
			if (!StateManager.account) {
				throw new Error('No account is connected.');
			}
			await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: 'Refreshing table list.',
				cancellable: true
			}, async (progress, token) => {
				this._onDidChangeTreeData.fire();
			});	
		}
		catch(err) {
			vscode.window.showErrorMessage(`Refreshing tables failed: ${err.message}`);
			return Promise.resolve();
		}
	}

	getTreeItem(element: TableNode): vscode.TreeItem {
		if (element.kind === 'table') {
			return new TableTreeItem(element.name, element);
		}
		if (element.kind === 'field') {
			let item = new TableFieldTreeItem(element.as, element);
			item.iconPath = this.getIcon(element);
			return item;
		}
		throw new Error(`TableNode type ${element.kind} is not supported.`);
	}
	private getIcon(node: TableNode): any {
		var icon:(string | undefined) = undefined;
		if (node.kind === 'field') {
			icon = `${node.type}.svg`;
		}
		if (!icon) {
			return undefined;
		}
		return  {
			light: this.context.asAbsolutePath(path.join('resources', 'icons', 'light', icon)),
			dark: this.context.asAbsolutePath(path.join('resources', 'icons', 'dark', icon))
		};
	}
	async getChildren(element?: TableNode): Promise<TableNode[]> {
		const account = StateManager.account;
		if (!account) {
			return Promise.resolve([]);
		}
		if (!element) {
			const tables = await SettingsManager.getTables(account.aid);
			return Promise.resolve(tables);
		}
		if (element.kind === 'table') {
			let fields = await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: `Loading fields for table ${element.name}.`,
				cancellable: true
			}, async (progress, token) => {
				const client = new LyticsClient(account.apikey!);
				try {
					let fields = await client.getFields(element.name);
					fields = fields.sort( (a, b) => {
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
				catch(err) {
					vscode.window.showErrorMessage(`Loading tables failed: ${err.message}`);
					return Promise.resolve();
				}
			});
			if (!fields) {
				fields = [];
			}
			return Promise.resolve(fields);
		}
		return Promise.resolve([]);
	}

	async commandAddTable() {
		try {
			const account = StateManager.account;
			if (!account) {
				throw new Error('No account is connected.');
			}
			const name = await vscode.window.showInputBox({prompt: 'Enter the name of the table you want to add.'});
			if (!name || name.trim().length === 0) {
				return Promise.resolve();
			}
			await SettingsManager.addTable(name, account.aid);
			await this.refresh();
			vscode.window.showInformationMessage(`Table ${name} was added.`);
			return Promise.resolve();
		}
		catch(err) {
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
				var name = await vscode.window.showInputBox({prompt: 'Enter the name of the table you want to remove.'});
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
		catch(err) {
			vscode.window.showErrorMessage(`Remove table failed: ${err.message}`);
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
	constructor(
		public readonly name: string, 
		element: TableNode
	) {
		super(name, vscode.TreeItemCollapsibleState.None);
		if (element.shortdesc && element.shortdesc.trim().length > 0) {
			this.tooltip = element.shortdesc;
		}
	}
	contextValue = 'field';
}