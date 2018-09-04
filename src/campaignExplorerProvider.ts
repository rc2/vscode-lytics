import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { StateManager } from './stateManager';
import { LyticsAccount, Campaign, CampaignVariation, CampaignVariationDetailOverride } from 'lytics-js/dist/types';
import lytics = require("lytics-js/dist/lytics");
import { ContentReader } from './contentReader';
import { LyticsExplorerProvider } from './lyticsExplorerProvider';

export class CampaignExplorerProvider extends LyticsExplorerProvider<Campaign | CampaignVariation> {

	/**
	 * Constructor.
	 * @param contentReader 
	 * @param context 
	 */
	constructor(contentReader: ContentReader, context: vscode.ExtensionContext) {
		super('campaign list', contentReader, context);
	}

	/**
	 * Inherited from TreeDataProvider.
	 * @param element 
	 */
	async getChildren(element?: Campaign): Promise<any[]> {
		const account = StateManager.getActiveAccount();
		if (!account) {
			return Promise.resolve([]);
		}
		if (!element) {
			return this.getCampaigns(account);
		}
		return this.getCampaignVariations(element, account);
	}

	/**
	 * Inherited from TreeDataProvider.
	 * @param element 
	 */
	getTreeItem(element: any): vscode.TreeItem {
		if (element.name) {
			return new CampaignTreeItem(element);
		}
		if (element.variation || element.variation === 0) {
			return new CampaignVariationTreeItem(element);
		}
		throw new Error(`The specified element is not supported by the campaign explorer provider.`);
	}

	/**
	 * Wrapper around the API call to get Lytics campaigns. 
	 * This function provides user feedback while data is
	 * read from Lytics.
	 * @param account 
	 * @returns Array of campaigns.
	 */
	private async getCampaigns(account: LyticsAccount): Promise<Campaign[]> {
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

	/**
	 * Wrapper around the API call to get Lytics campaign variations. 
	 * This function provides user feedback while data is
	 * read from Lytics.
	 * @param campaign 
	 * @param account 
	 * @returns Array of campaign variations
	 */
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

	/**
	 * It is possible that multiple campaigns have the same 
	 * name. In this case, the campaign id must be appended 
	 * to the campaign name so the user can distinguish 
	 * between them.
	 * @param campaigns The campaigns to display in a quick pick.
	 * @param getValue Function that gets quick pick value for a specific campaign.
	 * @returns Array of string values that can be displayed in a quick pick.
	 */
	private getCampaignNamesForQuickPick(campaigns: Campaign[], getValue: (campaign: Campaign, isNameUnique: boolean) => string): string[] {
		const values: string[] = [];
		const campaignsByName: Map<string, Campaign[]> = new Map<string, Campaign[]>();
		campaigns.forEach(campaign => {
			var campaigns: Campaign[] = [];
			if (campaignsByName.has(campaign.name)) {
				campaigns = campaignsByName.get(campaign.name);
			}
			campaigns.push(campaign);
			campaignsByName.set(campaign.name, campaigns);
		});
		campaignsByName.forEach((value: Campaign[], key: string) => {
			const isNameUnique = value.length === 1;
			for (var i = 0; i < value.length; i++) {
				values.push(getValue(value[i], isNameUnique));
			}
		});
		return values;
	}

	/**
	 * Displays a quick pick from which the user can select a campaign.
	 * @param account 
	 * @param message 
	 * @returns The selected campaign, or undefined if none was selected.
	 */
	private async promptForCampaign(account: LyticsAccount, message?: string): Promise<Campaign | undefined> {
		if (!message) {
			message = `Select a campaign.`;
		}
		const campaigns = await this.getCampaigns(account);
		const getCampaignNameForQuickPick = function (campaign: Campaign, isNameUnique: boolean): string {
			if (isNameUnique) {
				return campaign.name;
			}
			return `${campaign.name}\t[${campaign.id}]`;
		};
		const values = this.getCampaignNamesForQuickPick(campaigns, getCampaignNameForQuickPick);
		let value = await vscode.window.showQuickPick(values, {
			canPickMany: false,
			placeHolder: message
		});
		if (!value) {
			return Promise.resolve(undefined);
		}
		//
		//When multiple campaigns have the same name, the campaign 
		//id is read. Otherwise, the campaign name is read. This 
		//means two passes may be needed in order to find the 
		//selected campaign.
		let campaign: (Campaign | undefined) = undefined;
		const valueInBrackets = this.getValueInBrackets(value);
		if (valueInBrackets) {
			campaign = campaigns.find(campaign => campaign.id === valueInBrackets);
		}
		else {
			campaign = campaigns.find(campaign => campaign.name === value);
		}
		return Promise.resolve(campaign);
	}

	/**
	 * Displays a quick pick from which the user can select a campaign variation.
	 * @param campaign 
	 * @param account 
	 * @param message 
	 * @returns The selected campaign variation, or undefined if none was selected.
	 */
	private async promptForCampaignVariation(campaign: Campaign, account: LyticsAccount, message?: string): Promise<CampaignVariation | undefined> {
		if (!message) {
			message = `Select a campaign variation.`;
		}
		var variations: CampaignVariation[] = [];
		const values: string[] = [];
		variations = await this.getCampaignVariations(campaign, account);
		variations.forEach(variation => values.push(`${variation.variation}\t[${variation.id}]`));

		let value = await vscode.window.showQuickPick(values, {
			canPickMany: false,
			placeHolder: message
		});
		if (!value) {
			return Promise.resolve(undefined);
		}
		//
		//Since campaign variations are not named, all
		//campaign variations are displayed the same
		//way: variation [id]
		value = this.getValueInBrackets(value);
		const variation = variations.find(variation => variation.id === value);
		return Promise.resolve(variation);
	}

	private async promptForFolderPath(): Promise<string | undefined> {
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

	async commandShowCampaignInfo(campaign: Campaign): Promise<boolean> {
		try {
			const account = StateManager.getActiveAccount();
			if (!account) {
				throw new Error('No account is connected.');
			}
			if (!campaign) {
				campaign = await this.promptForCampaign(account, 'Select the campaign whose info you want to show.');
			}
			if (!campaign) {
				return Promise.resolve(false);
			}
			await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: `Loading campaign info: ${campaign.name}`,
				cancellable: true
			}, async (progress, token) => {
				const uri = vscode.Uri.parse(`lytics://${account.aid}/campaigns/${campaign.id}.json`);
				await this.displayAsReadOnly(uri);
			});
			return Promise.resolve(true);
		}
		catch (err) {
			vscode.window.showErrorMessage(`Show campaign info failed: ${err.message}`);
			return Promise.resolve(false);
		}
	}

	async commandShowCampaignVariationInfo(variation: CampaignVariation): Promise<boolean> {
		try {
			const account = StateManager.getActiveAccount();
			if (!account) {
				throw new Error('No account is connected.');
			}
			if (!variation) {
				const campaign = await this.promptForCampaign(account, 'Select the campaign whose variation info you want to show.');
				if (!campaign) {
					return Promise.resolve(false);
				}
				variation = await this.promptForCampaignVariation(campaign, account, 'Select the campaign variation whose info you want to show.');
			}
			if (!variation) {
				return Promise.resolve(false);
			}
			await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: `Loading campaign variation info: ${variation.id}`,
				cancellable: true
			}, async (progress, token) => {
				const uri = vscode.Uri.parse(`lytics://${account.aid}/variations/${variation.id}.json`);
				await this.displayAsReadOnly(uri);
			});
			return Promise.resolve(true);
		}
		catch (err) {
			vscode.window.showErrorMessage(`Show campaign variation info failed: ${err.message}`);
			return Promise.resolve(false);
		}
	}

	async commandDownloadCampaignVariationDetailOverride(variation: CampaignVariation): Promise<boolean> {
		try {
			const account = StateManager.getActiveAccount();
			if (!account) {
				throw new Error('No account is connected.');
			}
			if (!variation) {
				const campaign = await this.promptForCampaign(account, 'Select the campaign whose variation detail override you want to download.');
				if (!campaign) {
					return Promise.resolve(false);
				}
				variation = await this.promptForCampaignVariation(campaign, account, 'Select the campaign variation whose detail override you want to download.');
			}
			if (!variation) {
				return Promise.resolve(false);
			}
			const downloadPath = await this.promptForFolderPath();
			if (!downloadPath || downloadPath.trim().length === 0) {
				return Promise.resolve(false);
			}
			const wasDownloaded = await vscode.window.withProgress({
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
				if (!filePath) {
					return Promise.resolve(false);
				}
				const uri = vscode.Uri.file(filePath);
				await this.displayAsReadOnly(uri);
				vscode.window.showInformationMessage(`Campaign variation downloaded: ${filePath}`);
				return Promise.resolve(true);
			});
		}
		catch (err) {
			vscode.window.showErrorMessage(`Downloading campaign variationb failed: ${err.message}`);
			return Promise.resolve(false);
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
		var override: any = variation.detail_override;
		if (!override) {
			override = {};
		}
		var text = JSON.stringify(override, null, 4);
		await fs.writeFile(filePath, text, err => { });
		return Promise.resolve(filePath);
	}

	async commandUploadCampaignVariationDetailOverride(uri: vscode.Uri): Promise<boolean> {
		const editor = vscode.window.activeTextEditor;
		if (!uri) {
			if (editor && editor.document) {
				uri = editor.document.uri;
			}
		}
		if (!uri) {
			return Promise.resolve(false);
		}
		if (uri.scheme !== 'file') {
			vscode.window.showErrorMessage('Only local files can be uploaded to Lytics.');
			return Promise.resolve(false);
		}
		if (editor.document.uri.toString() !== uri.toString()) {
			//this should not happen
			vscode.window.showErrorMessage('Editor and override documents do not match.');
			return Promise.resolve(false);
		}
		if (editor.document.isDirty) {
			vscode.window.showErrorMessage('Save the file before uploading a campaign variation detail override to Lytics.');
			return Promise.resolve(false);
		}
		const account = StateManager.getActiveAccount();
		if (!account) {
			vscode.window.showErrorMessage('Connect to an account before uploading a campaign variation detail override to Lytics.');
			return Promise.resolve(false);
		}
		const variationId = path.parse(uri.fsPath).name;
		if (!variationId || variationId.trim().length === 0) {
			await vscode.window.showErrorMessage('Unable to determine the campaign variation id from the file path.');
			return Promise.resolve(false);
		}
		//
		//upload the detail override file
		const wasUploaded = await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: 'Uploading campaign variation.',
			cancellable: true
		}, async (progress, token) => {
			const client = lytics.getClient(account.apikey);
			try {
				let variation = await client.getCampaignVariation(variationId);
				if (!variation) {
					vscode.window.showErrorMessage(`The campaign variation does not exist in Lytics account ${account.aid}.`);
					return Promise.resolve(false);
				}
				const yesMessage = 'Upload the campaign variation detail override to Lytics';
				const noMessage = 'Cancel';
				const answer = await vscode.window.showQuickPick([yesMessage, noMessage], { canPickMany: false });
				if (answer !== yesMessage) {
					return Promise.resolve(false);
				}
				fs.readFile(uri.fsPath, 'utf-8', async (err, data) => {
					var override = JSON.parse(data);
					var variation = await client.updateCampaignVariationDetailOverride(variationId, override);
					vscode.window.showInformationMessage(`Detail override was uploaded to Lytics for campaign variation ${variation.id}.`);
					return Promise.resolve(true);
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
				return Promise.resolve(false);
			}
		});
		return Promise.resolve(wasUploaded);
	}
}

class CampaignTreeItem extends vscode.TreeItem {
	constructor(element: Campaign) {
		super(element.name!, vscode.TreeItemCollapsibleState.Collapsed);
		this.id = element.id;
		this.contextValue = 'campaign';
	}
	readonly id: string;
	get tooltip(): string {
		if (!this.id) {
			return '';
		}
		return `${this.id}`;
	}
}

class CampaignVariationTreeItem extends vscode.TreeItem {
	constructor(element: CampaignVariation) {
		super(element.variation.toString(), vscode.TreeItemCollapsibleState.None);
		this.contextValue = 'campaignVariation';
		this.id = element.id;
	}
	readonly id: string;
	get tooltip(): string {
		if (!this.id) {
			return '';
		}
		return `${this.id}`;
	}
}
