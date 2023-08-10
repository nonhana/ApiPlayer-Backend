import express from 'express';
import { teamController } from '../controller/teams';

const router = express.Router();

// 获取团队列表
router.get('/teamlist', teamController.getTeamList);

// 获取某单个团队的详细信息
router.get('/teaminfo', teamController.getTeamInfo);

export default router;
