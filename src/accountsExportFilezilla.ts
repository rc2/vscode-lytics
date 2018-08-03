import * as vscode from 'vscode';
import * as fs from 'fs';
import { AccountsExportHandler } from './exports';
import { LyticsAccount } from '../node_modules/lytics-js/dist/types';
import lytics = require("lytics-js");

export class AccountsExportFilezilla implements AccountsExportHandler {
    async export(getAccounts: () => Promise<LyticsAccount[]>, progress: vscode.Progress<{
        message?: string | undefined;
        increment?: number | undefined;
    }>) {
        const path = await vscode.window.showSaveDialog({
            filters: {
                'FileZilla config files': ['xml']
            },
            defaultUri: vscode.Uri.file('FileZilla.xml')
        });
        if (!path) {
            return Promise.resolve();
        }
        //
        progress.report({
            message: `loading accounts`
        });
        const accounts = await getAccounts();
        if (!accounts || accounts.length === 0) {
            return;
        }
        const servers: string[] = [];
        for (let i = 0; i < accounts.length; i++) {
            const account = accounts[i];
            const client = lytics.getClient(account.apikey!);
            const account2 = await client.getAccount(account.aid);
            if (account2) {
                const server = AccountsExportFilezilla.getServer(account2);
                servers.push(server);
            }
            progress.report({
                message: `${i + 1} of ${accounts.length} accounts processed`
            });
        }
        const data = `<?xml version="1.0" encoding="UTF-8"?>
			<FileZilla3 version="3.35.1" platform="mac">
				<Servers>
				${servers.join('')}
				</Servers>
			</FileZilla3>`;
        await fs.writeFile(path.fsPath, data, err => { });
        vscode.window.showInformationMessage(`Accounts exported for FileZilla: ${path.fsPath}`);
        return Promise.resolve();
    }
    static getServer(account: LyticsAccount): string {
        const pass = new Buffer(account.dataapikey!).toString('base64');
        const server = `
			<Server>
				<Host>lytics.brickftp.com</Host>
				<Port>22</Port>
				<Protocol>1</Protocol>
				<Type>0</Type>
				<User>${account.domain}</User>
				<Pass encoding="base64">${pass}</Pass>
				<Logontype>1</Logontype>
				<TimezoneOffset>0</TimezoneOffset>
				<PasvMode>MODE_DEFAULT</PasvMode>
				<MaximumMultipleConnections>0</MaximumMultipleConnections>
				<EncodingType>Auto</EncodingType>
				<BypassProxy>0</BypassProxy>
				<Name>${account.aid} - ${account.name}</Name>
				<Comments />
				<Colour>0</Colour>
				<LocalDir />
				<RemoteDir />
				<SyncBrowsing>0</SyncBrowsing>
				<DirectoryComparison>0</DirectoryComparison>
			</Server>`;
        return server;
    }
}