import * as vscode from 'vscode';
import { StateManager } from './stateManager';
import { LyticsAccount, Subscription, WebhookConfig, Segment, TableSchemaField } from 'lytics-js/dist/types';
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

	async commandEditSubscription(subscription: Subscription): Promise<boolean> {
		try {
			const account = StateManager.getActiveAccount();
			if (!account) {
				throw new Error('No account is connected.');
			}
			if (!subscription) {
				subscription = await this.promptForSubscription(account, 'Select the subscription you want to edit.');
			}
			if (!subscription) {
				return Promise.resolve(false);
			}
			return this.upsertSubscription(account, subscription.channel, subscription);
		}
		catch (err) {
			vscode.window.showErrorMessage(`Show subscription info failed: ${err.message}`);
			return Promise.resolve(false);
		}
	}

	private async promptForWebhookUrl(account: LyticsAccount, subscription?: Subscription, message?: string): Promise<URL | undefined> {
		var currentUrlValue: (string | undefined);
		if (subscription && subscription.config && subscription.config.webhook_url) {
			currentUrlValue = subscription.config.webhook_url.toString();
		}
		var urlNotSet = true;
		while(urlNotSet) {
			currentUrlValue = await vscode.window.showInputBox({
				prompt: 'Enter the URL for the webhook.',
				value: currentUrlValue
			});
			if (!currentUrlValue || currentUrlValue.trim().length === 0) {
				return Promise.resolve(undefined);
			}
			try {
				const url = new URL(currentUrlValue);
				return Promise.resolve(url);
			}
			catch(err) {
				vscode.window.showErrorMessage(err.message);
			}
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
	 * @param subscription
	 * @param message 
	 * @returns The selected segments, or undefined if the user escapes out of the quick pick.
	 */
	private async promptForSegments(account: LyticsAccount, subscription?: Subscription, message?: string): Promise<Segment[] | undefined> {
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

		const items = segments.map(segment => {
			const item = new SegmentQuickPickItem(segment);
			if (subscription && subscription.segment_ids.indexOf(segment.id) > -1) {
				item.picked = true;
			}
			return item;
		});
		var itemNotSelected = true;
		while(itemNotSelected) {
			let selectedItems = await vscode.window.showQuickPick(items, {
				canPickMany: true,
				placeHolder: message
			});
			if (!selectedItems) {
				return Promise.resolve(undefined);
			}
			if (selectedItems.length > 0) {
				return Promise.resolve(selectedItems.map(item => item.segment));
			}
		}
	}

	private async promptForUserFields(account: LyticsAccount, subscription?: Subscription, message?: string): Promise<TableSchemaField[] | undefined> {
		if (!message) {
			message = `Select the user fields to include when triggered.`;
		}
		const client = lytics.getClient(account.apikey!);
		const table = await client.getTableSchema('user');
		if (!table) {
			vscode.window.showErrorMessage('No user table was found for this Lytics account.');
			return Promise.resolve(undefined);
		}
		const columns = table.columns.sort((a, b) => {
			if (a.as! < b.as!) {
				return -1;
			}
			if (a.as! > b.as!) {
				return 1;
			}
			return 0;
		});

		const items = columns.map(column => {
			const item = new TableSchemaFieldQuickPickItem(column);
			if (subscription && subscription.config && subscription.config.user_fields && subscription.config.user_fields.indexOf(column.as) > -1) {
				item.picked = true;
			}
			return item;
		});
		let selectedItems = await vscode.window.showQuickPick(items, {
			canPickMany: true,
			placeHolder: message
		});
		return Promise.resolve(selectedItems.map(item => item.column));
	}

	private async upsertWebhook(account: LyticsAccount, subscription?: Subscription): Promise<boolean> {
		//
		//Renaming a subscription will not change the subscription slug.
		const name = await vscode.window.showInputBox({
			prompt: 'Enter a name for the webhook.',
			value: subscription ? subscription.name : undefined,
		});
		if (!name || name.trim().length === 0) {
			return Promise.resolve(false);
		}
		const description = await vscode.window.showInputBox({
			prompt: 'Enter a description for the webhook.',
			value: subscription ? subscription.description : undefined
		});
		if (isUndefined(description)) {
			return Promise.resolve(false);
		}
		const url = await this.promptForWebhookUrl(account, subscription, 'Enter the URL for the webhook.');
		if (isUndefined(url)) {
			return Promise.resolve(false);
		}
		var segments:(Segment[] | undefined);
		while (!segments || segments.length === 0) {
			segments = await this.promptForSegments(account, subscription, 'Select the segments whose events will be sent to the webhook.');
			if (!segments) {
				return Promise.resolve(false);
			}
		}
		var fields = await this.promptForUserFields(account, subscription, 'Select the user fields to send to the webhook.');

		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: `${subscription ? 'Updating' : 'Adding'} webhook: ${name}`,
			cancellable: true
		}, async (progress, token) => {
			const config = new WebhookConfig();
			config.name = name;
			config.description = description;
			config.webhook_url = url;
			if (subscription && subscription.config) {
				config.headers = subscription.config.headers;
			}
			segments.forEach(segment => config.segment_ids.push(segment.id));
			if (fields) {
				fields.forEach(field => config.user_fields.push(field.as));
			}
			const client = lytics.getClient(account.apikey!);
			if (subscription) {
				subscription = await client.updateWebhook(subscription.id, config);
			}
			else {
				subscription = await client.createWebhook(config);
			}
			progress.report({
				message: `Subscription ${subscription.id} was ${subscription ? 'updated' : 'added'}.`
			});
			await this.refresh();
		});
		return Promise.resolve(true);
	}
	async upsertSubscription(account: LyticsAccount, channel: string, subscription?: Subscription) : Promise<boolean> {
		if (!channel && subscription) {
			channel = subscription.channel;
		}
		if (channel === 'webhook') {
			return this.upsertWebhook(account, subscription);
		}
		if (subscription) {
			vscode.window.showErrorMessage(`Editing this subscription is not supported.`);
		}
		return Promise.resolve(false);
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
			return this.upsertSubscription(account, channel, undefined);
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
class TableSchemaFieldQuickPickItem implements vscode.QuickPickItem {
	label: string;	
	description?: string;
	detail?: string;
	picked?: boolean;
	constructor(public readonly column: TableSchemaField) {
		this.label = column.as;
		this.detail = column.shortdesc;
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