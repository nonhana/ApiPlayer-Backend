import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/user.middleware';
import { queryPromise } from '../../utils';
import axios from 'axios';
import qs from 'qs';
import type { ResultSetHeader } from 'mysql2';
import type { AxiosRequestConfig } from 'axios';
import type { AddApiReq, DeleteApiReq, RunApiReq, UpdateApiReq } from './types';
import type { ApiId, ApiRequestParam, ApiRequestParamsTable, ApiResponsesTable, ApisTable, GlobalParamsTable, ProjectsTable } from '../types';
import { VersionUpdateType } from '../../utils/constants';
import dotenv from 'dotenv';

dotenv.config();

class ApisController {
	// 新增接口
	addApi = async (req: AuthenticatedRequest, res: Response) => {
		const apiInfo = req.body as AddApiReq;
		try {
			// 在api_version表当中插入修改的记录
			const { project_id } = apiInfo;
			const { insertId: version_id } = await queryPromise<ResultSetHeader>('INSERT INTO api_versions SET ?', {
				user_id: req.state!.userInfo!.user_id,
				project_id,
				version_msg: `新增了接口。`,
				version_type: VersionUpdateType.ADD, // 新增接口类型为4
			});

			// 1. 插入api_info，拿到api_id
			const { insertId: result } = await queryPromise<ResultSetHeader>('INSERT INTO apis SET ?', {
				...apiInfo,
				version_id,
			});

			// 2. 返回结果
			res.status(200).json({
				result_code: 0,
				result_msg: 'add api success',
				result,
			});
		} catch (error: any) {
			res.status(500).json({
				result_code: 1,
				result_msg: error.message || 'An error occurred',
			});
		}
	};

	// 删除接口
	deleteApi = async (req: AuthenticatedRequest, res: Response) => {
		const { api_id, project_id } = req.body as DeleteApiReq;
		try {
			// 在api_version表当中插入修改的记录
			const { api_name } = (await queryPromise<{ api_name: string }[]>('SELECT api_name FROM apis WHERE api_id = ?', api_id))[0];
			const { insertId } = await queryPromise<ResultSetHeader>('INSERT INTO api_versions SET ?', {
				user_id: req.state!.userInfo.user_id,
				project_id,
				version_msg: `删除了接口：${api_name} ，接口id为：${api_id} 。`,
				version_type: VersionUpdateType.DELETE, // 删除接口类型为5
			});

			// 软删除：把delete_status改为1，并且把version_id更新
			await queryPromise('UPDATE apis SET delete_status = 1, version_id = ? WHERE api_id = ?', [insertId, api_id]);

			res.status(200).json({
				result_code: 0,
				result_msg: 'delete api success',
			});
		} catch (error: any) {
			res.status(500).json({
				result_code: 1,
				result_msg: error.message || 'An error occurred',
			});
		}
	};

	// 更新接口
	updateApi = async (req: AuthenticatedRequest, res: Response) => {
		// 说明：api_id, project_id两者是必须的，其他的参数如果没有传就不更新
		const { api_id, dictionary_id, project_id, api_request_params, api_request_JSON, api_responses, basic_info } = req.body as UpdateApiReq;
		try {
			// 在修改开始前，检测有没有要修改的内容，如果没有，直接返回
			if (!dictionary_id && !basic_info && !api_request_params && !api_request_JSON && !api_responses) {
				res.status(200).json({
					result_code: 1,
					result_msg: '未检测到要修改的内容',
				});
				return;
			}
			console.log(api_id, dictionary_id, project_id);

			// 如果dictionary_id改变，不插入修改记录，直接返回
			const { dictionary_id: dictionaryIdSource } = (
				await queryPromise<{ dictionary_id: number }[]>('SELECT dictionary_id FROM apis WHERE api_id = ?', api_id)
			)[0];
			console.log(dictionary_id, dictionaryIdSource);
			if (dictionary_id && dictionary_id !== dictionaryIdSource) {
				await queryPromise('UPDATE apis SET dictionary_id = ? WHERE api_id = ?', [dictionary_id, api_id]);
				res.status(200).json({
					result_code: 0,
					result_msg: '更新接口成功',
					result: api_id,
				});
				return;
			}

			// 在api_version表当中插入修改的记录并获取到version_id
			const { insertId: version_id } = await queryPromise<ResultSetHeader>('INSERT INTO api_versions SET ?', {
				user_id: req.state!.userInfo!.user_id,
				project_id,
				version_msg: '',
				version_type: '',
			});

			let version_msg = ''; // 在更新不同的表的时候，记录更新了哪些内容
			let version_type = ''; // 版本更新的类型，0-接口基本信息更新；1-接口返回体更新；2-接口请求参数更新；3-接口请求体(Body-JSON)更新。如果涉及到多个内容的更新，采用'0,1,...'这样的形式进行拼接。

			// 1. 更新api_info
			// 1.1 先获取到原本的api信息
			if (basic_info) {
				const apiInfoSource = await queryPromise<ApisTable[]>('SELECT * FROM apis WHERE api_id = ?', api_id);
				const apiInfoSourceItem = apiInfoSource[0];
				// 1.2 将原本的api信息存储到api_backup表中
				await queryPromise('INSERT INTO api_backup SET ?', {
					...apiInfoSourceItem,
					version_id,
				});
				// 1.3 更新apis表
				await queryPromise('UPDATE apis SET ? WHERE api_id = ?', [{ ...basic_info, version_id }, api_id]);

				version_msg += `更新了接口id为：${api_id} 的基本信息；`;
				version_type += '0,';
			}

			// 2. 更新api_responses
			if (api_responses) {
				version_msg += `更新了接口：${api_id} 的返回响应：`;
				// 软删除：将delete_status改为1，版本号改为最新的
				await queryPromise('UPDATE api_responses SET delete_status = 1, version_id = ? WHERE api_id = ? AND delete_status = 0', [version_id, api_id]);
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
				version_type += '1,';
			}

			// 3. 更新api_request_params
			if (api_request_params) {
				version_msg += `更新了接口id为：${api_id} 的请求参数：`;
				// 先找到目前未被软删除的请求参数，将其delete_status改为1，版本号改为最新的
				await queryPromise('UPDATE request_params SET delete_status = 1, version_id = ? WHERE api_id = ? AND delete_status = 0', [
					version_id,
					api_id,
				]);
				// 然后再将新的请求参数插入到request_params表中
				api_request_params.forEach((item) => {
					item.params_list.forEach(async (param) => {
						const paramItem = {
							api_id,
							param_class: item.type,
							param_name: param.param_name,
							param_type: param.param_type,
							param_desc: param.param_desc,
						};
						if (paramItem.param_name !== '') {
							version_msg += `${paramItem.param_name}、`;
							await queryPromise('INSERT INTO request_params SET ?', {
								...paramItem,
								version_id,
							});
						}
					});
				});
				version_msg = version_msg.substring(0, version_msg.length - 1) + '；';
				version_type += '2,';
			}

			// 4. 更新api_request_JSON
			if (api_request_JSON && api_request_JSON !== undefined) {
				version_msg += `更新了接口：${api_id} 的bodyJSON；`;
				// 软删除：将delete_status改为1，版本号改为最新的
				await queryPromise('UPDATE request_JSON SET delete_status = 1, version_id = ? WHERE api_id = ? AND delete_status = 0', [version_id, api_id]);
				// 去掉api_request_JSON中的\n和\t
				const JSON_body = api_request_JSON.replace(/\n/g, '').replace(/\t/g, '');
				await queryPromise('INSERT INTO request_JSON SET ?', {
					api_id,
					JSON_body,
				});
				version_type += '3,';
			}

			// 5. 更新api_version表中的version_msg
			version_msg = version_msg.substring(0, version_msg.length - 1) + '。';
			version_type = version_type.substring(0, version_type.length - 1);
			await queryPromise('UPDATE api_versions SET version_msg = ?, version_type = ? WHERE version_id = ?', [version_msg, version_type, version_id]);

			// 6. 返回结果
			res.status(200).json({
				result_code: 0,
				result_msg: '更新接口成功',
				result: api_id,
			});
		} catch (error) {
			res.status(500).json({
				result_code: 1,
				result_msg: '更新接口失败',
				error,
			});
		}
	};

	// 查找接口
	getApiInfo = async (req: Request, res: Response) => {
		const { api_id } = req.query as unknown as ApiId;
		try {
			// 1. 获取该接口基本信息，并解构出project_id, dictionary_id
			// 由于版本功能的引入，需要获取到最新的版本信息，所以需要按照version_id降序排列，取第一条
			const apiInfoSource = await queryPromise<ApisTable[]>('SELECT * FROM apis WHERE api_id = ? ORDER BY version_id DESC LIMIT 1', api_id);
			const { project_id, dictionary_id, delete_status, ...apiInfo } = apiInfoSource[0];

			// 判断是否已经被删除
			if (delete_status === 1) {
				res.status(200).json({
					result_code: 1,
					result_msg: 'api has been deleted',
				});
				return;
			}

			// 2. 获取该接口的前置url
			const { project_current_type: projectCurrentType } = (
				await queryPromise<ProjectsTable[]>('SELECT * FROM projects WHERE project_id = ?', project_id)
			)[0];
			const { env_baseurl: baseUrl } = (
				await queryPromise<{ env_baseurl: string }[]>('SELECT env_baseurl FROM project_env WHERE project_id = ? AND env_type = ? ', [
					project_id,
					projectCurrentType,
				])
			)[0];

			// 3. 获取该接口的列表形式请求参数，只搜索delete_status为0的
			const paramsSource = await queryPromise<ApiRequestParamsTable[]>('SELECT * FROM request_params WHERE api_id = ? AND delete_status = 0', api_id);
			let api_request_params: ApiRequestParam[] = [];
			for (let i = 0; i < 5; i++) {
				const paramsClassified = paramsSource.filter((item) => item.param_class === i);
				let paramsItem: ApiRequestParam;
				if (!paramsClassified.length) {
					continue;
				} else {
					paramsItem = {
						type: i,
						params_list: paramsClassified.map((item) => {
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
			const api_request_JSON = (
				await queryPromise<{ JSON_body: string }[]>('SELECT JSON_body FROM request_JSON WHERE api_id = ? AND delete_status = 0', api_id)
			)[0];

			// 5. 获取该接口的返回响应列表，可能有多个
			const apiResponsesSource = await queryPromise<ApiResponsesTable[]>(
				'SELECT * FROM api_responses WHERE api_id = ? AND delete_status = 0',
				api_id
			);

			const api_responses = apiResponsesSource.map((item) => {
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
				result_msg: 'get api detail success',
				result,
			});
		} catch (error: any) {
			res.status(500).json({
				result_code: 1,
				result_msg: error.message || 'An error occurred',
			});
		}
	};

	/**
	 * 运行API
	 * > 具体的规则：
	 * > 1. 先获取到传过来的api_id，获取到这个api的method、url等相关信息
	 * > 2. 然后接收传过来的参数
	 * > 3. 最后将参数解析完成之后，用axios来发送请求
	 */
	runApi = async (req: Request, res: Response): Promise<void> => {
		const { api_id, api_request_params, api_request_JSON } = req.body as RunApiReq;
		try {
			// 1. 将api_id传入，获取到api的method、url等相关信息
			const { api_method, api_url } = (
				await queryPromise<
					{
						api_method: 'GET' | 'POST' | 'PUT' | 'DELETE';
						api_url: string;
					}[]
				>('SELECT api_method, api_url FROM apis WHERE api_id = ?', api_id)
			)[0];

			// 2. 获取传来的参数并根据其格式加以解析
			let Params: Array<{ key: string; value: any }> = [];
			let Body_formData: Array<{ key: string; value: any }> = [];
			let Body_wwwFormUrlencoded: Array<{ key: string; value: any }> = [];
			let Cookies = [];
			let Header: Array<{ key: string; value: any }> = [];
			api_request_params.forEach((item) => {
				if (item.type === 0) {
					item.params_list.forEach((param) => {
						if (param.param_name !== '') {
							Params.push({
								key: param.param_name,
								value: param.param_value,
							});
						}
					});
				}
				if (item.type === 1) {
					item.params_list.forEach((param) => {
						if (param.param_name !== '') {
							Body_formData.push({
								key: param.param_name,
								value: param.param_value,
							});
						}
					});
				}
				if (item.type === 2) {
					item.params_list.forEach((param) => {
						if (param.param_name !== '') {
							Body_wwwFormUrlencoded.push({
								key: param.param_name,
								value: param.param_value,
							});
						}
					});
				}
				if (item.type === 3) {
					item.params_list.forEach((param) => {
						if (param.param_name !== '') {
							Cookies.push({
								key: param.param_name,
								value: param.param_value,
							});
						}
					});
				}
				if (item.type === 4) {
					item.params_list.forEach((param) => {
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
			const { project_id } = (await queryPromise<{ project_id: number }[]>('SELECT project_id FROM apis WHERE api_id = ?', api_id))[0];
			const { project_current_type } = (
				await queryPromise<{ project_current_type: number }[]>('SELECT project_current_type FROM projects WHERE project_id = ?', project_id)
			)[0];
			const { env_baseurl } = (
				await queryPromise<{ env_baseurl: string }[]>('SELECT env_baseurl FROM project_env WHERE project_id = ? AND env_type = ?', [
					project_id,
					project_current_type,
				])
			)[0];
			(await queryPromise<GlobalParamsTable[]>('SELECT * FROM global_params WHERE project_id = ?', project_id)).forEach((item) => {
				// 0-Header，1-Cookie，2-Query
				if (item.father_type === 0) {
					Header.push({
						key: item.param_name,
						value: typeof item.param_value === 'string' ? JSON.parse(item.param_value).value : item.param_value,
					});
				}
				if (item.father_type === 1) {
					Cookies.push({
						key: item.param_name,
						value: typeof item.param_value === 'string' ? JSON.parse(item.param_value).value : item.param_value,
					});
				}
				if (item.father_type === 2) {
					Params.push({
						key: item.param_name,
						value: typeof item.param_value === 'string' ? JSON.parse(item.param_value).value : item.param_value,
					});
				}
			});

			// 5. 通过axios向指定的url发送请求
			if (env_baseurl !== process.env.MOCK_URL) {
				const axiosConfig: AxiosRequestConfig = {
					method: api_method,
					url: env_baseurl + api_url,
					params: Params.reduce((acc: any, cur) => {
						acc[cur.key] = cur.value;
						return acc;
					}, {}),
					data: {},
					headers: Header.reduce((acc: any, cur) => {
						acc[cur.key] = cur.value;
						return acc;
					}, {}),
					withCredentials: true,
				};

				// 如果为POST请求，那么需要对data进行处理并设置Content-Type(请求体格式)
				if (api_method === 'POST') {
					if (Body_formData.length > 0) {
						axiosConfig.data = qs.stringify(
							Body_formData.reduce((acc: any, cur) => {
								acc[cur.key] = cur.value;
								return acc;
							}, {})
						);
						axiosConfig.headers!['Content-Type'] = 'multipart/form-data';
					}
					if (Body_wwwFormUrlencoded.length > 0) {
						axiosConfig.data = qs.stringify(
							Body_wwwFormUrlencoded.reduce((acc: any, cur) => {
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

				const data = (await axios(axiosConfig)).data;

				// 6. 将结果返回
				res.status(200).json({
					result_code: 0,
					result_msg: 'api run success',
					result: {
						axiosConfig,
						data,
					},
				});
			} else {
				// 获取到api的reponse_body
				const { response_body } = (
					await queryPromise<{ response_body: string }[]>('SELECT response_body FROM api_responses WHERE api_id = ?', api_id)
				)[0];

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
				const data = (await axios(axiosConfig)).data;
				res.status(200).json({
					result_code: 0,
					result_msg: 'api run success',
					result: {
						axiosConfig,
						data,
					},
				});
			}
		} catch (error: any) {
			res.status(500).json({
				result_code: 1,
				result_msg: error.message || 'An error occurred',
			});
		}
	};
}

export const apisController = new ApisController();
