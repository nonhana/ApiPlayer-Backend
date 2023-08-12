import express from 'express';
import { projectsController } from '../controller/projects';

const router = express.Router();

// 新增项目
router.post('/addproject', projectsController.addProject);

// 添加最近访问记录
router.post('/addrecentproject', projectsController.addRecentProject);

// 获取最近访问的项目列表
router.get('/recentlyvisited', projectsController.getRecentlyVisited);

// 获取某项目所有的接口列表(目录+接口)
router.get('/apilist', projectsController.getApiList);

// 新增目录
router.post('/adddictionary', projectsController.addDictionary);

// 更新目录
router.post('/updatedictionary', projectsController.updateDictionary);

// 删除目录
router.post('/deletedictionary', projectsController.deleteDictionary);

// 获取某个项目的基本信息
router.get('/basicinfo', projectsController.getBasicInfo);

// 修改某个项目的基本信息
router.post('/updatebasicinfo', projectsController.updateBasicInfo);

// 获取某个项目的全局信息
router.get('/globalinfo', projectsController.getGlobalInfo);

// 更新某个项目的全局信息
router.post('/updateglobalinfo', projectsController.updateGlobalInfo);

// 删除项目
router.post('/deleteproject', projectsController.deleteProject);

export default router;
