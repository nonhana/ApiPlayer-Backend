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

// 获取当前时间，并转为 yyyy-mm-dd hh:mm:ss 的格式返回。如果不足两位，则在前面补 0
export const getPresentTime = () => {
	const date = new Date();
	const year = date.getFullYear();
	const month = date.getMonth() + 1;
	const day = date.getDate();
	const hour = date.getHours();
	const minute = date.getMinutes();
	const second = date.getSeconds();

	return `
	${year}-
	${month < 10 ? '0' + month : month}-
	${day < 10 ? '0' + day : day} 
	${hour < 10 ? '0' + hour : hour}:
	${minute < 10 ? '0' + minute : minute}:
	${second < 10 ? '0' + second : second}
	`;
};
