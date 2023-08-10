import { Request, Response } from 'express';
import { getMissingParam, queryPromise } from '../utils/index';

class ProjectsController {
	// 添加最近访问的记录
	addRecentProject = async (req: Request, res: Response) => {
		const { user_id, project_id } = req.body;
		try {
			const sql = `INSERT INTO recently_visited (user_id, project_id, last_access_time) VALUES (${user_id}, ${project_id}, NOW())`;
			await queryPromise(sql);
			res.status(200).json({
				result_code: 0,
				result_message: 'insert success',
			});
		} catch (error: any) {
			res.status(500).json({
				result_code: 1,
				result_message: error.message || 'An error occurred',
			});
		}
	};

	// 获取最近访问的项目列表
	getRecentProjects = async (req: Request, res: Response) => {
		const { user_id } = req.query;
		try {
			const sql = `SELECT * FROM recently_visited WHERE user_id = ${user_id} ORDER BY last_access_time DESC LIMIT 10`;
			const projectIdList = await queryPromise(sql);

			const result = await Promise.all(
				projectIdList.map(async (item: any) => {
					const sql = `SELECT project_name,project_img,project_desc FROM projects WHERE id = ${item.project_id}`;
					const project = await queryPromise(sql);
					return project[0];
				})
			);

			res.status(200).json({
				result_code: 0,
				result_message: 'success',
				data: result,
			});
		} catch (error: any) {
			res.status(500).json({
				result_code: 1,
				result_message: error.message || 'An error occurred',
			});
		}
	};

	// 新建项目
	addNewProject = async (req: Request, res: Response) => {
		const { user_id, ...projectInfo } = req.body;
		try {
			const sql = `INSERT INTO projects (user_id, project_name, project_img, project_desc) VALUES (${user_id}, '${projectInfo.project_name}', '${projectInfo.project_img}', '${projectInfo.project_desc}')`;
			await queryPromise(sql);
			res.status(200).json({
				result_code: 0,
				result_message: 'insert success',
			});
		} catch (error: any) {
			res.status(500).json({
				result_code: 1,
				result_message: error.message || 'An error occurred',
			});
		}
	};
}

export const projectsController = new ProjectsController();
