import * as vscode from 'vscode';
import { StateManager } from './stateManager';
import { LyticsAccount, Subscription, WebhookConfig, Segment } from 'lytics-js/dist/types';
import lytics = require("lytics-js/dist/lytics");
import { ContentReader } from './contentReader';
import { LyticsExplorerProvider } from './lyticsExplorerProvider';
import { URL } from 'url';
import { isUndefined } from 'util';
import { LyticsClient } from 'lytics-js/dist/LyticsClient';

export class SubscriptionExplorerProvider extends LyticsExplorerProvider<Subscription> {

	/**
	 * Constructor.
	 * @param contentReader 
	 * @param context 
	 */
	constructor(contentReader: ContentReader, context: vscode.ExtensionContext) {
		super('subscription list', contentReader, context);
	}

	/**
	 * Inherited from TreeDataProvider.
	 * @param element 
	 */
	async getChildren(element?: Subscription): Promise<any[]> {
		const account = StateManager.getActiveAccount();
		if (!account) {
			return Promise.resolve([]);
		}
		if (!element) {
			return this.getSubscriptions(account);
		}
		return Promise.resolve([]);
	}

	/**
	 * Inherited from TreeDataProvider.
	 * @param element 
	 */
	getTreeItem(element: any): vscode.TreeItem {
		if (element.name) {
			return new SubscriptionTreeItem(element);
		}
		throw new Error(`The specified element is not supported by the subscription explorer provider.`);
	}

	/**
	 * Wrapper around the API call to get Lytics subscriptions. 
	 * This function provides user feedback while data is
	 * read from Lytics.
	 * @param account 
	 * @returns Array of subscriptions.
	 */
	private async getSubscriptions(account: LyticsAccount): Promise<Subscription[]> {
		let subscriptions = await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: `Loading subscriptions for account: ${account.aid}`,
			cancellable: true
		}, async (progress, token) => {
			const client = lytics.getClient(account.apikey!);
			try {
				const subscriptions = await client.getSubscriptions();
				var sortedSubscriptions = subscriptions.sort((a, b) => {
					if (a.name! < b.name!) {
						return -1;
					}
					if (a.name! > b.name!) {
						return 1;
					}
					return 0;
				});
				return Promise.resolve(sortedSubscriptions);
			}
			catch (err) {
				let message: (string | undefined);
				if (err && err.response) {
					if (err.response.status === 404) {
						return Promise.resolve([]);
					}
				}
				if (!message) {
					message = `Loading subscriptions failed: ${err.message}`;
				}
				vscode.window.showErrorMessage(message);
				return Promise.resolve();
			}
		});
		if (!subscriptions) {
			subscriptions = [];
		}
		return Promise.resolve(subscriptions);
	}

	/**
	 * Displays a quick pick from which the user can select a subscription.
	 * @param account 
	 * @param message 
	 * @returns The selected subscription, or undefined if none was selected.
	 */
	private async promptForSubscription(account: LyticsAccount, message?: string): Promise<Subscription | undefined> {
		if (!message) {
			message = `Select a subscription.`;
		}
		const subscriptions = await this.getSubscriptions(account);
		const items = subscriptions.map(subscription => new SubscriptionQuickPickItem(subscription));
		let selectedItem = await vscode.window.showQuickPick(items, {
			canPickMany: false,
			placeHolder: message
		});
		if (!selectedItem) {
			return Promise.resolve(undefined);
		}
		return Promise.resolve(selectedItem.subscription);
	}

	async commandShowSubscriptionInfo(subscription: Subscription): Promise<boolean> {
		try {
			const account = StateManager.getActiveAccount();
			if (!account) {
				throw new Error('No account is connected.');
			}
			if (!subscription) {
				subscription = await this.promptForSubscription(account, 'Select the subscription whose info you want to show.');
			}
			if (!subscription) {
				return Promise.resolve(false);
			}
			await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: `Loading subscription info: ${subscription.name}`,
				cancellable: true
			}, async (progress, token) => {
				const uri = vscode.Uri.parse(`lytics://${account.aid}/subscriptions/${subscription.slug}.json`);
				await this.displayAsReadOnly(uri);
			});
			return Promise.resolve(true);
		}
		catch (err) {
			vscode.window.showErrorMessage(`Show subscription info failed: ${err.message}`);
			return Promise.resolve(false);
		}
	}

	/**
	 * Displays a quick pick from which the user can select the subscription channel.
	 * @param account 
	 * @param message 
	 * @returns The selected subscription channel, or undefined if none was selected.
	 */
	private async promptForSubscriptionChannel(account: LyticsAccount, message?: string): Promise<string | undefined> {
		if (!message) {
			message = `Select a subscription channel.`;
		}
		const values:string[] = ['webhook'];
		let value = await vscode.window.showQuickPick(values, {
			canPickMany: false,
			placeHolder: message
		});
		return Promise.resolve(value);
	}
	/**
	 * Displays a quick pick from which the user can select the segments to watch.
	 * @param account 
	 * @param message 
	 * @returns The selected segments, or undefined if the user escapes out of the quick pick.
	 */
	private async promptForSegments(account: LyticsAccount, message?: string): Promise<Segment[] | undefined> {
		if (!message) {
			message = `Select the segments for the subscription.`;
		}
		const client = lytics.getClient(account.apikey!);
		var segments = await client.getSegments();
		if (!segments) {
			vscode.window.showErrorMessage('No segments are available for this Lytics account.');
			return Promise.resolve(undefined);
		}
		segments = segments.sort((a, b) => {
			if (a.name! < b.name!) {
				return -1;
			}
			if (a.name! > b.name!) {
				return 1;
			}
			return 0;
		});

		const items = segments.map(segment => new SegmentQuickPickItem(segment));
		let selectedItems = await vscode.window.showQuickPick(items, {
			canPickMany: true,
			placeHolder: message
		});
		return Promise.resolve(selectedItems.map(item => item.segment));
	}
	private async addWebhook(account: LyticsAccount): Promise<boolean> {
		const name = await vscode.window.showInputBox({
			prompt: 'Enter a name for the webhook.',
		});
		if (!name || name.trim().length === 0) {
			return Promise.resolve(false);
		}
		const description = await vscode.window.showInputBox({
			prompt: 'Enter a description for the webhook.',
		});
		if (isUndefined(description)) {
			return Promise.resolve(false);
		}
		var url:(URL | undefined);
		while(!url) {
			const surl = await vscode.window.showInputBox({
				prompt: 'Enter the URL for the webhook.',
			});
			if (!surl || surl.trim().length === 0) {
				return Promise.resolve(false);
			}
			try {
				url = new URL(surl);
			}
			catch(err) {
				vscode.window.showErrorMessage(err.message);
			}
		}
		var segments:(Segment[] | undefined);
		while (!segments || segments.length === 0) {
			segments = await this.promptForSegments(account, 'Select the segments whose events will be sent to the webhook.');
			if (!segments) {
				return Promise.resolve(false);
			}
		}
		
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: `Adding webhook: ${name}`,
			cancellable: true
		}, async (progress, token) => {
			const config = new WebhookConfig();
			config.name = name;
			config.description = description;
			config.webhook_url = url;
			config.user_fields.push('_uid');
			config.user_fields.push('email');
			config.headers = JSON.parse('{"Lytics-Training-Mode":"enabled"}');
			segments.forEach(segment => config.segment_ids.push(segment.id));
			const client = lytics.getClient(account.apikey!);
			const subscription = await client.createWebhook(config);
			progress.report({
				message: `Subscription ${subscription.id} was created.`
			});
			await this.refresh();
		});
		return Promise.resolve(true);
	}
	async commandAddSubscription(): Promise<boolean> {
		try {
			const account = StateManager.getActiveAccount();
			if (!account) {
				throw new Error('No account is connected.');
			}
			const channel = await this.promptForSubscriptionChannel(account, 'Select the channel for the subscription you want to create.');
			if (!channel) {
				return Promise.resolve(false);
			}
			if (channel === 'webhook') {
				return this.addWebhook(account);
			}
			return Promise.resolve(false);
		}
		catch (err) {
			vscode.window.showErrorMessage(`Create subscription failed: ${err.message}`);
			return Promise.resolve(false);
		}
	}
	async commandRemoveSubscription(subscription?: Subscription): Promise<boolean> {
		try {
			const account = StateManager.getActiveAccount();
			if (!account) {
				throw new Error('No account is connected.');
			}
			if (!subscription) {
				subscription = await this.promptForSubscription(account, 'Select the subscription you want to remove.');
			}
			if (!subscription) {
				return Promise.resolve(false);
			}
			const confirm = await this.confirm(`Are you sure you want to remove subscription ${subscription.name}?`);
			if (!confirm) {
				return Promise.resolve(false);
			}
			const client = new LyticsClient(account!.apikey);
			await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: `Removing subscription: ${subscription.name}`,
				cancellable: true
			}, async (progress, token) => {
				const client = lytics.getClient(account.apikey!);
				const wasDeleted = await client.deleteSubscription(subscription.id);
				progress.report({
					message: `Subscription ${subscription.id} ${wasDeleted ? 'was': 'was not'} deleted.`
				});
				await this.refresh();
			});
			return Promise.resolve(true);
		}
		catch (err) {
			vscode.window.showErrorMessage(`Remove subscription failed: ${err.message}`);
			return Promise.resolve(false);
		}
	}
}

class SubscriptionTreeItem extends vscode.TreeItem {
	constructor(element: Subscription) {
		super(element.name!, vscode.TreeItemCollapsibleState.None);
		this.slug = element.slug;
		this.contextValue = 'subscription';
	}
	readonly slug: string;
	get tooltip(): string {
		if (!this.slug) {
			return '';
		}
		return `${this.slug}`;
	}
}

class SegmentQuickPickItem implements vscode.QuickPickItem {
	label: string;	
	description?: string;
	detail?: string;
	picked?: boolean;
	constructor(public readonly segment: Segment) {
		this.label = segment.name;
		this.detail = segment.id;
		this.description = segment.slug_name;
	}
}
class SubscriptionQuickPickItem implements vscode.QuickPickItem {
	label: string;	
	description?: string;
	detail?: string;
	picked?: boolean;
	constructor(public readonly subscription: Subscription) {
		this.label = subscription.name;
		this.description = subscription.slug;
		this.detail = subscription.id;
	}
}