// utils/constants.ts
// 用于存放项目中遇到的所有常量，包括枚举、类型别名等

// 项目权限枚举：0-管理员，1-编辑者，2-只读成员，3-禁止访问
export enum ProjectPermission {
	ADMIN = 0,
	EDITOR = 1,
	READER = 2,
	FORBIDDEN = 3,
}
