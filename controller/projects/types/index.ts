// controller/projects/types/index.ts
// 用来存放所有与project相关的类型定义

/* ----------请求体定义---------- */
/**
 * 新建项目请求体
 * user_id, team_id, ...projectInfo
 */
export interface CreateProjectReq {
	/**
	 * 团队id
	 */
	team_id: number;
	/**
	 * 项目名称
	 */
	project_name: string;
	/**
	 * 项目图标
	 */
	project_img: string;
	/**
	 * 项目描述
	 */
	project_desc: string;
}
/**
 * 项目id
 */
export interface ProjectId {
	/**
	 * 项目id
	 */
	project_id: number;
}
/**
 * 新增目录请求体
 */
export interface AddDictionaryReq {
	/**
	 * 项目id
	 */
	project_id: number;
	/**
	 * 父目录id
	 */
	father_id: number | null;
	/**
	 * 目录名称
	 */
	dictionary_name: string;
}
/**
 * 更新目录请求体
 */
export interface UpdateDictionaryReq {
	/**
	 * 目录id
	 */
	dictionary_id: number;
	/**
	 * 父目录id
	 */
	father_id: number | null;
	/**
	 * 目录名称
	 */
	dictionary_name: string;
}
/**
 * 目录id
 */
export interface DictionaryId {
	/**
	 * 目录id
	 */
	dictionary_id: number;
}
/**
 * 修改项目基本信息请求体
 */
export interface UpdateProjectInfoReq {
	/**
	 * 项目id
	 */
	project_id: number;
	/**
	 * 项目名称
	 */
	project_name: string;
	/**
	 * 项目图标
	 */
	project_img: string;
	/**
	 * 项目描述
	 */
	project_desc: string;
	/**
	 * 项目当前环境类型。0~3：开发环境、测试环境、正式环境、mock.js环境
	 */
	project_current_type: number;
}
/**
 * 更新某个项目的全局信息请求体
 */
export interface UpdateProjectGlobalInfoReq {
	/**
	 * 项目id
	 */
	project_id: number;
	/**
	 * 全局参数列表
	 */
	global_params: {
		/**
		 * 参数父级类型。0-Header，1-Cookie，2-Query
		 */
		type: number;
		/**
		 * 参数列表
		 */
		params_list: GlobalParamsListItem[];
	}[];
	/**
	 * 全局变量列表
	 */
	global_variables: GlobalVariablesListItem[];
	/**
	 * 环境列表
	 */
	env_list: EnvListItem[];
}
/**
 * 回滚项目至指定的版本请求体
 */
export interface RollbackReq {
	/**
	 * 项目id
	 */
	project_id: number;
	/**
	 * 版本id
	 */
	version_id: number;
}
/* ----------返回数据体定义---------- */
/**
 * 项目列表item
 */
export interface ProjectItem {
	/**
	 * 项目id
	 */
	project_id: number;
	/**
	 * 项目名称
	 */
	project_name: string;
	/**
	 * 项目图标
	 */
	project_img: string;
	/**
	 * 项目描述
	 */
	project_desc: string;
}
/**
 * 环境列表item
 */
export interface EnvListItem {
	/**
	 * 环境类型
	 */
	env_type: number;
	/**
	 * 环境基础url
	 */
	env_baseurl: string;
}
/**
 * 全局参数列表item
 */
export interface GlobalParamsListItem {
	/**
	 * 参数id
	 */
	param_id: number;
	/**
	 * 参数名称
	 */
	param_name: string;
	/**
	 * 参数本身的类型。0-number，1-integer，2-string
	 */
	param_type: number;
	/**
	 * 参数值
	 */
	param_value: string | number;
	/**
	 * 参数描述
	 */
	param_desc: string;
	/**
	 * 参数操作类型。0-更新，1-插入，2-删除
	 */
	param_action_type: number;
}
/**
 * 全局变量列表item
 */
export interface GlobalVariablesListItem {
	/**
	 * 变量id
	 */
	variable_id: number;
	/**
	 * 变量名称
	 */
	variable_name: string;
	/**
	 * 变量本身的类型。0-number，1-integer，2-string
	 */
	variable_type: number;
	/**
	 * 变量值
	 */
	variable_value: string | number;
	/**
	 * 变量描述
	 */
	variable_desc: string;
	/**
	 * 变量操作类型。0-更新，1-插入，2-删除
	 */
	variable_action_type: number;
}
/**
 * 用户基本信息
 */
export interface UserInfo {
	/**
	 * 用户id
	 */
	user_id: number;
	/**
	 * 用户名
	 */
	username: string;
	/**
	 * 用户头像
	 */
	avatar: string;
}
