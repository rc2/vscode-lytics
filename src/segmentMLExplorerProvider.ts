import * as vscode from 'vscode';
import * as path from 'path';
import { StateManager } from './stateManager';
import { LyticsAccount, Segment, SegmentMLModel, CreateSegmentMLModelConfig, SegmentMLModelSegment, SegmentMLSummaryConflicts } from 'lytics-js/dist/types';
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
		const summaryChart = await this.getSummaryChart(model);
		const conflictsChart = await this.getConflictsChart(model);
		const featuresGraph = await this.getFeaturesGraph(model);
		const modelValidationTable = await this.getModelValidationTable(model);
		const html = `<html>` +
			`<head>` +
			`<style>
				.hide { display: none }
				.transparent { background-color: transparent }
			</style>` +
			jsLinks +
			`<script type="text/javascript">` +
			`var sampleSize = ${this.getSampleSize(model)};` +
			`var summary = JSON.parse('${JSON.stringify(model.summary)}');` + 
			`var features = JSON.parse('${JSON.stringify(model.features.filter(f => f.importance > 0).sort((a, b) => b.importance - a.importance))}');
			var conflicts = JSON.parse('${JSON.stringify(model.summary.conf)}');
			var modelFuzziness = ${this.getModelFuzziness(model)};
			var falsePositiveRate = ${this.getFalsePositiveRate(model)};
			var falseNegativeRate = ${this.getFalseNegativeRate(model)};` +
			`</script>` +
			`<style>` +
			`h2 { padding-top: 20px; }` +
			`.segmentml-table { width: 700px; padding-bottom: 16px; }` +
			`.segmentml-table th, .segmentml-table td { border: 1px solid; padding: 8px; text-align: center; }` +
			`.segmentml-table th.empty { border: 0px; }` +
			`.segmentml-table td.center { text-align: center; }` +
			`.segmentml-table td.left { text-align: left; }` +
			`.segmentml-table td.right { text-align: right; }` +
			`#raw-data-table { padding-top: 10px; }` +
			`</style>` +
			`</head>` +
			`<body>` +
			`<h1>${model.conf.source.name} &gt; ${model.conf.target.name} </h1>` +
			segmentInfo +
			`<h2>Summary</h2>` +
			summaryChart + 
			`<h2>Conflicts</h2>` +
			conflictsChart + 
			`<h2>Model Features</h2>` + 
			featuresGraph +
			modelValidationTable +
			`<p style="font-size: x-small; padding-top: 20px; ">Generated at: ${new Date()}</p>` +
			`<script>drawCharts();</script>` + 
			`</body>` +
			`</html>`;
		return Promise.resolve(html);
	}
	async getJsForHtmlHead(extensionPath: string): Promise<string> {
		const lines: string[] = [];
		const files = ['Chart.bundle.min.js', 'segmentml-helper.js'];
		files.forEach(file => {
			const pathJs1 = vscode.Uri.file(path.join(extensionPath, 'resources', 'js', file));
			const pathJs2 = pathJs1.with({ scheme: 'vscode-resource' });
			lines.push(`<script type="text/javascript" src="${pathJs2}"></script>`);
		});
		return Promise.resolve(lines.join('\n'));
	}
	async getSegmentInfoHtml(source: SegmentMLModelSegment, target: SegmentMLModelSegment): Promise<string> {
		const html = `<table class="segmentml-table">` +
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
	private formatAsInt(value: number): string {
		return value.toLocaleString('en', { useGrouping: true });
	}
	private formatAsPercent(value: number): string {
		return `${(value * 100).toFixed(2)}%`;
	}
	private getModelFuzziness(model: SegmentMLModel): number {
		const conflicts = model.summary.conf;
		const sampleSize = this.getSampleSize(model);
		if (sampleSize === 0) {
			return 0;
		}
		return (conflicts.FalseNegative + conflicts.FalsePositive) / sampleSize;
	}
	private getFalsePositiveRate(model: SegmentMLModel): number {
		const conflicts = model.summary.conf;
		if (conflicts.TrueNegative === 0) {
			return 0;
		}
		return conflicts.FalsePositive / conflicts.TrueNegative;
	}
	private getFalseNegativeRate(model: SegmentMLModel): number {
		const conflicts = model.summary.conf;
		if (conflicts.FalseNegative === 0 && conflicts.TruePositive === 0) {
			return 0;
		}
		return conflicts.FalseNegative / (conflicts.FalseNegative + conflicts.TruePositive);
	}
	private getSampleSize(model: SegmentMLModel): number {
		return model.summary.conf.FalseNegative + model.summary.conf.FalsePositive + model.summary.conf.TrueNegative + model.summary.conf.TruePositive;
	}
	async getModelValidationTable(model: SegmentMLModel): Promise<string> {
		const conflicts = model.summary.conf;
		const data = [
			['False Positive', this.formatAsInt(conflicts.FalsePositive), '# of users in the target segment who are not predicted to be in that segment'],
			['True Positive', this.formatAsInt(conflicts.TruePositive), '# of users in the target segment who are predicted to be in that segment'],
			['False Negative', this.formatAsInt(conflicts.FalseNegative), '# of users in the source segment who are predicted to be in the target segment'],
			['True Negative', this.formatAsInt(conflicts.TrueNegative), '# of users in the source segment who are not predicted to be in the target segment'],
			['Model Fuzziness', this.formatAsPercent(this.getModelFuzziness(model)), '<sup>false negative + false positive</sup>&frasl;<sub>sample size</sub>'],
			['False Positive Rate', this.formatAsPercent(this.getFalsePositiveRate(model)), '<sup>false positive</sup>&frasl;<sub>true negative</sub>'],
			['False Negative Rate', this.formatAsPercent(this.getFalseNegativeRate(model)), '<sup>false negative</sup>&frasl;<sub>false negative + true positive</sub>'],
			['Sample Size', this.formatAsInt(this.getSampleSize(model)), '# of users from the source and target segments that were used for validation'],
			['MSE', this.formatAsInt(model.summary.mse), '<a href="https://en.wikipedia.org/wiki/Mean_squared_error">Mean squared error</a>'],
			['R<sup>2</sup>', this.formatAsInt(model.summary.rsq), '<a href="https://en.wikipedia.org/wiki/Coefficient_of_determination">Coefficient of determination</a>'],
			['AUC', this.formatAsInt(model.summary.auc), '<a href="https://en.wikipedia.org/wiki/Receiver_operating_characteristic#Area_under_the_curve">Area under the curve</a>'],
			['Threshold', this.formatAsInt(model.summary.threshold), 'Correlation threshold at which to discard features in the model']
		];
		const rows: string[] = [];
		data
			.sort(function (a, b) {
				return a[0] > b[0] ? 1 : -1;
			})
			.forEach(d => rows.push(`<tr><td class="right">${d[0]}</td><td class="right">${d[1]}</td><td class="left">${d[2]}</td></tr>`));
		const html = `<h2>Model Validation Results</h2>` +
			`<table class="segmentml-table" id="raw-data-table">` +
			`<tr>` +
			`<th>Name</th>` +
			`<th>Value</th>` +
			`<th>Description</th>` +
			`</tr>` +
			rows.join('\n') +
			`</table>`;
		return Promise.resolve(html);
	}
	async getSummaryChart(model: SegmentMLModel): Promise<string> {
		const html = 
			`<div style="height: 300px; width: 700px">
				<canvas id="summaryChart" width="700px" height="300px"></canvas>
			</div>`;
		return Promise.resolve(html);
	}
	async getConflictsChart(model: SegmentMLModel): Promise<string> {
		const html = 
			`<div style="height: 200px; width: 400px">
				<canvas id="conflictsChart"></canvas>
			</div>`;
		return Promise.resolve(html);
	}
	async getFeaturesGraph(model: SegmentMLModel): Promise<string> {
		const features = model.features.filter(f => f.importance > 0);
		const height = features.length * 40;
		const html = 
			`<div>
				<canvas id="featuresChart" width="700px" height="${height}px"></canvas>
			</div>`;
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
			//
			//TODO: prompt to select segment or field

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
			const modelOnly = await this.confirm(`Prevent users from being scored?`);
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
				config.model_only = modelOnly;
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
