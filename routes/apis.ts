import express from 'express';
import { auth } from '../middleware/user.middleware';
import { apisController } from '../controller/apis';

const router = express.Router();

// 获取某api详情信息
router.get('/apiinfo', auth, apisController.getApiInfo);

// 新增接口
router.post('/addapi', auth, apisController.addApi);

// 更新接口
router.post('/updateapi', auth, apisController.updateApi);

// 删除接口
router.post('/deleteapi', auth, apisController.deleteApi);

// 运行api
router.post('/runapi', auth, apisController.runApi);

export default router;
