import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { StateManager } from './stateManager';
import { LyticsAccount, Campaign, CampaignVariation, CampaignVariationDetailOverride } from 'lytics-js/dist/types';
import lytics = require("lytics-js/dist/lytics");
import { LyticsUri } from './lyticsUri';

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
		if (element.variation || element.variation === 0) {
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

	async getFolderPathForDownload(): Promise<string | undefined> {
		const paths = await vscode.window.showOpenDialog({
			canSelectFiles: false,
			canSelectFolders: true,
			canSelectMany: false,
		});
		if (!paths || paths.length !== 1) {
			return Promise.resolve(undefined);
		}
		return Promise.resolve(paths[0].fsPath);
	}

	async commandDownloadCampaignVariationDetailOverride(variation: CampaignVariation) {
		try {
			const account = StateManager.account;
			if (!account) {
				throw new Error('No account is connected.');
			}
			const downloadPath = await this.getFolderPathForDownload();
			if (!downloadPath || downloadPath.trim().length === 0) {
				return Promise.resolve();
			}
			await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: `Downloading campaign variation detail override: ${variation.id}`,
				cancellable: true
			}, async (progress, token) => {
				const client = lytics.getClient(account.apikey!);
				const variation2 = await client.getCampaignVariation(variation.id);
				if (!variation2) {
					throw new Error(`The detail override for campaign variation ${variation.id} does not exist in the Lytics account.`);
				}
				const filePath = await this.saveCampaignVariationDetailOverrideToFolder(variation2, downloadPath);
				if (filePath) {
					const uri = vscode.Uri.file(filePath);
					const doc = await vscode.workspace.openTextDocument(uri);
					await vscode.window.showTextDocument(doc, { preview: false });

					vscode.window.showInformationMessage(`campaign variation downloaded: ${filePath}`);
					return;
				}
			});
		}
		catch (err) {
			vscode.window.showErrorMessage(`Downloading campaign variationb failed: ${err.message}`);
			return Promise.resolve();
		}
	}
	async saveCampaignVariationDetailOverrideToFolder(variation: CampaignVariation, downloadPath: string): Promise<string | undefined> {
		const filePath = path.join(downloadPath, `${variation.id}.campaign_override`);
		if (fs.existsSync(filePath)) {
			const confirmation = await vscode.window.showQuickPick(['Ignore', 'Overwrite'], {
				canPickMany: false,
				placeHolder: `Do you want to overwrite the file ${variation.id}.campaign_override?`
			});
			if (confirmation !== 'Overwrite') {
				return Promise.reject({ message: 'file already exists' });
			}
		}
		var override:any = variation.detail_override;
		if (!override) {
			override = {};
		}
		var text = JSON.stringify(override, null, 4);
		await fs.writeFile(filePath, text, err => { });
		return Promise.resolve(filePath);
	}
	async commandUploadCampaignVariationDetailOverride(uri: vscode.Uri) {
		if (!uri) {
			return Promise.resolve();
		}
		if (uri.scheme !== 'file') {
			return vscode.window.showErrorMessage('Only local files can be uploaded to Lytics.');
		}
		const account = StateManager.account;
		if (!account) {
			return vscode.window.showErrorMessage('Connect to an account before uploading a campaign variation detail override to Lytics.');
		}
		const editor = vscode.window.activeTextEditor;
		if (editor && editor.document) {
			if (editor.document.uri.toString() !== uri.toString()) {
				//this should not happen
				return vscode.window.showErrorMessage('Editor and override documents do not match.');
			}
			if (editor.document.isDirty) {
				return vscode.window.showErrorMessage('Save the file before uploading a campaign variation detail override to Lytics.');
			}
		}
		const variationId = path.parse(uri.fsPath).name;
		if (!variationId || variationId.trim().length === 0) {
			await vscode.window.showErrorMessage('Unable to determine the campaign variation id from the file path.');
			return Promise.resolve();
		}
		//determine if the campaign variation exists
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: 'Verifying campaign variation.',
			cancellable: true
		}, async (progress, token) => {
			const client = lytics.getClient(account.apikey);
			try {
				let variation = await client.getCampaignVariation(variationId);
				if (!variation) {
					vscode.window.showErrorMessage('The specified campaign variation does not exist in the Lytics account.');
					return Promise.resolve();
				}
				const yesMessage = 'Upload the campaign variation detail override to Lytics';
				const noMessage = 'Cancel';
				const answer = await vscode.window.showQuickPick([yesMessage, noMessage], { canPickMany: false });
				if (answer !== yesMessage) {
					return Promise.resolve();
				}
				fs.readFile(uri.fsPath, 'utf-8', async (err, data) => {
					var override = JSON.parse(data);
					var variation = await client.updateCampaignVariationDetailOverride(variationId, override);
					vscode.window.showInformationMessage(`Detail override was uploaded to Lytics for campaign variation ${variation.id}.`);
					return Promise.resolve();
				});
			}
			catch (err) {
				let message: (string | undefined);
				if (err.response) {
					if (err.response.status === 401) {
						message = 'Invalid API key was provided.';
					}
				}
				if (!message) {
					message = `Upload campaign variation detail override failed: ${err.message}`;
				}
				vscode.window.showErrorMessage(message);
				return Promise.resolve();
			}
		});
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
