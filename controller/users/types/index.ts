// controller/users/types/index.ts
// 用来存放所有与user相关的类型定义

/* ----------请求体定义---------- */
/**
 * 发送验证码请求体
 */
export interface SendCaptchaReqBody {
	/**
	 * 邮箱地址
	 */
	email: string;
}
/**
 * 注册请求体
 */
export interface RegisterReqBody {
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
export interface LoginReqBody {
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
export interface ModifyUserInfoReqBody {
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
}
/**
 * 搜索用户请求体
 */
export interface SearchUserReqBody {
	/**
	 * 用户名
	 */
	username: string;
}
/**
 * 修改密码请求体
 */
export interface ModifyPasswordReqBody {
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
export interface ModifyEmailReqBody {
	/**
	 * 验证码
	 */
	captcha: string;
	/**
	 * 新邮箱地址
	 */
	newEmail: string;
}

/* ----------返回数据体定义---------- */

/* ----------数据库表定义---------- */
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
