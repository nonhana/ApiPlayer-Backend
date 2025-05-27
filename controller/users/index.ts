import { Request, Response } from 'express';
import { queryPromise } from '../../utils';
import nodemailer from 'nodemailer';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { AuthenticatedRequest } from '../../middleware/user.middleware';
import type { SendCaptchaReq, RegisterReq, LoginReq, ModifyUserInfoReq, SearchUserReq, ModifyPasswordReq, ModifyEmailReq } from './types';
import type { UsersTable } from '../types';
import type { UserId } from '../types';
import type { ResultSetHeader } from 'mysql2';
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
		const { email } = req.body as SendCaptchaReq;

		// 生成随机的 6 位数的数字验证码
		const verificationCode = String(1e5 + Math.floor(Math.random() * 1e5 * 9));
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
		transporter.sendMail(mailOptions, (error?: unknown) => {
			if (error) {
				res.status(500).json({ result_code: 1, result_msg: '发送验证码失败' });
			} else {
				res.status(200).json({ result_code: 0, result_msg: '验证码已发送' });
			}
		});
	};

	// 注册
	register = async (req: Request, res: Response) => {
		const { email, captcha, password } = req.body as RegisterReq;

		try {
			const retrieveRes = await queryPromise<UsersTable[]>('SELECT * FROM users WHERE email = ?', email);

			if (retrieveRes.length > 0) {
				res.status(200).json({ result_code: 1, result_msg: '该 email 已存在' });
				return;
			}
		} catch (error) {
			res.status(500).json({ result_code: 1, result_msg: '注册失败', error });
			return;
		}

		const emailVerificationCode = this.emailCaptchaMap.get(email);

		if (captcha !== emailVerificationCode) {
			res.status(200).json({ result_code: 1, result_msg: '验证码不正确' });
			return;
		}

		// 加密
		const salt = bcrypt.genSaltSync(10);
		const passwordEncrypted = bcrypt.hashSync(password, salt);

		try {
			// 注册的时候拿到 new_user_id和username
			const { insertId: new_user_id } = await queryPromise<ResultSetHeader>('INSERT INTO users (email, password) VALUES (?, ?)', [
				email,
				passwordEncrypted,
			]);
			const { username } = await queryPromise<{ username: string }>('SELECT username FROM users WHERE user_id = ?', new_user_id);
			const { insertId: new_team_id } = await queryPromise<ResultSetHeader>('INSERT INTO teams (team_name, team_desc) VALUES (?, ?)', [
				'PersonalTeam',
				'个人团队',
			]);
			await queryPromise('INSERT INTO team_members (user_id, team_id, team_user_name, team_user_identity) VALUES (?, ?, ?, ?)', [
				new_user_id,
				new_team_id,
				username,
				0,
			]);

			res.status(200).json({ result_code: 0, result_msg: '注册成功' });
		} catch (error) {
			res.status(500).json({ result_code: 1, result_msg: '注册失败', error });
		}
	};

	// 登录
	login = async (req: Request, res: Response) => {
		const { email, password } = req.body as LoginReq;

		try {
			const retrieveRes = await queryPromise<UsersTable[]>('SELECT * FROM users WHERE email = ?', email);

			if (retrieveRes.length === 0) {
				res.status(200).json({ result_code: 1, result_msg: '这个 email 不存在，请先进行注册' });
				return;
			}

			const userInfo = retrieveRes[0];
			const compareRes = bcrypt.compareSync(password, userInfo.password);
			if (!compareRes) {
				res.status(200).json({ result_code: 1, result_msg: 'password 不正确' });
				return;
			}

			// IIFE写法，限制password的作用域
			(() => {
				const { password, createdAt, updatedAt, ...restUserInfo } = userInfo;

				// 根据 id, email, username, introduce, avatar 生成token
				const token = jwt.sign(restUserInfo, process.env.JWT_SECRET!, { expiresIn: '1d' });

				res.status(200).json({ result_code: 0, result_msg: '登录成功', result: token });
			})();
		} catch (error) {
			res.status(500).json({ result_code: 1, result_msg: '登录失败', error });
		}
	};

	// 获取用户信息
	info = async (req: AuthenticatedRequest, res: Response) => {
		const { user_id } = req.query as unknown as UserId;
		try {
			let retrieveRes: UsersTable[] = [];
			if (user_id) {
				retrieveRes = await queryPromise<UsersTable[]>('SELECT * FROM users WHERE user_id = ?', user_id);
			} else {
				retrieveRes = await queryPromise<UsersTable[]>('SELECT * FROM users WHERE user_id = ?', req.state!.userInfo.user_id);
			}

			const { password, createdAt, updatedAt, ...userInfo } = retrieveRes[0];
			res.status(200).json({ result_code: 0, result_msg: '获取成功', result: userInfo });
		} catch (error) {
			res.status(500).json({ result_code: 1, result_msg: '获取用户信息失败', error });
		}
	};

	// 更新用户信息
	updateInfo = async (req: AuthenticatedRequest, res: Response) => {
		const info = req.body as ModifyUserInfoReq;
		try {
			await queryPromise('UPDATE users SET ? WHERE user_id = ?', [info, req.state!.userInfo.user_id]);
			const retrieveRes = await queryPromise<UsersTable[]>('SELECT * FROM users WHERE user_id = ?', req.state!.userInfo.user_id);

			const { password, createdAt, updatedAt, ...userInfo } = retrieveRes[0];
			res.status(200).json({ result_code: 0, result_msg: '更新成功', result: userInfo });
		} catch (error) {
			res.status(500).json({ result_code: 1, result_msg: '用户信息更新失败', error });
		}
	};

	// 上传头像
	uploadAvatar = async (req: AuthenticatedRequest, res: Response) => {
		if (!req.file) {
			res.status(400).json({ result_code: 1, result_msg: '未检测到上传文件' });
			return;
		}
		const avatarPath = `${process.env.AVATAR_PATH}/${req.file.filename}`;
		try {
			await queryPromise('UPDATE users SET ? WHERE user_id = ?', [{ avatar: avatarPath }, req.state!.userInfo.user_id]);
			res.status(200).json({ result_code: 0, result_msg: 'File uploaded successfully', result: avatarPath });
		} catch (error) {
			res.status(500).json({ result_code: 1, result_msg: 'File uploaded failed', error });
		}
	};

	// 根据用户名搜索用户
	searchUser = async (req: Request, res: Response) => {
		const { username } = req.query as unknown as SearchUserReq;
		try {
			const usersSource = await queryPromise<UsersTable[]>('SELECT * FROM users WHERE username LIKE ?', `%${username}%`);

			const retrieveRes = usersSource.map((user) => {
				const { password, createdAt, updatedAt, ...userInfo } = user;
				return userInfo;
			});

			res.status(200).json({
				result_code: 0,
				result_msg: '获取成功',
				result: retrieveRes,
			});
		} catch (error) {
			res.status(500).json({
				result_code: 1,
				result_msg: '获取失败',
				error,
			});
		}
	};

	// 修改密码
	changePassword = async (req: AuthenticatedRequest, res: Response) => {
		const { captcha, newPassword } = req.body as ModifyPasswordReq;

		const { email, user_id } = req.state!.userInfo;

		const emailVerificationCode = this.emailCaptchaMap.get(email);

		if (captcha !== emailVerificationCode) {
			res.status(200).json({ result_code: 1, result_msg: '验证码不正确' });
			return;
		}

		try {
			const retrieveRes = await queryPromise<UsersTable[]>('SELECT * FROM users WHERE user_id = ?', user_id);

			const userInfo = retrieveRes[0];
			const compareRes = bcrypt.compareSync(newPassword, userInfo.password);
			if (compareRes) {
				res.status(200).json({ result_code: 1, result_msg: '新密码不能与原始密码相同' });
				return;
			}
		} catch (error) {
			res.status(500).json({ result_code: 1, result_msg: '修改失败', error });
			return;
		}

		// 加密
		const salt = bcrypt.genSaltSync(10);
		const passwordEncrypted = bcrypt.hashSync(newPassword, salt);

		try {
			await queryPromise('UPDATE users SET ? WHERE user_id = ?', [{ password: passwordEncrypted }, user_id]);
			res.status(200).json({ result_code: 0, result_msg: '修改成功' });
		} catch (error) {
			res.status(500).json({ result_code: 1, result_msg: '修改失败', error });
		}
	};

	// 修改 email
	changeEmail = async (req: AuthenticatedRequest, res: Response) => {
		const { newEmail, captcha } = req.body as ModifyEmailReq;

		const originEmail = req.state!.userInfo.email;

		const { user_id } = req.state!.userInfo;

		if (newEmail === originEmail) {
			res.status(200).json({ result_code: 1, result_msg: '新 email 不能和原 email 相同' });
			return;
		}

		const emailVerificationCode = this.emailCaptchaMap.get(newEmail);

		if (captcha !== emailVerificationCode) {
			res.status(200).json({ result_code: 1, result_msg: '验证码不正确' });
			return;
		}

		try {
			await queryPromise('UPDATE users SET ? WHERE user_id = ?', [{ email: newEmail }, user_id]);
			res.status(200).json({ result_code: 0, result_msg: '修改成功' });
		} catch (error) {
			res.status(500).json({ result_code: 1, result_msg: '修改失败', error });
		}
	};
}

export const userController = new UserController();
