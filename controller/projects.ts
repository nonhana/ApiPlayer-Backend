import { Request, Response } from 'express';
import { queryPromise } from '../utils/index';
import type { OkPacket } from 'mysql';
import type { ApiListItem } from '../utils/types';
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { JSONSchemaFaker } from 'json-schema-faker';
import dotenv from 'dotenv';

dotenv.config();

interface ApiRequestParam {
	/**
	 * 0-Params，1-Body(form-data)，2-Body(x-www-form-unlencoded)，3-Cookie，4-Header
	 */
	type: number;
	params_list?: ParamsList[];
}
interface ParamsList {
	param_desc: string;
	param_name: string;
	param_type: number;
}
interface ApiResponse {
	http_status: number;
	response_body: string;
	response_name: string;
}

class ProjectsController {
	// 上传项目图标。只保存，不更新数据库
	uploadProjectIcon = async (req: Request, res: Response) => {
		if (!req.file) {
			res.status(400).json({ result_code: 1, result_msg: 'No file uploaded' });
			return;
		}
		const projectIconPath = `${process.env.PROJECT_ICON_PATH}/${req.file.filename}`;
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
		const { user_id, team_id, ...projectInfo } = req.body;
		try {
			// 1. 先插入项目信息，获取到新的项目信息
			const sql = 'INSERT INTO projects SET ?';
			const projectResult: OkPacket = await queryPromise(sql, { ...projectInfo, team_id });

			// 2. 再插入项目成员信息，将这个队伍里面的所有成员都加入到这个项目的成员列表里面
			const sql2 = 'SELECT user_id FROM team_members WHERE team_id = ?';
			const userList = await queryPromise(sql2, team_id);
			if (userList.length > 0) {
				userList.forEach(async (item: any) => {
					await queryPromise('INSERT INTO projects_users SET ?', {
						user_id: item.user_id,
						project_id: projectResult.insertId,
						project_user_identity: 3,
					});
				});
			}

			// 3. 新建这个项目的接口根目录
			const sql3 = 'INSERT INTO dictionaries SET ?';
			await queryPromise(sql3, { project_id: projectResult.insertId, dictionary_name: '根目录' });

			// 4. 预置这个项目的环境：0~3：开发环境、测试环境、正式环境、mock.js环境
			for (let i = 0; i < 3; i++) {
				await queryPromise('INSERT INTO project_env (project_id, env_type) VALUES (?, ?) ', [projectResult.insertId, i]);
			}
			await queryPromise('INSERT INTO project_env (project_id, env_type, env_baseurl) VALUES (?, ?, ?) ', [
				projectResult.insertId,
				3,
				process.env.MOCK_URL,
			]);

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
					const sql1 = 'SELECT project_id,project_name,project_img,project_desc FROM projects WHERE project_id = ?';
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
					console.log('env_type', env_type);
					console.log('env_baseurl', env_baseurl);
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

	// 接收前端传来的Swagger文档(yaml格式)，将其转为JSON格式后解析之后，新建接口。
	uploadYaml = async (req: Request, res: Response) => {
		if (!req.file) {
			res.status(400).json({ result_code: 1, result_msg: 'No file uploaded' });
			return;
		}
		const { project_id } = req.body;
		try {
			// 通过project_id，获取到这个项目的根目录
			const { dictionary_id } = (
				await queryPromise('SELECT dictionary_id FROM dictionaries WHERE project_id = ? AND father_id IS NULL', project_id)
			)[0];
			const yamlPath = `public/uploads/files/yamls/${req.file.filename}`;

			const yamlContent = fs.readFileSync(yamlPath, 'utf8');
			const jsonData: any = yaml.load(yamlContent);

			// 将jsonData进行解析
			// 1. 将definitions中的内容解析并暂存，便于后续替换$ref中的内容
			const definitions: any = {};
			if (jsonData.definitions) {
				for (let key in jsonData.definitions) {
					definitions[key] = jsonData.definitions[key];
				}
			}
			// 2. 定义替换$ref的函数，将$ref中的内容替换成definitions中的内容。
			// 由于definitions中的内容可能也有$ref，所以需要递归替换。
			// 如果不包含$ref，则直接返回。
			const replaceRef = (obj: any) => {
				if (obj.$ref) {
					const ref = obj.$ref.split('/');
					const refName = ref[ref.length - 1];
					obj = definitions[refName];
					replaceRef(obj);
				} else {
					for (let key in obj) {
						if (typeof obj[key] === 'object') {
							replaceRef(obj[key]);
						}
					}
				}
				return obj;
			};
			// 3. 遍历paths，提取出api_info，api_request_params，api_request_JSON，api_responses
			let api_id_list: number[] = [];
			let api_info_list: any[] = [];
			let api_request_params_list: any[] = [];
			let api_request_JSON_list: any[] = [];
			let api_responses_list: any[] = [];
			const paths = jsonData.paths;
			for (let path in paths) {
				let api_info = {
					project_id: Number(project_id),
					dictionary_id: Number(dictionary_id),
					api_name: '',
					api_url: '',
					api_method: '',
					api_desc: '',
					api_editor_id: 0,
					api_creator_id: 0,
				};
				let api_request_params: ApiRequestParam[] = [];
				let api_request_JSON: string = '';
				let api_responses: ApiResponse[] = [];
				// 2.1 处理api_info
				api_info.api_method = Object.keys(paths[path])[0].toUpperCase();
				api_info.api_name = paths[path][Object.keys(paths[path])[0]].summary;
				api_info.api_url = path;
				api_info.api_desc = paths[path][Object.keys(paths[path])[0]].description;
				api_info.api_editor_id = (req as any).state.userInfo.user_id;
				api_info.api_creator_id = (req as any).state.userInfo.user_id;
				// 2.2 处理api_request_params
				const parameters = paths[path][Object.keys(paths[path])[0]].parameters;
				console.log('parameters', parameters);
				if (parameters) {
					for (let i = 0; i < parameters.length; i++) {
						/**
						 * 0-Params，1-Body(form-data)，2-Body(x-www-form-unlencoded)，3-Cookie，4-Header
						 */
						let typeNum: number = 0;
						if (api_info.api_method === 'GET') {
							switch (parameters[i].in) {
								case 'query':
									typeNum = 0;
									break;
								case 'header':
									typeNum = 4;
									break;
								case 'cookie':
									typeNum = 3;
									break;
								default:
									break;
							}
						} else if (api_info.api_method === 'POST') {
							switch (parameters[i].in) {
								case 'formData':
									typeNum = 1;
									break;
								case 'query':
									typeNum = 2;
									break;
								case 'cookie':
									typeNum = 3;
									break;
								case 'header':
									typeNum = 4;
									break;
								default:
									break;
							}
						}
						// 如果api_request_params中不存在这个type，则新建；如果存在，则push
						const index = api_request_params.findIndex((item: ApiRequestParam) => item.type === typeNum);
						if (index === -1) {
							api_request_params.push({
								type: typeNum,
								params_list: [
									{
										param_desc: parameters[i].description,
										param_name: parameters[i].name,
										param_type: parameters[i].type === 'number' ? 0 : parameters[i].type === 'integer' ? 1 : parameters[i].type === 'string' ? 2 : 3,
									},
								],
							});
						} else {
							api_request_params[index].params_list!.push({
								param_desc: parameters[i].description,
								param_name: parameters[i].name,
								param_type: parameters[i].type === 'number' ? 0 : parameters[i].type === 'integer' ? 1 : parameters[i].type === 'string' ? 2 : 3,
							});
						}
					}
					// 2.3 处理api_request_JSON
					// 如果传过来的参数in有body(json格式)，则将其JSON_Schema存入api_request_JSON
					const body = parameters.find((item: any) => item.in === 'body');
					if (body) {
						// 把body中的$ref替换成definitions中的内容。
						api_request_JSON = JSON.stringify(replaceRef(body.schema));
					}
				}
				// 2.4 处理api_responses
				const responses = paths[path][Object.keys(paths[path])[0]].responses;
				for (let key in responses) {
					api_responses.push({
						http_status: key === 'default' ? 0 : Number(key),
						// 把body中的$ref替换成definitions中的内容。
						response_body: JSON.stringify(replaceRef(responses[key].schema)),
						response_name: responses[key].description,
					});
				}
				// 2.5 处理完成后，将数据保存到数据库中
				const api_id = (
					await queryPromise('INSERT INTO apis SET ?', {
						...api_info,
					})
				).insertId;

				if (api_responses) {
					api_responses.forEach(async (item: any) => {
						await queryPromise('INSERT INTO api_responses SET ?', { ...item, api_id });
					});
				}

				if (api_request_params) {
					api_request_params.forEach((item: any) => {
						item.params_list.forEach(async (param: any) => {
							const paramItem = {
								api_id,
								param_class: item.type,
								param_name: param.param_name,
								param_type: param.param_type,
								param_desc: param.param_desc,
							};
							await queryPromise('INSERT INTO request_params SET ?', paramItem);
						});
					});
				}

				if (api_request_JSON !== '') {
					await queryPromise('INSERT INTO request_JSON SET ?', { JSON_body: api_request_JSON, api_id });
				}

				api_id_list.push(api_id);
				api_info_list.push(api_info);
				api_request_params_list.push(api_request_params);
				api_request_JSON_list.push(api_request_JSON);
				api_responses_list.push(api_responses);
			}

			res.status(200).json({
				result_code: 0,
				result_msg: 'Change yaml to json successfully',
				api_id_list,
				api_info_list,
				api_request_params_list,
				api_request_JSON_list,
				api_responses_list,
			});
		} catch (error: any) {
			res.status(500).json({
				result_code: 1,
				result_msg: error.message || 'An error occurred',
			});
		}
	};

	// mock接口，接收JSON Schema，返回mock数据
	mock = async (req: Request, res: Response) => {
		const schema = req.body;

		const mockedData = await JSONSchemaFaker.resolve(schema);

		res.status(200).json(mockedData);
	};
}

export const projectsController = new ProjectsController();
