import { createApp } from 'vue'
import { createPinia } from 'pinia'

// toast.css
import './style/toast.css'

import Popup from '@/components/Popup/index.vue'
import App from './App.vue'
import router from './router'
import directive from '@/directive/lazy.js'

const app = createApp(App)

app.use(createPinia())
app.use(router)
// app.component('SvgIcon'
// app.use(directive), SvgIcon)
app.component('Popup', Popup)
app.use(directive)
app.mount('#app')
