import * as vscode from 'vscode';
import { LyticsAccount } from 'lytics-js/dist/types';

export interface AccountsExportHandler {
    export(getAccounts: () => Promise<LyticsAccount[]>, progress: vscode.Progress<{
        message?: string | undefined;
        increment?: number | undefined;
    }>): Promise<void>;
}