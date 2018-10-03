import * as vscode from 'vscode';
import { SettingsManager } from './settingsManager';
import { StateManager } from './stateManager';
import { LyticsAccount, Topic, TopicUrl } from 'lytics-js/dist/types';
import { LyticsExplorerProvider } from './lyticsExplorerProvider';
import { ContentReader } from './contentReader';

export class TopicExplorerProvider extends LyticsExplorerProvider<Topic> {

	constructor(contentReader: ContentReader, context: vscode.ExtensionContext) {
		super('topic list', contentReader, context);
	}

	/**
	 * Inherited from TreeDataProvider.
	 * @param element 
	 */
	async getChildren(element?: any): Promise<any[]> {
		const account = StateManager.getActiveAccount();
		if (!account) {
			return Promise.resolve([]);
		}
		if (!element) {
			const settings = SettingsManager.getLyticsApiSettings();
			return this.getTopics(account, settings.maxTopics);
		}
		return Promise.resolve([]);
	}

	/**
	 * Inherited from TreeDataProvider.
	 * @param element 
	 */
	getTreeItem(element: any): vscode.TreeItem {
		if (element.label) {
			return new TopicTreeItem(element.label, element);
		}
		throw new Error(`The specified element is not supported by the topic explorer provider.`);
	}

	/**
	 * Displays a quick pick from which the user can select a topic.
	 * @param account 
	 * @param message 
	 * @returns The selected topic, or undefined if none was selected.
	 */
	private async promptForTopic(account: LyticsAccount, message?: string): Promise<Topic | undefined> {
		if (!message) {
			message = `Select a topic.`;
		}
		const settings = SettingsManager.getLyticsApiSettings();
		const topics = await this.getTopics(account, settings.maxTopicUrls);
		const values = topics.map(t => t.label);
		let value = await vscode.window.showQuickPick(values, {
			canPickMany: false,
			placeHolder: message
		});
		if (!value) {
			return Promise.resolve(undefined);
		}
		const topic = topics.find(t => t.label === value);
		return Promise.resolve(topic);
	}

	/**
	 * Wrapper around the API call to get the Lytics topics.
	 * This function provides user feedback while data is
	 * read from Lytics.
	 * @param account 
	 * @returns Array of topics.
	 */
	private async getTopics(account: LyticsAccount, max:number = 0): Promise<Topic[]> {
		let topics = await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: `Loading topics.`,
			cancellable: true
		}, async (progress, token) => {
			const client = await this.getClient(account.aid);
			try {
				var topics:Topic[] = [];
				if (max > 0) {
					topics = await client.getTopics(max);
				}
				else {
					topics = await client.getTopics();
				}
				return Promise.resolve(topics);
			}
			catch (err) {
				let message: (string | undefined);
				if (!message) {
					message = `Loading topics failed: ${err.message}`;
				}
				vscode.window.showErrorMessage(message);
				return Promise.resolve();
			}
		});
		if (!topics) {
			topics = [];
		}
		return Promise.resolve(topics);
	}

	/**
	 * Wrapper around the API call to get Lytics topic urls. 
	 * This function provides user feedback while data is 
	 * read from Lytics.
	 * @param account 
	 * @returns Array of topic urls.
	 */
	private async getUrls(element: Topic, account: LyticsAccount): Promise<TopicUrl[]> {
		//
		//Schema is loaded because the element parameter is 
		//not fully populated. It only contains information
		//from the settings.
		let fields = await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: `Loading urls for topic: ${element.label}.`,
			cancellable: true
		}, async (progress, token) => {
			const client = await this.getClient(account.aid);
			try {
				const collection = await client.getTopicUrls(element.label!);
				if (!collection) {
					return Promise.resolve([]);
				}
				let urls = collection.urls;
				return Promise.resolve(urls);
			}
			catch (err) {
				vscode.window.showErrorMessage(`Loading topic urls failed: ${err.message}`);
				return Promise.resolve();
			}
		});
		if (!fields) {
			fields = [];
		}
		return Promise.resolve(fields);
	}

	async commandShowTopicInfo(topic: Topic): Promise<boolean> {
		try {
			const account = StateManager.getActiveAccount();
			if (!account) {
				throw new Error('No account is connected.');
			}
			if (!topic) {
				topic = await this.promptForTopic(account, 'Select the topic you want to show.');
			}
			if (!topic) {
				return Promise.resolve(false);
			}

			const topicLabel = topic.label;
			if (!topicLabel || topicLabel.trim().length === 0) {
				return Promise.resolve(false);
			}
			await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: `Loading topic info: ${topicLabel}`,
				cancellable: true
			}, async (progress, token) => {
				const uri = vscode.Uri.parse(`lytics://${account.aid}/topics/${topic.label}.json`);
				await this.displayAsReadOnly(uri);
			});
			return Promise.resolve(true);
		}
		catch (err) {
			vscode.window.showErrorMessage(`Show topic info failed: ${err.message}`);
			return Promise.resolve(false);
		}
	}

	async commandShowTopicsForCrawledUrl(): Promise<boolean> {
		try {
			const account = StateManager.getActiveAccount();
			if (!account) {
				throw new Error('No account is connected.');
			}
			const url = await vscode.window.showInputBox({
				prompt: 'Enter the URL whose topics you want to see.',
			});
			if (!url || url.trim().length === 0) {
				return Promise.resolve(false);
			}
			await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: `Loading topics: ${url}`,
				cancellable: true
			}, async (progress, token) => {
				const uri = vscode.Uri.parse(`lytics://${account.aid}/document/topics/${url}.json`);
				await this.displayAsReadOnly(uri);
			});
			return Promise.resolve(true);
		}
		catch (err) {
			vscode.window.showErrorMessage(`Show topic info failed: ${err.message}`);
			return Promise.resolve(false);
		}
	}
}

class TopicTreeItem extends vscode.TreeItem {
	constructor(
		public readonly name: string,
		element: Topic
	) {
		super(`${name} [${element.doc_count}]`, vscode.TreeItemCollapsibleState.None);
		this.docCount = element.doc_count;
	}
	readonly docCount: number;
	contextValue = 'topic';
}
