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
