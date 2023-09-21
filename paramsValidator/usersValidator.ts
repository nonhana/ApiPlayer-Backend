import { body, Meta } from 'express-validator';

const atLeastOneParamExists = (input: any, { req }: Meta) => {
	if (Object.keys(req.body ?? {}).length === 0) {
		throw new Error('至少包含一个参数');
	}
	return true;
};

export const usersValidator = {
	['send-captcha']: [body('email').isEmail()],
	['register']: [
		body('email').isEmail(),
		body('captcha')
			.isString()
			.matches(/^\d{6}$/),
		body('password').isString().notEmpty(),
	],
	['login']: [body('email').isEmail(), body('password').isString().notEmpty()],
	['update-info']: [body('username').isString().optional(), body('introduce').isString().optional(), body().custom(atLeastOneParamExists)],
	['change-password']: [
		body('captcha')
			.isString()
			.matches(/^\d{6}$/),
		body('newPassword').isString().notEmpty(),
	],
	['change-email']: [
		body('captcha')
			.isString()
			.matches(/^\d{6}$/),
		body('newEmail').isEmail(),
	],
};
