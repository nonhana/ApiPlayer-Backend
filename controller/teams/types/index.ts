// controller/teams/types/index.ts
// 用来存放所有与team相关的类型定义

/* ----------请求体定义---------- */
/**
 * 团队id
 */
export interface TeamId {
	/**
	 * 团队id
	 */
	team_id: number;
}
/**
 * 新建团队请求体
 */
export interface CreateTeamReqBody {
	/**
	 * 团队名称
	 */
	team_name: string;
	/**
	 * 团队描述
	 */
	team_desc: string;
	/**
	 * 用户在团队中的名称
	 */
	team_user_name: string;
}
/**
 * 更新团队信息请求体
 */
export interface UpdateTeamInfoReqBody {
	/**
	 * 团队描述
	 */
	team_desc: string;
	/**
	 * 团队id
	 */
	team_id: number;
	/**
	 * 团队名称
	 */
	team_name: string;
	/**
	 * 团队里面用户的名称
	 */
	team_user_name: string;
	/**
	 * 用户id
	 */
	user_id: number;
}
/**
 * 邀请用户加入团队请求体
 */
export interface InviteUserReqBody {
	/**
	 * 团队id
	 */
	team_id: number;
	/**
	 * 用户id
	 */
	user_id: number;
	/**
	 * 用户在团队中的名称
	 */
	team_user_name: string;
}
/**
 * 设置成员权限请求体
 */
export interface SetMemberIdentityReqBody {
	/**
	 * 团队id
	 */
	team_id: number;
	/**
	 * 用户在团队中的身份
	 */
	team_user_identity: number;
	/**
	 * 用户在团队中的用户名
	 */
	team_user_name: string;
	/**
	 * 用户id
	 */
	user_id: number;
	/**
	 * 用户的对这个团队项目的权限列表
	 */
	team_project_indentity_list: {
		/**
		 * 项目id
		 */
		project_id: string;
		/**
		 * 项目权限，0-管理员，1-编辑者，2-只读成员，3-禁止访问
		 */
		project_user_identity: number;
	}[];
}
/**
 * 移除某成员请求体
 */
export interface RemoveMemberReqBody {
	/**
	 * 团队id
	 */
	team_id: number;
	/**
	 * 用户id
	 */
	user_id: number;
}

/* ----------返回数据体定义---------- */
/**
 * 团队列表item信息
 */
export interface TeamItem {
	/**
	 * 团队id
	 */
	team_id: number;
	/**
	 * 团队名称
	 */
	team_name: string;
	/**
	 * 团队描述
	 */
	team_desc: string;
	/**
	 * 用户在团队中的身份
	 */
	team_user_identity?: number;
}
/**
 * 团队成员item信息
 */
export interface TeamMemberItem {
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
	/**
	 * 用户邮箱
	 */
	email: string;
	/**
	 * 用户在团队中的名称
	 */
	team_user_name: string;
	/**
	 * 用户在团队中的身份
	 */
	team_user_identity: number;
}
/**
 * 团队项目item信息
 */
export interface TeamProjectItem {
	/**
	 * 项目id
	 */
	project_id: number;
	/**
	 * 项目名称
	 */
	project_name: string;
	/**
	 * 项目图片
	 */
	project_img: string;
}
/**
 * 团队项目成员item信息
 */
export interface TeamProjectMemberItem {
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
	/**
	 * 用户邮箱
	 */
	email: string;
	/**
	 * 用户在项目中的身份
	 */
	project_user_identity: number;
}

/* ----------数据库表定义---------- */
