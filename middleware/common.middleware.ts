import { Request, Response, NextFunction } from 'express';
import { paramsErrorHandler } from '../utils/index';
import { validationResult } from 'express-validator';

export const paramsHandler = (req: Request, res: Response, next: NextFunction) => {
	const errors = validationResult(req);
	if (!errors.isEmpty()) {
		paramsErrorHandler({ paramsError: errors.array() }, res);
		return;
	}
	next();
};
