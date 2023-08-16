import { Request, Response } from 'express';
import { queryPromise, unifiedResponseBody, errorHandler } from '../utils/index';
import nodemailer from 'nodemailer';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AVATAR_BASE_PATH } from '../constance';

class UserController {
	emailCaptchaMap: Map<string, string>;

	constructor() {
		this.emailCaptchaMap = new Map();
	}

	sendCaptcha = async (req: Request, res: Response) => {
		const { email } = req.body;

		// 生成随机的 6 位数的数字验证码
		const verificationCode = String(1e5 + Math.floor(Math.random() * 1e5 * 9));
		console.log({ verificationCode });
		this.emailCaptchaMap.set(email, verificationCode);

		setTimeout(() => {
			this.emailCaptchaMap.delete(email);
		}, 1000 * 60 * 3);

		// 设置 Nodemailer 配置
		const transporter = nodemailer.createTransport({
			host: 'smtp.163.com',
			port: 465,
			secure: true, // 使用 SSL
			auth: {
				user: 'api_player@163.com', // 用于发送验证码的网易邮箱账户
				pass: 'QEBIJMAOQXUBTQLW', // 网易邮箱账户的密码或授权码
			},
		});

		// 设置电子邮件的内容
		const mailOptions = {
			from: 'api_player@163.com', // 发件人
			to: email, // 收件人，通过请求获取的用户邮箱地址
			subject: 'ApiPlayer验证码', // 邮件主题
			text: `ApiPlayer，您的验证码是：${verificationCode}，三分钟内有效。`, // 邮件内容
		};

		// 发送电子邮件
		transporter.sendMail(
			mailOptions,
			(
				error?: unknown,
				info?: {
					response?: string;
				}
			) => {
				if (error) {
					errorHandler({ error, result_msg: '发送验证码失败', res });
				} else {
					console.log('Email sent: ' + info?.response);
					unifiedResponseBody({ result_msg: '验证码已发送', res });
				}
			}
		);
	};

	register = async (req: Request, res: Response) => {
		const { email, captcha, password } = req.body;

		try {
			const retrieveRes = await queryPromise(`SELECT * FROM users WHERE email='${email}'`);

			if (retrieveRes.length > 0) {
				unifiedResponseBody({ result_code: 1, result_msg: '该 email 已存在', res });
				return;
			}
		} catch (error) {
			errorHandler({ error, result_msg: '注册失败', res });
			return;
		}

		const emailVerificationCode = this.emailCaptchaMap.get(email);

		if (captcha !== emailVerificationCode) {
			unifiedResponseBody({ result_code: 1, result_msg: '验证码不正确', res });
			return;
		}

		// 加密
		const salt = bcrypt.genSaltSync(10);
		const passwordEncrypted = bcrypt.hashSync(password, salt);

		try {
			await queryPromise('INSERT INTO users SET ?', { email, password: passwordEncrypted });
			unifiedResponseBody({ result_msg: '注册成功', res });
		} catch (error) {
			errorHandler({ error, result_msg: '注册失败', res });
		}
	};

	login = async (req: Request, res: Response) => {
		const { email, password } = req.body;

		try {
			const retrieveRes = await queryPromise(`SELECT * FROM users WHERE email='${email}'`);

			if (retrieveRes.length === 0) {
				unifiedResponseBody({ result_code: 1, result_msg: '该 email 不存在', res });
				return;
			}

			const userInfo = retrieveRes[0];
			const compareRes = bcrypt.compareSync(password, userInfo.password);
			if (!compareRes) {
				unifiedResponseBody({ result_code: 1, result_msg: 'password 不正确', res });
				return;
			}
			(() => {
				const { password, createdAt, updatedAt, ...restUserInfo } = userInfo;

				// 根据 id, email, username, introduce, avatar 生成token
				const token = jwt.sign(restUserInfo, 'apiPlayer', { expiresIn: '1d' });

				unifiedResponseBody({ result_msg: '登陆成功', result: { token }, res });
			})();
		} catch (error) {
			errorHandler({ error, result_msg: '登陆失败', res });
		}
	};

	info = async (req: Request, res: Response) => {
		try {
			const retrieveRes = await queryPromise('SELECT * FROM users WHERE user_id = ?', (req as any).state.userInfo.user_id);

			const { user_id, password, createdAt, updatedAt, ...userInfo } = retrieveRes[0];
			unifiedResponseBody({ result_msg: '获取成功', result: { userInfo }, res });
		} catch (error) {
			errorHandler({ error, result_msg: '获取用户信息失败', res });
		}
	};

	updateInfo = async (req: Request, res: Response) => {
		try {
			await queryPromise('UPDATE users SET ? WHERE user_id = ?', [req.body, (req as any).state.userInfo.user_id]);
			const retrieveRes = await queryPromise('SELECT * FROM users WHERE user_id = ?', (req as any).state.userInfo.user_id);

			const { user_id, password, createdAt, updatedAt, ...userInfo } = retrieveRes[0];
			unifiedResponseBody({ result_msg: '更新成功', result: { userInfo }, res });
		} catch (error) {
			errorHandler({ error, result_msg: '用户信息更新失败', res });
		}
	};

	uploadAvatar = async (req: Request, res: Response) => {
		if (!req.file) {
			unifiedResponseBody({ httpStatus: 400, result_code: 1, result_msg: 'No file uploaded', res });
			return;
		}
		const avatarPath = `${AVATAR_BASE_PATH}/${req.file.filename}`;
		try {
			await queryPromise('UPDATE users SET ? WHERE user_id = ?', [{ avatar: avatarPath }, (req as any).state.userInfo.user_id]);
			unifiedResponseBody({ result_msg: 'File uploaded successfully', result: { avatar: avatarPath }, res });
		} catch (error) {
			errorHandler({ error, result_msg: 'File uploaded failed', res });
		}
	};
}

export const userController = new UserController();
