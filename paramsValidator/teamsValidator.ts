import { body, Meta } from 'express-validator';

const atLeastOneOf = (params: string[], _: any, { req }: Meta) => {
	const body = req.body ?? {};
	const hasAtLeastOneParam = params.some((param) => param in body);
	if (!hasAtLeastOneParam) {
		throw new Error('At least one of the specified parameters is required');
	}
	return true;
};

// 验证团队相关的参数
export const teamsValidator = {
	// 添加团队
	['add-team']: [body('team_name').isString().notEmpty(), body('team_desc').isString().notEmpty(), body('team_user_name').isString().notEmpty()],
	// 更新团队信息
	['update-team']: [
		body('team_id').isInt().notEmpty(),
		body('user_id').isInt().optional(),
		body('team_name').isString().optional(),
		body('team_desc').isString().optional(),
		body('team_user_name').isString().optional(),
		body().custom(atLeastOneOf.bind(null, ['team_name', 'team_desc', 'team_user_name'])),
	],
	// 邀请用户进入团队
	['invite-user']: [body('team_id').isInt().notEmpty(), body('user_id').isInt().notEmpty(), body('team_user_name').isString().notEmpty()],
	// 设置团队成员权限
	['set-member-identity']: [
		body('team_id').isInt().notEmpty(),
		body('user_id').isInt().optional(),
		body('team_user_identity').isInt().optional(),
		body('team_user_name').isString().optional(),
		body('team_project_indentity_list').isArray().optional(),
		body().custom(atLeastOneOf.bind(null, ['team_user_identity', 'team_user_name', 'team_project_indentity_list'])),
	],
	// 移除团队成员
	['remove-member']: [body('team_id').isInt().notEmpty(), body('user_id').isInt().notEmpty()],
};
