import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/user.middleware';
import { queryPromise } from '../utils/index';
import axios from 'axios';
import type { AxiosRequestConfig } from 'axios';
import qs from 'qs';
import dotenv from 'dotenv';
dotenv.config();

class ApisController {
	// 新增接口
	addApi = async (req: AuthenticatedRequest, res: Response) => {
		const { ...apiInfo } = req.body;
		try {
			// 在api_version表当中插入修改的记录
			const { project_id } = apiInfo;
			const { insertId } = await queryPromise('INSERT INTO api_versions SET ?', {
				user_id: req.state!.userInfo!.user_id,
				project_id,
				version_msg: `新增了接口。`,
			});

			// 1. 插入api_info，拿到api_id
			const { insertId: api_id } = await queryPromise('INSERT INTO apis SET ?', {
				...apiInfo,
				version_id: insertId,
			});

			// 2. 返回结果
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

	// 删除接口
	deleteApi = async (req: AuthenticatedRequest, res: Response) => {
		const { api_id, project_id } = req.body;
		try {
			// 在api_version表当中插入修改的记录
			const { api_name } = (await queryPromise('SELECT api_name FROM apis WHERE api_id = ?', api_id))[0];
			const { insertId } = await queryPromise('INSERT INTO api_versions SET ?', {
				user_id: req.state!.userInfo!.user_id,
				project_id,
				version_msg: `删除了接口：${api_name} ，接口id为：${api_id} 。`,
			});

			// 软删除：把delete_status改为1，并且把version_id更新
			await queryPromise('UPDATE apis SET delete_status = 1, version_id = ? WHERE api_id = ?', [insertId, api_id]);

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

	// 更新接口
	updateApi = async (req: AuthenticatedRequest, res: Response) => {
		const { api_id, project_id, api_request_params, api_request_JSON, api_responses, ...apiInfo } = req.body;
		try {
			// 在api_version表当中插入修改的记录并获取到version_id
			const { insertId: version_id } = await queryPromise('INSERT INTO api_versions SET ?', {
				user_id: req.state!.userInfo!.user_id,
				project_id,
				version_msg: '',
			});

			let version_msg = ''; // 在更新不同的表的时候，记录下更新了哪些内容

			// 1. 更新api_info
			// 1.1 先获取到原本的api信息
			const apiInfoSource = await queryPromise('SELECT * FROM apis WHERE api_id = ?', api_id);
			const apiInfoSourceItem = apiInfoSource[0];
			// 1.2 将原本的api信息存储到api_backup表中
			await queryPromise('INSERT INTO api_backup SET ?', {
				...apiInfoSourceItem,
				version_id,
			});
			// 1.3 更新apis表
			await queryPromise('UPDATE apis SET ? WHERE api_id = ?', [{ ...apiInfo, version_id }, api_id]);

			version_msg += `更新了接口：${apiInfo.api_name} 的基本信息；`;

			// 2. 更新api_responses
			if (api_responses) {
				version_msg += `更新了接口：${apiInfo.api_name} 的返回响应：`;
				// 软删除：将delete_status改为1，版本号改为最新的
				await queryPromise('UPDATE api_responses SET delete_status = 1, version_id = ? WHERE api_id = ?', [version_id, api_id]);
				api_responses.forEach(async (item: any) => {
					version_msg += `${item.response_name}、`;
					await queryPromise('INSERT INTO api_responses SET ?', {
						api_id,
						http_status: item.http_status,
						response_name: item.response_name,
						response_body: item.response_body,
						version_id,
					});
				});
				version_msg = version_msg.substring(0, version_msg.length - 1) + '；';
			}

			// 3. 更新api_request_params
			if (api_request_params) {
				version_msg += `更新了接口：${apiInfo.api_name} 的请求参数：`;
				// 软删除：将delete_status改为1，版本号改为最新的
				await queryPromise('UPDATE request_params SET delete_status = 1, version_id = ? WHERE api_id = ?', [version_id, api_id]);
				api_request_params.forEach((item: any) => {
					item.params_list.forEach(async (param: any) => {
						const paramItem = {
							api_id,
							param_class: item.type,
							param_name: param.param_name,
							param_type: param.param_type,
							param_desc: param.param_desc,
						};
						if (paramItem.param_name !== '') {
							version_msg += `${paramItem.param_name}、`;
							await queryPromise('INSERT INTO request_params SET ?', paramItem);
						}
					});
				});
				version_msg = version_msg.substring(0, version_msg.length - 1) + '；';
			}

			// 4. 更新api_request_JSON
			if (api_request_JSON && api_request_JSON !== undefined) {
				version_msg += `更新了接口：${apiInfo.api_name} 的bodyJSON；`;
				// 软删除：将delete_status改为1，版本号改为最新的
				await queryPromise('UPDATE request_JSON SET delete_status = 1, version_id = ? WHERE api_id = ?', [version_id, api_id]);
				// 去掉api_request_JSON中的\n和\t
				const JSON_body = api_request_JSON.replace(/\n/g, '').replace(/\t/g, '');
				await queryPromise('INSERT INTO request_JSON SET ?', {
					api_id,
					JSON_body,
				});
			}

			// 5. 更新api_version表中的version_msg
			version_msg = version_msg.substring(0, version_msg.length - 1) + '。';
			await queryPromise('UPDATE api_versions SET version_msg = ? WHERE version_id = ?', [version_msg, version_id]);

			// 6. 返回结果
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

	// 查找接口
	getApiInfo = async (req: Request, res: Response) => {
		const { api_id } = req.query;
		try {
			// 1. 获取该接口基本信息，并解构出project_id, dictionary_id
			// 由于版本功能的引入，需要获取到最新的版本信息，所以需要按照version_id降序排列，取第一条
			const apiInfoSource = await queryPromise('SELECT * FROM apis WHERE api_id = ? ORDER BY version_id DESC LIMIT 1', api_id);
			const { project_id, dictionary_id, delete_status, ...apiInfo } = apiInfoSource[0];

			// 判断是否已经被删除
			if (delete_status === 1) {
				res.status(200).json({
					result_code: 1,
					result_message: 'api has been deleted',
				});
				return;
			}

			// 2. 获取该接口的前置url
			const { project_current_type: projectCurrentType } = (await queryPromise('SELECT * FROM projects WHERE project_id = ?', project_id))[0];
			const baseUrl = (
				await queryPromise('SELECT env_baseurl FROM project_env WHERE project_id = ? AND env_type = ? ', [project_id, projectCurrentType])
			)[0].env_baseurl;

			// 3. 获取该接口的列表形式请求参数，只搜索delete_status为0的
			const paramsSource = await queryPromise('SELECT * FROM request_params WHERE api_id = ? AND delete_status = 0', api_id);
			let api_request_params: any[] = [];
			for (let i = 0; i < 5; i++) {
				const paramsClassified = paramsSource.filter((item: any) => item.param_class === i);
				let paramsItem = {};
				if (!paramsClassified.length) {
					continue;
				} else {
					paramsItem = {
						type: i,
						params_list: paramsClassified.map((item: any) => {
							return {
								param_name: item.param_name,
								param_type: item.param_type,
								param_desc: item.param_desc,
							};
						}),
					};
				}
				api_request_params.push(paramsItem);
			}

			// 4. 获取该接口JSON形式的请求参数，只搜索delete_status为0的
			const api_request_JSON = (await queryPromise('SELECT JSON_body FROM request_JSON WHERE api_id = ? AND delete_status = 0', api_id))[0];

			// 5. 获取该接口的返回响应列表，可能有多个
			const apiResponsesSource = await queryPromise('SELECT * FROM api_responses WHERE api_id = ? AND delete_status = 0', api_id);

			const api_responses = apiResponsesSource.map((item: any) => {
				return {
					response_id: item.response_id,
					http_status: item.http_status,
					response_name: item.response_name,
					response_body: JSON.parse(item.response_body),
				};
			});

			// 6. 最终结果组装并返回
			const result = {
				...apiInfo,
				baseUrl,
				api_request_params,
				api_request_JSON,
				api_responses,
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

	/**
	 * 运行API
	 * 具体的规则：
	 * 1. 先获取到传过来的api_id，获取到这个api的method、url等相关信息
	 * 2. 然后接收传过来的参数
	 * 3. 最后将参数解析完成之后，用axios来发送请求
	 */
	runApi = async (req: Request, res: Response): Promise<void> => {
		const { api_id, api_request_params, api_request_JSON } = req.body;
		try {
			// 1. 将api_id传入，获取到api的method、url等相关信息
			const { api_method, api_url } = (await queryPromise('SELECT api_method, api_url FROM apis WHERE api_id = ?', api_id))[0];

			// 2. 获取传来的参数并根据其格式加以解析
			let Params: Array<Record<string, any>> = [];
			let Body_formData: Array<Record<string, any>> = [];
			let Body_wwwFormUrlencoded: Array<Record<string, any>> = [];
			let Cookies: Array<Record<string, any>> = [];
			let Header: Array<Record<string, any>> = [];
			api_request_params.forEach((item: any) => {
				if (item.type === 0) {
					item.params_list.forEach((param: any) => {
						if (param.param_name !== '') {
							Params.push({
								key: param.param_name,
								value: param.param_value,
							});
						}
					});
				}
				if (item.type === 1) {
					item.params_list.forEach((param: any) => {
						if (param.param_name !== '') {
							Body_formData.push({
								key: param.param_name,
								value: param.param_value,
							});
						}
					});
				}
				if (item.type === 2) {
					item.params_list.forEach((param: any) => {
						if (param.param_name !== '') {
							Body_wwwFormUrlencoded.push({
								key: param.param_name,
								value: param.param_value,
							});
						}
					});
				}
				if (item.type === 3) {
					item.params_list.forEach((param: any) => {
						if (param.param_name !== '') {
							Cookies.push({
								key: param.param_name,
								value: param.param_value,
							});
						}
					});
				}
				if (item.type === 4) {
					item.params_list.forEach((param: any) => {
						if (param.param_name !== '') {
							Header.push({
								key: param.param_name,
								value: param.param_value,
							});
						}
					});
				}
			});

			// 3. 如果有传来JSON形式的参数，放在Body_JSON里面
			let Body_JSON = '';
			if (api_request_JSON) {
				Body_JSON = api_request_JSON;
			}

			// 4. 获取全局的信息，并插入到对应的位置
			const { project_id } = (await queryPromise('SELECT project_id FROM apis WHERE api_id = ?', api_id))[0];
			const { project_current_type } = (await queryPromise('SELECT project_current_type FROM projects WHERE project_id = ?', project_id))[0];
			const { env_baseurl } = (
				await queryPromise('SELECT env_baseurl FROM project_env WHERE project_id = ? AND env_type = ?', [project_id, project_current_type])
			)[0];
			(await queryPromise('SELECT * FROM global_params WHERE project_id = ?', project_id)).forEach((item: any) => {
				// 0-Header，1-Cookie，2-Query
				if (item.father_type === 0) {
					Header.push({
						key: item.param_name,
						value: JSON.parse(item.param_value).value,
					});
				}
				if (item.father_type === 1) {
					Cookies.push({
						key: item.param_name,
						value: JSON.parse(item.param_value).value,
					});
				}
				if (item.father_type === 2) {
					Params.push({
						key: item.param_name,
						value: JSON.parse(item.param_value).value,
					});
				}
			});

			// 5. 通过axios向指定的url发送请求
			if (env_baseurl !== process.env.MOCK_URL) {
				const axiosConfig: AxiosRequestConfig = {
					method: api_method,
					url: env_baseurl + api_url,
					params: Params.reduce((acc: any, cur: any) => {
						acc[cur.key] = cur.value;
						return acc;
					}, {}),
					data: {},
					headers: Header.reduce((acc: any, cur: any) => {
						acc[cur.key] = cur.value;
						return acc;
					}, {}),
					withCredentials: true,
				};

				// 如果为POST请求，那么需要对data进行处理并设置Content-Type(请求体格式)
				if (api_method === 'POST') {
					if (Body_formData.length > 0) {
						axiosConfig.data = qs.stringify(
							Body_formData.reduce((acc: any, cur: any) => {
								acc[cur.key] = cur.value;
								return acc;
							}, {})
						);
						axiosConfig.headers!['Content-Type'] = 'multipart/form-data';
					}
					if (Body_wwwFormUrlencoded.length > 0) {
						axiosConfig.data = qs.stringify(
							Body_wwwFormUrlencoded.reduce((acc: any, cur: any) => {
								acc[cur.key] = cur.value;
								return acc;
							}, {})
						);
						axiosConfig.headers!['Content-Type'] = 'application/x-www-form-urlencoded';
					}
					if (Body_JSON !== '') {
						axiosConfig.data = Body_JSON;
						axiosConfig.headers!['Content-Type'] = 'application/json';
					}
				}

				const response = (await axios(axiosConfig)).data;

				// 6. 将结果返回
				res.status(200).json({
					result_code: 0,
					result_message: 'api run success',
					sourceConfig: axiosConfig,
					data: response,
				});
			} else {
				// 获取到api的reponse_body
				const { response_body } = (await queryPromise('SELECT response_body FROM api_responses WHERE api_id = ?', api_id))[0];

				// 如果有root，将其取出；没有就直接返回
				let JSON_Schema = {};
				if (JSON.parse(response_body).root) {
					JSON_Schema = JSON.parse(response_body).root;
				} else {
					JSON_Schema = JSON.parse(response_body);
				}
				const axiosConfig: AxiosRequestConfig = {
					method: 'POST',
					url: process.env.MOCK_URL, // 线上用
					data: JSON_Schema,
					withCredentials: true,
				};
				const response = (await axios(axiosConfig)).data;
				res.status(200).json({
					result_code: 0,
					result_message: 'api run success',
					sourceConfig: axiosConfig,
					data: response,
				});
			}
		} catch (error: any) {
			res.status(500).json({
				result_code: 1,
				result_message: error.message || 'An error occurred',
			});
		}
	};
}

export const apisController = new ApisController();
