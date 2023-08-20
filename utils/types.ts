export interface ApiListItem {
	id: number;
	label: string;
	type: 'dictionary' | 'GET' | 'POST' | 'PUT' | 'DELETE';
	children: ApiListItem[];
}
