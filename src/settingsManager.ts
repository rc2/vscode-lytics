import * as vscode from 'vscode';
import lytics = require("lytics-js/dist/lytics");
import { LyticsAccount, TableSchema } from 'lytics-js/dist/types';

export class SettingsManager {

    constructor() {
    }

    static async getAccount(aid: number): Promise<LyticsAccount | undefined> {
        let settings = vscode.workspace.getConfiguration().get('lytics.accounts', [] as AccountSetting[]);
        let existing = settings.find(obj => obj.aid === aid);
        if (!existing) {
            return Promise.reject(new Error('The specified account id has not been configured.'));
        }
        return this.getAccountFromSettings(existing);
    }

    private static async getAccountFromSettings(setting: AccountSetting): Promise<LyticsAccount | undefined> {
        let client = lytics.getClient(setting.apikey);
        var account = await client.getAccount(setting.aid);
        return Promise.resolve(account);
    }

    static async getAccounts(): Promise<LyticsAccount[]> {
        const settings = vscode.workspace.getConfiguration().get('lytics.accounts', [] as AccountSetting[]);
        let accounts: LyticsAccount[] = [];
        for (let setting of settings) {
            try {
                var account = await this.getAccountFromSettings(setting);
                if (!account) {
                    throw new Error();
                }
            }
            catch (err) {
                account = new LyticsAccount();
                account.aid = setting.aid;
                account.apikey = setting.apikey;
            }
            accounts.push(account);
        }
        accounts = accounts.sort((a, b) => {
            if (a.aid < b.aid) {
                return -1;
            }
            if (a.aid > b.aid) {
                return 1;
            }
            return 0;
        });
        return Promise.resolve(accounts);
    }

    static async addAccount(aid: number, apikey: string) {
        let settings = vscode.workspace.getConfiguration().get('lytics.accounts', [] as AccountSetting[]);
        let existing = settings.find(obj => obj.apikey === apikey && obj.aid === aid);
        if (existing) {
            let err = new Error(`Account ${aid} already exists.`);
            return Promise.reject(err);
        }
        settings.push(<AccountSetting>{ apikey: apikey, aid: aid });
        await vscode.workspace.getConfiguration().update('lytics.accounts', settings, true);
    }

    static async removeAccount(aid: number) {
        let settings = vscode.workspace.getConfiguration().get('lytics.accounts', [] as AccountSetting[]);
        let existing = settings.find(obj => obj.aid === aid);
        if (!existing) {
            let err = new Error(`The specified account id is not defined in settings.`);
            return Promise.reject(err);
        }
        var index = settings.indexOf(existing);
        if (index > -1) {
            settings.splice(index, 1);
            await vscode.workspace.getConfiguration().update('lytics.accounts', settings, true);
        }
        return Promise.resolve();
    }

    static async getTables(aid: number): Promise<TableSchema[]> {
        let tables: TableSchema[] = [];
        const settings = vscode.workspace.getConfiguration().get('lytics.accounts', [] as AccountSetting[]);
        var setting = settings.find((account) => account.aid === aid);
        if (setting) {
            if (setting.tables) {
                setting.tables.sort();
                for (let i = 0; i < setting.tables.length; i++) {
                    let table = new TableSchema();
                    table.name = setting.tables[i];
                    tables.push(table);
                }
            }
        }
        return Promise.resolve(tables);
    }

    static async addTable(name: string, aid: number) {
        let settings = vscode.workspace.getConfiguration().get('lytics.accounts', [] as AccountSetting[]);
        let existing = settings.find(obj => obj.aid === aid);
        if (!existing) {
            let err = new Error(`The specified account id is not defined in settings.`);
            return Promise.reject(err);
        }
        if (!existing.tables) {
            existing.tables = [];
        }
        if (existing.tables.indexOf(name) > -1) {
            let err = new Error(`The table ${name} is already included.`);
            return Promise.reject(err);
        }
        existing.tables.push(name);
        await vscode.workspace.getConfiguration().update('lytics.accounts', settings, true);
    }

    static async removeTable(name: string, aid: number) {
        let settings = vscode.workspace.getConfiguration().get('lytics.accounts', [] as AccountSetting[]);
        let existing = settings.find(obj => obj.aid === aid);
        if (!existing) {
            let err = new Error(`The specified account id is not defined in settings.`);
            return Promise.reject(err);
        }
        let index = settings.indexOf(existing);
        if (index > -1) {
            var setting = settings[index];
            let index2 = setting.tables.indexOf(name);
            if (index2 === -1) {
                let err = new Error(`The table ${name} is not current set on the account ${aid}.`);
                return Promise.reject(err);
            }
            setting.tables.splice(index2, 1);
            await vscode.workspace.getConfiguration().update('lytics.accounts', settings, true);
        }
        return Promise.resolve();
    }
    static getWatchSettings(): LyticsWatchSettings {
        return vscode.workspace.getConfiguration().get('lytics.watch') as LyticsWatchSettings;
    }
}
interface AccountSetting {
    apikey: string;
    aid: number;
    tables: string[];
}
interface LyticsWatchSettings {
    colorize: boolean;
    max: number;
}