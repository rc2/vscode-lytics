import * as vscode from 'vscode';
import { StateManager } from './stateManager';
import { LyticsAccount, Segment } from 'lytics-js/dist/types';
import { ContentReader } from './contentReader';
import { LyticsExplorerProvider } from './lyticsExplorerProvider';

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
			return this.getSegments(account);
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

	/**
	 * Wrapper around the API call to get Lytics segments. 
	 * This function provides user feedback while data is
	 * read from Lytics.
	 * @param account 
	 * @returns Array of segments.
	 */
	private async getSegments(account: LyticsAccount): Promise<Segment[]> {
		let segments = await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: `Loading segments for account: ${account.aid}`,
			cancellable: true
		}, async (progress, token) => {
			const client = await this.getClient(account.aid);
			try {
				const segments = await client.getSegments();
				var sortedSegments = segments.sort((a, b) => {
					if (a.name! < b.name!) {
						return -1;
					}
					if (a.name! > b.name!) {
						return 1;
					}
					return 0;
				});
				return Promise.resolve(sortedSegments);
			}
			catch (err) {
				let message: (string | undefined);
				if (err && err.response) {
					if (err.response.status === 404) {
						return Promise.resolve([]);
					}
				}
				if (!message) {
					message = `Loading segments failed: ${err.message}`;
				}
				vscode.window.showErrorMessage(message);
				return Promise.resolve();
			}
		});
		if (!segments) {
			segments = [];
		}
		return Promise.resolve(segments);
	}

	/**
	 * Displays a quick pick from which the user can select a segment.
	 * @param account 
	 * @param message 
	 * @returns The selected segment, or undefined if none was selected.
	 */
	private async promptForSegment(account: LyticsAccount, message?: string): Promise<Segment | undefined> {
		if (!message) {
			message = `Select a segment.`;
		}
		const segments = await this.getSegments(account);
		const values = segments.map(s => s.name);
		let value = await vscode.window.showQuickPick(values, {
			canPickMany: false,
			placeHolder: message
		});
		if (!value) {
			return Promise.resolve(undefined);
		}
		const segment = segments.find(s => s.name === value);
		return Promise.resolve(segment);
	}

	async commandShowSegmentInfo(segment: Segment): Promise<boolean> {
		try {
			const account = StateManager.getActiveAccount();
			if (!account) {
				throw new Error('No account is connected.');
			}
			if (!segment) {
				segment = await this.promptForSegment(account, 'Select the segment whose info you want to show.');
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

class SegmentTreeItem extends vscode.TreeItem {
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
