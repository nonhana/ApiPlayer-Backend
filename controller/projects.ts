import { Request, Response } from 'express';
import { queryPromise } from '../utils/index';
import { OkPacket } from 'mysql';

interface ApiList {
	id: number;
	name: string;
	type: 'dictionary' | 'GET' | 'POST' | 'PUT' | 'DELETE';
	children: ApiList[];
}

class ProjectsController {
	// 新建项目
	addProject = async (req: Request, res: Response) => {
		const { user_id, ...projectInfo } = req.body;
		try {
			// 1. 先插入项目信息，获取到新的项目信息
			const sql = `INSERT INTO projects (team_id, project_name, project_img, project_desc) VALUES ('${projectInfo.team_id}', '${projectInfo.project_name}', '${projectInfo.project_img}', '${projectInfo.project_desc}')`;
			const projectResult: OkPacket = await queryPromise(sql);

			// 2. 再插入项目成员信息
			const sql2 = `INSERT INTO projects_users (user_id, project_id, project_user_identity) VALUES (${user_id}, ${projectResult.insertId}, 0)`;
			await queryPromise(sql2);

			// 3. 新建这个项目的接口根目录
			const sql3 = `INSERT INTO dictionaries (project_id, dictionary_name) VALUES (${projectResult.insertId}, '根目录')`;
			await queryPromise(sql3);

			res.status(200).json({
				result_code: 0,
				result_message: 'add project success',
			});
		} catch (error: any) {
			res.status(500).json({
				result_code: 1,
				result_message: error.message || 'An error occurred',
			});
		}
	};

	// 添加某用户最近访问的项目记录
	addRecentProject = async (req: Request, res: Response) => {
		const { user_id, project_id } = req.body;
		try {
			// 先查询是否存在
			const sql = `SELECT * FROM recently_visited WHERE user_id = ${user_id} AND project_id = ${project_id}`;
			const result = await queryPromise(sql);
			if (result.length) {
				// 如果存在，更新访问时间
				const sql2 = `UPDATE recently_visited SET last_access_time = NOW() WHERE user_id = ${user_id} AND project_id = ${project_id}`;
				await queryPromise(sql2);
			} else {
				// 如果不存在，插入记录
				const sql2 = `INSERT INTO recently_visited (user_id, project_id, last_access_time) VALUES (${user_id}, ${project_id}, NOW())`;
				await queryPromise(sql2);
			}
			res.status(200).json({
				result_code: 0,
				result_message: 'add recent project success',
			});
		} catch (error: any) {
			res.status(500).json({
				result_code: 1,
				result_message: error.message || 'An error occurred',
			});
		}
	};

	// 获取某用户最近访问的项目列表
	getRecentProjects = async (req: Request, res: Response) => {
		const { user_id } = req.query;
		try {
			const sql = `SELECT * FROM recently_visited WHERE user_id = ${user_id} ORDER BY last_access_time DESC LIMIT 10`;
			const projectIdList = await queryPromise(sql);

			const result = await Promise.all(
				projectIdList.map(async (item: any) => {
					const sql = `SELECT project_name,project_img,project_desc FROM projects WHERE project_id = ${item.project_id}`;
					const project = await queryPromise(sql);
					return project[0];
				})
			);

			res.status(200).json({
				result_code: 0,
				result_message: 'get recent projects success',
				data: result,
			});
		} catch (error: any) {
			res.status(500).json({
				result_code: 1,
				result_message: error.message || 'An error occurred',
			});
		}
	};

	// 获取某项目所有的接口列表(目录+接口)
	getProjectApis = async (req: Request, res: Response) => {
		const { project_id } = req.query;
		try {
			let result: ApiList[] = [];
			// 1. 获取所有的目录
			const sql = `SELECT * FROM dictionaries WHERE project_id = ${project_id}`;
			const dictionariesSource = await queryPromise(sql);

			const root = dictionariesSource.find((item: any) => item.father_id === null);
			result.push({
				id: root.dictionary_id,
				name: root.dictionary_name,
				type: 'dictionary',
				children: [],
			});

			// 2. 根据father_id构建目录树。如果father_id为null，则为根目录
			const buildTree = (father_id: number) => {
				const children: ApiList[] = [];
				dictionariesSource.forEach((item: any) => {
					if (item.father_id === father_id) {
						children.push({
							id: item.dictionary_id,
							name: item.dictionary_name,
							type: 'dictionary',
							children: buildTree(item.dictionary_id),
						});
					}
				});
				return children;
			};

			result[0].children = buildTree(root.dictionary_id);

			// 遍历目录树，根据dictionary_id，获取每个目录下的接口
			const getApis = async (tree: ApiList[]) => {
				for (let i = 0; i < tree.length; i++) {
					const sql = `SELECT * FROM apis WHERE dictionary_id = ${tree[i].id}`;
					const apisSource = await queryPromise(sql);
					const children: ApiList[] = [];
					apisSource.forEach((item: any) => {
						children.push({
							id: item.api_id,
							name: item.api_name,
							type: item.api_method,
							children: [],
						});
					});
					tree[i].children = children;
					await getApis(tree[i].children);
				}
			};
			await getApis(result);

			// 将处理完的结果返回
			res.status(200).json({
				result_code: 0,
				result_message: 'get project apis success',
				data: result,
			});
		} catch (error: any) {
			res.status(500).json({
				result_code: 1,
				result_message: error.message || 'An error occurred',
			});
		}
	};

	// 获取某API详情信息
	getApiDetail = async (req: Request, res: Response) => {
		const { api_id } = req.query;
		try {
		} catch (error: any) {
			res.status(500).json({
				result_code: 1,
				result_message: error.message || 'An error occurred',
			});
		}
	};
}

export const projectsController = new ProjectsController();
