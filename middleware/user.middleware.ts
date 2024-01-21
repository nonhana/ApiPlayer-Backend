import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import type { TokenInfo } from '../utils/types';
import dotenv from 'dotenv';
dotenv.config();

export interface AuthenticatedRequest extends Request {
	state?: {
		userInfo: TokenInfo;
	};
}

// 验证 token 的中间件
export const auth = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
	const { headers } = req;
	const { authorization } = headers;

	// 此处直接预置了Bearer ，不用加了
	const token = (authorization as string)?.replace('Bearer ', '');

	if (!token) {
		res.status(401).json({ result_code: 1, result_msg: '缺少 token' });
		return;
	}

	// 如果前端发的请求带了 token，就验证 token
	try {
		req.state = {
			userInfo: jwt.verify(token, process.env.JWT_SECRET!) as TokenInfo,
		};
	} catch (error: any) {
		if (error.name === 'TokenExpiredError') {
			res.status(401).json({ result_code: 1, result_msg: 'token 已过期', error });
		} else {
			res.status(401).json({ result_code: 1, result_msg: '无效的 token', error });
		}
		return;
	}
	next();
};
