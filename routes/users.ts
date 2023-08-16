import express, { Request } from 'express';
import { auth } from '../middleware/user.middleware';
import { userController } from '../controller/users';
import multer from 'multer';
import path from 'path';
import { usersValidator } from '../paramsValidator/usersValidator';
import { paramsHandler } from '../middleware/common.middleware';

const router = express.Router();

const storage = multer.diskStorage({
	destination(req, file, cb) {
		cb(null, 'public/uploads/images/avatars');
	},
	filename(req, file, cb) {
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

export default router;
