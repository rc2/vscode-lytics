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

	/**
	 * Inherited from TreeDataProvider.
	 * @param element 
	 */
	async getChildren(element?: DataStream): Promise<any[]> {
		const account = StateManager.getActiveAccount();
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

	/**
	 * Inherited from TreeDataProvider.
	 * @param element 
	 */
	getTreeItem(element: any): vscode.TreeItem {
		if (element.stream) {
			return new DataStreamTreeItem(element);
		}
		if (element.name) {
			let item = new DataStreamFieldTreeItem(element);
			item.iconPath = this.getStreamFieldIcon(element);
			return item;
		}
		throw new Error(`The specified element is not supported by the stream explorer provider.`);
	}

	/**
	 * Gets the parent for the node.
	 * @param node 
	 */
	async getParent(node?: any): Promise<any> {
		if (!node) {
			return Promise.resolve(undefined);
		}
		if (node.name) {
			return Promise.resolve(this.mapOfFieldToStream.get(node));
		}
		return Promise.resolve(undefined);
	}

	/**
	 * Gets the icon for a data stream field node.
	 * @param node 
	 */
	private getStreamFieldIcon(node: any): any {
		var icon: (string | undefined) = undefined;
		if (node.type !== undefined) {
			icon = `${node.type}.svg`;
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
	 * Displays a quick pick from which the user can select a data stream.
	 * @param account 
	 * @param message 
	 * @returns The selected stream, or undefined if none was selected.
	 */
	private async promptForStream(account: LyticsAccount, message?: string): Promise<DataStream | undefined> {
		if (!message) {
			message = `Select a data stream.`;
		}
		const streams = await this.getStreams(account);
		const values = streams.map(q => q.stream);
		let value = await vscode.window.showQuickPick(values, {
			canPickMany: false,
			placeHolder: message
		});
		if (!value) {
			return Promise.resolve(undefined);
		}
		const stream = streams.find(s => s.stream === value);
		return Promise.resolve(stream);
	}

	/**
	 * Wrapper around the API call to get Lytics data streams. 
	 * This function provides user feedback while data is 
	 * read from Lytics.
	 * @param account 
	 * @returns Array of data streams.
	 */
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

	async commandShowStreamInfo(stream: DataStream): Promise<boolean> {
		try {
			const account = StateManager.getActiveAccount();
			if (!account) {
				throw new Error('No account is connected.');
			}
			if (!stream) {
				stream = await this.promptForStream(account, `Select the data stream you want to show.`);
			}
			if (!stream) {
				return Promise.resolve(false);
			}
			await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: `Loading stream info: ${stream.stream}`,
				cancellable: true
			}, async (progress, token) => {
				const uri = vscode.Uri.parse(`lytics://${account.aid}/streams/${stream.stream}.json`);
				await this.displayAsReadOnly(uri);
			});
			return Promise.resolve(true);
		}
		catch (err) {
			vscode.window.showErrorMessage(`Loading data stream info failed: ${err.message}`);
			return Promise.resolve(false);
		}
	}

	async commandShowQueryInfo(stream: DataStream) {
		try {
			const account = StateManager.getActiveAccount();
			if (!account) {
				throw new Error('No account is connected.');
			}
			if (!stream) {
				stream = await this.promptForStream(account, `Select the data stream whose query info you want to show.`);
			}
			if (!stream) {
				return Promise.resolve(false);
			}
			await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: `Loading query info: ${stream.stream}`,
				cancellable: true
			}, async (progress, token) => {
				const uri = vscode.Uri.parse(`lytics://${account.aid}/streams/${stream.stream}/queries/${stream.stream}-queries.json`);
				await this.displayAsReadOnly(uri);
			});
		}
		catch (err) {
			vscode.window.showErrorMessage(`Show query info failed: ${err.message}`);
			return Promise.resolve();
		}
	}

	async commandShowField(field: DataStreamField) {
		try {
			const account = StateManager.getActiveAccount();
			if (!account) {
				throw new Error('No account is connected.');
			}
			//TODO: if field is udefined...
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
				await this.displayAsReadOnly(uri);
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