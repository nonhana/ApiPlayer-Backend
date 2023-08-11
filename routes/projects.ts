import express from 'express';
import { projectsController } from '../controller/projects';

const router = express.Router();

// 新增项目
router.post('/addproject', projectsController.addProject);

// 添加最近访问记录
router.post('/addrecentproject', projectsController.addRecentProject);

// 获取最近访问的项目列表
router.get('/recentlyvisited', projectsController.getRecentProjects);

// 获取某项目所有的接口列表(目录+接口)
router.get('/getapilist', projectsController.getProjectApis);

export default router;
