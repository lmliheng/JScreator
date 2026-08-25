<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const toast = useToastStore()

const account = ref('')
const password = ref('')
const loading = ref(false)

const expired = ref(route.query.expired === '1')

async function submit() {
  if (!account.value.trim() || !password.value) {
    toast.error('请输入账号和密码')
    return
  }
  loading.value = true
  try {
    await auth.login(account.value.trim(), password.value)
    toast.success('登录成功')
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
    router.push(redirect)
  } catch (e) {
    toast.error(e.message || '登录失败')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-md px-4 py-12">
    <div class="card">
      <h1 class="text-2xl font-bold text-ink">登录</h1>
      <p class="mt-2 text-sm text-muted">使用用户名或邮箱登录。</p>

      <div v-if="expired" class="mt-4 rounded-tag border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
        登录已过期，请重新登录。
      </div>

      <form class="mt-6 space-y-4" @submit.prevent="submit">
        <div>
          <label class="field-label" for="account">用户名 / 邮箱</label>
          <input id="account" v-model="account" type="text" autocomplete="username" class="input" placeholder="admin 或 admin@demo.com" />
        </div>
        <div>
          <label class="field-label" for="password">密码</label>
          <input id="password" v-model="password" type="password" autocomplete="current-password" class="input" placeholder="••••••••" />
        </div>
        <button type="submit" class="btn-accent w-full disabled:opacity-60" :disabled="loading">
          {{ loading ? '登录中…' : '登录' }}
        </button>
      </form>

      <p class="mt-6 text-center text-sm text-body">
        还没有账号？
        <RouterLink to="/register" class="text-accent hover:text-accent-strong">去注册</RouterLink>
      </p>
    </div>
  </div>
</template>

<style scoped>
.field-label {
  display: block;
  margin-bottom: 0.25rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-muted);
}
</style>
