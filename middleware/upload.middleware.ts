import path from 'path';
import multer from 'multer';

export const avatarUpload = multer({
	storage: multer.diskStorage({
		destination(_, __, cb) {
			cb(null, 'public/uploads/images/avatars');
		},
		filename(_, file, cb) {
			cb(null, `${Date.now()}_${Math.floor(Math.random() * 1e9)}${path.extname(file.originalname)}`);
		},
	}),
	fileFilter: (_, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
		// 定义允许的文件类型
		const allowedTypes = ['image/jpeg', 'image/png'];
		if (allowedTypes.includes(file.mimetype)) {
			cb(null, true);
		} else {
			cb(new Error('不支持的文件类型'));
		}
	},
	limits: {
		fileSize: 1024 * 1024 * 5,
	},
});

// 上传项目图标
export const imgUpload = multer({
	storage: multer.diskStorage({
		destination(_, __, cb) {
			cb(null, 'public/uploads/images/projectIcons');
		},
		filename(_, file, cb) {
			cb(null, `${Date.now()}_${Math.floor(Math.random() * 1e9)}${path.extname(file.originalname)}`);
		},
	}),
	fileFilter: (_, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
		// 定义允许的文件类型
		const allowedTypes = ['image/jpeg', 'image/png'];
		if (allowedTypes.includes(file.mimetype)) {
			cb(null, true);
		} else {
			cb(new Error('不支持的文件类型'));
		}
	},
	limits: {
		fileSize: 1024 * 1024 * 5,
	},
});

// 上传yaml文件
export const yamlUpload = multer({
	storage: multer.diskStorage({
		destination(_, __, cb) {
			cb(null, 'public/uploads/files/yamls');
		},
		filename(_, __, cb) {
			cb(null, 'swagger.yaml');
		},
	}),
	fileFilter: (_, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
		// 定义允许的文件类型:yaml
		const allowedTypes = ['application/x-yaml', 'text/yaml'];
		if (allowedTypes.includes(file.mimetype)) {
			cb(null, true);
		} else {
			cb(new Error('不支持的文件类型'));
		}
	},
	limits: {
		fileSize: 1024 * 1024 * 3,
	},
});
