import express from 'express';
import { auth } from '../middleware/user.middleware';
import { projectsController } from '../controller/projects';

const router = express.Router();

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

export default router;
