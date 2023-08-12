import express from 'express';
import { teamController } from '../controller/teams';

const router = express.Router();

// 获取团队列表
router.get('/teamlist', teamController.getTeamList);

// 获取某单个团队的详细信息
router.get('/teaminfo', teamController.getTeamInfo);

// 新建团队
router.post('/addteam', teamController.addTeam);

// 删除团队
router.post('/deleteteam', teamController.deleteTeam);

// 更新团队信息
router.post('/updateteam', teamController.updateTeam);

// 邀请用户加入团队
router.post('/inviteuser', teamController.inviteUser);

// 设置成员权限
router.post('/setmemberidentity', teamController.setMemberIdentity);

// 移除某成员
router.post('/removemember', teamController.removeMember);

export default router;
