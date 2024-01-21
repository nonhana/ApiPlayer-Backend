import express from 'express';
import { auth } from '../middleware/user.middleware';
import { teamController } from '../controller/teams';
import { teamsValidator } from '../paramsValidator/teamsValidator';

const router = express.Router();

// 获取团队列表
router.get('/teamlist', auth, teamController.getTeamList);

// 获取某单个团队的详细信息
router.get('/teaminfo', auth, teamController.getTeamInfo);

// 新建团队
router.post('/addteam', teamsValidator['add-team'], auth, teamController.addTeam);

// 删除团队
router.post('/deleteteam', auth, teamController.deleteTeam);

// 更新团队信息
router.post('/updateteam', teamsValidator['update-team'], auth, teamController.updateTeam);

// 邀请用户加入团队
router.post('/inviteuser', teamsValidator['invite-user'], auth, teamController.inviteUser);

// 设置成员权限
router.post('/setmemberidentity', teamsValidator['set-member-identity'], auth, teamController.setMemberIdentity);

// 移除某成员
router.post('/removemember', teamsValidator['remove-member'], auth, teamController.removeMember);

export default router;
