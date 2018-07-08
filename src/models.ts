export interface Account {
	name: string;
	aid: number;
	isNotValid: boolean;
	apikey: string;
}
export interface DataStreamNode {
	//stream
	stream: string;
	fields: DataStreamNode[];
	//field
	name: string;
	type: string;
	is_array: boolean;
	//common
	hidden: boolean;
	//custom
	kind: string;
	parentName: string;
}
export interface TableNode {
	//table
	name: string;
	//field
	as: string;
	type: string;
	is_by: boolean;
	shortdesc: string;
	longdesc: string;
	//common
	//custom
	kind: string;
	parentName: string;
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