// import { useAuthStore } from '../store/auto'
import router from './index'
import { useAuthStore } from '@/store/auth'
import { requestUserInfo } from '@/composables/useRequest'
import { ElMessage } from 'element-plus'

// 从 userInfo 中取 role_id。
// /sys/profile 返回的 user_info 结构为 { user_detail: { role_id, role_name, ... }, user_permission: [...] }
const getRoleId = (userInfo) => {
    const id = userInfo?.user_detail?.role_id
    if (id === undefined || id === null || id === '') return null
    return Number(id)
}

// 判断当前用户角色是否在允许的角色列表内；roles 为空/未定义表示不限制
const hasRole = (userInfo, roles) => {
    if (!Array.isArray(roles) || roles.length === 0) return true
    const roleId = getRoleId(userInfo)
    if (roleId === null) return false
    return roles.includes(roleId)
}

router.beforeEach(async (to, from, next) => {
    //const authStore = useAuthStore() // 在导航时调用，避免加载router配置后立即调用
    // 为什么这里使用store token ，一刷新就会回到登录页 ，也就是没拿到token
    const whiteList = ['/auth']

    // 读取持久化的 auth（pinia-plugin-persistedstate 会存到 localStorage['auth']）
    let auth = null
    try {
        auth = JSON.parse(localStorage.getItem('auth'))
    } catch (e) {
        auth = null
    }
    const token = auth?.token

    if (!token) {
        if (whiteList.includes(to.path)) {
            next()
        } else {
            next('/auth')
        }
        return
    }

    // 已登录访问登录页 → 回首页
    if (to.path === '/auth') {
        next('/')
        return
    }

    // ===== 角色权限校验 =====
    const roles = to.meta?.roles
    if (Array.isArray(roles) && roles.length > 0) {
        const authStore = useAuthStore()
        let userInfo = authStore.userInfo

        // 刷新后 store 可能是空的（userInfo 尚未拉取），尝试从 /sys/profile 拉一次
        if (!userInfo || !userInfo.user_detail) {
            try {
                const res = await requestUserInfo()
                if (res && res.code === 200 && res.user_info) {
                    authStore.setUserInfo(res.user_info)
                    userInfo = res.user_info
                }
            } catch (e) {
                // 拉取失败按无角色处理（下方会被拒绝并重定向）
            }
        }

        if (!hasRole(userInfo, roles)) {
            ElMessage.warning('没有访问该页面的权限')
            next('/')
            return
        }
    }

    next()
})
