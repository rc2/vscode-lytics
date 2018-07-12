import * as vscode from 'vscode';
import * as fs from 'fs';
import { LyticsClient } from './lyticsClient';
import { StateManager } from './stateManager';

export class QueryEditorProvider  {
	constructor(private context: vscode.ExtensionContext) {
		if (!this.context) {
		}
	}

	async commandUploadQuery(uri: vscode.Uri) {
		if (!uri) {
			return Promise.resolve();
		}
		if (uri.scheme !== 'file') {
			return vscode.window.showErrorMessage('Only local files can be uploaded to Lytics.');
		}
		const account = StateManager.account;
		if (!account) {
			return vscode.window.showErrorMessage('Connect to an account before uploading a query to Lytics.');
		}
		const editor = vscode.window.activeTextEditor;
		if (editor && editor.document) {
			if (editor.document.uri.toString() !== uri.toString()) {
				//this should not happen
				return vscode.window.showErrorMessage('Editor and query documents do not match.');
			}
			if (editor.document.isDirty) {
				return vscode.window.showErrorMessage('Save the file before uploading a query to Lytics.');
			}
		}
		//get the query alias from the file
		fs.readFile(uri.path, 'utf-8', async (err, data) => {
			const regex = /\bALIAS\s*([a-zA-Z_\-]+)/;
			const matches = data.match(regex);
			let alias;
			if (matches && matches.length === 2 && matches[0].startsWith('ALIAS') && matches[1]) {
				alias = matches[1].trim();
			}
			if (!alias || alias.length === 0) {
				await vscode.window.showErrorMessage('Unable to upload query: no query alias was found in the LQL.');
				return Promise.resolve();
			}
			//determine if the query already exists
			var currentQuery;
			const client = new LyticsClient(account.apikey);
			try {
				currentQuery = await client.getQuery(alias);
			}
			catch (err) {
				if (!err || !err.response || !err.response.status || err.response.status !== 404) {
					vscode.window.showErrorMessage(`Unable to determine if the query already exists.`);
					return Promise.resolve();
				}
			}
			//prompt the user to add new or overwrite existing query
			const yesMessage = currentQuery ? 'Overwrite existing query on Lytics' : 'Add new query to Lytics';
			const noMessage = 'Cancel';
			const answer = await vscode.window.showQuickPick([yesMessage, noMessage], { canPickMany: false });
			if (answer !== yesMessage) {
				return Promise.resolve();
			}
			const response = await client.upsertQuery(data);
			if (response.status !== 200) {
				vscode.window.showErrorMessage(`Unable to upload query ${alias} to Lytics: ${response.message}.`);
				return Promise.resolve();
			}
			vscode.window.showInformationMessage(`Query ${alias} was uploaded to Lytics.`);
			return Promise.resolve();
		});
	}
}