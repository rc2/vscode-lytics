import * as vscode from 'vscode';
import * as path from 'path';
import { LyticsClient } from './lyticsClient';
import { Account } from './models';
import { SettingsManager } from './settingsManager';
import { StateManager } from './stateManager';

export class AccountExplorerProvider implements vscode.TreeDataProvider<Account> {

	private _onDidChangeTreeData: vscode.EventEmitter<any> = new vscode.EventEmitter<any>();
	readonly onDidChangeTreeData: vscode.Event<any> = this._onDidChangeTreeData.event;

	constructor(private context: vscode.ExtensionContext) {
	}
	
	async refresh() {
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: 'Refreshing account list.',
			cancellable: true
		}, async (progress, token) => {
			this._onDidChangeTreeData.fire();
		});
	}

	getTreeItem(element: Account): vscode.TreeItem {
		let item = new AccountTreeItem(element.name, element.aid, vscode.TreeItemCollapsibleState.None);
		if (!element.isValid) {
			item.tooltip = "A connection to the account cannot be made with the specified API key.";
		}
		item.iconPath = this.getIcon(element);
		return item;
	}

	private getIcon(account: Account): any {
		var icon = 'cloud.svg';
		if (!account.isValid) {
			icon = 'ban.svg';
		}
		const currentAccount = StateManager.account;
		if (currentAccount && currentAccount.aid === account.aid) {
			icon = 'cloud_active.svg';
		}
		return  {
			light: this.context.asAbsolutePath(path.join('resources', 'icons', 'light', icon)),
			dark: this.context.asAbsolutePath(path.join('resources', 'icons', 'dark', icon))
		};
	}

	async getChildren(element?: Account): Promise<Account[]> {
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
		const apikey = await vscode.window.showInputBox({prompt: 'Enter the API key for the account you want to add.'});
		if (!apikey) {
			return Promise.resolve();
		}
		await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: 'Verifying API key.',
				cancellable: true
			}, async (progress, token) => {
				const client = new LyticsClient(apikey!);
				try {
					progress.report({increment: 25});
					let account = await client.getAccount();
					progress.report({increment: 50});
					await SettingsManager.addAccount(apikey, account.aid);
					progress.report({increment: 75});
					await this.refresh();
					progress.report({increment: 100});
					vscode.window.showInformationMessage(`Account ${account.aid} was added.`);
					return Promise.resolve();
				}
				catch(err) {
					vscode.window.showErrorMessage(`Add account failed: ${err.message}`);
					return Promise.resolve();
				}
		});
		return Promise.resolve();
	}

	async commandRemoveAccount(account: AccountTreeItem) {
		try {
			if (!account) {
				const value = await vscode.window.showInputBox({prompt: 'Enter the id for the account you want to remove.'});
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
			await SettingsManager.removeAccount(aid);
			await this.refresh();
			vscode.window.showInformationMessage(`Account ${aid} was removed.`);
			return Promise.resolve();
		}
		catch(err) {
			vscode.window.showErrorMessage(`Remove account failed: ${err.message}`);
			return Promise.resolve();
		}
	}

	async commandConnectAccount(accountItem: AccountTreeItem): Promise<Account | undefined> {
		try {
			if (!accountItem) {
				const value = await vscode.window.showInputBox({prompt: 'Enter the id for the account you want to connect to.'});
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
				StateManager.account = account;
				await this.refresh();
				vscode.window.showInformationMessage(`Account ${account.aid} is now connected.`);
				return Promise.resolve(account);
			});

			return Promise.resolve(account);
		}
		catch(err) {
			vscode.window.showErrorMessage(`Connect account failed: ${err.message}`);
			return Promise.resolve(undefined);
		}
	}
	 
	async commandDisconnectAccount(accountItem: AccountTreeItem): Promise<Account | undefined> {
		const account = StateManager.account;
		if (!account) {
			vscode.window.showErrorMessage('No account is connected.');
			return Promise.resolve(undefined);
		}

		if (accountItem && accountItem.aid !== account.aid) {
			vscode.window.showErrorMessage('The selected account is not connected.');
			return Promise.resolve(undefined);
		}
		StateManager.account = undefined;
		await this.refresh();
		vscode.window.showInformationMessage(`The account ${account.aid} has been disconnected.`);
		return Promise.resolve(account);
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