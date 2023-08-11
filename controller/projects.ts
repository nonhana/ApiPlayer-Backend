import { Request, Response } from 'express';
import { queryPromise, getPresentTime } from '../utils/index';
import { OkPacket } from 'mysql';

interface ApiListItem {
	id: number;
	name: string;
	type: 'dictionary' | 'GET' | 'POST' | 'PUT' | 'DELETE';
	children: ApiListItem[];
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

			// 4. 预置这个项目的环境：0~3：开发环境、测试环境、正式环境、mock.js环境
			for (let i = 0; i < 4; i++) {
				await queryPromise('INSERT INTO project_env (project_id, env_type) VALUES (?, ?) ', [projectResult.insertId, i]);
			}

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
			let result: ApiListItem[] = [];
			// 1. 获取所有的目录
			const sql = `SELECT * FROM dictionaries WHERE project_id = ${project_id}`;
			const dictionariesSource = await queryPromise(sql);

			// 2. 获取到项目根目录
			const root = dictionariesSource.find((item: any) => item.father_id === null);
			result.push({
				id: root.dictionary_id,
				name: root.dictionary_name,
				type: 'dictionary',
				children: [],
			});

			// 3. 根据father_id构建目录树
			const buildTree = (father_id: number) => {
				const children: ApiListItem[] = [];
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

			// 4. 遍历目录树，根据dictionary_id获取每个目录下的接口
			const getApis = async (tree: ApiListItem[]) => {
				for (let i = 0; i < tree.length; i++) {
					const sql = `SELECT * FROM apis WHERE dictionary_id = ${tree[i].id}`;
					const apisSource = await queryPromise(sql);
					const children: ApiListItem[] = [];
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
			// 1. 获取该接口基本信息，并结构出project_id, dictionary_id, response_id
			const apiInfoSource = await queryPromise('SELECT * FROM apis WHERE api_id = ? ', api_id);
			const { project_id, dictionary_id, response_id, ...apiInfo } = apiInfoSource[0];

			// 2. 获取该接口的前置url
			const projectCurrentType = (await queryPromise('SELECT project_current_type FROM projects WHERE project_id = ? ', project_id))[0];
			const baseUrl = (
				await queryPromise('SELECT env_baseurl FROM project_env WHERE project_id = ? AND env_type = ? ', [project_id, projectCurrentType])
			)[0];

			// 3. 获取该接口的列表形式请求参数
			const paramsSource = await queryPromise('SELECT * FROM request_params WHERE api_id = ? ', api_id);
			let api_request_params: any[] = [];
			for (let i = 0; i < 5; i++) {
				const paramsClassified = paramsSource.filter((item: any) => item.param_type === i);
				let paramsItem = {
					type: i,
					params_list: paramsClassified.map((item: any) => {
						return {
							name: item.param_name,
							type: item.param_type,
							desc: item.param_desc,
						};
					}),
				};
				api_request_params.push(paramsItem);
			}

			// 4. 获取该接口JSON形式的请求参数
			const api_request_JSON = (await queryPromise('SELECT JSON_body FROM request_JSON WHERE api_id = ? ', api_id))[0];

			// 5. 获取该接口的响应参数
			const { response_id: api_response_id, ...api_response } = (await queryPromise('SELECT * FROM api_responses WHERE api_id = ? ', api_id))[0];

			// 6. 最终结果组装并返回
			const result = {
				...apiInfo,
				api_env_url: baseUrl,
				api_request_params,
				api_request_JSON,
				api_response,
			};

			res.status(200).json({
				result_code: 0,
				result_message: 'get api detail success',
				api_info: result,
			});
		} catch (error: any) {
			res.status(500).json({
				result_code: 1,
				result_message: error.message || 'An error occurred',
			});
		}
	};

	// 新增接口
	addApi = async (req: Request, res: Response) => {
		const { api_request_params, api_request_JSON, api_response, ...apiInfo } = req.body;
		try {
			// 1. 先插入api_response，拿到response_id
			const response_id = (await queryPromise('INSERT INTO api_responses SET ?', api_response)).insertId;

			// 2. 插入api_info，拿到api_id
			const presentTime = getPresentTime();
			const api_id = (
				await queryPromise('INSERT INTO apis SET ?', {
					...apiInfo,
					api_createdAt: presentTime,
					api_updatedAt: presentTime,
					response_id,
				})
			).insertId;

			// 3. 插入api_request_params
			const paramsList: any[] = [];
			api_request_params.forEach((item: any) => {
				item.params_list.forEach((param: any) => {
					paramsList.push({
						api_id,
						param_name: param.name,
						param_type: item.type,
						param_desc: param.desc,
					});
				});
			});
			await queryPromise('INSERT INTO request_params SET ?', paramsList);

			// 4. 插入api_request_JSON
			await queryPromise('INSERT INTO request_JSON SET ?', {
				api_id,
				JSON_body: api_request_JSON,
			});

			// 5. 返回结果
			res.status(200).json({
				result_code: 0,
				result_message: 'add api success',
				api_id,
			});
		} catch (error: any) {
			res.status(500).json({
				result_code: 1,
				result_message: error.message || 'An error occurred',
			});
		}
	};

	// 更新接口
	updateApi = async (req: Request, res: Response) => {
		const { api_id, api_request_params, api_request_JSON, api_response, ...apiInfo } = req.body;
		try {
			// 1. 更新api_info
			const presentTime = getPresentTime();
			await queryPromise('UPDATE apis SET ? WHERE api_id = ?', [{ ...apiInfo, api_updatedAt: presentTime }, api_id]);

			// 2. 更新api_response
			await queryPromise('UPDATE api_responses SET ? WHERE api_id = ?', [api_response, api_id]);

			// 3. 更新api_request_params
			const paramsList: any[] = [];
			api_request_params.forEach((item: any) => {
				item.params_list.forEach((param: any) => {
					paramsList.push({
						api_id,
						param_name: param.name,
						param_type: item.type,
						param_desc: param.desc,
					});
				});
			});
			await queryPromise('DELETE FROM request_params WHERE api_id = ?', api_id);
			await queryPromise('INSERT INTO request_params SET ?', paramsList);

			// 4. 更新api_request_JSON
			await queryPromise('UPDATE request_JSON SET ? WHERE api_id = ?', [{ JSON_body: api_request_JSON }, api_id]);

			// 5. 返回结果
			res.status(200).json({
				result_code: 0,
				result_message: 'update api success',
				api_id,
			});
		} catch (error: any) {
			res.status(500).json({
				result_code: 1,
				result_message: error.message || 'An error occurred',
			});
		}
	};

	// 删除接口
	deleteApi = async (req: Request, res: Response) => {
		const { api_id } = req.body;
		try {
			await queryPromise('DELETE FROM apis WHERE api_id = ?', api_id);

			res.status(200).json({
				result_code: 0,
				result_message: 'delete api success',
			});
		} catch (error: any) {
			res.status(500).json({
				result_code: 1,
				result_message: error.message || 'An error occurred',
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
				result_message: 'add dictionary success',
				dictionary_id,
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
