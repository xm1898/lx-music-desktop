import { createApp } from 'vue'

import { i18nPlugin } from './plugins/i18n'

import App from './App.vue'

import '@root/common/error'
import { sendReady } from './utils/ipc'

window.ELECTRON_DISABLE_SECURITY_WARNINGS = process.env.ELECTRON_DISABLE_SECURITY_WARNINGS

// 迷你播放器语言跟随主进程设置，通过 URL 参数带过来
const lang = new URLSearchParams(window.location.search).get('lang')
if (lang && window.i18n.locale !== lang) {
  window.i18n.setLanguage(lang as 'zh-cn' | 'en-us' | 'ko-kr' | 'zh-tw')
  window.setLang(lang)
}

const app = createApp(App)
app.use(i18nPlugin)
app.mount('#root')

// 通知主进程补发当前播放状态
sendReady()
