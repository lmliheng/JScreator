import { createApp } from 'vue'
import App from './App.vue'
import ElementPlus from 'element-plus'
import print from 'vue3-print-nb'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import 'element-plus/dist/index.css'
import router from './router/index'
import { createPinia } from 'pinia'
import './router/NavigationGuards'
import './asset/main.css'
import i18n from './i18n/index'

const app = createApp(App)
const pinia = createPinia()

pinia.use(piniaPluginPersistedstate)
app.use(pinia)
app.use(print)
app.use(router)
app.use(ElementPlus)
app.use(i18n)
app.mount('#app')
