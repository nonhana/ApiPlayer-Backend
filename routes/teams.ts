import express from 'express';
import { auth } from '../middleware/user.middleware';
import { teamController } from '../controller/teams';

const router = express.Router();

// 获取团队列表
router.get('/teamlist', auth, teamController.getTeamList);

// 获取某单个团队的详细信息
router.get('/teaminfo', auth, teamController.getTeamInfo);

// 新建团队
router.post('/addteam', auth, teamController.addTeam);

// 删除团队
router.post('/deleteteam', auth, teamController.deleteTeam);

// 更新团队信息
router.post('/updateteam', auth, teamController.updateTeam);

// 邀请用户加入团队
router.post('/inviteuser', auth, teamController.inviteUser);

// 设置成员权限
router.post('/setmemberidentity', auth, teamController.setMemberIdentity);

// 移除某成员
router.post('/removemember', auth, teamController.removeMember);

export default router;
