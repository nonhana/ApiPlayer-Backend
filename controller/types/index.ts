// controller/types/index.ts
// 用来存放所有接口共用的类型定义

/* ---------- 逻辑类型定义 ---------- */
/**
 * 用户id
 */
export interface UserId {
	/**
	 * 用户id
	 */
	user_id: number;
}
/**
 * 接口id
 */
export interface ApiId {
	/**
	 * 接口id
	 */
	api_id: number;
}
/**
 * Api目录列表item
 */
export interface ApiListItem {
	/**
	 * 接口id
	 */
	id: number;
	/**
	 * 接口名称
	 */
	label: string;
	/**
	 * 接口类型
	 */
	type: 'dictionary' | 'GET' | 'POST' | 'PUT' | 'DELETE';
	/**
	 * 如果是目录，children属性存放子目录列表；如果是接口，children是空数组
	 */
	children: ApiListItem[];
}
/**
 * Api请求参数列表
 */
export interface ApiRequestParam {
	/**
	 * 0-Params，1-Body(form-data)，2-Body(x-www-form-unlencoded)，3-Cookie，4-Header
	 */
	type: number;
	params_list: ParamsList[];
}
/**
 * 参数列表item
 */
interface ParamsList {
	param_desc: string;
	param_name: string;
	param_type: number;
	param_value?: string | number;
}
/**
 * Api返回体结构
 */
export interface ApiResponse {
	http_status: number;
	response_body: string;
	response_name: string;
}

/* ---------- 数据库表定义 ---------- */
/**
 * 最近访问项目表
 */
export interface RecentlyVisitedTable {
	/**
	 * 用户id
	 */
	user_id: number;
	/**
	 * 项目id
	 */
	project_id: number;
	/**
	 * 最近访问时间
	 */
	last_access_time: string;
}
/**
 * 接口目录表
 */
export interface DistionarieTable {
	/**
	 * 目录id
	 */
	dictionary_id: number;
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
 * 接口表
 */
export interface ApisTable {
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
	 * 接口名称
	 */
	api_name: string;
	/**
	 * 接口方法
	 */
	api_method: 'dictionary' | 'GET' | 'POST' | 'PUT' | 'DELETE';
	/**
	 * 接口路径
	 */
	api_url: string;
	/**
	 * 接口状态
	 */
	api_status: number;
	/**
	 * 接口描述
	 */
	api_desc: string;
	/**
	 * 接口负责人id
	 */
	api_principal_id: number;
	/**
	 * 接口编辑人id
	 */
	api_editor_id: number;
	/**
	 * 接口创建人id
	 */
	api_creator_id: number;
	/**
	 * 接口修改时间
	 */
	api_editedAt: string;
	/**
	 * 接口版本号
	 */
	version_id: number;
	/**
	 * 软删除的删除状态。如果为0，标记为未删除；如果为1，标记为删除。
	 */
	delete_status: number;
}
/**
 * 项目表
 */
export interface ProjectsTable {
	/**
	 * 项目id
	 */
	project_id: number;
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
	/**
	 * 项目当前环境类型。0~3：开发环境、测试环境、正式环境、mock.js环境
	 */
	project_current_type: number;
}
/**
 * 全局参数表
 */
export interface GlobalParamsTable {
	/**
	 * 参数id
	 */
	param_id: number;
	/**
	 * 项目id
	 */
	project_id: number;
	/**
	 * 参数所属的类型。0-Header，1-Cookie，2-Query
	 */
	father_type: number;
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
}
/**
 * 全局变量表
 */
export interface GlobalVariablesTable {
	/**
	 * 变量id
	 */
	variable_id: number;
	/**
	 * 项目id
	 */
	project_id: number;
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
}
/**
 * 版本表
 */
export interface VersionsTable {
	/**
	 * 版本id
	 */
	version_id: number;
	/**
	 * 项目id
	 */
	project_id: number;
	/**
	 * 用户id
	 */
	user_id: number;
	/**
	 * 版本更新的类型。
	 * 0-接口基本信息更新；1-接口返回体更新；2-接口请求参数更新；3-接口请求体(Body-JSON)更新；4-新增接口；5-删除接口。如果涉及到多个内容的更新，采用'0,1,...'这样的形式进行拼接。
	 */
	version_type: string;
	/**
	 * 当前版本对应的内容修改信息
	 */
	version_msg: string;
	/**
	 * 该版本创建的时间
	 */
	createdAt: string;
}
/**
 * api备份表
 */
export interface ApiBackupTable extends ApisTable {
	/**
	 * 备份id
	 */
	backup_id: number;
}
/**
 * api返回体表
 */
export interface ApiResponsesTable extends ApiResponse {
	/**
	 * 返回体id
	 */
	response_id: number;
	/**
	 * 接口id
	 */
	api_id: number;
	/**
	 * 版本id
	 */
	version_id: number;
	/**
	 * 软删除的删除状态。如果为0，标记为未删除；如果为1，标记为删除。
	 */
	delete_status: number;
}
/**
 * api请求参数表
 */
export interface ApiRequestParamsTable {
	/**
	 * 参数id
	 */
	param_id: number;
	/**
	 * 接口id
	 */
	api_id: number;
	/**
	 * 参数所属的类型。0-Params，1-Body(form-data)，2-Body(x-www-form-unlencoded)，3-Cookie，4-Header
	 */
	param_class: number;
	/**
	 * 参数名称
	 */
	param_name: string;
	/**
	 * 参数本身的类型。0-number，1-integer，2-string
	 */
	param_type: number;
	/**
	 * 参数描述
	 */
	param_desc: string;
	/**
	 * 版本号
	 */
	version_id: number;
	/**
	 * 软删除的删除状态。如果为0，标记为未删除；如果为1，标记为删除。
	 */
	delete_status: number;
}
/**
 * api请求体（Body-JSON）表
 */
export interface ApiRequestJSONTable {
	/**
	 * 请求体id
	 */
	JSON_id: number;
	/**
	 * 接口id
	 */
	api_id: number;
	/**
	 * 请求体JSON字符串
	 */
	JSON_body: string;
	/**
	 * 版本号
	 */
	verion_id: number;
	/**
	 * 软删除的删除状态。如果为0，标记为未删除；如果为1，标记为删除。
	 */
	delete_status: number;
}
/**
 * 用户表
 */
export interface UsersTable {
	/**
	 * 用户id
	 */
	user_id: number;
	/**
	 * 用户名
	 */
	username: string;
	/**
	 * 密码
	 */
	password: string;
	/**
	 * 邮箱地址
	 */
	email: string;
	/**
	 * 用户介绍
	 */
	introduce: string;
	/**
	 * 用户头像
	 */
	avatar: string;
	/**
	 * 创建时间
	 */
	createdAt: string;
	/**
	 * 更新时间
	 */
	updatedAt: string;
}
