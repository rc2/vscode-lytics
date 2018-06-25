import * as vscode from 'vscode';
import { Account, TableNode } from './models';
import { LyticsClient } from './lyticsClient';

export class SettingsManager {

	constructor() {
    }
    
    static async getAccount(aid: number): Promise<Account> {
        let settings = vscode.workspace.getConfiguration().get('lytics.accounts', [] as AccountSetting[]);
        let existing = settings.find(obj => obj.aid === aid);
        if (!existing) {
            return Promise.reject(new Error('The specified account id has not been configured.'));
        }
        return this.getAccountFromSettings(existing);
    }

    private static async getAccountFromSettings(setting: AccountSetting): Promise<Account> {
        let client = new LyticsClient(setting.apikey);
        var account = await client.getAccount();
        return Promise.resolve(account);
    }

    static async getAccounts(): Promise<Account[]> {
        const settings = vscode.workspace.getConfiguration().get('lytics.accounts', [] as AccountSetting[]);
        let accounts:Account[] = [];
        for (let setting of settings) {
            try {
                var account = await this.getAccountFromSettings(setting);
            }
            catch(err) {
                account = {name: '', aid: setting.aid, isValid: false, apikey: setting.apikey};
            }
            accounts.push(account);
        }
        accounts = accounts.sort( (a, b) => {
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

    static async addAccount(apikey: string, aid: number) {
        let settings = vscode.workspace.getConfiguration().get('lytics.accounts', [] as AccountSetting[]);
        let existing = settings.find(obj => obj.apikey === apikey);
        if (existing) {
            let err = new Error(`The specified API key is already being used for account ${aid}.`);
            return Promise.reject(err);
        }
        settings.push(<AccountSetting>{apikey: apikey, aid: aid});
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

    static async getTables(aid: number): Promise<TableNode[]> {
        let tables:TableNode[] = [];
        const settings = vscode.workspace.getConfiguration().get('lytics.accounts', [] as AccountSetting[]);
        var setting = settings.find((account) => account.aid === aid);
        if (setting) {
            if (setting.tables) {
                for (let i=0; i<setting.tables.length; i++) {
                    let table = <TableNode>{ 
                        name: setting.tables[i], 
                        kind: 'table'}
                    ;
                    tables.push(table);
                }
            }
        }
        tables = tables.sort( (a, b) => {
            if (a.name < b.name) {
                return -1;
            }
            if (a.name > b.name) {
                return 1;
            }
            return 0;
        });
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

}
interface AccountSetting {
    apikey: string;
    aid: number;
    tables: string[];
}
