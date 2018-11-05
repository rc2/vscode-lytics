import * as vscode from 'vscode';
import lytics = require("lytics-js/dist/lytics");
import { ContentDisplayer } from './contentDisplayer';
import { ContentReader } from './contentReader';

export class UtilitiesProvider implements ContentDisplayer, vscode.Disposable {
	constructor(private contentReader: ContentReader, public context: vscode.ExtensionContext) {
	}
	async displayAsReadOnly(uri: vscode.Uri, readFromCache?: boolean): Promise<vscode.TextEditor> {
		if (this.contentReader) {
			this.contentReader.removeFromCache(uri);
		}
		const doc = await vscode.workspace.openTextDocument(uri);
		return vscode.window.showTextDocument(doc, { preview: false });
	}
	async commandGenerateHash(): Promise<boolean> {
		try {
			//TODO: Prompt for hash type.
			const hashType = 'sip';
			const value = await vscode.window.showInputBox({
				prompt: `Enter the value you want to generate a ${hashType} hash for.`
			});
			if (!value || value.trim().length === 0) {
				return Promise.resolve(false);
			}
			await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: `Generating ${hashType}: ${value}`,
				cancellable: true
			}, async (progress, token) => {
				const uri = vscode.Uri.parse(`lytics://utils/hash/${hashType}/${encodeURIComponent(value)}.json`);
				await this.displayAsReadOnly(uri);
				return Promise.resolve(true);
			});
		}
		catch (err) {
			vscode.window.showErrorMessage(`Generate hash failed: ${err.message}`);
			return Promise.resolve(false);
		}

		// const siphash = require("siphash");
		// const key = [0x0, 0x0, 0x1, 0x0];
		// const hash = siphash.hash(key, value);
		// const hex = [hash.h.toString(16), hash.l.toString(16)].join('');
		// const int64 = require('int64');
		// const hashedValue = int64.hex2dec(hex);
		// vscode.window.showInformationMessage(`${hashedValue} --> SipHash of: ${value}`);

	}
	dispose() {
	}
}