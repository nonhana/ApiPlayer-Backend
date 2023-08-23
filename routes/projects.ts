import express, { Request } from 'express';
import { auth } from '../middleware/user.middleware';
import { projectsController } from '../controller/projects';
import multer from 'multer';
import path from 'path';
import cors from 'cors';

const router = express.Router();

// 上传项目图标
const imgUpload = multer({
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
		fileSize: 1024 * 1024 * 3,
	},
});

// 上传yaml文件
const yamlUpload = multer({
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

// 上传项目图标
router.post('/uploadprojecticon', auth, imgUpload.single('projectIcon'), projectsController.uploadProjectIcon);

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

// 接收前端传来的yaml文件，并将其转为json格式返回
router.post('/importswagger', auth, yamlUpload.single('yamlFile'), projectsController.uploadYaml);

// mock
router.post('/mock', cors(), projectsController.mock);

export default router;
