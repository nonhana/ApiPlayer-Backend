import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { unifiedResponseBody, errorHandler } from '../utils/index';

interface AuthenticatedRequest extends Request {
	state?: {
		userInfo?: any;
	};
}

export const auth: any = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
	const { headers } = req;
	const { authorization } = headers;

	const token = (authorization as string)?.replace('Bearer ', '');

	if (!token) {
		unifiedResponseBody({ httpStatus: 401, result_code: 1, result_msg: '缺少 token', res });
		return;
	}

	try {
		req.state = {};
		req.state.userInfo = jwt.verify(token, 'apiPlayer');
	} catch (error: any) {
		if (error.name === 'TokenExpiredError') {
			errorHandler({ error, httpStatus: 401, result_msg: 'token 已过期', res });
		} else {
			errorHandler({ error, httpStatus: 401, result_msg: '无效的 token', res });
		}

		return;
	}
	next();
};
