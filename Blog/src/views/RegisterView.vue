<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'

const router = useRouter()
const auth = useAuthStore()
const toast = useToastStore()

const username = ref('')
const email = ref('')
const password = ref('')
const confirm = ref('')
const loading = ref(false)

async function submit() {
  if (!username.value.trim() || !email.value.trim() || !password.value) {
    toast.error('请完整填写注册信息')
    return
  }
  if (password.value !== confirm.value) {
    toast.error('两次输入的密码不一致')
    return
  }
  loading.value = true
  try {
    await auth.register({
      username: username.value.trim(),
      email: email.value.trim(),
      password: password.value,
    })
    toast.success('注册成功')
    router.push('/')
  } catch (e) {
    toast.error(e.message || '注册失败')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-md px-4 py-12">
    <div class="card">
      <h1 class="text-2xl font-bold text-ink">注册</h1>
      <p class="mt-2 text-sm text-muted">创建账号后即可发表评论、撰写文章。</p>

      <form class="mt-6 space-y-4" @submit.prevent="submit">
        <div>
          <label class="field-label" for="username">用户名</label>
          <input id="username" v-model="username" type="text" autocomplete="username" class="input" placeholder="你的用户名" />
        </div>
        <div>
          <label class="field-label" for="email">邮箱</label>
          <input id="email" v-model="email" type="email" autocomplete="email" class="input" placeholder="you@example.com" />
        </div>
        <div>
          <label class="field-label" for="password">密码</label>
          <input id="password" v-model="password" type="password" autocomplete="new-password" class="input" placeholder="••••••••" />
        </div>
        <div>
          <label class="field-label" for="confirm">确认密码</label>
          <input id="confirm" v-model="confirm" type="password" autocomplete="new-password" class="input" placeholder="再次输入密码" />
        </div>
        <button type="submit" class="btn-accent w-full disabled:opacity-60" :disabled="loading">
          {{ loading ? '注册中…' : '注册' }}
        </button>
      </form>

      <p class="mt-6 text-center text-sm text-body">
        已有账号？
        <RouterLink to="/login" class="text-accent hover:text-accent-strong">去登录</RouterLink>
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
