import { Request, Response } from 'express';
import { queryPromise } from '../utils/index';
import type { OkPacket } from 'mysql';
import type { ApiListItem } from '../utils/types';
import { PROJECT_ICON_BASE_PATH, PROJECT_ICON_SERVER_PATH } from '../constance';

class ProjectsController {
	// 上传项目图标。只保存，不更新数据库
	uploadProjectIcon = async (req: Request, res: Response) => {
		if (!req.file) {
			res.status(400).json({ result_code: 1, result_msg: 'No file uploaded' });
			return;
		}
		const projectIconPath = `${PROJECT_ICON_SERVER_PATH}/${req.file.filename}`;
		try {
			res.status(200).json({
				result_code: 0,
				result_msg: 'File uploaded successfully',
				project_icon_path: projectIconPath,
			});
		} catch (error: any) {
			res.status(500).json({
				result_code: 1,
				result_msg: error.message || 'An error occurred',
			});
		}
	};

	// 新建项目
	addProject = async (req: Request, res: Response) => {
		const { user_id, ...projectInfo } = req.body;
		try {
			// 1. 先插入项目信息，获取到新的项目信息
			const sql = 'INSERT INTO projects SET ?';
			const projectResult: OkPacket = await queryPromise(sql, projectInfo);

			// 2. 再插入项目成员信息
			const sql2 = 'INSERT INTO projects_users SET ?';
			await queryPromise(sql2, { user_id, project_id: projectResult.insertId, project_user_identity: 0 });

			// 3. 新建这个项目的接口根目录
			const sql3 = 'INSERT INTO dictionaries SET ?';
			await queryPromise(sql3, { project_id: projectResult.insertId, dictionary_name: '根目录' });

			// 4. 预置这个项目的环境：0~3：开发环境、测试环境、正式环境、mock.js环境
			for (let i = 0; i < 4; i++) {
				await queryPromise('INSERT INTO project_env (project_id, env_type) VALUES (?, ?) ', [projectResult.insertId, i]);
			}

			res.status(200).json({
				result_code: 0,
				result_msg: 'add project success',
			});
		} catch (error: any) {
			res.status(500).json({
				result_code: 1,
				result_msg: error.message || 'An error occurred',
			});
		}
	};

	// 添加某用户最近访问的项目记录
	addRecentProject = async (req: Request, res: Response) => {
		const { user_id, project_id } = req.body;
		try {
			// 先查询是否存在
			const sql = 'SELECT * FROM recently_visited WHERE user_id = ? AND project_id = ?';
			const result = await queryPromise(sql, [user_id, project_id]);
			if (result.length) {
				// 如果存在，更新访问时间
				const sql2 = 'UPDATE recently_visited SET last_access_time = NOW() WHERE user_id = ? AND project_id = ?';
				await queryPromise(sql2, [user_id, project_id]);
			} else {
				// 如果不存在，插入记录
				const sql2 = 'INSERT INTO recently_visited (user_id, project_id) VALUES (?, ?)';
				await queryPromise(sql2, [user_id, project_id]);
			}
			res.status(200).json({
				result_code: 0,
				result_msg: 'add recent project success',
			});
		} catch (error: any) {
			res.status(500).json({
				result_code: 1,
				result_msg: error.message || 'An error occurred',
			});
		}
	};

	// 获取某用户最近访问的项目列表
	getRecentlyVisited = async (req: Request, res: Response) => {
		const { user_id } = req.query;
		try {
			const sql = 'SELECT * FROM recently_visited WHERE user_id = ? ORDER BY last_access_time DESC LIMIT 10';
			const projectIdList = await queryPromise(sql, user_id);

			const result = await Promise.all(
				projectIdList.map(async (item: any) => {
					const sql1 = 'SELECT project_name,project_img,project_desc FROM projects WHERE project_id = ?';
					const project = await queryPromise(sql1, item.project_id);

					const sql2 = 'SELECT last_access_time FROM recently_visited WHERE user_id = ? AND project_id = ?';
					const last_access_time = await queryPromise(sql2, [user_id, item.project_id]);
					return {
						...project[0],
						last_access_time: last_access_time[0].last_access_time,
					};
				})
			);

			res.status(200).json({
				result_code: 0,
				result_msg: 'get recent projects success',
				data: result,
			});
		} catch (error: any) {
			res.status(500).json({
				result_code: 1,
				result_msg: error.message || 'An error occurred',
			});
		}
	};

	// 获取某项目所有的接口列表(目录+接口)
	getApiList = async (req: Request, res: Response) => {
		const { project_id } = req.query;
		try {
			let result: ApiListItem[] = [];
			// 1. 获取所有的目录
			const sql = 'SELECT * FROM dictionaries WHERE project_id = ?';
			const dictionariesSource = await queryPromise(sql, [project_id]);

			// 2. 获取到项目根目录
			const root = dictionariesSource.find((item: any) => item.father_id === null);
			result.push({
				id: root.dictionary_id,
				label: root.dictionary_name,
				type: 'dictionary',
				children: [],
			});

			// 3. 根据father_id构建目录树
			const buildDicTree = (father_id: number) => {
				const children: ApiListItem[] = [];
				dictionariesSource.forEach((item: any) => {
					if (item.father_id === father_id) {
						children.push({
							id: item.dictionary_id,
							label: item.dictionary_name,
							type: 'dictionary',
							children: buildDicTree(item.dictionary_id),
						});
					}
				});
				return children;
			};

			result[0].children = buildDicTree(root.dictionary_id);

			// 4. 遍历目录树，根据dictionary_id获取每个目录下的接口
			const getApis = async (tree: ApiListItem[]) => {
				for (let i = 0; i < tree.length; i++) {
					// 因为dictionary_id可能等于api_id，所以这里要判断一下是否为目录
					if (tree[i].type === 'dictionary') {
						const sql = 'SELECT * FROM apis WHERE dictionary_id = ?';
						const apisSource = await queryPromise(sql, tree[i].id);
						apisSource.forEach((item: any) => {
							tree[i].children.push({
								id: item.api_id,
								type: item.api_method,
								label: item.api_name,
								children: [],
							});
						});
						await getApis(tree[i].children);
					}
				}
			};
			await getApis(result);

			// 将处理完的结果返回
			res.status(200).json({
				result_code: 0,
				result_msg: 'get project apis success',
				data: result,
			});
		} catch (error: any) {
			res.status(500).json({
				result_code: 1,
				result_msg: error.message || 'An error occurred',
			});
		}
	};

	// 新增目录
	addDictionary = async (req: Request, res: Response) => {
		const { ...dictionaryInfo } = req.body;
		try {
			const dictionary_id = (
				await queryPromise('INSERT INTO dictionaries SET ?', {
					...dictionaryInfo,
				})
			).insertId;

			res.status(200).json({
				result_code: 0,
				result_msg: 'add dictionary success',
				dictionary_id,
			});
		} catch (error: any) {
			res.status(500).json({
				result_code: 1,
				result_msg: error.message || 'An error occurred',
			});
		}
	};

	// 更新目录
	updateDictionary = async (req: Request, res: Response) => {
		const { dictionary_id, ...dictionaryInfo } = req.body;
		try {
			await queryPromise('UPDATE dictionaries SET ? WHERE dictionary_id = ?', [dictionaryInfo, dictionary_id]);

			res.status(200).json({
				result_code: 0,
				result_msg: 'update dictionary success',
				dictionary_id,
			});
		} catch (error: any) {
			res.status(500).json({
				result_code: 1,
				result_msg: error.message || 'An error occurred',
			});
		}
	};

	// 删除目录
	deleteDictionary = async (req: Request, res: Response) => {
		const { dictionary_id } = req.body;
		try {
			await queryPromise('DELETE FROM dictionaries WHERE dictionary_id = ?', dictionary_id);

			res.status(200).json({
				result_code: 0,
				result_msg: 'delete dictionary success',
			});
		} catch (error: any) {
			res.status(500).json({
				result_code: 1,
				result_msg: error.message || 'An error occurred',
			});
		}
	};

	// 获取某个项目的基本信息
	getBasicInfo = async (req: Request, res: Response) => {
		const { project_id } = req.query;
		try {
			const projectInfo = await queryPromise('SELECT * FROM projects WHERE project_id = ?', project_id);

			res.status(200).json({
				result_code: 0,
				result_msg: 'get project info success',
				project_info: projectInfo[0],
			});
		} catch (error: any) {
			res.status(500).json({
				result_code: 1,
				result_msg: error.message || 'An error occurred',
			});
		}
	};

	// 修改项目的基本信息
	updateBasicInfo = async (req: Request, res: Response) => {
		const { project_id, ...projectInfo } = req.body;
		try {
			await queryPromise('UPDATE projects SET ? WHERE project_id = ?', [projectInfo, project_id]);

			res.status(200).json({
				result_code: 0,
				result_msg: 'update project info success',
				project_id,
			});
		} catch (error: any) {
			res.status(500).json({
				result_code: 1,
				result_msg: error.message || 'An error occurred',
			});
		}
	};

	// 获取某个项目的全局信息
	getGlobalInfo = async (req: Request, res: Response) => {
		const { project_id } = req.query;
		try {
			// 1. 获取全局参数
			let global_params: any = [];
			const paramsSource = await queryPromise('SELECT * FROM global_params WHERE project_id = ?', project_id);
			for (let i = 0; i < 3; i++) {
				const tempParams: any[] = paramsSource.filter((item: any) => item.father_type === i);
				if (tempParams.length > 0) {
					let item = {
						type: i,
						params_list: tempParams.map((param: any) => {
							return {
								param_id: param.param_id,
								param_name: param.param_name,
								param_type: param.param_type,
								param_desc: param.param_desc,
								param_value: param.param_value,
							};
						}),
					};
					global_params.push(item);
				}
			}

			// 2. 获取全局变量
			const variablesSource = await queryPromise('SELECT * FROM global_variables WHERE project_id = ?', project_id);
			const global_variables = variablesSource.map((variable: any) => {
				return {
					variable_id: variable.variable_id,
					variable_name: variable.variable_name,
					variable_type: variable.variable_type,
					variable_value: variable.variable_value,
					variable_desc: variable.variable_desc,
				};
			});

			// 3. 获取环境列表
			const env_list = await queryPromise('SELECT env_type, env_baseurl FROM project_env WHERE project_id = ?', project_id);

			// 4. 结果组装返回
			res.status(200).json({
				result_code: 0,
				result_msg: 'get project global info success',
				global_params,
				global_variables,
				env_list,
			});
		} catch (error: any) {
			res.status(500).json({
				result_code: 1,
				result_msg: error.message || 'An error occurred',
			});
		}
	};

	// 更新某个项目的全局信息
	updateGlobalInfo = async (req: Request, res: Response) => {
		const { project_id, global_params, global_variables, env_list } = req.body;
		try {
			// 1. 更新全局参数，根据param_action_type来判断是新增、修改还是删除
			if (global_params) {
				for (let i = 0; i < global_params.length; i++) {
					const type = global_params[i].type;
					const params_list = global_params[i].params_list;
					for (let j = 0; j < params_list.length; j++) {
						const param_id = params_list[j].param_id;
						const param_name = params_list[j].param_name;
						const param_type = params_list[j].param_type;
						const param_desc = params_list[j].param_desc;
						const param_value = params_list[j].param_value;
						const param_action_type = params_list[j].param_action_type;
						if (param_action_type === 0) {
							await queryPromise('UPDATE global_params SET ? WHERE param_id = ?', [{ param_name, param_type, param_desc, param_value }, param_id]);
						} else if (param_action_type === 1) {
							await queryPromise('INSERT INTO global_params SET ?', {
								project_id,
								father_type: type,
								param_name,
								param_type,
								param_desc,
								param_value,
							});
						} else {
							await queryPromise('DELETE FROM global_params WHERE param_id = ?', param_id);
						}
					}
				}
			}

			// 2. 更新全局变量,根据variable_action_type来判断是新增、修改还是删除
			if (global_variables) {
				for (let i = 0; i < global_variables.length; i++) {
					const variable_id = global_variables[i].variable_id;
					const variable_name = global_variables[i].variable_name;
					const variable_type = global_variables[i].variable_type;
					const variable_value = global_variables[i].variable_value;
					const variable_desc = global_variables[i].variable_desc;
					const variable_action_type = global_variables[i].variable_action_type;

					if (variable_action_type === 0) {
						await queryPromise('UPDATE global_variables SET ? WHERE variable_id = ?', [
							{ variable_name, variable_type, variable_value, variable_desc },
							variable_id,
						]);
					} else if (variable_action_type === 1) {
						await queryPromise('INSERT INTO global_variables SET ?', { project_id, variable_name, variable_type, variable_value, variable_desc });
					} else {
						await queryPromise('DELETE FROM global_variables WHERE variable_id = ?', variable_id);
					}
				}
			}

			// 3. 更新环境列表
			if (env_list) {
				for (let i = 0; i < env_list.length; i++) {
					const env_type = env_list[i].env_type;
					const env_baseurl = env_list[i].env_baseurl;
					await queryPromise('UPDATE project_env SET ? WHERE project_id = ? AND env_type = ?', [{ env_baseurl }, project_id, env_type]);
				}
			}

			res.status(200).json({
				result_code: 0,
				result_msg: 'update project global info success',
				project_id,
			});
		} catch (error: any) {
			res.status(500).json({
				result_code: 1,
				result_msg: error.message || 'An error occurred',
			});
		}
	};

	// 删除项目
	deleteProject = async (req: Request, res: Response) => {
		const { project_id } = req.body;
		try {
			await queryPromise('DELETE FROM projects WHERE project_id = ?', project_id);

			res.status(200).json({
				result_code: 0,
				result_msg: 'delete project success',
				project_id,
			});
		} catch (error: any) {
			res.status(500).json({
				result_code: 1,
				result_msg: error.message || 'An error occurred',
			});
		}
	};
}

export const projectsController = new ProjectsController();
