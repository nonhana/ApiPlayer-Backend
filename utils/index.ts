import db from '../database/index';
import { QueryOptions } from 'mysql';

export const getMissingParam = (requireParams: string[], paramsFromClient: object) => {
	const paramsFromClientKeys = Object.keys(paramsFromClient);

	for (const param of requireParams) {
		if (!paramsFromClientKeys.includes(param)) return param;
	}
};

export const queryPromise = (options: string | QueryOptions, values?: any): Promise<any> => {
	return new Promise((resolve, reject) => {
		if (values) {
			db.query(options, values, (error, result) => {
				if (error) {
					reject(error);
				} else {
					resolve(result);
				}
			});
		} else {
			db.query(options, (error, result) => {
				if (error) {
					reject(error);
				} else {
					resolve(result);
				}
			});
		}
	});
};

// 获取当前时间，并转为 yyyy-mm-dd hh:mm:ss 的格式返回
export const getPresentTime = () => {
	const date = new Date();
	const year = date.getFullYear();
	const month = date.getMonth() + 1;
	const day = date.getDate();
	const hour = date.getHours();
	const minute = date.getMinutes();
	const second = date.getSeconds();

	return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
};
