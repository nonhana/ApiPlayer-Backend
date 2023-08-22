import express, { Request } from 'express';
import { auth } from '../middleware/user.middleware';
import { projectsController } from '../controller/projects';
import multer from 'multer';
import path from 'path';
import cors from 'cors';

const router = express.Router();

const storage = multer.diskStorage({
	destination(_, __, cb) {
		cb(null, 'public/uploads/images/projectIcons');
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

// 上传项目图标
router.post('/uploadprojecticon', auth, upload.single('projectIcon'), projectsController.uploadProjectIcon);

// 新增项目
router.post('/addproject', auth, projectsController.addProject);

// 添加最近访问记录
router.post('/addrecentproject', auth, projectsController.addRecentProject);

// 获取最近访问的项目列表
router.get('/recentlyvisited', auth, projectsController.getRecentlyVisited);

// 获取某项目所有的接口列表(目录+接口)
router.get('/apilist', auth, projectsController.getApiList);

// 新增目录
router.post('/adddictionary', auth, projectsController.addDictionary);

// 更新目录
router.post('/updatedictionary', auth, projectsController.updateDictionary);

// 删除目录
router.post('/deletedictionary', auth, projectsController.deleteDictionary);

// 获取某个项目的基本信息
router.get('/basicinfo', auth, projectsController.getBasicInfo);

// 修改某个项目的基本信息
router.post('/updatebasicinfo', auth, projectsController.updateBasicInfo);

// 获取某个项目的全局信息
router.get('/globalinfo', auth, projectsController.getGlobalInfo);

// 更新某个项目的全局信息
router.post('/updateglobalinfo', auth, projectsController.updateGlobalInfo);

// 删除项目
router.post('/deleteproject', auth, projectsController.deleteProject);

// mock
router.post('/mock', cors(), projectsController.mock);

export default router;
