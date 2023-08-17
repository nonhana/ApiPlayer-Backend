import { Request, Response } from 'express';
import { queryPromise } from '../utils/index';
import axios from 'axios';
import type { AxiosRequestConfig } from 'axios';
import qs from 'qs';

class ApisController {
	// 获取某API详情信息
	getApiInfo = async (req: Request, res: Response) => {
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
			const api_id = (
				await queryPromise('INSERT INTO apis SET ?', {
					...apiInfo,
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
			await queryPromise('UPDATE apis SET ? WHERE api_id = ?', [{ ...apiInfo }, api_id]);

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

	/**
	 * 运行API
	 * 具体的规则：
	 * 1. 先获取到传过来的api_id，获取到这个api的method、url等相关信息
	 * 2. 然后接收传过来的参数
	 * 3. 最后将参数解析完成之后，用axios来发送请求
	 */
	runApi = async (req: Request, res: Response) => {
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
					item.params_list.forEach((item: any) => {
						Params.push({
							key: item.param_name,
							value: item.param_value,
						});
					});
				}
				if (item.type === 1) {
					item.params_list.forEach((item: any) => {
						Body_formData.push({
							key: item.param_name,
							value: item.param_value,
						});
					});
				}
				if (item.type === 2) {
					item.params_list.forEach((item: any) => {
						Body_wwwFormUrlencoded.push({
							key: item.param_name,
							value: item.param_value,
						});
					});
				}
				if (item.type === 3) {
					item.params_list.forEach((item: any) => {
						Cookies.push({
							key: item.param_name,
							value: item.param_value,
						});
					});
				}
				if (item.type === 4) {
					item.params_list.forEach((item: any) => {
						Header.push({
							key: item.param_name,
							value: item.param_value,
						});
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
			const { env_baseurl } = await queryPromise('SELECT env_baseurl FROM project_env WHERE project_id = ? AND env_type = ?', [
				project_id,
				project_current_type,
			]);
			const paramsSource = await queryPromise('SELECT * FROM global_params WHERE project_id = ?', project_id);
			paramsSource.forEach((item: any) => {
				if (item.param_type === 0) {
					Params.push({
						key: item.param_name,
						value: JSON.parse(item.param_value).value,
					});
				}
				if (item.param_type === 1) {
					Body_formData.push({
						key: item.param_name,
						value: JSON.parse(item.param_value).value,
					});
				}
				if (item.param_type === 2) {
					Body_wwwFormUrlencoded.push({
						key: item.param_name,
						value: JSON.parse(item.param_value).value,
					});
				}
				if (item.param_type === 3) {
					Cookies.push({
						key: item.param_name,
						value: JSON.parse(item.param_value).value,
					});
				}
				if (item.param_type === 4) {
					Header.push({
						key: item.param_name,
						value: JSON.parse(item.param_value).value,
					});
				}
			});

			// 5. 通过axios向指定的url发送请求
			const axiosConfig: AxiosRequestConfig = {
				method: api_method,
				url: env_baseurl + api_url,
				params: Params,
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
					axiosConfig.headers!['Content-Type'] = 'application/x-www-form-urlencoded';
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

			const response = await axios(axiosConfig);

			// 6. 将结果返回
			res.status(200).json({
				result_code: 0,
				result_message: 'api run success',
				data: response.data,
			});
		} catch (error: any) {
			res.status(500).json({
				result_code: 1,
				result_message: error.message || 'An error occurred',
			});
		}
	};
}

export const apisController = new ApisController();
