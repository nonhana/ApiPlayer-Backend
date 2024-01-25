// utils/constants.ts
// 用于存放项目中遇到的所有常量，包括枚举、类型别名等

// 团队权限枚举：0-团队所有者，1-团队管理者，2-团队成员，3-游客
export enum TeamPermission {
	OWNER = 0,
	MANAGER = 1,
	MEMBER = 2,
	VISITOR = 3,
}

// 项目权限枚举：0-管理员，1-编辑者，2-只读成员，3-禁止访问
export enum ProjectPermission {
	ADMIN = 0,
	EDITOR = 1,
	READER = 2,
	FORBIDDEN = 3,
}

// 项目开发环境枚举：0-开发环境，1-测试环境，2-正式环境，3-mock.js环境
export enum ProjectEnv {
	DEV = 0,
	TEST = 1,
	PROD = 2,
	MOCK = 3,
}

// 版本更新的类型枚举。0-接口基本信息更新，1-接口返回体更新，2-接口请求参数更新，3-接口请求体(Body-JSON)更新，4-新增接口，5-删除接口。
export enum VersionUpdateType {
	BASIC = '0',
	RES = '1',
	PARAMS = '2',
	BODY = '3',
	ADD = '4',
	DELETE = '5',
}
