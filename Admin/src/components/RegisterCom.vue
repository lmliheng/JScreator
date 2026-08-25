<script setup>
import { reactive, ref, onBeforeUnmount } from 'vue'
import { register, sendEmailCode, emailLogin } from '../composables/useRequest'
import { useRouter } from 'vue-router'
import { api } from '../composables/useAxiosConfig'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '../store/auth'
import { Message } from '@element-plus/icons-vue'

const router = useRouter()
const authStore = useAuthStore()

const mode = ref('password') // 'password' | 'email'

// 密码注册
const loading = ref(false)
const ruleForm = reactive({
    username: '',
    email: '',
    password: '',
    confirm: ''
})

// 邮箱验证码注册
const emailForm = reactive({
    email: '',
    code: ''
})
const emailLoading = ref(false)
const sending = ref(false)
const countdown = ref(0)
let sendTimer = null

const submitForm = async () => {
    if (!ruleForm.username || !ruleForm.email || !ruleForm.password) {
        ElMessage.warning('请完整填写注册信息')
        return
    }
    if (ruleForm.password !== ruleForm.confirm) {
        ElMessage.warning('两次输入的密码不一致')
        return
    }
    loading.value = true
    try {
        const res = await register({
            username: ruleForm.username,
            email: ruleForm.email,
            password: ruleForm.password
        })
        if (res.code === 200) {
            ElMessage.success('注册成功')
            if (res.token) {
                authStore.setToken(res.token)
                authStore.setTokenTime(new Date().toLocaleString())
            }
            router.push('/')
        } else {
            ElMessage.error(res.message || '注册失败')
        }
    } catch (e) {
        ElMessage.error('注册失败')
    } finally {
        loading.value = false
    }
}

async function sendCode() {
    if (!emailForm.email.trim()) {
        ElMessage.warning('请输入邮箱')
        return
    }
    if (countdown.value > 0) return
    sending.value = true
    try {
        await sendEmailCode(emailForm.email.trim())
        ElMessage.success('验证码已发送，请查收邮件')
        countdown.value = 60
        sendTimer = setInterval(() => {
            countdown.value--
            if (countdown.value <= 0) clearInterval(sendTimer)
        }, 1000)
    } catch (e) {
        ElMessage.error('发送失败')
    } finally {
        sending.value = false
    }
}

async function submitEmail() {
    if (!emailForm.email.trim() || !emailForm.code.trim()) {
        ElMessage.warning('请输入邮箱和验证码')
        return
    }
    emailLoading.value = true
    try {
        const res = await emailLogin(emailForm.email.trim(), emailForm.code.trim())
        if (res.code === 200) {
            authStore.setToken(res.token)
            authStore.setTokenTime(new Date().toLocaleString())
            ElMessage.success('注册成功')
            router.push('/')
        } else {
            ElMessage.error(res.message || '注册失败')
        }
    } catch (e) {
        ElMessage.error('注册失败')
    } finally {
        emailLoading.value = false
    }
}

// 邮箱图标 toggle：password <-> email
function toggleEmail() {
    mode.value = mode.value === 'email' ? 'password' : 'email'
}

const API_BASE = api.defaults.baseURL

function githubRegister() {
    const redirect = window.location.origin + '/#/auth'
    window.location.href = API_BASE + '/auth/github?redirect=' + encodeURIComponent(redirect)
}

onBeforeUnmount(() => {
    if (sendTimer) clearInterval(sendTimer)
})
</script>

<template>
    <div v-loading="loading || emailLoading">
        <h1 style="text-align: center;">注册</h1>

        <div id="register-form">
            <!-- 密码注册 -->
            <el-form v-if="mode === 'password'" :model="ruleForm" label-width="70px">
                <el-form-item label="用户名">
                    <el-input v-model="ruleForm.username" placeholder="用户名"></el-input>
                </el-form-item>
                <el-form-item label="邮箱">
                    <el-input v-model="ruleForm.email" placeholder="you@example.com"></el-input>
                </el-form-item>
                <el-form-item label="密码">
                    <el-input v-model="ruleForm.password" type="password" show-password placeholder="密码"></el-input>
                </el-form-item>
                <el-form-item label="确认">
                    <el-input v-model="ruleForm.confirm" type="password" show-password placeholder="确认密码"></el-input>
                </el-form-item>
                <el-button type="primary" @click="submitForm" style="width: 300px;">注册</el-button>
            </el-form>

            <!-- 邮箱验证码注册 -->
            <el-form v-else :model="emailForm" label-width="70px">
                <el-form-item label="邮箱">
                    <el-input v-model="emailForm.email" placeholder="you@example.com"></el-input>
                </el-form-item>
                <el-form-item label="验证码">
                    <div style="display: flex; gap: 8px; width: 100%;">
                        <el-input v-model="emailForm.code" placeholder="请输入 6 位数字" maxlength="6" style="flex: 1;"></el-input>
                        <el-button :disabled="sending || countdown > 0" @click="sendCode">
                            {{ countdown > 0 ? countdown + 's' : (sending ? '发送中…' : '发送验证码') }}
                        </el-button>
                    </div>
                </el-form-item>
                <el-button type="primary" @click="submitEmail" style="width: 300px;">注册</el-button>
            </el-form>

            <!-- 底部图标：邮箱 + GitHub -->
            <div class="social-login">
                <el-tooltip content="邮箱注册" placement="top">
                    <el-button circle :type="mode === 'email' ? 'primary' : 'default'" @click="toggleEmail">
                        <el-icon><Message /></el-icon>
                    </el-button>
                </el-tooltip>
                <el-tooltip content="GitHub 注册" placement="top">
                    <el-button circle @click="githubRegister">
                        <svg class="gh-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.7-3.88-1.54-3.88-1.54-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.69 1.25 3.35.95.1-.74.4-1.25.72-1.54-2.55-.29-5.23-1.28-5.23-5.68 0-1.26.45-2.29 1.18-3.09-.12-.29-.51-1.46.11-3.05 0 0 .96-.31 3.15 1.18a10.9 10.9 0 0 1 5.74 0c2.19-1.49 3.15-1.18 3.15-1.18.62 1.59.23 2.76.11 3.05.73.8 1.18 1.83 1.18 3.09 0 4.41-2.69 5.38-5.25 5.67.41.35.78 1.05.78 2.12 0 1.53-.01 2.76-.01 3.14 0 .31.21.67.8.56A11.52 11.52 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z" />
                        </svg>
                    </el-button>
                </el-tooltip>
            </div>
        </div>
    </div>
</template>

<style scoped>
#register-form {
    display: flex;
    flex-direction: column;
    align-items: center;
}

.social-login {
    display: flex;
    gap: 12px;
    justify-content: center;
    margin-top: 16px;
}

.gh-icon {
    width: 18px;
    height: 18px;
}
</style>
