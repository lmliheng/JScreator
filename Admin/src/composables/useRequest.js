import { api } from './useAxiosConfig'
import md5 from 'md5'
export const login = (account, password) => api({
    url: '/sys/login',
    method: 'post',
    data: {
        username: account,
        password: password
        //md5(password)
    }
})

// 注册
export const register = (data) => api({
    url: '/sys/register',
    method: 'post',
    data
})

// 发送邮箱验证码
export const sendEmailCode = (email) => api({
    url: '/email/send-code',
    method: 'post',
    data: { email }
})

// 邮箱验证码登录
export const emailLogin = (email, code) => api({
    url: '/email/login',
    method: 'post',
    data: { email, code }
})

export const requestUserInfo = () => api({
    url: '/sys/profile',
    method: 'get'
})


export const requestUser = (params) => api({
    url: '/user-manage/list',
    method: 'get',
    params
})

export const requestUserDetail = (id) => api({
    url: `/user-manage/detail/${id}`,
    method: 'get'
})


export const requestRoleList = () => api({
    url: `/role/list`,
    method: 'get'
})

export const requestPermissionList = () => api({
    url: `/permission/list`,
    method: 'get'
})


// ============ 用户管理（管理员） ============
export const requestUserAdd = (data) => api({
    url: '/user-manage/add',
    method: 'post',
    data
})

export const requestUserUpdate = (data) => api({
    url: '/user-manage/update',
    method: 'put',
    data
})

// 管理员更新用户完整信息（含 vip、area、bio、name、checkinDay 等扩展字段）
export const requestUpdateUserFull = (data) => api({
    url: '/user-manage/update',
    method: 'put',
    data
})

// 管理员重置用户密码
export const requestUserResetPassword = (data) => api({
    url: '/user-manage/reset-password',
    method: 'put',
    data
})

export const requestUserDelete = (id) => api({
    url: '/user-manage/delete',
    method: 'delete',
    data: { id }
})

// 批量删除用户
export const requestUserDeleteBatch = (ids) => api({
    url: '/user-manage/delete-batch',
    method: 'post',
    data: { ids }
})

// 本人更新资料（用户名/邮箱）
export const requestSelfUpdate = (data) => api({
    url: '/userInfo',
    method: 'put',
    data
})

// 获取某用户已发布的文章列表（主页精选文章选择用，公开接口）
export const requestBlogArticles = (username, params) => api({
    url: `/blog/articles/${username}`,
    method: 'get',
    params
})

// 获取某用户的公开主页信息（含 socials / featured_articles）
export const requestBlogProfile = (username) => api({
    url: `/blog/profile/${username}`,
    method: 'get'
})

// 本人重置密码
export const requestSelfResetPassword = (password) => api({
    url: '/resetPassword',
    method: 'post',
    data: { password }
})


// ============ 角色管理 ============
export const requestRoleAdd = (role_name) => api({
    url: '/role/add',
    method: 'post',
    data: { role_name }
})

export const requestRoleUpdate = (role_id, role_name) => api({
    url: '/role/update',
    method: 'put',
    data: { role_id, role_name }
})

export const requestRoleDelete = (role_id) => api({
    url: '/role/delete',
    method: 'delete',
    data: { role_id }
})

export const requestRoleSetPermission = (role_id, permission_id_list) => api({
    url: '/role/setPermission',
    method: 'post',
    data: { role_id, permission_id_list }
})

export const requestRolePermission = (role_id) => api({
    url: `/role/permission/${role_id}`,
    method: 'get'
})


// ============ 权限管理 ============
export const requestPermissionUpdate = (data) => api({
    url: '/permission/update',
    method: 'put',
    data
})


// ============ 文章管理 ============

// 公开文章列表（分页 + 按分类 + 关键词，仅 status=1 已发布）
export const requestArticleList = (params) => api({
    url: '/article/list',
    method: 'get',
    params
})

// 当前用户自己的文章列表（分页，含草稿/仅自己可见）
export const requestArticleMine = (params) => api({
    url: '/article/mine',
    method: 'get',
    params
})

// 文章详情（含作者、分类、正文）
export const requestArticleDetail = (id) => api({
    url: `/article/detail/${id}`,
    method: 'get'
})

// 新增文章
export const requestArticleAdd = (data) => api({
    url: '/article/add',
    method: 'post',
    data
})

// 更新文章
export const requestArticleUpdate = (id, data) => api({
    url: `/article/update/${id}`,
    method: 'put',
    data
})

// 删除文章
export const requestArticleDelete = (id) => api({
    url: `/article/delete/${id}`,
    method: 'delete'
})


// ============ 文章分类管理 ============

// 全部分类
export const requestArticleCategoryList = () => api({
    url: '/article/category/list',
    method: 'get'
})

// 新增分类
export const requestArticleCategoryAdd = (category_name) => api({
    url: '/article/category/add',
    method: 'post',
    data: { category_name }
})

// 更新分类
export const requestArticleCategoryUpdate = (category_id, category_name) => api({
    url: '/article/category/update',
    method: 'put',
    data: { category_id, category_name }
})

// 删除分类
export const requestArticleCategoryDelete = (category_id) => api({
    url: '/article/category/delete',
    method: 'delete',
    data: { category_id }
})


// ============ 通知系统 ============

// 管理员发布通知
export const requestNotificationAdd = (data) => api({
    url: '/notification/add',
    method: 'post',
    data
})

// 当前用户收到的通知列表
export const requestNotificationList = () => api({
    url: '/notification/list',
    method: 'get'
})

// 当前用户未读数
export const requestNotificationUnreadCount = () => api({
    url: '/notification/unread-count',
    method: 'get'
})

// 标记已读
export const requestNotificationRead = (notification_id) => api({
    url: '/notification/read',
    method: 'post',
    data: { notification_id }
})

// 管理员更新通知
export const requestNotificationUpdate = (data) => api({
    url: '/notification/update',
    method: 'put',
    data
})

// 管理员删除通知
export const requestNotificationDelete = (notification_id) => api({
    url: '/notification/delete',
    method: 'delete',
    data: { notification_id }
})

// ============ 系统监控（仅管理员） ============

export const requestSystemMonitor = () => api({
    url: '/system-monitor',
    method: 'get'
})

// 接口调用统计
export const requestApiStats = () => api({
    url: '/system-monitor/api-stats',
    method: 'get'
})

// ============ 评论管理（仅管理员） ============

export const requestCommentManageList = (params) => api({
    url: '/comment/manage/list',
    method: 'get',
    params
})

export const requestCommentManageUpdate = (data) => api({
    url: '/comment/manage/update',
    method: 'put',
    data
})

export const requestCommentManageDelete = (comment_ids) => api({
    url: '/comment/manage/delete',
    method: 'delete',
    data: { comment_ids }
})

// ============ 互动管理（点赞 / 收藏，仅 admin） ============
export const requestLikeManageList = (params) => api({
    url: '/social/admin/likes',
    method: 'get',
    params
})

export const requestLikeManageDelete = (id) => api({
    url: `/social/admin/likes/${id}`,
    method: 'delete'
})

export const requestFavoriteManageList = (params) => api({
    url: '/social/admin/favorites',
    method: 'get',
    params
})

export const requestFavoriteManageDelete = (id) => api({
    url: `/social/admin/favorites/${id}`,
    method: 'delete'
})

// ============ 广告管理（仅 admin） ============
export const requestAdList = (params) => api({
    url: '/ad/admin/list',
    method: 'get',
    params
})

export const requestAdDetail = (id) => api({
    url: `/ad/admin/detail/${id}`,
    method: 'get'
})

export const requestAdAdd = (data) => api({
    url: '/ad/admin/add',
    method: 'post',
    data
})

export const requestAdUpdate = (id, data) => api({
    url: `/ad/admin/update/${id}`,
    method: 'put',
    data
})

export const requestAdStatus = (id, status) => api({
    url: `/ad/admin/status/${id}`,
    method: 'put',
    data: { status }
})

export const requestAdDelete = (id) => api({
    url: `/ad/admin/delete/${id}`,
    method: 'delete'
})

// ============ 公告管理（仅 admin） ============
export const requestAnnounceList = (params) => api({
    url: '/announcement/admin/list',
    method: 'get',
    params
})

export const requestAnnounceAdd = (data) => api({
    url: '/announcement/admin/add',
    method: 'post',
    data
})

export const requestAnnounceUpdate = (id, data) => api({
    url: `/announcement/admin/update/${id}`,
    method: 'put',
    data
})

export const requestAnnounceStatus = (id, status) => api({
    url: `/announcement/admin/status/${id}`,
    method: 'put',
    data: { status }
})

export const requestAnnounceDelete = (id) => api({
    url: `/announcement/admin/delete/${id}`,
    method: 'delete'
})