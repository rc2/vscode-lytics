import * as vscode from 'vscode';
import * as path from 'path';
import { LyticsClient } from './lyticsClient';
import { DataStreamNode } from './models';
import { StateManager } from './stateManager';

export class StreamExplorerProvider implements vscode.TreeDataProvider<DataStreamNode> {

	private _onDidChangeTreeData: vscode.EventEmitter<any> = new vscode.EventEmitter<any>();
	readonly onDidChangeTreeData: vscode.Event<any> = this._onDidChangeTreeData.event;
	constructor(private context: vscode.ExtensionContext) {
	}
	
	async refresh() {
		try {
			await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: 'Refreshing stream list.',
				cancellable: true
			}, async (progress, token) => {
				this._onDidChangeTreeData.fire();
			});
			}
		catch(err) {
			vscode.window.showErrorMessage(`Refreshing streams failed: ${err.message}`);
			return Promise.resolve();
		}
	}

	getTreeItem(element: DataStreamNode): vscode.TreeItem {
		if (element.kind === 'stream') {
			return new DataStreamTreeItem(element);
		}
		if (element.kind === 'field') {
			let item = new DataStreamFieldTreeItem(element);
			item.iconPath = this.getIcon(element);
			return item;
		}
		throw new Error(`DataStreamNode type ${element.kind} is not supported.`);
	}
	private getIcon(node: DataStreamNode): any {
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
	async getChildren(element?: DataStreamNode): Promise<DataStreamNode[]> {
		if (!element) {
			const account = StateManager.account;
			if (!account) {
				return Promise.resolve([]);
			}

			let streams = await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: 'Loading data streams.',
				cancellable: true
			}, async (progress, token) => {
				const account = StateManager.account;
				if (!account) {
					return Promise.resolve();
				}
				const client = new LyticsClient(account.apikey!);
				try {
					let streams = await client.getStreams();
					streams = streams.sort( (a, b) => {
						if (a.stream < b.stream) {
							return -1;
						}
						if (a.stream > b.stream) {
							return 1;
						}
						return 0;
					});
					return Promise.resolve(streams);
				}
				catch(err) {
					vscode.window.showErrorMessage(`Loading data streams failed: ${err.message}`);
					return Promise.resolve();
				}
			});
			if (!streams) {
				streams = [];
			}
			return Promise.resolve(streams);
		}
		else {
			if (element.fields) {
				let fields:DataStreamNode[] = [];
				for(let i=0; i<element.fields.length; i++) {
					let field = element.fields[i];
					fields.push(field);
				}
				fields = fields.sort( (a, b) => {
					if (a.name < b.name) {
						return -1;
					}
					if (a.name > b.name) {
						return 1;
					}
					return 0;
				});
				return Promise.resolve(fields);
			}
		}
		return Promise.resolve([]);
	}
}

class DataStreamTreeItem extends vscode.TreeItem {
	constructor(element: DataStreamNode) {
		super(element.stream, vscode.TreeItemCollapsibleState.Collapsed);
		this.contextValue = element.kind;
	}
}

class DataStreamFieldTreeItem extends vscode.TreeItem {
	constructor(element: DataStreamNode) {
		super(element.name, vscode.TreeItemCollapsibleState.None);
		this.contextValue = element.kind;
		this.label = element.name;
		let properties:string[] = [];
		if (element.is_array) {
			properties.push('array');
		}
		if (element.hidden) {
			properties.push('hidden');
		}
		if (properties.length > 0) {
			this.label += ` [${properties.join(', ')}]`;
		}
	}
}