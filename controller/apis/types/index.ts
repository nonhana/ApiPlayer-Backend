// controller/apis/types/index.ts
// 用来存放所有与api相关的类型定义
import type { ApiRequestParam } from '../../types';

/* ----------请求体定义---------- */
/**
 * 新增接口请求体
 */
export interface AddApiReq {
	/**
	 * 接口所属的目录id
	 */
	dictionary_id: number;
	/**
	 * 接口所属的项目id
	 */
	project_id: number;
	/**
	 * 接口的创建者id
	 */
	api_creator_id: number;
	/**
	 * 接口的编辑者id
	 */
	api_editor_id: number;
}
/**
 * 删除接口请求体
 */
export interface DeleteApiReq {
	/**
	 * 接口id
	 */
	api_id: number;
	/**
	 * 接口所属的项目id
	 */
	project_id: number;
}
/**
 * 更新接口请求体
 */
export interface UpdateApiReq {
	/**
	 * 接口id
	 */
	api_id: number;
	/**
	 * 项目id
	 */
	project_id: number;
	/**
	 * 目录id
	 */
	dictionary_id: number;
	/**
	 * 接口的基本信息
	 */
	basic_info: {
		/**
		 * 接口名称
		 */
		api_name: string;
		/**
		 * 接口url
		 */
		api_url: string;
		/**
		 * 接口请求的方法
		 */
		api_method: 'GET' | 'POST' | 'PUT' | 'DELETE';
		/**
		 * 接口的状态。0-开发中，1-测试中，2-已发布，3-将废弃
		 */
		api_status: number;
		/**
		 * 接口负责人id
		 */
		api_principal_id: number;
		/**
		 * 接口编辑人id
		 */
		api_editor_id: number;
		/**
		 * 接口描述
		 */
		api_desc: string;
	};
	/**
	 * 接口请求参数
	 */
	api_request_params: ApiRequestParam[];
	/**
	 * 接口请求体（Body-JSON）
	 */
	api_request_JSON: string;
	/**
	 * 接口返回响应体列表
	 */
	api_responses: {
		response_id: number;
		http_status: number;
		response_body: string;
		response_name: string;
	}[];
}
/**
 * 运行接口请求体
 */
export interface RunApiReq {
	/**
	 * 发送请求的本机ip
	 */
	local_ip: string;
	/**
	 * 接口id
	 */
	api_id: number;
	/**
	 * 接口请求参数
	 */
	api_request_params: ApiRequestParam[];
	/**
	 * 接口请求体（Body-JSON）
	 */
	api_request_JSON: string;
}
