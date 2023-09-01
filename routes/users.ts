import express, { Request } from 'express';
import path from 'path';
import multer from 'multer';
import { userController } from '../controller/users';
import { usersValidator } from '../paramsValidator/usersValidator';
import { paramsHandler } from '../middleware/common.middleware';
import { auth } from '../middleware/user.middleware';

const router = express.Router();

const storage = multer.diskStorage({
	destination(_, __, cb) {
		cb(null, 'public/uploads/images/avatars');
	},
	filename(_, file, cb) {
		cb(null, `${Date.now()}_${Math.floor(Math.random() * 1e9)}${path.extname(file.originalname)}`);
	},
});

const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
	// 定义允许的文件类型
	const allowedTypes = ['image/jpeg', 'image/png'];

	if (allowedTypes.includes(file.mimetype)) {
		cb(null, true);
	} else {
		cb(new Error('不支持的文件类型'));
	}
};

const upload = multer({
	storage,
	fileFilter,
	limits: {
		fileSize: 1024 * 1024 * 3,
	},
});

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
router.post('/upload-avatar', auth, upload.single('avatar'), userController.uploadAvatar);

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
