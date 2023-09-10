import { Request, Response } from 'express';
import { queryPromise, unifiedResponseBody, errorHandler } from '../utils/index';
import nodemailer from 'nodemailer';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

class UserController {
	// 用于存储邮箱验证码的 Map
	emailCaptchaMap: Map<string, string>;

	constructor() {
		this.emailCaptchaMap = new Map();
	}

	// 发送验证码
	sendCaptcha = async (req: Request, res: Response) => {
		const { email } = req.body;

		// 生成随机的 6 位数的数字验证码
		const verificationCode = String(1e5 + Math.floor(Math.random() * 1e5 * 9));
		console.log({ verificationCode });
		this.emailCaptchaMap.set(email, verificationCode);

		setTimeout(() => {
			this.emailCaptchaMap.delete(email);
		}, 1000 * 60 * 5);

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
			text: `ApiPlayer，您的验证码是：${verificationCode}，五分钟内有效。`, // 邮件内容
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

	// 注册
	register = async (req: Request, res: Response) => {
		const { email, captcha, password } = req.body;

		try {
			const retrieveRes = await queryPromise('SELECT * FROM users WHERE email = ?', email);

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
			// 注册的时候拿到 new_user_id和username
			const { insertId: new_user_id } = await queryPromise('INSERT INTO users (email, password) VALUES (?, ?)', [email, passwordEncrypted]);
			const { username } = await queryPromise('SELECT username FROM users WHERE user_id = ?', new_user_id);
			const { insertId: new_team_id } = await queryPromise('INSERT INTO teams (team_name, team_desc) VALUES (?, ?)', ['PersonalTeam', '个人团队']);
			await queryPromise('INSERT INTO team_members (user_id, team_id, team_user_name, team_user_identity) VALUES (?, ?, ?, ?)', [
				new_user_id,
				new_team_id,
				username,
				0,
			]);

			unifiedResponseBody({ result_msg: '注册成功', res });
		} catch (error) {
			errorHandler({ error, result_msg: '注册失败', res });
		}
	};

	// 登录
	login = async (req: Request, res: Response) => {
		const { email, password } = req.body;

		try {
			const retrieveRes = await queryPromise('SELECT * FROM users WHERE email = ?', email);

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

			// IIFE写法，限制password的作用域
			(() => {
				const { password, createdAt, updatedAt, ...restUserInfo } = userInfo;

				// 根据 id, email, username, introduce, avatar 生成token
				const token = jwt.sign(restUserInfo, 'apiPlayer', { expiresIn: '1d' });

				unifiedResponseBody({ result_msg: '登录成功', result: { token }, res });
			})();
		} catch (error) {
			errorHandler({ error, result_msg: '登录失败', res });
		}
	};

	// 获取用户信息
	info = async (req: Request, res: Response) => {
		const { user_id: origin_user_id } = req.query;
		try {
			let retrieveRes: any = null;
			if (origin_user_id) {
				retrieveRes = await queryPromise('SELECT * FROM users WHERE user_id = ?', origin_user_id);
			} else {
				retrieveRes = await queryPromise('SELECT * FROM users WHERE user_id = ?', (req as any).state.userInfo.user_id);
			}

			const { password, createdAt, updatedAt, ...userInfo } = retrieveRes[0];
			unifiedResponseBody({ result_msg: '获取成功', result: { userInfo }, res });
		} catch (error) {
			errorHandler({ error, result_msg: '获取用户信息失败', res });
		}
	};

	// 更新用户信息
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

	// 上传头像
	uploadAvatar = async (req: Request, res: Response) => {
		if (!req.file) {
			unifiedResponseBody({ httpStatus: 400, result_code: 1, result_msg: 'No file uploaded', res });
			return;
		}
		const avatarPath = `${process.env.AVATAR_PATH}/${req.file.filename}`;
		try {
			await queryPromise('UPDATE users SET ? WHERE user_id = ?', [{ avatar: avatarPath }, (req as any).state.userInfo.user_id]);
			unifiedResponseBody({ result_msg: 'File uploaded successfully', result: { avatar: avatarPath }, res });
		} catch (error) {
			errorHandler({ error, result_msg: 'File uploaded failed', res });
		}
	};

	// 根据用户名搜索用户
	searchUser = async (req: Request, res: Response) => {
		const { username } = req.query;
		try {
			const usersSource = await queryPromise('SELECT user_id, username, avatar, email, introduce FROM users WHERE username LIKE ?', `%${username}%`);

			const retrieveRes = usersSource.map((user: any) => {
				const { password, createdAt, updatedAt, ...userInfo } = user;
				return userInfo;
			});

			res.status(200).json({
				result_code: 0,
				result_msg: '获取成功',
				user_list: retrieveRes,
			});
		} catch (error) {
			res.status(500).json({
				result_code: 1,
				result_msg: '获取失败' + error,
			});
		}
	};

	// 修改密码
	changePassword = async (req: Request, res: Response) => {
		const { captcha, newPassword } = req.body;

		const { email, user_id } = (req as any).state.userInfo;

		const emailVerificationCode = this.emailCaptchaMap.get(email);

		if (captcha !== emailVerificationCode) {
			unifiedResponseBody({ result_code: 1, result_msg: '验证码不正确', res });
			return;
		}

		try {
			const retrieveRes = await queryPromise('SELECT * FROM users WHERE user_id = ?', user_id);

			const userInfo = retrieveRes[0];
			const compareRes = bcrypt.compareSync(newPassword, userInfo.password);
			if (compareRes) {
				unifiedResponseBody({ result_code: 1, result_msg: '新密码不能与原始密码相同', res });
				return;
			}
		} catch (error) {
			errorHandler({ error, result_msg: '修改失败', res });
			return;
		}

		// 加密
		const salt = bcrypt.genSaltSync(10);
		const passwordEncrypted = bcrypt.hashSync(newPassword, salt);

		try {
			await queryPromise('UPDATE users SET ? WHERE user_id = ?', [{ password: passwordEncrypted }, user_id]);
			unifiedResponseBody({ result_msg: '修改成功', res });
		} catch (error) {
			errorHandler({ error, result_msg: '修改失败', res });
		}
	};

	// 修改 email
	changeEmail = async (req: Request, res: Response) => {
		const { newEmail, captcha } = req.body;

		const OriginEmail = (req as any).state.userInfo.email;

		const { user_id } = (req as any).state.userInfo;

		if (newEmail === OriginEmail) {
			unifiedResponseBody({ result_code: 1, result_msg: '新 email 不能和原 email 相同', res });
			return;
		}

		const emailVerificationCode = this.emailCaptchaMap.get(newEmail);

		if (captcha !== emailVerificationCode) {
			unifiedResponseBody({ result_code: 1, result_msg: '验证码不正确', res });
			return;
		}

		try {
			await queryPromise('UPDATE users SET ? WHERE user_id = ?', [{ email: newEmail }, user_id]);
			unifiedResponseBody({ result_msg: '修改成功', res });
		} catch (error) {
			errorHandler({ error, result_msg: '修改失败', res });
		}
	};
}

export const userController = new UserController();
