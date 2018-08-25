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
			item.tooltip = "A connection to the account cannot be made with the specified API key.";
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
			const currentAccount = StateManager.account;
			if (currentAccount && currentAccount.aid === account.aid) {
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

	async commandAddAccount() {
		const apikey = await vscode.window.showInputBox({ prompt: 'Enter the API key for the account you want to add.' });
		if (!apikey) {
			return Promise.resolve();
		}
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: 'Verifying API key.',
			cancellable: true
		}, async (progress, token) => {
			const client = lytics.getClient(apikey!);
			try {
				let accounts = await client.getAccounts();
				if (!accounts || accounts.length === 0) {
					vscode.window.showErrorMessage('No accounts were found for the specified API key.');
					return Promise.resolve();
				}
				const accountOptions = accounts.map(a => `${a.aid} : ${a.name}`);
				const selectedAccount = await vscode.window.showQuickPick(accountOptions);
				if (!selectedAccount || selectedAccount.trim().length === 0) {
					return Promise.resolve();
				}
				const aid = parseInt(selectedAccount.split(':')[0]);
				if (!isNaN(aid)) {
					await SettingsManager.addAccount(aid, apikey);
					await this.refresh();
					vscode.window.showInformationMessage(`Account ${aid} was added.`);
					return Promise.resolve();
				}
			}
			catch (err) {
				let message: (string | undefined);
				if (err.response) {
					if (err.response.status === 401) {
						message = 'Invalid API key was provided.';
					}
				}
				if (!message) {
					message = `Add account failed: ${err.message}`;
				}
				vscode.window.showErrorMessage(message);
				return Promise.resolve();
			}
		});
		return Promise.resolve();
	}

	async commandRemoveAccount(account: AccountTreeItem) {
		try {
			if (!account) {
				const value = await vscode.window.showInputBox({ prompt: 'Enter the id for the account you want to remove.' });
				if (!value) {
					return Promise.resolve();
				}
				var aid = Number(value);
				if (isNaN(aid)) {
					throw new Error('An invalid account id was entered.');
				}
			}
			else {
				aid = account.aid;
			}
			if (StateManager.account && StateManager.account.aid === aid) {
				throw new Error(`You must disconnect the account before you can remove it.`);
				return Promise.resolve();
			}
			await SettingsManager.removeAccount(aid);
			await this.refresh();
			vscode.window.showInformationMessage(`Account ${aid} was removed.`);
			return Promise.resolve();
		}
		catch (err) {
			vscode.window.showErrorMessage(`Remove account failed: ${err.message}`);
			return Promise.resolve();
		}
	}

	async commandConnectAccount(accountItem: AccountTreeItem): Promise<LyticsAccount | undefined> {
		try {
			if (!accountItem) {
				const value = await vscode.window.showInputBox({ prompt: 'Enter the id for the account you want to connect to.' });
				if (!value) {
					return Promise.resolve(undefined);
				}
				var aid = Number(value);
				if (isNaN(aid)) {
					throw new Error('An invalid account id was entered.');
				}
			}
			else {
				aid = accountItem.aid;
			}

			const account = await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: 'Getting account details.',
				cancellable: true
			}, async (progress, token) => {
				const account = await SettingsManager.getAccount(aid);
				if (account) {
					StateManager.account = account;
					await this.refresh();
					vscode.window.showInformationMessage(`Account is connected: ${account.aid}`);
					return Promise.resolve(account);
				}
			});

			return Promise.resolve(account);
		}
		catch (err) {
			vscode.window.showErrorMessage(`Connect account failed: ${err.message}`);
			return Promise.resolve(undefined);
		}
	}

	async commandDisconnectAccount(accountItem: AccountTreeItem): Promise<LyticsAccount | undefined> {
		const account = StateManager.account;
		if (!account) {
			vscode.window.showErrorMessage('No account is connected.');
			return Promise.resolve(undefined);
		}

		if (accountItem && accountItem.aid !== account.aid) {
			vscode.window.showErrorMessage(`The selected account is not connected: ${account.aid}`);
			return Promise.resolve(undefined);
		}
		StateManager.account = undefined;
		await this.refresh();
		vscode.window.showInformationMessage(`The account is disconnected: ${account.aid}`);
		return Promise.resolve(account);
	}

	async commandShowAccount(accountItem: AccountTreeItem) {
		try {
			let aid = 0;
			if (accountItem) {
				aid = accountItem.aid;
			}
			else {
				const account = StateManager.account;
				if (account) {
					aid = account.aid;
				}
			}
			if (aid === 0) {
				throw new Error('Unable to determine account id.');
			}
			await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: `Loading account info: ${aid}`,
				cancellable: true
			}, async (progress, token) => {
				const uri = vscode.Uri.parse(`lytics://accounts/${aid}.json`);
				const doc = await vscode.workspace.openTextDocument(uri);
				await vscode.window.showTextDocument(doc, { preview: false });
			});
		}
		catch (err) {
			vscode.window.showErrorMessage(`Show account failed: ${err.message}`);
			return Promise.resolve();
		}
	}
	async commandExportAccounts() {
		let exportHandler:(AccountsExportHandler|undefined);
		const handlerName = await vscode.window.showQuickPick(['Export to FileZilla']);
		if (!handlerName || handlerName.trim().length === 0) {
			return;
		}
		if (handlerName === 'Export to FileZilla') {
			exportHandler = new AccountsExportFilezilla();
		}
		if (!exportHandler) {
			vscode.window.showErrorMessage(`Export handler could not be resolved: ${handlerName}`);
			return;
		}
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: 'Exporting accounts',
			cancellable: true
		}, async (progress, token) => {
			const getAccounts = async () => {
				const accounts:LyticsAccount[] = await SettingsManager.getAccounts();
				return Promise.resolve(accounts);
			};
			return await exportHandler!.export(getAccounts, progress);
		});
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

	//get tooltip(): string {
	//	return `${this.name} [${this.aid}]`;
	//}

	contextValue = 'account';
}