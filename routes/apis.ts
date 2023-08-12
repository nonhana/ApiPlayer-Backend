import express from 'express';
import { apisController } from '../controller/apis';

const router = express.Router();

// 获取某api详情信息
router.get('/apiinfo', apisController.getApiInfo);

// 新增接口
router.post('/addapi', apisController.addApi);

// 更新接口
router.post('/updateapi', apisController.updateApi);

// 删除接口
router.post('/deleteapi', apisController.deleteApi);

// 运行api
router.post('/runapi', apisController.runApi);

export default router;
