import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { StateManager } from './stateManager';
import lytics = require("lytics-js/dist/lytics");
import { LyticsAccountSetting, LyticsAccount } from 'lytics-js/dist/types';
import { ContentReader } from './contentReader';
import { LyticsExplorerProvider } from './lyticsExplorerProvider';
import { isBoolean } from 'util';

export class AccountSettingExplorerProvider extends LyticsExplorerProvider<LyticsAccountSetting> {

	/**
	 * Constructor.
	 * @param contentReader 
	 * @param context 
	 */
	constructor(contentReader: ContentReader, context: vscode.ExtensionContext) {
		super('account setting list', contentReader, context);
	}

	/**
	 * Inherited from TreeDataProvider.
	 * @param element 
	 */
	getTreeItem(element: any): vscode.TreeItem {
		if (element instanceof AccountSettingCategory) {
			return new AccountSettingCategoryTreeItem(element.name);
		}
		if (element.slug) {
			let item = new AccountSettingTreeItem(element.slug, element);
			item.iconPath = this.getSettingIcon(element);
			return item;
		}
		throw new Error(`The specified element is not supported by the account setting explorer provider.`);
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
			return this.getSettingsGroupedByCategory(account);
		}
		if (element instanceof AccountSettingCategory) {
			return Promise.resolve(element.settings);
		}
	}

	/**
	 * Gets the icon for an account setting node.
	 * @param node 
	 */
	private getSettingIcon(node: any): any {
		var icon: (string | undefined) = undefined;
		if (node.field && node.field.type) {
			const type = node.field.type;
			if (type.startsWith('[]')) {
				icon = 'array.svg';
			}
			else if (type === 'boolean') {
				icon = 'bool.svg';
			}
			else {
				icon = `${type}.svg`;
			}
		}
		if (!icon) {
			return undefined;
		}
		return {
			light: this.context.asAbsolutePath(path.join('resources', 'icons', 'light', icon)),
			dark: this.context.asAbsolutePath(path.join('resources', 'icons', 'dark', icon))
		};
	}

	/**
	 * Wrapper around the API call to get Lytics account settings
	 * grouped by category. This function provides 
	 * user feedback while data is read from Lytics.
	 * @param account 
	 * @returns Array of account setting categories.
	 */
	private async getSettingsGroupedByCategory(account: LyticsAccount): Promise<AccountSettingCategory[]> {
		const map = await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: `Loading settings for account: ${account.aid}`,
			cancellable: true
		}, async (progress, token) => {
			const client = lytics.getClient(account.apikey!);
			return client.getAccountSettingsGroupedByCategory();
		});
		if (!map) {
			return Promise.resolve([]);
		}
		const categories: AccountSettingCategory[] = [];
		for (let key of map.keys()) {
			let settings = map.get(key);
			if (settings && settings.length > 0) {
				let category = new AccountSettingCategory(key);
				for (var i = 0; i < settings.length; i++) {
					category.settings.push(settings[i]);
				}
				category.settings.sort((a, b) => {
					if (a.slug < b.slug) {
						return -1;
					}
					if (a.slug > b.slug) {
						return 1;
					}
					return 0;
				});
				categories.push(category);
			}
		}
		categories.sort((a,b) => {
			if (a.name < b.name) {
				return -1;
			}
			if (a.name > b.name) {
				return 1;
			}
			return 0;
		});
		return Promise.resolve(categories);
	}

	/**
	 * Wrapper around the API call to get Lytics account settings. 
	 * This function provides user feedback while data is 
	 * read from Lytics.
	 * @param account 
	 * @returns Array of account settings.
	 */
	private async getAccountSettings(account: LyticsAccount): Promise<LyticsAccountSetting[]> {
		const settings = await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: `Loading settings for account: ${account.aid}`,
			cancellable: true
		}, async (progress, token) => {
			const client = lytics.getClient(account.apikey!);
			return client.getAccountSettings();
		});
		if (!settings) {
			return Promise.resolve([]);
		}
		settings.sort((a, b) => {
			if (a.slug < b.slug) {
				return -1;
			}
			if (a.slug > b.slug) {
				return 1;
			}
			return 0;
		});
		return Promise.resolve(settings);
	}

	/**
	 * Wrapper around the API call to get a Lytics account setting. 
	 * This function provides user feedback while data is 
	 * read from Lytics.
	 * @param slug 
	 * @returns An account setting.
	 */
	private async getAccountSetting(slug: string): Promise<LyticsAccountSetting | undefined> {
		const account = StateManager.getActiveAccount();
		if (!account) {
			return Promise.resolve(undefined);
		}
		const client = lytics.getClient(account.apikey!);
		const setting = await client.getAccountSetting(slug);
		if (!setting) {
			throw new Error(`The setting ${slug} does not exist in the Lytics account.`);
		}
		return Promise.resolve(setting);
	}

	/**
	 * Displays a quick pick from which the user can select an account setting.
	 * @param account 
	 * @param editableOnly
	 * @param message 
	 * @returns The selected setting, or undefined if none was selected.
	 */
	private async promptForAccountSetting(account: LyticsAccount, editableOnly: boolean = false, message?: string): Promise<LyticsAccountSetting | undefined> {
		if (!message) {
			message = `Select an account setting.`;
		}
		let settings = await this.getAccountSettings(account);
		if (editableOnly) {
			settings = settings.filter(s => s.can_be_assigned);
		}
		const items = settings.map(s => new AccountSettingQuickPickItem(s));
		let item = await vscode.window.showQuickPick(items, {
			canPickMany: false,
			placeHolder: message
		});
		if (!item) {
			return Promise.resolve(undefined);
		}
		return Promise.resolve(item.setting);
	}

	async commandShowAccountSettingInfo(setting: LyticsAccountSetting): Promise<boolean> {
		try {
			const account = StateManager.getActiveAccount();
			if (!account) {
				throw new Error('No account is connected.');
			}
			if (!setting) {
				setting = await this.promptForAccountSetting(account, false, `Select the account setting you want to show.`);
			}
			if (!setting) {
				return Promise.resolve(false);
			}
			await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: `Opening account setting: ${setting.slug}`,
				cancellable: true
			}, async (progress, token) => {
				const uri = vscode.Uri.parse(`lytics://${account.aid}/settings/${setting.slug}.json`);
				await this.displayAsReadOnly(uri);
			});
			return Promise.resolve(true);
		}
		catch (err) {
			vscode.window.showErrorMessage(`Open account setting failed: ${err.message}`);
			return Promise.resolve(false);
		}
	}

	/**
	 * Wrapper around the API call to update a Lytics account setting. 
	 * This function provides user feedback while data is 
	 * written to Lytics.
	 * @param setting
	 * @param value
	 * @param account 
	 * @returns 
	 */
	private async updateAccountSetting(setting: LyticsAccountSetting, value:any, account: LyticsAccount): Promise<boolean> {
		const wasUpdated = await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: `Updating account setting: ${setting.slug}`,
			cancellable: true
		}, async (progress, token) => {
			const client = lytics.getClient(account.apikey!);
			const setting2 = await client.updateAccountSetting(setting.slug, value);
			const wasUpdated = (setting2 !== undefined && setting.slug === setting2.slug);
			if (wasUpdated) {
				await this.refresh();
			}
			return Promise.resolve(wasUpdated);	
		});
		return Promise.resolve(wasUpdated);
	}
	private parseBoolean(value:any): boolean {
		if (value === undefined || value === null) {
			return false;
		}
		if (isBoolean(value)) {
			return value;
		}
		return eval(value);
	}
	private async promptForValueBoolean(setting: LyticsAccountSetting): Promise<boolean | undefined> {
		const current = this.parseBoolean(setting.value);
		const values:string[] = [];
		if (current) {
			values.push('true');
			values.push('false');
		}
		else {
			values.push('false');
			values.push('true');
		}
		const selectedValue = await vscode.window.showQuickPick(values, {
			placeHolder: setting.field.description
		});
		if (selectedValue === undefined) {
			return Promise.resolve(undefined);
		}
		const newValue = this.parseBoolean(selectedValue);
		if (newValue === current) {
			return Promise.resolve(undefined);
		}
		return Promise.resolve(newValue);
	}

	async commandEditAccountSetting(setting: LyticsAccountSetting): Promise<boolean> {
		try {
			const account = StateManager.getActiveAccount();
			if (!account) {
				throw new Error('No account is connected.');
			}
			if (!setting) {
				setting = await this.promptForAccountSetting(account, true, `Select the account setting you want to edit.`);
			}
			if (!setting) {
				return Promise.resolve(false);
			}
			const type = setting.field.type;
			let current = setting.value;
			var newValue:any = null;
			if (type === 'boolean') {
				if (current === null) {
					current = false;
				}
				newValue = await this.promptForValueBoolean(setting);
			}
			//
			//TODO: add support for other types
			else {
				vscode.window.showErrorMessage(`Editing this type of account setting is not yet supported: ${type}`);
				return Promise.resolve(false);
			}
			if (newValue === undefined || current === newValue) {
				return Promise.resolve(false);
			}
			const confirm = await this.confirm(`Are you sure you want to change ${setting.slug}?`);
			if (!confirm) {
				return Promise.resolve(false);
			}
			return this.updateAccountSetting(setting, newValue, account);
		}
		catch (err) {
			vscode.window.showErrorMessage(`Edit account setting failed: ${err.message}`);
			return Promise.resolve(false);
		}
	}
}

class AccountSettingCategory {
	constructor(public readonly name: string) {
	}
	readonly settings: LyticsAccountSetting[] = [];
}
class AccountSettingCategoryTreeItem extends vscode.TreeItem {
	constructor(
		public readonly name: string
	) {
		super(name, vscode.TreeItemCollapsibleState.Collapsed);
	}
	contextValue = 'account-setting-category';
}

class AccountSettingTreeItem extends vscode.TreeItem {
	constructor(
		public readonly name: string,
		public readonly element: LyticsAccountSetting
	) {
		super(name, vscode.TreeItemCollapsibleState.None);
		this.tooltip = element.field.name;
		if (element.can_be_assigned) {
			this.contextValue = 'account-setting-editable';
		}
		else {
			this.contextValue = 'account-setting';
		}
	}
}

class AccountSettingQuickPickItem implements vscode.QuickPickItem {
	label: string;	
	description?: string;
	detail?: string;
	picked?: boolean;
	constructor(public readonly setting: LyticsAccountSetting) {
		this.label = setting.slug;
		this.detail = setting.field.name;
	}
}