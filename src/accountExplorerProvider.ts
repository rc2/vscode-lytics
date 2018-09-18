import * as vscode from 'vscode';
import * as path from 'path';
import { SettingsManager } from './settingsManager';
import { StateManager } from './stateManager';
import { AccountsExportFilezilla } from './accountsExportFilezilla';
import { AccountsExportHandler } from './exports';
import { LyticsAccount } from 'lytics-js/dist/types';
import lytics = require("lytics-js/dist/lytics");
import { ContentReader } from './contentReader';
import { LyticsExplorerProvider } from './lyticsExplorerProvider';

export class AccountExplorerProvider extends LyticsExplorerProvider<LyticsAccount> {

	constructor(contentReader: ContentReader, context: vscode.ExtensionContext) {
		super('account list', contentReader, context);
	}

	getTreeItem(account: LyticsAccount): vscode.TreeItem {
		const name = account && account.name ? account.name : '';
		let item = new AccountTreeItem(name, account.aid, vscode.TreeItemCollapsibleState.None);
		if (!account) {
			item.tooltip = "A connection to the account cannot be made with the specified access token.";
		}
		item.iconPath = this.getIcon(account);
		return item;
	}

	private getIcon(account: LyticsAccount): any {
		var icon = 'cloud.svg';
		if (!account) {
			icon = 'sync-problem.svg';
		}
		else {
			if (StateManager.isActiveAccount(account.aid)) {
				icon = 'cloud-active.svg';
			}
		}
		return {
			light: this.context.asAbsolutePath(path.join('resources', 'icons', 'light', icon)),
			dark: this.context.asAbsolutePath(path.join('resources', 'icons', 'dark', icon))
		};
	}

	async getChildren(element?: LyticsAccount): Promise<LyticsAccount[]> {
		if (!element) {
			const accounts = await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: 'Getting account list.',
				cancellable: true
			}, async (progress, token) => {
				return await SettingsManager.getAccounts();
			});
			return Promise.resolve(accounts);
		}
		return Promise.resolve([]);
	}

	async commandAddAccount(): Promise<boolean> {
		const apikey = await vscode.window.showInputBox({ prompt: 'Enter the access token for the account you want to add.' });
		if (!apikey) {
			return Promise.resolve(false);
		}
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: 'Verifying access token.',
			cancellable: true
		}, async (progress, token) => {
			const client = lytics.getClient(apikey!);
			try {
				let accounts = await client.getAccounts();
				if (!accounts || accounts.length === 0) {
					vscode.window.showErrorMessage('No accounts were found for the specified access token.');
					return Promise.resolve(false);
				}
				const accountOptions = accounts.map(a => `${a.aid} : ${a.name}`);
				const selectedAccount = await vscode.window.showQuickPick(accountOptions);
				if (!selectedAccount || selectedAccount.trim().length === 0) {
					return Promise.resolve(false);
				}
				const aid = parseInt(selectedAccount.split(':')[0]);
				if (!isNaN(aid)) {
					await SettingsManager.addAccount(aid, apikey);
					await this.refresh();
					vscode.window.showInformationMessage(`Account ${aid} was added.`);
					return Promise.resolve(true);
				}
			}
			catch (err) {
				let message: (string | undefined);
				if (err.response) {
					if (err.response.status === 401) {
						message = 'Invalid access token was provided.';
					}
				}
				if (!message) {
					message = `Add account failed: ${err.message}`;
				}
				vscode.window.showErrorMessage(message);
				return Promise.resolve(false);
			}
		});
		return Promise.resolve(false);
	}

	private async promptForAid(message?: string): Promise<number> {
		if (!message) {
			message = `Select an account.`;
		}
		const values: string[] = [];
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: 'Loading accounts.',
			cancellable: true
		}, async (progress, token) => {
			const accounts = await SettingsManager.getAccounts();
			accounts.forEach(account => values.push(`${account.aid}: ${account.name}`));
		});

		let value = await vscode.window.showQuickPick(values, {
			canPickMany: false,
			placeHolder: message
		});
		if (!value) {
			return Promise.resolve(undefined);
		}
		const position = value.indexOf(':');
		if (position !== -1) {
			value = value.split(':')[0].trim();
		}
		const aid = Number(value);
		if (isNaN(aid)) {
			throw new Error('An invalid account id was entered.');
		}
		return Promise.resolve(aid);
	}

	async commandRemoveAccount(accountItem: AccountTreeItem): Promise<boolean> {
		try {
			let aid = 0;
			if (!accountItem) {
				aid = await this.promptForAid('Select the account you want to remove.');
			}
			else {
				aid = accountItem.aid;
			}
			if (!aid || aid === 0) {
				return Promise.resolve(false);
			}

			if (StateManager.isActiveAccount(aid)) {
				throw new Error(`You must disconnect the account before you can remove it.`);
			}
			const confirm = await this.confirm(`Are you sure you want to remove account ${aid}?`);
			if (!confirm) {
				return Promise.resolve(false);
			}
			await SettingsManager.removeAccount(aid);
			await this.refresh();
			vscode.window.showInformationMessage(`Account ${aid} was removed.`);
			return Promise.resolve(true);
		}
		catch (err) {
			vscode.window.showErrorMessage(`Remove account failed: ${err.message}`);
			return Promise.resolve(false);
		}
	}

	async commandConnectAccount(accountItem: AccountTreeItem): Promise<boolean> {
		try {
			let aid = 0;
			if (!accountItem) {
				aid = await this.promptForAid('Select the account you want to connect to.');
			}
			else {
				aid = accountItem.aid;
			}
			if (!aid || aid === 0) {
				return Promise.resolve(false);
			}
			const account = await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: 'Getting account details.',
				cancellable: true
			}, async (progress, token) => {
				const activeAccount = await StateManager.getActiveAccount();
				if (activeAccount) {
					if (activeAccount.aid === aid) {
						return Promise.resolve(undefined);
					}
					else {
						const confirmed = await this.confirm(`Disconnect from account ${activeAccount.aid} and connect to ${aid}?`);
						if (!confirmed) {
							return Promise.resolve(undefined);
						}
					}
				} 
				const account = await SettingsManager.getAccount(aid);
				if (account) {
					StateManager.setActiveAccount(account);
					await this.refresh();
					vscode.window.showInformationMessage(`Account is connected: ${account.aid}`);
					return Promise.resolve(account);
				}
			});
			return Promise.resolve(account !== undefined);
		}
		catch (err) {
			vscode.window.showErrorMessage(`Connect account failed: ${err.message}`);
			return Promise.resolve(false);
		}
	}

	async commandDisconnectAccount(accountItem: AccountTreeItem): Promise<boolean> {
		let aid = 0;
		if (!accountItem) {
			const account = StateManager.getActiveAccount();
			if (account) {
				aid = account.aid;
			}
		}
		if (accountItem) {
			if (!StateManager.isActiveAccount(accountItem.aid)) {
				vscode.window.showErrorMessage(`The selected account is not connected: ${accountItem.aid}`);
				return Promise.resolve(false);
			}
			aid = accountItem.aid;
		}
		const confirm = await this.confirm(`Are you sure you want to disconnect account ${aid}?`);
		if (!confirm) {
			return Promise.resolve(false);
		}
		StateManager.setActiveAccount(undefined);
		await this.refresh();
		vscode.window.showInformationMessage(`The account is disconnected: ${aid}`);
		return Promise.resolve(true);
	}

	async commandShowAccount(accountItem: AccountTreeItem): Promise<boolean> {
		try {
			let aid = 0;
			if (!accountItem) {
				aid = await this.promptForAid('Select the account whose information you want to show.');
			}
			else {
				aid = accountItem.aid;
			}
			if (!aid || aid === 0) {
				return Promise.resolve(false);
			}
			await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: `Loading account info: ${aid}`,
				cancellable: true
			}, async (progress, token) => {
				const uri = vscode.Uri.parse(`lytics://accounts/${aid}.json`);
				await this.displayAsReadOnly(uri);
				return Promise.resolve(true);
			});
		}
		catch (err) {
			vscode.window.showErrorMessage(`Show account failed: ${err.message}`);
			return Promise.resolve(false);
		}
	}

	async commandExportAccounts(): Promise<boolean> {
		let exportHandler: (AccountsExportHandler | undefined);
		const handlerName = await vscode.window.showQuickPick(['Export to FileZilla'], {
			canPickMany: false,
			placeHolder: 'Select the format for the account exports.'
		});
		if (!handlerName || handlerName.trim().length === 0) {
			return Promise.resolve(false);
		}
		if (handlerName === 'Export to FileZilla') {
			exportHandler = new AccountsExportFilezilla();
		}
		if (!exportHandler) {
			vscode.window.showErrorMessage(`Export handler could not be resolved: ${handlerName}`);
			return Promise.resolve(false);
		}
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: 'Exporting accounts',
			cancellable: true
		}, async (progress, token) => {
			const getAccounts = async () => {
				const accounts: LyticsAccount[] = await SettingsManager.getAccounts();
				return Promise.resolve(accounts);
			};
			return await exportHandler!.export(getAccounts, progress);
		});
		return Promise.resolve(true);
	}

	async commandUpdateAccountAccessToken(accountItem: AccountTreeItem): Promise<boolean> {
		try {
			let aid = 0;
			if (!accountItem) {
				aid = await this.promptForAid('Select the account you want to update.');
			}
			else {
				aid = accountItem.aid;
			}
			if (!aid || aid === 0) {
				return Promise.resolve(false);
			}

			if (StateManager.isActiveAccount(aid)) {
				throw new Error(`You must disconnect the account before you can it.`);
			}
			const apikey = await vscode.window.showInputBox({ 
				prompt: `Enter the access token you want to use for account ${aid}.` 
			});
			if (!apikey || apikey.trim().length === 0) {
				return Promise.resolve(false);
			}
			const confirm = await this.confirm(`Are you sure you want to update the access token for account ${aid}?`);
			if (!confirm) {
				return Promise.resolve(false);
			}
			await SettingsManager.updateAccount(aid, apikey);
			await this.refresh();
			vscode.window.showInformationMessage(`Access token for account ${aid} was updated.`);
			return Promise.resolve(true);
		}
		catch (err) {
			vscode.window.showErrorMessage(`Access token update failed: ${err.message}`);
			return Promise.resolve(false);
		}
	}
}

class AccountTreeItem extends vscode.TreeItem {
	constructor(
		public readonly name: string,
		public readonly aid: number,
		public readonly collapsibleState: vscode.TreeItemCollapsibleState,
		public readonly command?: vscode.Command,
	) {
		super(`[${aid}] ${name}`, collapsibleState);
	}
	contextValue = 'account';
}