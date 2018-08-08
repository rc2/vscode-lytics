import * as vscode from 'vscode';
import { StateManager } from './stateManager';
import { LyticsAccount, Campaign, CampaignVariation } from 'lytics-js/dist/types';
import lytics = require("lytics-js/dist/lytics");

export class CampaignExplorerProvider implements vscode.TreeDataProvider<Campaign | CampaignVariation> {

	private _onDidChangeTreeData: vscode.EventEmitter<any> = new vscode.EventEmitter<any>();
	readonly onDidChangeTreeData: vscode.Event<any> = this._onDidChangeTreeData.event;
	constructor(private context: vscode.ExtensionContext) {
	}

	async refresh() {
		try {
			await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: 'Refreshing campaign list.',
				cancellable: true
			}, async (progress, token) => {
				this._onDidChangeTreeData.fire();
			});
		}
		catch (err) {
			vscode.window.showErrorMessage(`Refreshing campaigns failed: ${err.message}`);
			return Promise.resolve();
		}
	}

	async getChildren(element?: Campaign): Promise<any[]> {
		const account = StateManager.account;
		if (!account) {
			return Promise.resolve([]);
		}
		if (!element) {
			return this.getCampaigns(account);
		}
		else {
			return this.getCampaignVariations(element, account);
		}
		return Promise.resolve([]);
	}

	getTreeItem(element: any): vscode.TreeItem {
		if (element.name) {
			return new CampaignTreeItem(element);
		}
		if (element.variation || element.variation == 0) {
			return new CampaignVariationTreeItem(element);
		}
		throw new Error(`The specified element is not supported by the campaign explorer provider.`);
	}

	async getCampaigns(account: LyticsAccount): Promise<Campaign[]> {
		let campaigns = await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: `Loading campaigns for account: ${account.aid}`,
			cancellable: true
		}, async (progress, token) => {
			const client = lytics.getClient(account.apikey!);
			try {
				const campaigns = await client.getCampaigns();
				var sortedCampaigns = campaigns.sort((a, b) => {
					if (a.name! < b.name!) {
						return -1;
					}
					if (a.name! > b.name!) {
						return 1;
					}
					return 0;
				});
				return Promise.resolve(sortedCampaigns);
			}
			catch (err) {
				let message: (string | undefined);
				if (err && err.response) {
					if (err.response.status === 404) {
						return Promise.resolve([]);
					}
				}
				if (!message) {
					message = `Loading campaigns failed: ${err.message}`;
				}
				vscode.window.showErrorMessage(message);
				return Promise.resolve();
			}
		});
		if (!campaigns) {
			campaigns = [];
		}
		return Promise.resolve(campaigns);
	}

	async getCampaignVariations(campaign: Campaign, account: LyticsAccount): Promise<CampaignVariation[]> {
		let campaignVariations = await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: `Loading variations for campaign: ${campaign.name}`,
			cancellable: true
		}, async (progress, token) => {
			const client = lytics.getClient(account.apikey!);
			try {
				const variations = await client.getCampaignVariations(campaign.id!);
				var sortedVariations = variations.sort((a, b) => {
					if (a.variation! < b.variation!) {
						return -1;
					}
					if (a.variation! > b.variation!) {
						return 1;
					}
					return 0;
				});
				return Promise.resolve(sortedVariations);
			}
			catch (err) {
				let message: (string | undefined);
				if (err && err.response) {
					if (err.response.status === 404) {
						return Promise.resolve([]);
					}
				}
				if (!message) {
					message = `Loading campaign variations failed: ${err.message}`;
				}
				vscode.window.showErrorMessage(message);
				return Promise.resolve();
			}
		});
		if (!campaignVariations) {
			campaignVariations = [];
		}
		return Promise.resolve(campaignVariations);
	}

	async commandShowCampaignInfo(campaign: Campaign) {
		try {
			const account = StateManager.account;
			if (!account) {
				throw new Error('No account is connected.');
			}
			await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: `Loading campaign info: ${campaign.name}`,
				cancellable: true
			}, async (progress, token) => {
				const uri = vscode.Uri.parse(`lytics://${account.aid}/campaigns/${campaign.id}.json`);
				const doc = await vscode.workspace.openTextDocument(uri);
				await vscode.window.showTextDocument(doc, { preview: false });
			});
		}
		catch (err) {
			vscode.window.showErrorMessage(`Show campaign info failed: ${err.message}`);
			return Promise.resolve();
		}
	}
	async commandShowCampaignVariationInfo(variation: CampaignVariation) {
		try {
			const account = StateManager.account;
			if (!account) {
				throw new Error('No account is connected.');
			}
			await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: `Loading campaign variation info: ${variation.id}`,
				cancellable: true
			}, async (progress, token) => {
				const uri = vscode.Uri.parse(`lytics://${account.aid}/variations/${variation.id}.json`);
				const doc = await vscode.workspace.openTextDocument(uri);
				await vscode.window.showTextDocument(doc, { preview: false });
			});
		}
		catch (err) {
			vscode.window.showErrorMessage(`Show campaign variation info failed: ${err.message}`);
			return Promise.resolve();
		}
	}
}

class CampaignTreeItem extends vscode.TreeItem {
	constructor(element: Campaign) {
		super(element.name!, vscode.TreeItemCollapsibleState.Collapsed);
		this.contextValue = 'campaign';
	}
}
class CampaignVariationTreeItem extends vscode.TreeItem {
	constructor(element: CampaignVariation) {
		super(element.variation.toString(), vscode.TreeItemCollapsibleState.None);
		this.contextValue = 'campaignVariation';
	}
}
