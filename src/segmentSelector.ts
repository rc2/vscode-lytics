import * as vscode from 'vscode';
import { LyticsAccount, Segment } from 'lytics-js/dist/types';
import { LyticsClient } from 'lytics-js/dist/LyticsClient';

export class SegmentSelector {
	constructor(private client: LyticsClient, private account: LyticsAccount) {
	}
	/**
	 * Wrapper around the API call to get Lytics segments. 
	 * This function provides user feedback while data is
	 * read from Lytics.
	 * @returns Array of segments.
	 */
	public async getSegments(): Promise<Segment[]> {
		let segments = await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: `Loading segments for account: ${ this.account.aid}`,
			cancellable: true
		}, async (progress, token) => {
			try {
				const segments = await this.client.getSegments();
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
	 * @param message 
	 * @returns The selected segment, or undefined if none was selected.
	 */
	public async promptForSegment(message?: string): Promise<Segment | undefined> {
		if (!message) {
			message = `Select a segment.`;
		}
		const segments = await this.getSegments();
		const values = segments.map(s => new SegmentQuickPickItem(s));
		let value = await vscode.window.showQuickPick(values, {
			canPickMany: false,
			placeHolder: message
		});
		if (!value) {
			return Promise.resolve(undefined);
		}
		const segment = segments.find(s => s.name === value.label);
		return Promise.resolve(segment);
	}
}

class SegmentQuickPickItem implements vscode.QuickPickItem {
	label: string;
	description?: string;
	detail?: string;
	picked?: boolean;
	constructor(public readonly segment: Segment) {
		this.label = segment.name;
		this.detail = segment.description;
		this.description = segment.slug_name;
	}
}