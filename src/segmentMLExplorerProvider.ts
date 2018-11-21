import * as vscode from 'vscode';
import * as path from 'path';
import { StateManager } from './stateManager';
import { LyticsAccount, Segment, SegmentMLModel, CreateSegmentMLModelConfig, SegmentMLModelSegment, SegmentMLSummaryConfig } from 'lytics-js/dist/types';
import { ContentReader } from './contentReader';
import { LyticsExplorerProvider } from './lyticsExplorerProvider';
import { SegmentSelector } from './segmentSelector';
import { isUndefined, isNullOrUndefined } from 'util';
import { LyticsClient } from 'lytics-js/dist/LyticsClient';

export class SegmentMLExplorerProvider extends LyticsExplorerProvider<SegmentMLModel> {

	/**
	 * Constructor.
	 * @param contentReader 
	 * @param context 
	 */
	constructor(contentReader: ContentReader, context: vscode.ExtensionContext) {
		super('SegmentML model list', contentReader, context);
	}

	/**
	 * Inherited from TreeDataProvider.
	 * @param element 
	 */
	async getChildren(element?: SegmentMLModel): Promise<any[]> {
		const account = StateManager.getActiveAccount();
		if (!account) {
			return Promise.resolve([]);
		}
		if (!element) {
			return this.getModels(account);
		}
		return Promise.resolve([]);
	}

	/**
	 * Inherited from TreeDataProvider.
	 * @param element 
	 */
	getTreeItem(element: any): vscode.TreeItem {
		if (element.name) {
			return new ModelTreeItem(element);
		}
		throw new Error(`The specified element is not supported by the SegmentML explorer provider.`);
	}

	/**
	 * Wrapper around the API call to get Lytics SegmentML models. 
	 * This function provides user feedback while data is
	 * read from Lytics.
	 * @param account 
	 * @returns Array of SegmentML models.
	 */
	private async getModels(account: LyticsAccount): Promise<SegmentMLModel[]> {
		let models = await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: `Loading SegmentML models for account: ${account.aid}`,
			cancellable: true
		}, async (progress, token) => {
			const client = await this.getClient(account.aid);
			try {
				const mlModels = await client.getSegmentMLModels();
				var sortedModels = mlModels.sort((a: SegmentMLModel, b: SegmentMLModel) => {
					if (a.name! < b.name!) {
						return -1;
					}
					if (a.name! > b.name!) {
						return 1;
					}
					return 0;
				});
				return Promise.resolve(sortedModels);
			}
			catch (err) {
				let message: (string | undefined);
				if (err && err.response) {
					if (err.response.status === 404) {
						return Promise.resolve([]);
					}
				}
				if (!message) {
					message = `Loading SegmentML models failed: ${err.message}`;
				}
				vscode.window.showErrorMessage(message);
				return Promise.resolve();
			}
		});
		if (!models) {
			models = [];
		}
		return Promise.resolve(models);
	}

	/**
	 * Displays a quick pick from which the user can select a SegmentML model.
	 * @param account 
	 * @param message 
	 * @returns The selected model, or undefined if none was selected.
	 */
	private async promptForModel(account: LyticsAccount, message?: string): Promise<SegmentMLModel | undefined> {
		if (!message) {
			message = `Select a SegmentML model.`;
		}
		const models = await this.getModels(account);

		const values = models.map(model => new ModelQuickPickItem(model));
		let value = await vscode.window.showQuickPick(values, {
			canPickMany: false,
			placeHolder: message
		});
		if (!value) {
			return Promise.resolve(undefined);
		}
		const selectedModel = models.find(model => model.name === value.detail);
		return Promise.resolve(selectedModel);
	}

	async commandShowModelInfo(model: SegmentMLModel): Promise<boolean> {
		try {
			const account = StateManager.getActiveAccount();
			if (!account) {
				throw new Error('No account is connected.');
			}
			if (!model) {
				model = await this.promptForModel(account, 'Select the SegmentML model whose info you want to show.');
			}
			if (!model) {
				return Promise.resolve(false);
			}
			const name = SegmentMLModel.getModelNameWithoutGeneration(model.name);
			await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: `Loading SegmentML model info: ${name}`,
				cancellable: true
			}, async (progress, token) => {
				const uri = vscode.Uri.parse(`lytics://${account.aid}/segmentml/${name}.json`);
				await this.displayAsReadOnly(uri);
			});
			return Promise.resolve(true);
		}
		catch (err) {
			vscode.window.showErrorMessage(`Show SegmentML model info failed: ${err.message}`);
			return Promise.resolve(false);
		}
	}
	private _panels: Map<string, vscode.WebviewPanel> = new Map<string, vscode.WebviewPanel>();
	async commandShowModelVisualize(model: SegmentMLModel, context: vscode.ExtensionContext): Promise<boolean> {
		try {
			const account = StateManager.getActiveAccount();
			if (!account) {
				throw new Error('No account is connected.');
			}
			if (!model) {
				model = await this.promptForModel(account, 'Select the SegmentML model whose info you want to show.');
			}
			if (!model) {
				return Promise.resolve(false);
			}
			const name = SegmentMLModel.getModelNameWithoutGeneration(model.name);
			await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: `Loading SegmentML model visualization: ${name}`,
				cancellable: true
			}, async (progress, token) => {
				let panel = this._panels.get(name);
				if (!panel) {
					panel = vscode.window.createWebviewPanel(
						'modelVisualization',
						name,
						vscode.ViewColumn.One,
						{
							enableScripts: true,
							localResourceRoots: [
								vscode.Uri.file(path.join(context.extensionPath, 'resources', 'js'))
							]
						}
					);
					panel.onDidDispose(() => this._panels.delete(name));
					this._panels.set(name, panel);
				}
				const client = await this.getClient(account.aid);
				panel.webview.html = await this.getHtml(model, context.extensionPath, client);
				panel.reveal();
			});
			return Promise.resolve(true);
		}
		catch (err) {
			vscode.window.showErrorMessage(`Show SegmentML model visualization failed: ${err.message}`);
			return Promise.resolve(false);
		}
	}
	async getHtml(model: SegmentMLModel, extensionPath: string, client: LyticsClient): Promise<string> {
		//
		//TODO: it is possible that the source or target segment has been deleted, which means there is no segment to retrieve.
		//const source = await client.getSegment(model.conf.source.id);
		//const target = await client.getSegment(model.conf.target.id);
		const source = model.conf.source;
		const target = model.conf.target;
		const jsLinks = await this.getJsForHtmlHead(extensionPath);
		const segmentInfo = await this.getSegmentInfoHtml(source, target);
		const gauges = await this.getGauges(model);
		const graph = await this.getFeatureGraph(model);
		const html = `<html>` +
			`<head>` +
			`<style>
				#legend table { background-color: transparent }
				.hide { display: none }
				.transparent { background-color: transparent }
			</style>` +
			jsLinks +
			`<script type="text/javascript">` +
			`google.charts.load('current', { packages: ['corechart', 'bar', 'table', 'gauge'] });
			var features = JSON.parse('${JSON.stringify(model.features)}');
			var summary = JSON.parse('${JSON.stringify(model.summary.conf)}');
			var modelFuzziness = ${SegmentMLSummaryConfig.getModelFuzziness(model.summary.conf)};
			var falsePositiveRate = ${SegmentMLSummaryConfig.getFalsePositiveRate(model.summary.conf)};
			var falseNegativeRate = ${SegmentMLSummaryConfig.getFalseNegativeRate(model.summary.conf)};
			google.charts.setOnLoadCallback(drawCharts);` +
			`</script>` +
			`<style>` +
			`#segment-info { width: 700px; padding-bottom: 16px; }` +
			`#segment-info th, #segment-info td { border: 1px solid; padding: 8px; text-align: center; }` +
			`#segment-info th.empty { border: 0px; }` +
			`#segment-info td.right { text-align: right; }` +
			`</style>` +
			`</head>` +
			`<body>` +
			`<h1>${model.conf.source.name} &gt; ${model.conf.target.name} </h1>` +
			segmentInfo +
			gauges +
			graph +
			`<p style="font-size: x-small; padding-top:20px; ">Generated at: ${new Date()}</p>` +
			`</body>` +
			`</html>`;
		return Promise.resolve(html);
	}
	async getJsForHtmlHead(extensionPath: string): Promise<string> {
		const lines: string[] = [];
		const files = ['loader.js', 'segmentml-helper.js'];
		files.forEach(file => {
			const pathJs1 = vscode.Uri.file(path.join(extensionPath, 'resources', 'js', file));
			const pathJs2 = pathJs1.with({ scheme: 'vscode-resource' });
			lines.push(`<script type="text/javascript" src="${pathJs2}"></script>`);
		});
		return Promise.resolve(lines.join('\n'));
	}
	async getSegmentInfoHtml(source: SegmentMLModelSegment, target: SegmentMLModelSegment): Promise<string> {
		const html = `<table id="segment-info">` +
			`<tr>` +
			`<th class="empty"></th>` +
			`<th>Source segment</th>` +
			`<th>Target segment</th>` +
			`</tr>` +
			`<tr><td class="right">Name</td><td>${source.name}</td><td>${target.name}</td></tr>` +
			`<tr><td class="right">Slug</td><td>${source.slug_name}</td><td>${target.slug_name}</td></tr>` +
			`<tr><td class="right">ID</td><td>${source.id}</td><td>${target.id}</td></tr>` +
			`<tr><td class="right">Description</td><td>${source.description}</td><td>${target.description}</td></tr>` +
			`</table>`;
		return Promise.resolve(html);
	}
	async getGauges(model: SegmentMLModel): Promise<string> {
		return Promise.resolve(`<div id="gauges"></div>`);
	}
	async getFeatureGraph(model: SegmentMLModel): Promise<string> {
		const html = `<div id="chart" style="width: 700px; height: 450px;">
		</div>
		<div id="legend"></div>`;
		return Promise.resolve(html);
	}
	async commandAddModel(): Promise<boolean> {
		try {
			const account = StateManager.getActiveAccount();
			if (!account) {
				throw new Error('No account is connected.');
			}
			const client = await this.getClient(account.aid);
			if (!client) {
				throw new Error('No Lytics client is available.');
			}
			const selector = new SegmentSelector(client, account);
			const source = await selector.promptForSegment('Select the source segment.');
			if (!source) {
				return Promise.resolve(false);
			}
			const target = await selector.promptForSegment('Select the target segment.');
			if (!target) {
				return Promise.resolve(false);
			}
			//
			//
			if (source.slug_name === target.slug_name) {
				throw new Error('You must select different segments for the source and target segments for a SegmentML model.');
			}
			//
			//prompt for use scores
			const ignoreScores = await vscode.window.showQuickPick(['No', 'Yes'], {
				canPickMany: false,
				placeHolder: 'Ignore behavioral scores?'
			});
			if (isUndefined(ignoreScores)) {
				return Promise.resolve(false);
			}
			const useScores = (ignoreScores === 'No');
			//
			//TODO: prompt for aspect_collections
			//TODO: prompt for additional_fields
			//
			//confirm
			const newModelName = `${source.slug_name}::${target.slug_name}`;
			const addModel = await this.confirm(`Are you sure you want to add the model ${newModelName} ?`);
			if (!addModel) {
				return Promise.resolve(false);
			}
			//
			//
			await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: `Adding SegmentML model: ${newModelName}`,
				cancellable: true
			}, async (progress, token) => {
				const config = new CreateSegmentMLModelConfig();
				config.source = source.slug_name;
				config.target = target.slug_name;
				config.use_scores = useScores;
				const model = await client.createSegmentMLModel(config);
				if (model) {
					progress.report({
						message: `SegmentML model ${model.name} was added.`
					});
					//
					//Lytics seems to need a moment before the API 
					//to list all models includes the new model. 
					//Therefore, wait a second.
					await this.wait(1000);
					await this.refresh();
				}
			});
		}
		catch (err) {
			let message = err.message;
			if (err.response && err.response.status === 400) {
				if (err.response.data && !isNullOrUndefined(err.response.data.message)) {
					message = err.response.data.message;
				}
			}
			vscode.window.showErrorMessage(`Add SegmentML model failed: ${message}`);
			return Promise.resolve(false);
		}
		return Promise.resolve(true);
	}
}

class ModelTreeItem extends vscode.TreeItem {
	constructor(element: SegmentMLModel) {
		const name = SegmentMLModel.getModelNameWithoutGeneration(element.name!);
		super(name, vscode.TreeItemCollapsibleState.None);
		this.name = name;
		this.contextValue = 'segmentml';
	}
	readonly name: string;
	get tooltip(): string {
		if (!this.name) {
			return '';
		}
		return `${this.name}`;
	}
}
class ModelQuickPickItem implements vscode.QuickPickItem {
	label: string;
	description?: string;
	detail?: string;
	constructor(public readonly model: SegmentMLModel) {
		this.label = SegmentMLModel.getModelNameWithoutGeneration(model.name);
		this.detail = model.name;
	}
}
