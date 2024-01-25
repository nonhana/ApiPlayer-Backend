import { Request, Response } from 'express';
import { queryPromise } from '../../utils';
import type { AuthenticatedRequest } from '../../middleware/user.middleware';
import type {
	TeamItem,
	TeamId,
	TeamMemberItem,
	TeamProjectItem,
	TeamProjectMemberItem,
	CreateTeamReq,
	UpdateTeamInfoReq,
	InviteUserReq,
	SetMemberIdentityReq,
	RemoveMemberReq,
} from './types';
import type { OkPacket } from 'mysql';
import { ProjectPermission, TeamPermission } from '../../utils/constants';

class TeamController {
	// 获取该用户的团队列表
	getTeamList = async (req: AuthenticatedRequest, res: Response) => {
		const { user_id } = req.state!.userInfo;
		try {
			const result = await queryPromise<TeamItem[]>(
				'SELECT t.team_id, t.team_name, t.team_desc, m.team_user_identity FROM teams t INNER JOIN team_members m ON t.team_id = m.team_id WHERE m.user_id = ?',
				user_id
			);

			res.status(200).json({
				result_code: 0,
				result_msg: 'get team list success',
				result,
			});
		} catch (error: any) {
			res.status(500).json({
				result_code: 1,
				result_msg: error.message,
			});
			return;
		}
	};

	// 获取某个团队的详细信息
	getTeamInfo = async (req: Request, res: Response) => {
		const { team_id } = req.query as unknown as TeamId;
		try {
			const [memberList, projectList, teamInfoSource] = await Promise.all([
				queryPromise<TeamMemberItem[]>(
					'SELECT u.user_id, u.username, u.avatar, u.email, m.team_user_name, m.team_user_identity FROM users u INNER JOIN team_members m ON u.user_id = m.user_id WHERE m.team_id = ?',
					team_id
				),
				queryPromise<TeamProjectItem[]>('SELECT project_id, project_name, project_img FROM projects WHERE team_id = ?', team_id),
				queryPromise<TeamItem[]>('SELECT team_id, team_name, team_desc FROM teams WHERE team_id = ?', team_id),
			]);

			const memberListFormatted = memberList.map((item) => ({
				user_id: item.user_id,
				user_name: item.username,
				user_team_name: item.team_user_name ?? item.username,
				user_img: item.avatar,
				user_email: item.email,
				user_identity: item.team_user_identity,
			}));

			// 获取到项目列表后，再获取每个项目的成员列表
			const projectListFormatted =
				projectList.length > 0
					? await Promise.all(
							projectList.map(async (item) => {
								const projectMemberList = await queryPromise<TeamProjectMemberItem[]>(
									'SELECT u.user_id, u.username, u.avatar, u.email, p.project_user_identity FROM users u INNER JOIN projects_users p ON u.user_id = p.user_id WHERE p.project_id = ?',
									item.project_id
								);

								const projectMemberListFormatted = projectMemberList.map((item) => ({
									user_id: item.user_id,
									user_name: item.username,
									user_img: item.avatar,
									user_email: item.email,
									user_identity: item.project_user_identity,
								}));

								return {
									project_id: item.project_id,
									project_name: item.project_name,
									project_img: item.project_img,
									project_member_list: projectMemberListFormatted,
								};
							})
					  )
					: [];

			const teamInfo = {
				team_id: teamInfoSource[0].team_id,
				team_name: teamInfoSource[0].team_name,
				team_desc: teamInfoSource[0].team_desc,
			};

			res.status(200).json({
				result_code: 0,
				result_msg: 'get team info success',
				result: {
					member_list: memberListFormatted,
					project_list: projectListFormatted,
					team_info: teamInfo,
				},
			});
		} catch (error: any) {
			res.status(500).json({
				result_code: 1,
				result_msg: error.message || 'An error occurred',
			});
		}
	};

	// 新建团队
	addTeam = async (req: AuthenticatedRequest, res: Response) => {
		const { team_name, team_desc, team_user_name } = req.body as CreateTeamReq;
		try {
			const { insertId } = await queryPromise<OkPacket>('INSERT INTO teams (team_name, team_desc) VALUES (?, ?)', [team_name, team_desc]);

			// 创建团队的时候，创建人是团队所有者
			await queryPromise('INSERT INTO team_members (user_id, team_id, team_user_name, team_user_identity) VALUES (?, ?, ?, ?)', [
				req.state!.userInfo.user_id,
				insertId,
				team_user_name,
				TeamPermission.OWNER,
			]);
			res.status(200).json({
				result_code: 0,
				result_msg: 'add team success',
			});
		} catch (error: any) {
			res.status(500).json({
				result_code: 1,
				result_msg: error.message || 'An error occurred',
			});
		}
	};

	// 删除团队
	deleteTeam = async (req: Request, res: Response) => {
		const { team_id } = req.body as TeamId;
		try {
			await queryPromise('DELETE FROM teams WHERE team_id = ?', team_id);
			res.status(200).json({
				result_code: 0,
				result_msg: 'delete team success',
			});
		} catch (error: any) {
			res.status(500).json({
				result_code: 1,
				result_msg: error.message || 'An error occurred',
			});
		}
	};

	// 更新团队信息
	updateTeam = async (req: Request, res: Response) => {
		const { team_id, user_id, team_user_name, ...teamInfo } = req.body as UpdateTeamInfoReq;
		try {
			if (Object.keys(teamInfo).length > 0) {
				await queryPromise('UPDATE teams SET ? WHERE team_id = ?', [teamInfo, team_id]);
			}
			if (team_user_name) {
				await queryPromise('UPDATE team_members SET team_user_name = ? WHERE team_id = ? AND user_id = ?', [team_user_name, team_id, user_id]);
			}
			res.status(200).json({
				result_code: 0,
				result_msg: 'update team info success',
			});
		} catch (error: any) {
			res.status(500).json({
				result_code: 1,
				result_msg: error.message || 'An error occurred',
			});
		}
	};

	// 邀请用户加入团队
	inviteUser = async (req: Request, res: Response) => {
		const { team_id, user_id, team_user_name } = req.body as InviteUserReq;
		try {
			// 1. 先加到团队里面
			// 默认身份：3-游客。成员身份一览：0-团队所有者，1-团队管理者，2-团队成员，3-游客
			await queryPromise('INSERT INTO team_members (user_id, team_id, team_user_name, team_user_identity) VALUES (?, ?, ?, ?)', [
				user_id,
				team_id,
				team_user_name,
				TeamPermission.VISITOR,
			]);
			// 2. 再加到团队的所有项目里面
			const projectList = await queryPromise<{ project_id: string }[]>('SELECT project_id FROM projects WHERE team_id = ?', team_id);
			if (projectList.length > 0) {
				projectList.forEach(async (item) => {
					// 默认权限：3-禁止访问。项目权限一览：0-管理员，1-编辑者，2-只读成员，3-禁止访问
					await queryPromise('INSERT INTO projects_users (user_id, project_id, project_user_identity) VALUES (?, ?, ?)', [
						user_id,
						item.project_id,
						ProjectPermission.FORBIDDEN,
					]);
				});
			}
			res.status(200).json({
				result_code: 0,
				result_msg: 'invite user success',
			});
		} catch (error: any) {
			res.status(500).json({
				result_code: 1,
				result_msg: error.message || 'An error occurred',
			});
		}
	};

	// 设置成员权限
	setMemberIdentity = async (req: Request, res: Response) => {
		const { team_id, user_id, team_project_indentity_list, ...teamInfo } = req.body as SetMemberIdentityReq;
		try {
			await queryPromise('UPDATE team_members SET ? WHERE team_id = ? AND user_id = ?', [teamInfo, , team_id, user_id]);

			if (team_project_indentity_list && team_project_indentity_list.length > 0) {
				team_project_indentity_list.forEach(async (item) => {
					const { project_id, project_user_identity } = item;
					await queryPromise('UPDATE projects_users SET project_user_identity = ? WHERE project_id = ? AND user_id = ?', [
						project_user_identity,
						project_id,
						user_id,
					]);
				});
			}

			res.status(200).json({
				result_code: 0,
				result_msg: 'set member identity success',
			});
		} catch (error: any) {
			res.status(500).json({
				result_code: 1,
				result_msg: error.message || 'An error occurred',
			});
		}
	};

	// 移除某成员
	removeMember = async (req: Request, res: Response) => {
		const { team_id, user_id } = req.body as RemoveMemberReq;
		try {
			await queryPromise('DELETE FROM team_members WHERE team_id = ? AND user_id = ? AND team_user_identity != 0', [team_id, user_id]);
			res.status(200).json({
				result_code: 0,
				result_msg: 'remove member success',
			});
		} catch (error: any) {
			res.status(500).json({
				result_code: 1,
				result_msg: error.message || 'An error occurred',
			});
		}
	};
}

export const teamController = new TeamController();
