import * as axios from 'axios';
import { Account, DataStreamNode, TableNode, QueryNode } from './models';

export class LyticsClient {

	constructor(apikey: string) {
		this._apikey = apikey;
		this._client = axios.default.create({
			headers: { 'Authorization': apikey }
		});
	}
	private _client: axios.AxiosInstance;
	private _apikey: string;

	async getAccount(): Promise<Account> {
		let response = await this._client.request({
			url: 'https://api.lytics.io/api/account'
		});
		const accounts = response.data.data as Array<Account>;
		accounts[0].isValid = true;
		accounts[0].apikey = this._apikey;
		return Promise.resolve(accounts[0]);
	}

	async getStreams(): Promise<DataStreamNode[]> {
		let response = await this._client.request({
			url: 'https://api.lytics.io/api/schema/_streams'
		});
		const streams = response.data.data as Array<DataStreamNode>;
		streams.map(stream => {
			stream.kind = 'stream';
			stream.fields.map(field => field.kind = 'field');
		});
		return Promise.resolve(streams);
	}

	async getFields(table:string): Promise<TableNode[]> {
		let response = await this._client.request({
			url: `https://api.lytics.io/api/schema/${table}`
		});
		const fields = response.data.data.columns as Array<TableNode>;
		if (!fields) {
			return Promise.resolve([]);
		}
		fields.map(field => {
			field.kind = 'field';
		});	
		return Promise.resolve(fields);
	}
	
	async getQuery(alias: string): Promise<QueryNode> {
		let response = await this._client.request({
			url: `https://api.lytics.io/api/query/${alias}`
		});
		const data = response.data.data as QueryNode;
		return data;
	}

	async getQueriesGroupedByTable(): Promise<QueryNode[]> {
		let response = await this._client.request({
			url: 'https://api.lytics.io/api/query'
		});
		const data = response.data.data as Array<QueryNode>;

		let map: Map<string, QueryNode[]> = new Map();
		for (let i=0; i<data.length; i++) {
			let query = data[i];
			let values = map.get(query.table);
			if (!values) {
				values = [];
				map.set(query.table, values);
			}
			query.kind = 'query';
			values.push(query);
		}
		let queries:QueryNode[] = [];
		for (let key of map.keys()) {
			let query = <QueryNode>{ 
				kind: 'table',
				table: key, 
				queries: map.get(key)
			};
			queries.push(query);
		}
		
		queries = queries.sort( (a, b) => {
			if (a.table < b.table) {
				return -1;
			}
			if (a.table > b.table) {
				return 1;
			}
			return 0;
		});

		return Promise.resolve(queries);
	}
}
