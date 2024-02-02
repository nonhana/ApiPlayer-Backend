// controller/users/types/index.ts
// 用来存放所有与user相关的类型定义

/* ----------请求体定义---------- */
/**
 * 发送验证码请求体
 */
export interface SendCaptchaReq {
	/**
	 * 邮箱地址
	 */
	email: string;
}
/**
 * 注册请求体
 */
export interface RegisterReq {
	/**
	 * 邮箱地址
	 */
	email: string;
	/**
	 * 邮箱验证码
	 */
	captcha: string;
	/**
	 * 密码
	 */
	password: string;
}
/**
 * 登录请求体
 */
export interface LoginReq {
	/**
	 * 邮箱地址
	 */
	email: string;
	/**
	 * 密码
	 */
	password: string;
}
/**
 * 修改用户信息请求体
 */
export interface ModifyUserInfoReq {
	/**
	 * 用户名
	 */
	username?: string;
	/**
	 * 用户介绍
	 */
	introduce?: string;
	/**
	 * 用户头像
	 */
	avatar?: string;
	/**
	 * 用户邮箱
	 */
	email?: string;
}
/**
 * 搜索用户请求体
 */
export interface SearchUserReq {
	/**
	 * 用户名
	 */
	username: string;
}
/**
 * 修改密码请求体
 */
export interface ModifyPasswordReq {
	/**
	 * 验证码
	 */
	captcha: string;
	/**
	 * 新密码
	 */
	newPassword: string;
}
/**
 * 修改邮箱请求体
 */
export interface ModifyEmailReq {
	/**
	 * 验证码
	 */
	captcha: string;
	/**
	 * 新邮箱地址
	 */
	newEmail: string;
}
