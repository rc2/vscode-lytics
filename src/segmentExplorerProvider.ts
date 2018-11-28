import * as vscode from 'vscode';
import { StateManager } from './stateManager';
import { LyticsAccount, Segment } from 'lytics-js/dist/types';
import { ContentReader } from './contentReader';
import { LyticsExplorerProvider } from './lyticsExplorerProvider';
import { SegmentSelector } from './segmentSelector';

export class SegmentExplorerProvider extends LyticsExplorerProvider<Segment> {

	/**
	 * Constructor.
	 * @param contentReader 
	 * @param context 
	 */
	constructor(contentReader: ContentReader, context: vscode.ExtensionContext) {
		super('segment list', contentReader, context);
	}

	/**
	 * Inherited from TreeDataProvider.
	 * @param element 
	 */
	async getChildren(element?: Segment): Promise<any[]> {
		const account = StateManager.getActiveAccount();
		if (!account) {
			return Promise.resolve([]);
		}
		if (!element) {
			const client = await this.getClient(account.aid);
			const selector = new SegmentSelector(client, account);
			return selector.getSegments();
		}
		return Promise.resolve([]);
	}

	/**
	 * Inherited from TreeDataProvider.
	 * @param element 
	 */
	getTreeItem(element: any): vscode.TreeItem {
		if (element.name) {
			return new SegmentTreeItem(element);
		}
		throw new Error(`The specified element is not supported by the segment explorer provider.`);
	}

	async commandShowSegmentInfo(segment: Segment): Promise<boolean> {
		try {
			const account = StateManager.getActiveAccount();
			if (!account) {
				throw new Error('No account is connected.');
			}
			if (!segment) {
				const client = await this.getClient(account.aid);
				const selector = new SegmentSelector(client, account);
				segment = await selector.promptForSegment('Select the segment whose info you want to show.');
			}
			if (!segment) {
				return Promise.resolve(false);
			}
			await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: `Loading segment info: ${segment.name}`,
				cancellable: true
			}, async (progress, token) => {
				const uri = vscode.Uri.parse(`lytics://${account.aid}/segments/${segment.slug_name}.json`);
				await this.displayAsReadOnly(uri);
			});
			return Promise.resolve(true);
		}
		catch (err) {
			vscode.window.showErrorMessage(`Show segment info failed: ${err.message}`);
			return Promise.resolve(false);
		}
	}
}

export class SegmentTreeItem extends vscode.TreeItem {
	constructor(element: Segment) {
		super(element.name!, vscode.TreeItemCollapsibleState.None);
		this.slugName = element.slug_name;
		this.contextValue = 'segment';
	}
	readonly slugName: string;
	get tooltip(): string {
		if (!this.slugName) {
			return '';
		}
		return `${this.slugName}`;
	}
}
