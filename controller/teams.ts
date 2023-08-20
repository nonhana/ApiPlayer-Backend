import { Request, Response } from 'express';
import { queryPromise } from '../utils/index';
import type { OkPacket } from 'mysql';

class TeamController {
	// 获取该用户的团队列表
	getTeamList = async (req: Request, res: Response) => {
		const user_id = (<any>req).state.userInfo.user_id;
		try {
			const teamIdList = (await queryPromise(`SELECT team_id FROM team_members WHERE user_id = ${user_id}`)).map((item: any) => item.team_id);
			const source = await queryPromise('SELECT * FROM teams WHERE team_id IN (?)', [teamIdList.join(',')]);
			const result = source.map((item: any) => {
				return {
					team_id: item.team_id,
					team_name: item.team_name,
				};
			});
			res.status(200).json({
				result_code: 0,
				result_message: 'get team list success',
				data: result,
			});
		} catch (error: any) {
			res.status(500).json({
				result_code: 1,
				result_message: error.message,
			});
			return;
		}
	};

	// 获取某单个团队的详细信息
	getTeamInfo = async (req: Request, res: Response) => {
		const { team_id } = req.query;
		try {
			const [memberList, projectList, teamInfoSource] = await Promise.all([
				queryPromise(
					'SELECT u.user_id, u.username, u.avatar, u.email, m.team_user_name, m.team_user_identity FROM users u INNER JOIN team_members m ON u.user_id = m.user_id WHERE m.team_id = ?',
					team_id
				),
				queryPromise('SELECT project_id, project_name, project_img FROM projects WHERE team_id = ?', team_id),
				queryPromise('SELECT team_id, team_name, team_desc FROM teams WHERE team_id = ?', team_id),
			]);

			const memberListFormatted = memberList.map((item: any) => ({
				user_id: item.user_id,
				user_name: item.username,
				user_team_name: item.team_user_name ?? item.username,
				user_img: item.avatar,
				user_email: item.email,
				user_identity: item.team_user_identity,
			}));

			const teamInfo = {
				team_id: teamInfoSource[0].team_id,
				team_name: teamInfoSource[0].team_name,
				team_desc: teamInfoSource[0].team_desc,
			};

			res.status(200).json({
				result_code: 0,
				result_message: 'get team info success',
				member_list: memberListFormatted,
				project_list: projectList,
				team_info: teamInfo,
			});
		} catch (error: any) {
			res.status(500).json({
				result_code: 1,
				result_message: error.message || 'An error occurred',
			});
		}
	};

	// 新建团队
	addTeam = async (req: Request, res: Response) => {
		const { user_id, team_name, team_desc, team_user_name } = req.body;
		try {
			const teamId: OkPacket = await queryPromise(`INSERT INTO teams (team_name, team_desc) VALUES ('${team_name}', '${team_desc}')`);

			// 创建团队的时候，创建人是团队所有者
			await queryPromise(
				`INSERT INTO team_members (user_id, team_id, team_user_name, team_user_identity) VALUES (${user_id}, ${teamId.insertId}, '${team_user_name}', 3)`
			);
			res.status(200).json({
				result_code: 0,
				result_message: 'add team success',
			});
		} catch (error: any) {
			res.status(500).json({
				result_code: 1,
				result_message: error.message || 'An error occurred',
			});
		}
	};

	// 删除团队
	deleteTeam = async (req: Request, res: Response) => {
		const { team_id } = req.body;
		try {
			await queryPromise(`DELETE FROM teams WHERE team_id = ${team_id}`);
			res.status(200).json({
				result_code: 0,
				result_message: 'delete team success',
			});
		} catch (error: any) {
			res.status(500).json({
				result_code: 1,
				result_message: error.message || 'An error occurred',
			});
		}
	};

	// 更新团队信息
	updateTeam = async (req: Request, res: Response) => {
		const { team_id, user_id, team_name, team_desc, team_user_name } = req.body;
		try {
			await queryPromise('UPDATE teams SET team_name = ?, team_desc = ? WHERE team_id = ?', [team_name, team_desc, team_id]);
			await queryPromise(`UPDATE team_members SET team_user_name = ? WHERE team_id = ? AND user_id = ?`, [team_user_name, team_id, user_id]);

			res.status(200).json({
				result_code: 0,
				result_message: 'update team info success',
			});
		} catch (error: any) {
			res.status(500).json({
				result_code: 1,
				result_message: error.message || 'An error occurred',
			});
		}
	};

	// 邀请用户加入团队
	inviteUser = async (req: Request, res: Response) => {
		const { team_id, user_id, team_user_name } = req.body;
		try {
			// 默认身份：0-游客。成员身份一览：0-游客，1-成员，2-管理员，3-所有者
			await queryPromise(`INSERT INTO team_members (user_id, team_id, team_user_name) VALUES (${user_id}, ${team_id}, '${team_user_name}')`);
			res.status(200).json({
				result_code: 0,
				result_message: 'invite user success',
			});
		} catch (error: any) {
			res.status(500).json({
				result_code: 1,
				result_message: error.message || 'An error occurred',
			});
		}
	};

	// 设置成员权限
	setMemberIdentity = async (req: Request, res: Response) => {
		const { team_id, user_id, team_user_identity, team_user_name, team_project_indentity_list } = req.body;
		try {
			await queryPromise(
				`UPDATE team_members SET team_user_name = '${team_user_name}', team_user_identity = ${team_user_identity} WHERE team_id = ${team_id} AND user_id = ${user_id}`
			);

			if (team_project_indentity_list.length > 0) {
				team_project_indentity_list.forEach(async (item: any) => {
					const { project_id, project_user_identity } = item;
					await queryPromise(
						`UPDATE team_project SET project_user_identity = ${project_user_identity} WHERE user_id = ${user_id} AND project_id = ${project_id}`
					);
				});
			}

			res.status(200).json({
				result_code: 0,
				result_message: 'set member identity success',
			});
		} catch (error: any) {
			res.status(500).json({
				result_code: 1,
				result_message: error.message || 'An error occurred',
			});
		}
	};

	// 移除某成员
	removeMember = async (req: Request, res: Response) => {
		const { team_id, user_id } = req.body;
		try {
			await queryPromise(`DELETE FROM team_members WHERE team_id = ${team_id} AND user_id = ${user_id}`);
			res.status(200).json({
				result_code: 0,
				result_message: 'remove member success',
			});
		} catch (error: any) {
			res.status(500).json({
				result_code: 1,
				result_message: error.message || 'An error occurred',
			});
		}
	};
}

export const teamController = new TeamController();
