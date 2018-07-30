import * as vscode from 'vscode';
import { Account } from "./models";

export interface AccountsExportHandler {
    export(getAccounts: () => Promise<Account[]>, progress: vscode.Progress<{
        message?: string | undefined;
        increment?: number | undefined;
    }>): Promise<void>;
}