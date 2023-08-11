import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

interface AuthenticatedRequest extends Request {
	state: {
		userInfo?: any;
	};
}

export const auth: any = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
	const { headers } = req;
	const { authorization } = headers;

	const token = (authorization as string)?.replace('Bearer ', '');

	console.log(headers, { authorization });

	if (!token) {
		res.status(401).json({ message: '缺少 token' });
		return;
	}

	try {
		req.state = {};
		req.state.userInfo = jwt.verify(token, 'apiPlayer');
	} catch (error: any) {
		console.log({ error });

		if (error.name === 'TokenExpiredError') {
			res.status(401).json({ message: 'token 已过期' });
		} else {
			res.status(401).json({ message: '无效的 token' });
		}

		return;
	}
	next();
};