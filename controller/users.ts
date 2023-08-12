import { Request, Response } from 'express';
import { getMissingParam, queryPromise, getPresentTime } from '../utils/index';
import nodemailer from 'nodemailer';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

interface registerRequestBody {
	email: string;
	captcha: string;
	password: string;
}

class UserController {
	// 用于存储邮箱验证码的 Map
	emailCaptchaMap: Map<string, string>;

	constructor() {
		this.emailCaptchaMap = new Map();
		this.sendCaptcha = this.sendCaptcha.bind(this);
	}

	// 发送验证码
	sendCaptcha = async (req: Request, res: Response) => {
		const { email } = req.body;
		console.log({ email });

		// 生成随机的验证码，这里简单起见使用 6 位数的数字验证码
		const verificationCode = String(1e5 + Math.floor(Math.random() * 1e5 * 9));
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
			from: 'api_player@163.com', // 发件人，必须与配置中的一致
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
					console.log(error);
					res.status(500).json({ message: '发送验证码失败' });
				} else {
					console.log('Email sent: ' + info?.response);
					res.status(200).json({ message: '验证码已发送' });
				}
			}
		);
	};

	// 注册
	register = async (req: Request<{}, {}, registerRequestBody>, res: Response) => {
		const missingParam = getMissingParam(['email', 'captcha', 'password'], req.body);

		if (missingParam) {
			res.status(400).json({ message: `${missingParam} 缺失` });
			return;
		}

		const { email, captcha, password } = req.body;

		try {
			const retrieveRes = await queryPromise(`SELECT * FROM users WHERE email='${email}'`);

			if (retrieveRes.length > 0) {
				res.status(200).json({ message: '该 email 已存在' });
				return;
			}
		} catch (error) {
			res.status(500).json({
				message: '注册失败',
			});
			return;
		}

		const emailVerificationCode = this.emailCaptchaMap.get(email);

		if (captcha !== emailVerificationCode) {
			res.status(401).json({ message: `验证码不正确` });
			return;
		}

		// 加密
		const salt = bcrypt.genSaltSync(10);
		const passwordEncrypted = bcrypt.hashSync(password, salt);

		try {
			await queryPromise('INSERT INTO users SET ?', {
				email,
				password: passwordEncrypted,
				createdAt: getPresentTime(),
				updatedAt: getPresentTime(),
			});
			res.json({ message: '注册成功' });
		} catch (error) {
			res.status(500).json({ message: '注册失败', error });
		}
	};

	// 登录
	login = async (req: Request, res: Response) => {
		const missingParam = getMissingParam(['email', 'password'], req.body);

		if (missingParam) {
			res.status(400).json({ message: `${missingParam} 缺失` });
			return;
		}

		const { email, password } = req.body;

		try {
			const retrieveRes = await queryPromise(`SELECT * FROM users WHERE email='${email}'`);

			if (retrieveRes.length === 0) {
				res.status(200).json({ message: '该 email 不存在' });
				return;
			}

			const userInfo = retrieveRes[0];
			const compareRes = bcrypt.compareSync(password, userInfo.password);
			if (!compareRes) {
				res.status(200).json({ message: 'password 不正确' });
				return;
			}

			// IIFE写法，限制password的作用域
			(() => {
				const { password, ...restUserInfo } = userInfo;

				// 根据 id user_name is_admin来颁发token
				const token = jwt.sign(restUserInfo, 'apiPlayer', { expiresIn: '1d' });

				res.json({
					message: '登录成功',
					result: {
						token,
					},
				});
			})();
		} catch (error) {
			res.status(500).json({ message: '登录失败' });
			return;
		}
	};

	// 获取用户信息
	info = async (req: Request, res: Response) => {
		try {
			const retrieveRes = await queryPromise('SELECT * FROM users WHERE user_id = ?', (req as any).state.userInfo.user_id);

			const { user_id, password, createdAt, updatedAt, ...userInfo } = retrieveRes[0];

			res.status(200).json({ message: '获取成功', result: { userInfo } });
		} catch (error) {
			res.status(500).json({ message: '获取用户信息失败', error });
		}
	};

	// 更新用户信息
	updateInfo = async (req: Request, res: Response) => {
		const alterParams = ['username', 'password', 'introduce'];

		const paramsKey = Object.keys(req.body)[0];

		if (!alterParams.includes(paramsKey)) {
			res.status(400).json({ message: '请正确填写要修改的内容' });
			return;
		}

		try {
			await queryPromise('UPDATE users SET ? WHERE user_id = ?', [req.body, (req as any).state.userInfo.user_id]);
			const retrieveRes = await queryPromise('SELECT * FROM users WHERE user_id = ?', (req as any).state.userInfo.user_id);

			const { user_id, password, createdAt, updatedAt, ...userInfo } = retrieveRes[0];

			res.status(200).json({ message: '更新成功', result: { userInfo } });
		} catch (error) {
			res.status(500).json({ message: '用户信息更新失败' });
		}
	};

	// 上传头像
	uploadAvatar = async (req: Request, res: Response) => {
		if (!req.file) {
			res.status(400).json({ message: 'No file uploaded' });
			return;
		}
		const avatarPath = `http://${req.get('host')}${req.file.path.replace('public', '')}`;
		try {
			await queryPromise('UPDATE users SET ? WHERE user_id = ?', [{ avatar: avatarPath }, (req as any).state.userInfo.user_id]);
		} catch (error) {
			res.status(500).json({ message: 'File uploaded failed' });
		}
		res.status(200).json({
			message: 'File uploaded successfully',
			result: {
				avatar: avatarPath,
			},
		});
	};

	// 根据用户名搜索用户
	searchUser = async (req: Request, res: Response) => {
		const { username } = req.query;
		try {
			const usersSource = await queryPromise(`SELECT * FROM users WHERE username LIKE '%${username}%'`);

			const retrieveRes = usersSource.map((user: any) => {
				const { user_id, password, createdAt, updatedAt, ...userInfo } = user;
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
}

export const userController = new UserController();
