import { Request, Response } from 'express';
import { queryPromise } from '../../utils';
import type { ResultSetHeader } from 'mysql2';
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { JSONSchemaFaker } from 'json-schema-faker';
import type { AuthenticatedRequest } from '../../middleware/user.middleware';
import type {
	ProjectId,
	CreateProjectReq,
	ProjectItem,
	AddDictionaryReq,
	UpdateDictionaryReq,
	DictionaryId,
	UpdateProjectInfoReq,
	EnvListItem,
	UpdateProjectGlobalInfoReq,
	UserInfo,
	RollbackReq,
} from './types';
import type {
	ApiListItem,
	ApiRequestParam,
	ApiResponse,
	RecentlyVisitedTable,
	DistionarieTable,
	ApisTable,
	ProjectsTable,
	GlobalParamsTable,
	GlobalVariablesTable,
	VersionsTable,
	ApiBackupTable,
	ApiResponsesTable,
	ApiRequestParamsTable,
	ApiRequestJSONTable,
} from '../types';
import { ProjectPermission, ProjectEnv } from '../../utils/constants';
import dotenv from 'dotenv';
dotenv.config();

class ProjectsController {
	// 上传项目图标。这个函数只保存并返回保存地址，不更新数据库
	uploadProjectIcon = (req: Request, res: Response) => {
		if (!req.file) {
			res.status(400).json({ result_code: 1, result_msg: 'No file detected' });
			return;
		}
		const result = `${process.env.PROJECT_ICON_PATH}/${req.file.filename}`;
		try {
			res.status(200).json({
				result_code: 0,
				result_msg: 'File uploaded successfully',
				result,
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
		const { team_id, ...projectInfo } = req.body as CreateProjectReq;
		try {
			// 1. 先插入项目信息，获取到新的项目信息
			const { insertId } = await queryPromise<ResultSetHeader>('INSERT INTO projects SET ?', { ...projectInfo, team_id });

			// 2. 再插入项目成员信息，将这个队伍里面的所有成员都加入到这个项目的成员列表里面
			const userList = await queryPromise<{ user_id: string }[]>('SELECT user_id FROM team_members WHERE team_id = ?', team_id);
			if (userList.length > 0) {
				userList.forEach(async (item) => {
					await queryPromise('INSERT INTO projects_users SET ?', {
						user_id: item.user_id,
						project_id: insertId,
						project_user_identity: ProjectPermission.FORBIDDEN,
					});
				});
			}

			// 3. 新建这个项目的接口根目录
			await queryPromise('INSERT INTO dictionaries SET ?', { project_id: insertId, dictionary_name: '根目录' });

			// 4. 预置这个项目的环境：0~3：开发环境、测试环境、正式环境、mock.js环境
			for (let i = 0; i < 3; i++) {
				await queryPromise('INSERT INTO project_env (project_id, env_type) VALUES (?, ?) ', [insertId, i]);
			}
			await queryPromise('INSERT INTO project_env (project_id, env_type, env_baseurl) VALUES (?, ?, ?) ', [
				insertId,
				ProjectEnv.MOCK,
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
	addRecentProject = async (req: AuthenticatedRequest, res: Response) => {
		const { project_id } = req.body as ProjectId;
		try {
			// 先查询是否存在
			const result = await queryPromise<RecentlyVisitedTable[]>('SELECT * FROM recently_visited WHERE user_id = ? AND project_id = ?', [
				req.state!.userInfo.user_id,
				project_id,
			]);
			if (result.length) {
				// 如果存在，更新访问时间
				await queryPromise('UPDATE recently_visited SET last_access_time = NOW() WHERE user_id = ? AND project_id = ?', [
					req.state!.userInfo.user_id,
					project_id,
				]);
			} else {
				// 如果不存在，插入记录
				await queryPromise('INSERT INTO recently_visited (user_id, project_id) VALUES (?, ?)', [req.state!.userInfo.user_id, project_id]);
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
	getRecentlyVisited = async (req: AuthenticatedRequest, res: Response) => {
		try {
			const projectIdList = await queryPromise<RecentlyVisitedTable[]>(
				'SELECT * FROM recently_visited WHERE user_id = ? ORDER BY last_access_time DESC LIMIT 10',
				req.state!.userInfo.user_id
			);

			const result = await Promise.all(
				projectIdList.map(async (item) => {
					const projects = await queryPromise<ProjectItem[]>(
						'SELECT project_id,project_name,project_img,project_desc FROM projects WHERE project_id = ?',
						item.project_id
					);

					const last_access_time = await queryPromise<{ last_access_time: string }[]>(
						'SELECT last_access_time FROM recently_visited WHERE user_id = ? AND project_id = ?',
						[req.state!.userInfo.user_id, item.project_id]
					);
					return {
						...projects[0],
						last_access_time: last_access_time[0].last_access_time,
					};
				})
			);

			res.status(200).json({
				result_code: 0,
				result_msg: 'get recent projects success',
				result,
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
		const { project_id } = req.query as unknown as ProjectId;
		try {
			let result: ApiListItem[] = [];
			// 1. 获取所有的目录
			const dictionariesSource = await queryPromise<DistionarieTable[]>('SELECT * FROM dictionaries WHERE project_id = ?', project_id);

			// 2. 获取到项目根目录
			const root = dictionariesSource.find((item) => item.father_id === null);
			result.push({
				id: root!.dictionary_id,
				label: root!.dictionary_name,
				type: 'dictionary',
				children: [],
			});

			// 3. 根据father_id构建目录树
			const buildDicTree = (father_id: number) => {
				const children: ApiListItem[] = [];
				dictionariesSource.forEach((item) => {
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

			result[0].children = buildDicTree(root!.dictionary_id);

			// 4. 遍历目录树，根据dictionary_id获取每个目录下的接口
			const getApis = async (tree: ApiListItem[]) => {
				for (let i = 0; i < tree.length; i++) {
					// 因为dictionary_id可能等于api_id，所以这里要判断一下是否为目录
					if (tree[i].type === 'dictionary') {
						const apisSource = await queryPromise<ApisTable[]>('SELECT * FROM apis WHERE dictionary_id = ?', tree[i].id);
						apisSource.forEach((item) => {
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
				result,
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
		const dictionaryInfo = req.body as AddDictionaryReq;
		try {
			const { insertId } = await queryPromise<ResultSetHeader>('INSERT INTO dictionaries SET ?', dictionaryInfo);

			res.status(200).json({
				result_code: 0,
				result_msg: 'add dictionary success',
				result: insertId,
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
		const { dictionary_id, ...dictionaryInfo } = req.body as UpdateDictionaryReq;
		try {
			await queryPromise('UPDATE dictionaries SET ? WHERE dictionary_id = ?', [dictionaryInfo, dictionary_id]);

			res.status(200).json({
				result_code: 0,
				result_msg: 'update dictionary success',
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
		const { dictionary_id } = req.body as DictionaryId;
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
		const { project_id } = req.query as unknown as ProjectId;
		try {
			const projectInfo = await queryPromise<ProjectsTable[]>('SELECT * FROM projects WHERE project_id = ?', project_id);

			res.status(200).json({
				result_code: 0,
				result_msg: 'get project info success',
				result: projectInfo[0],
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
		const { project_id, ...projectInfo } = req.body as UpdateProjectInfoReq;
		try {
			await queryPromise('UPDATE projects SET ? WHERE project_id = ?', [projectInfo, project_id]);

			res.status(200).json({
				result_code: 0,
				result_msg: 'update project info success',
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
		const { project_id } = req.query as unknown as ProjectId;
		try {
			// 1. 获取全局参数
			let global_params = [];
			const paramsSource = await queryPromise<GlobalParamsTable[]>('SELECT * FROM global_params WHERE project_id = ?', project_id);
			for (let i = 0; i < 3; i++) {
				const tempParams = paramsSource.filter((item) => item.father_type === i);
				if (tempParams.length > 0) {
					global_params.push({
						type: i,
						params_list: tempParams.map((param) => {
							return {
								param_id: param.param_id,
								param_name: param.param_name,
								param_type: param.param_type,
								param_desc: param.param_desc,
								param_value: param.param_value,
							};
						}),
					});
				}
			}

			// 2. 获取全局变量
			const variablesSource = await queryPromise<GlobalVariablesTable[]>('SELECT * FROM global_variables WHERE project_id = ?', project_id);
			const global_variables = variablesSource.map((variable) => {
				return {
					variable_id: variable.variable_id,
					variable_name: variable.variable_name,
					variable_type: variable.variable_type,
					variable_value: variable.variable_value,
					variable_desc: variable.variable_desc,
				};
			});

			// 3. 获取环境列表
			const env_list = await queryPromise<EnvListItem[]>('SELECT env_type, env_baseurl FROM project_env WHERE project_id = ?', project_id);

			// 4. 结果组装返回
			res.status(200).json({
				result_code: 0,
				result_msg: 'get project global info success',
				result: {
					global_params,
					global_variables,
					env_list,
				},
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
		const { project_id, global_params, global_variables, env_list } = req.body as UpdateProjectGlobalInfoReq;
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
				result: project_id,
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
		const { project_id } = req.body as ProjectId;
		try {
			await queryPromise('DELETE FROM projects WHERE project_id = ?', project_id);

			res.status(200).json({
				result_code: 0,
				result_msg: 'delete project success',
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
		const { project_id } = req.body as ProjectId;
		try {
			// 通过project_id，获取到这个项目的根目录
			const { dictionary_id } = (
				await queryPromise<{ dictionary_id: string }[]>(
					'SELECT dictionary_id FROM dictionaries WHERE project_id = ? AND father_id IS NULL',
					project_id
				)
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
			let api_info_list = [];
			let api_request_params_list = [];
			let api_request_JSON_list = [];
			let api_responses_list = [];
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
				const { insertId: api_id } = await queryPromise<ResultSetHeader>('INSERT INTO apis SET ?', api_info);

				if (api_responses) {
					api_responses.forEach(async (item) => {
						await queryPromise('INSERT INTO api_responses SET ?', { ...item, api_id });
					});
				}

				if (api_request_params) {
					api_request_params.forEach((item) => {
						item.params_list!.forEach(async (param) => {
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
				result: {
					api_id_list,
					api_info_list,
					api_request_params_list,
					api_request_JSON_list,
					api_responses_list,
				},
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
		const schema = req.body as string;

		const result = await JSONSchemaFaker.resolve(schema);

		res.status(200).json({
			result_code: 0,
			result_msg: 'mock data successfully',
			result,
		});
	};

	// 获取到某个项目的历史操作记录信息
	getHistoryInfo = async (req: Request, res: Response) => {
		const { project_id } = req.query as unknown as ProjectId;
		try {
			const historyInfo = await queryPromise<VersionsTable[]>('SELECT * FROM api_versions WHERE project_id = ? ORDER BY createdAt DESC', project_id);

			// 根据user_id获取用户的基本信息
			const result = await Promise.all(
				historyInfo.map(async (item) => {
					const userInfo = await queryPromise<UserInfo[]>('SELECT user_id, username, avatar FROM users WHERE user_id = ?', item.user_id);
					return {
						...item,
						user_name: userInfo[0].username,
						user_avatar: userInfo[0].avatar,
					};
				})
			);

			res.status(200).json({
				result_code: 0,
				result_msg: 'get project history info success',
				result,
			});
		} catch (error: any) {
			res.status(500).json({
				result_code: 1,
				result_msg: error.message || 'An error occurred',
			});
		}
	};

	// 回滚某个项目的历史记录
	rollback = async (req: Request, res: Response) => {
		const { version_id, project_id } = req.body as RollbackReq;
		try {
			// 从api_versions表中根据version_id拿到version_type
			// version_type为版本更新的类型，0-接口基本信息更新；1-接口返回体更新；2-接口请求参数更新；3-接口请求体(Body-JSON)更新。如果涉及到多个内容的更新，采用'0,1,...'这样的形式进行拼接。
			// 目前version_type为4或者5不支持回滚功能。
			const version_type = (
				await queryPromise<{ version_type: string }[]>('SELECT version_type FROM api_versions WHERE version_id = ?', version_id)
			)[0].version_type.split(',') as string[];

			if (version_type.includes('4') || version_type.includes('5')) {
				res.status(200).json({
					result_code: 1,
					result_msg: 'This version cannot be rolled back',
				});
				return;
			}

			// 1. 回滚api_info
			if (version_type.includes('0')) {
				// 1.1 从api_backup中拿到对应的version_id的api_info
				const targetApiInfo = await queryPromise<ApiBackupTable[]>('SELECT * FROM api_backup WHERE version_id = ?', version_id);
				if (targetApiInfo.length > 0) {
					// 1.2 从api_version中拿到version_type包含0的除了目前这个最近的一个版本的version_id
					let lastVersionId: number | null = null;
					const versionIdList = await queryPromise<{ version_id: number }[]>(
						'SELECT version_id FROM api_versions WHERE project_id = ? AND version_type LIKE "%0%" ORDER BY createdAt DESC',
						project_id
					);
					if (versionIdList.length > 1) {
						lastVersionId = versionIdList[1].version_id;
					}
					// 1.3 剔除掉backup_id、api_id、project_id、version_id、api_createdAt、api_editedAt、delete_status属性，拿到对应的api_id，然后更新apis表中对应的api
					const apiInfo = JSON.parse(JSON.stringify(targetApiInfo[0]));
					delete apiInfo.backup_id;
					delete apiInfo.api_id;
					delete apiInfo.project_id;
					delete apiInfo.version_id;
					delete apiInfo.api_createdAt;
					delete apiInfo.api_editedAt;
					delete apiInfo.delete_status;
					await queryPromise('UPDATE apis SET ? WHERE api_id = ?', [{ ...apiInfo, version_id: lastVersionId }, targetApiInfo[0].api_id]);
					// 1.4 把api_backup表中对应的version_id的记录删除
					await queryPromise('DELETE FROM api_backup WHERE version_id = ?', version_id);
				}
			}

			// 2. 回滚api_responses
			if (version_type.includes('1')) {
				const targetResponses = await queryPromise<ApiResponsesTable[]>(
					'SELECT * FROM api_responses WHERE version_id = ? AND delete_status = 0',
					version_id
				);
				if (targetResponses.length > 0) {
					// 2.1 把api_responses表中对应的version_id的delete_status为0的记录删除
					await queryPromise('DELETE FROM api_responses WHERE version_id = ? AND delete_status = 0', version_id);
					// 2.2 从api_version中拿到version_type包含1的除了目前这个最近的一个版本的version_id
					let lastVersionId: number | null = null;
					const versionIdList = await queryPromise<{ version_id: number }[]>(
						'SELECT version_id FROM api_versions WHERE project_id = ? AND version_type LIKE "%1%" ORDER BY createdAt DESC',
						project_id
					);
					if (versionIdList.length > 1) {
						lastVersionId = versionIdList[1].version_id;
					}
					// 2.3 把api_responses表中对应的version_id的delete_status为1的记录的delete_status改为0，version_id改为lastVersionId
					await queryPromise('UPDATE api_responses SET delete_status = 0, version_id = ? WHERE version_id = ? AND delete_status = 1', [
						lastVersionId,
						version_id,
					]);
				}
			}

			// 3. 回滚api_request_params
			if (version_type.includes('2')) {
				const targetRequestParams = await queryPromise<ApiRequestParamsTable[]>(
					'SELECT * FROM request_params WHERE version_id = ? AND delete_status = 0',
					version_id
				);
				if (targetRequestParams.length > 0) {
					// 3.1 把request_params表中对应的version_id的delete_status为0的记录删除
					await queryPromise('DELETE FROM request_params WHERE version_id = ? AND delete_status = 0', version_id);
					// 3.2 从api_version中拿到version_type包含2的除了目前这个最近的一个版本的version_id
					let lastVersionId: number | null = null;
					const versionIdList = await queryPromise<{ version_id: number }[]>(
						'SELECT version_id FROM api_versions WHERE project_id = ? AND version_type LIKE "%2%" ORDER BY createdAt DESC',
						project_id
					);
					if (versionIdList.length > 1) {
						lastVersionId = versionIdList[1].version_id;
					}
					// 3.2 把request_params表中对应的version_id的delete_status为1的记录的delete_status改为0
					await queryPromise('UPDATE request_params SET delete_status = 0, version_id = ? WHERE version_id = ? AND delete_status = 1', [
						lastVersionId,
						version_id,
					]);
				}
			}

			// 4. 回滚api_request_JSON
			if (version_type.includes('3')) {
				const targetRequestJSON = await queryPromise<ApiRequestJSONTable[]>(
					'SELECT * FROM request_JSON WHERE version_id = ? AND delete_status = 0',
					version_id
				);
				if (targetRequestJSON.length > 0) {
					// 4.1 把request_JSON表中对应的version_id的delete_status为0的记录删除
					await queryPromise('DELETE FROM request_JSON WHERE version_id = ? AND delete_status = 0', version_id);
					// 4.2 从api_version中拿到version_type包含3的除了目前这个最近的一个版本的version_id
					let lastVersionId: number | null = null;
					const versionIdList = await queryPromise<{ version_id: number }[]>(
						'SELECT version_id FROM api_versions WHERE project_id = ? AND version_type LIKE "%3%" ORDER BY createdAt DESC',
						project_id
					);
					if (versionIdList.length > 1) {
						lastVersionId = versionIdList[1].version_id;
					}
					// 4.2 把request_JSON表中对应的version_id的delete_status为1的记录的delete_status改为0
					await queryPromise('UPDATE request_JSON SET delete_status = 0, version_id = ? WHERE version_id = ? AND delete_status = 1', [
						lastVersionId,
						version_id,
					]);
				}
			}

			// 5. 删除api_versions表中对应的version_id的记录
			await queryPromise('DELETE FROM api_versions WHERE version_id = ?', version_id);

			// 6. 回滚成功，返回响应
			res.status(200).json({
				result_code: 0,
				result_msg: 'rollback success',
			});
		} catch (error: any) {
			res.status(500).json({
				result_code: 1,
				result_msg: error.message || 'An error occurred',
				error,
			});
		}
	};
}

export const projectsController = new ProjectsController();
