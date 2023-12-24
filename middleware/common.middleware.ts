import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';

// 参数验证的中间件
export const paramsHandler = (req: Request, res: Response, next: NextFunction) => {
	const errors = validationResult(req);
	if (!errors.isEmpty()) {
		res.status(400).json({ result_code: 1, result_msg: '参数错误', paramsError: errors.array() });
		return;
	}
	next();
};
