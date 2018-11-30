import * as vscode from 'vscode';
import { StateManager } from './stateManager';
import { Segment, SegmentCollection } from 'lytics-js/dist/types';
import { ContentReader } from './contentReader';
import { LyticsExplorerProvider } from './lyticsExplorerProvider';
import { SegmentSelector } from './segmentSelector';
import { isNullOrUndefined } from 'util';
import { SegmentTreeItem } from './segmentExplorerProvider';

export class SegmentCollectionExplorerProvider extends LyticsExplorerProvider<SegmentCollection> {

	/**
	 * Constructor.
	 * @param contentReader 
	 * @param context 
	 */
	constructor(contentReader: ContentReader, context: vscode.ExtensionContext) {
		super('segment collection list', contentReader, context);
	}

	/**
	 * Inherited from TreeDataProvider.
	 * @param element 
	 */
	async getChildren(element?: SegmentCollection): Promise<any[]> {
		const account = StateManager.getActiveAccount();
		if (!account) {
			return Promise.resolve([]);
		}
		const client = await this.getClient(account.aid);
		const selector = new SegmentSelector(client, account);
		if (!element) {
			return selector.getSegmentCollections();
		}
		if (element.collection) {
			const promises:Promise<Segment>[] = [];
			element.collection.forEach(async (member) => {
				promises.push(client.getSegment(member.id));
			});
			const segments = (await Promise.all(promises))
				.filter(s => !isNullOrUndefined(s))
				.sort((a, b) => {
					if (a.name! < b.name!) {
						return -1;
					}
					if (a.name! > b.name!) {
						return 1;
					}
					return 0;
				});
			return Promise.resolve(segments);
		}
		return Promise.resolve([]);
	}

	/**
	 * Inherited from TreeDataProvider.
	 * @param element 
	 */
	getTreeItem(element: any): vscode.TreeItem {
		if (element.collection) {
			if (element.name) {
				return new SegmentCollectionTreeItem(element);
			}	
		}
		else {
			if (element.name) {
				return new SegmentTreeItem(element);
			}
		}
		throw new Error(`The specified element is not supported by the segment collection explorer provider.`);
	}

	async commandShowSegmentCollectionInfo(collection: SegmentCollection): Promise<boolean> {
		try {
			const account = StateManager.getActiveAccount();
			if (!account) {
				throw new Error('No account is connected.');
			}
			if (!collection) {
				const client = await this.getClient(account.aid);
				const selector = new SegmentSelector(client, account);
				collection = await selector.promptForSegmentCollection('Select the segment collection whose info you want to show.');
			}
			if (!collection) {
				return Promise.resolve(false);
			}
			await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: `Loading segment collection info: ${collection.name}`,
				cancellable: true
			}, async (progress, token) => {
				const uri = vscode.Uri.parse(`lytics://${account.aid}/segmentcollections/${collection.slug_name}.json`);
				await this.displayAsReadOnly(uri);
			});
			return Promise.resolve(true);
		}
		catch (err) {
			vscode.window.showErrorMessage(`Show segment collection info failed: ${err.message}`);
			return Promise.resolve(false);
		}
	}
}

class SegmentCollectionTreeItem extends vscode.TreeItem {
	constructor(element: SegmentCollection) {
		super(element.name, vscode.TreeItemCollapsibleState.Collapsed);
		this.slugName = element.slug_name;
		this.contextValue = 'segmentcollection';
	}
	readonly slugName: string;
	get tooltip(): string {
		if (!this.slugName) {
			return '';
		}
		return `${this.slugName}`;
	}
}
