import express from 'express';
import { auth } from '../middleware/user.middleware';
import { userController } from '../controller/users';
import multer from 'multer';
import path from 'path';

const router = express.Router();

const storage = multer.diskStorage({
	destination(req, file, cb) {
		cb(null, 'public/uploads/images/avatars');
	},
	filename(req, file, cb) {
		cb(null, `${Date.now()}_${Math.floor(Math.random() * 1e9)}${path.extname(file.originalname)}`);
	},
});
const upload = multer({
	storage,
});

// 发验证码
router.post('/send-captcha', userController.sendCaptcha);

// 注册
router.post('/register', userController.register);

// 登陆
router.post('/login', userController.login);

// get 用户信息
router.get('/info', auth, userController.info);

// 更新用户信息
router.post('/update-info', auth, userController.updateInfo);

// 上传头像
router.post('/upload-avatar', auth, upload.single('avatar'), userController.uploadAvatar);

export default router;
