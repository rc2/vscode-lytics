import * as vscode from 'vscode';
import * as path from 'path';
import { StateManager } from './stateManager';
import { LyticsAccount, DataStream, DataStreamField } from 'lytics-js/dist/types';
import lytics = require("lytics-js/dist/lytics");
import { LyticsExplorerProvider } from './lyticsExplorerProvider';
import { ContentReader } from './contentReader';

export class StreamExplorerProvider extends LyticsExplorerProvider<DataStream | DataStreamField> {

	constructor(contentReader: ContentReader, context: vscode.ExtensionContext) {
		super('stream list', contentReader, context);
	}

	private mapOfFieldToStream: Map<DataStreamField, DataStream> = new Map<DataStreamField, DataStream>();

	async getChildren(element?: DataStream): Promise<any[]> {
		const account = StateManager.account;
		if (!account) {
			return Promise.resolve([]);
		}
		if (!element) {
			return this.getStreams(account);
		}
		else {
			this.mapOfFieldToStream.clear();
			if (element.fields) {
				const fields = await this.getFields(element, account);
				if (fields && fields.length > 0) {
					for (let i = 0; i < fields.length; i++) {
						this.mapOfFieldToStream.set(fields[i], element);
					}
				}
				return Promise.resolve(fields);
			}
		}
		return Promise.resolve([]);
	}

	async getParent(element?: any): Promise<any> {
		if (!element) {
			return Promise.resolve(undefined);
		}
		if (element.name) {
			return Promise.resolve(this.mapOfFieldToStream.get(element));
		}
		return Promise.resolve(undefined);
	}

	getTreeItem(element: any): vscode.TreeItem {
		if (element.stream) {
			return new DataStreamTreeItem(element);
		}
		if (element.name) {
			let item = new DataStreamFieldTreeItem(element);
			item.iconPath = this.getIcon(element);
			return item;
		}
		throw new Error(`The specified element is not supported by the stream explorer provider.`);
	}

	private getIcon(element: DataStreamField): any {
		var icon: (string | undefined) = undefined;
		if (element instanceof DataStreamField) {
			icon = `${element.type}.svg`;
		}
		if (!icon) {
			return undefined;
		}
		return {
			light: this.context.asAbsolutePath(path.join('resources', 'icons', 'light', icon)),
			dark: this.context.asAbsolutePath(path.join('resources', 'icons', 'dark', icon))
		};
	}

	async getStreams(account: LyticsAccount): Promise<DataStream[]> {
		let streams = await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: `Loading data streams for account: ${account.aid}`,
			cancellable: true
		}, async (progress, token) => {
			const client = lytics.getClient(account.apikey!);
			try {
				const streams = await client.getStreams();
				var sortedStreams = streams.sort((a, b) => {
					if (a.stream! < b.stream!) {
						return -1;
					}
					if (a.stream! > b.stream!) {
						return 1;
					}
					return 0;
				});
				return Promise.resolve(sortedStreams);
			}
			catch (err) {
				let message: (string | undefined);
				if (err && err.response) {
					if (err.response.status === 404) {
						return Promise.resolve([]);
					}
				}
				if (!message) {
					message = `Loading data streams failed: ${err.message}`;
				}
				vscode.window.showErrorMessage(message);
				return Promise.resolve();
			}
		});
		if (!streams) {
			streams = [];
		}
		return Promise.resolve(streams);
	}

	async getFields(stream: DataStream, account: LyticsAccount): Promise<DataStreamField[]> {
		if (!stream.fields) {
			return Promise.resolve([]);
		}
		const fields: DataStreamField[] = stream.fields.sort((a, b) => {
			if (a.name! < b.name!) {
				return -1;
			}
			if (a.name! > b.name!) {
				return 1;
			}
			return 0;
		});
		return Promise.resolve(fields);
	}

	async commandShowQueryInfo(stream: DataStream) {
		try {
			const account = StateManager.account;
			if (!account) {
				throw new Error('No account is connected.');
			}
			await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: `Loading query info: ${stream.stream}`,
				cancellable: true
			}, async (progress, token) => {
				const uri = vscode.Uri.parse(`lytics://${account.aid}/streams/${stream.stream}/queries/${stream.stream}-queries.json`);
				const doc = await vscode.workspace.openTextDocument(uri);
				await vscode.window.showTextDocument(doc, { preview: false });
			});
		}
		catch (err) {
			vscode.window.showErrorMessage(`Show query info failed: ${err.message}`);
			return Promise.resolve();
		}
	}

	async commandShowField(field: DataStreamField) {
		try {
			const account = StateManager.account;
			if (!account) {
				throw new Error('No account is connected.');
			}
			const stream = await this.getParent(field) as DataStream;
			if (!stream) {
				throw new Error(`No parent was found for field ${field.name}`);
			}
			await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: `Loading stream field info: ${field.name}.`,
				cancellable: true
			}, async (progress, token) => {
				const uri = vscode.Uri.parse(`lytics://${account.aid}/streams/${stream.stream}/${field.name}.json`);
				const doc = await vscode.workspace.openTextDocument(uri);
				const editor = await vscode.window.showTextDocument(doc, { preview: false });
				return Promise.resolve(editor);
			});
		}
		catch (err) {
			vscode.window.showErrorMessage(`Show stream field failed: ${err.message}`);
			return Promise.resolve();
		}
	}
}

class DataStreamTreeItem extends vscode.TreeItem {
	constructor(element: DataStream) {
		super(element.stream!, vscode.TreeItemCollapsibleState.Collapsed);
		this.contextValue = 'stream';
	}
}

class DataStreamFieldTreeItem extends vscode.TreeItem {
	streamName: string;
	constructor(element: DataStreamField) {
		super(element.name!, vscode.TreeItemCollapsibleState.None);
		this.streamName = element.name!;
		this.contextValue = 'field';
		this.label = element.name;
		let properties: string[] = [];
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