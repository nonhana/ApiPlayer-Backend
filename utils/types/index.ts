export interface ApiListItem {
	id: number;
	label: string;
	type: 'dictionary' | 'GET' | 'POST' | 'PUT' | 'DELETE';
	children: ApiListItem[];
}
/**
 * token中所包含的信息
 */
export interface TokenInfo {
	/**
	 * 用户id
	 */
	user_id: number;
	/**
	 * 用户名
	 */
	username: string;
	/**
	 * 邮箱地址
	 */
	email: string;
	/**
	 * 用户介绍
	 */
	introduce: string;
	/**
	 * 用户头像
	 */
	avatar: string;
}
