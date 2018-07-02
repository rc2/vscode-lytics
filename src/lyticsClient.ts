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

	async getAccount(): Promise<Account | undefined> {
		let response = await this._client.request({
			url: 'https://api.lytics.io/api/account'
		});
		const accounts = response.data.data as Array<Account>;
		if (accounts.length === 1) {
			accounts[0].isValid = true;
			accounts[0].apikey = this._apikey;
			return Promise.resolve(accounts[0]);
		}
	}

	async getStreams(): Promise<DataStreamNode[]> {
		let response = await this._client.request({
			url: 'https://api.lytics.io/api/schema/_streams'
		});
		const streams = response.data.data as Array<DataStreamNode>;
		return Promise.resolve(streams);
	}

	async getStream(streamName:string): Promise<object> {
		let response = await this._client.request({
			url: `https://api.lytics.io/api/schema/_streams/${streamName}`
		});
		const streams = response.data.data as Array<DataStreamNode>;
		streams.map(stream => {
			stream.kind = 'stream';
			stream.fields.map(field => {
				field.kind = 'field';
				field.parentName = stream.name;
			});
		});
		return Promise.resolve(streams);
	}

	async getStreamField(streamName:string, fieldName:string): Promise<object | undefined> {
		const streams = await this.getStreams();
		const stream = streams.find(stream => stream.stream === streamName);
		if (!stream) {
			 return Promise.resolve(undefined);
		}
		var field = stream.fields.find(field => field.name === fieldName);
		if (!field) {
			return Promise.resolve(undefined);
		}
		return Promise.resolve(field);
	}

	async getTableFields(table:string): Promise<TableNode[]> {
		let response = await this._client.request({
			url: `https://api.lytics.io/api/schema/${table}`
		});
		const fields = response.data.data.columns as Array<TableNode>;
		if (!fields) {
			return Promise.resolve([]);
		}
		fields.map(field => {
			field.kind = 'field';
			field.parentName = table;
		});	
		return Promise.resolve(fields);
	}

	async getTableFieldInfo(tableName:string, fieldName:string): Promise<object> {
		let response = await this._client.request({
			url: `https://api.lytics.io/api/schema/${tableName}/fieldinfo?fields=${fieldName}`
		});
		const fields = response.data.data.fields as Array<TableNode>;
		if (!fields || fields.length === 0) {
			throw new Error(`The specified field does not exist in the specified table. (table: ${tableName}, field: ${fieldName})`);
		}
		return Promise.resolve(fields[0]);
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
