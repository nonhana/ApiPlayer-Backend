import db from '../database/index';
import { QueryError, FieldPacket, RowDataPacket, ResultSetHeader } from 'mysql2';

// 判断客户端传递的参数是否包含必须的参数
export const getMissingParam = (requireParams: string[], paramsFromClient: object) => {
	const paramsFromClientKeys = Object.keys(paramsFromClient);

	for (const param of requireParams) {
		if (!paramsFromClientKeys.includes(param)) return param;
	}
};

// 使用Promise封装数据库查询，方便使用async/await来取出查询结果
export const queryPromise = <T = RowDataPacket[] | ResultSetHeader>(sql: string, values?: any): Promise<T> => {
	return new Promise((resolve, reject) => {
		if (values !== undefined) {
			db.query(sql, values, (error: QueryError | null, result, fields: FieldPacket[]) => {
				if (error) {
					reject(error);
				} else {
					resolve(result as T);
				}
			});
		} else {
			db.query(sql, (error: QueryError | null, result: T, fields: FieldPacket[]) => {
				if (error) {
					reject(error);
				} else {
					resolve(result);
				}
			});
		}
	});
};

// 获取当前时间
export const getPresentTime = () => {
	const date = new Date();
	const year = date.getFullYear();
	const month = (date.getMonth() + 1).toString().padStart(2, '0');
	const day = date.getDate().toString().padStart(2, '0');
	const hour = date.getHours().toString().padStart(2, '0');
	const minute = date.getMinutes().toString().padStart(2, '0');
	const second = date.getSeconds().toString().padStart(2, '0');

	return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
};
