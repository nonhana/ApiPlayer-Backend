import db from '../database/index';
import { QueryOptions } from 'mysql';
import { Response } from 'express';

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

interface UnifiedResponseBodyParams {
	httpStatus?: number;
	result_code?: 0 | 1; // 0 success, 1 fail
	result_msg: string;
	result?: object;
	res: Response;
}

interface ErrorHandlerParams {
	error: any;
	httpStatus?: number;
	result_msg: string;
	result?: object;
	res: Response;
}

export const unifiedResponseBody = ({ httpStatus = 200, result_code = 0, result_msg, result = {}, res }: UnifiedResponseBodyParams): void => {
	res.status(httpStatus).json({
		result_code,
		result_msg,
		result,
	});
};

export const errorHandler = ({ error, httpStatus = 500, result_msg, result = {}, res }: ErrorHandlerParams): void => {
	unifiedResponseBody({
		httpStatus,
		result_code: 1,
		result_msg,
		result,
		res,
	});
};

export const paramsErrorHandler = (result: object, res: Response) => {
	unifiedResponseBody({ httpStatus: 400, result_code: 1, result_msg: '参数错误', result, res });
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
