import express from 'express';
import { userController } from '../controller/users';
import { usersValidator } from '../paramsValidator/usersValidator';
import { paramsHandler } from '../middleware/common.middleware';
import { avatarUpload } from '../middleware/upload.middleware';
import { auth } from '../middleware/user.middleware';

const router = express.Router();

// 发验证码
router.post('/send-captcha', usersValidator['send-captcha'], paramsHandler, userController.sendCaptcha);

// 注册
router.post('/register', usersValidator['register'], paramsHandler, userController.register);

// 登陆
router.post('/login', usersValidator['login'], paramsHandler, userController.login);

// get 用户信息
router.get('/info', auth, userController.info);

// 更新用户信息
router.post('/update-info', auth, usersValidator['update-info'], paramsHandler, userController.updateInfo);

// 上传头像
router.post('/upload-avatar', auth, avatarUpload.single('avatar'), userController.uploadAvatar);

// 根据用户名搜索用户
router.get('/searchuser', auth, userController.searchUser);

// 修改密码发验证码
router.post(
	'/send-captcha-when-change-password',
	auth,
	(req, res, next) => {
		req.body.email = (req as any).state.userInfo.email;
		next();
	},
	userController.sendCaptcha
);

// 修改密码
router.post('/change-password', auth, usersValidator['change-password'], paramsHandler, userController.changePassword);

// 修改email
router.post('/change-email', auth, usersValidator['change-email'], paramsHandler, userController.changeEmail);

export default router;
