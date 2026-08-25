<script setup>
import { ref } from 'vue'
import LoginCom from '../components/LoginCom.vue'
import RegisterCom from '../components/RegisterCom.vue'
const isLogin = ref(true)
</script>

<template>
    <div id="auth_container">
        <div id="auth_card">
            <LoginCom v-if="isLogin"></LoginCom>
            <RegisterCom v-else></RegisterCom>
            <div class="auth-switch">
                <el-button text type="primary" @click="isLogin = !isLogin">
                    {{ isLogin ? '没有账号？去注册' : '已有账号？去登录' }}
                </el-button>
            </div>
        </div>
    </div>
</template>

<style scoped>
#auth_container {
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: flex-start;
    padding-top: 60px;
}

#auth_card {
    width: 360px;
}

.auth-switch {
    text-align: center;
    margin-top: 12px;
}
</style>
