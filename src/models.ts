export interface Account {
	name: string;
	aid: number;
	isValid: boolean;
	apikey: string;
}
export interface DataStreamNode {
	name: string;
	stream: string;
	kind: string;
	type: string;
	is_array: boolean;
	hidden: boolean;
	fields: DataStreamNode[];
}
export interface TableNode {
	name: string;
	kind: string;
	as: string;
	type: string;
	is_by: boolean;
	shortdesc: string;
	longdesc: string;
}
export interface QueryNode {
	queries: QueryNode[];
	kind: string;
	alias: string;
	id: string;
	update: Date;
	created: Date;
	text: string;
	table: string;
	from: string;
	into: string;
	description: string;
}