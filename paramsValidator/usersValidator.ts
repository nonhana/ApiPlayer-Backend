import { body, Meta } from 'express-validator';

const atLeastOneOf = (params: string[], _: any, { req }: Meta) => {
	const body = req.body ?? {};
	const hasAtLeastOneParam = params.some((param) => param in body);
	if (!hasAtLeastOneParam) {
		throw new Error('At least one of the specified parameters is required');
	}
	return true;
};

// 验证用户相关的参数
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
	['update-info']: [
		body('username').isString().optional(),
		body('introduce').isString().optional(),
		body().custom(atLeastOneOf.bind(null, ['username', 'introduce'])),
	],
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
