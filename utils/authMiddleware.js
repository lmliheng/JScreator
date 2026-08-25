const { tokenValidator } = require('./token_creator');

/**
 * 鉴权中间件：解析 Authorization: Bearer <token>
 * 成功：req.user = decoded（含 id、role_id）
 * 失败：返回 401
 */
const verifyToken = (req, res, next) => {
    const token = req.headers.authorization;
    const decoded = tokenValidator(token);
    if (decoded === null) {
        return res.status(401).json({
            code: 401,
            success: false,
            message: '未登录或登录过期'
        });
    }
    req.user = decoded;
    next();
};

/**
 * 角色校验中间件：requireRole(1, 3) 表示只允许 role_id 为 1 或 3 的用户
 * 需在 verifyToken 之后调用（依赖 req.user）
 * 无权限：返回 403
 */
const requireRole = (...roleIds) => {
    return (req, res, next) => {
        if (!req.user || !roleIds.includes(Number(req.user.role_id))) {
            return res.status(403).json({
                code: 403,
                success: false,
                message: '权限不足'
            });
        }
        next();
    };
};

module.exports = { verifyToken, requireRole };
