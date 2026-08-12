import { ref, watch } from 'vue'
import { defineStore } from 'pinia'

export const useThemeStore = defineStore('theme', () => {
  const themeMode = ref(localStorage.getItem('theme-mode') || 'system')
  const isDark = ref(false)

  function applyTheme() {
    if (themeMode.value === 'dark') {
      isDark.value = true
      document.documentElement.classList.add('dark')
    } else if (themeMode.value === 'light') {
      isDark.value = false
      document.documentElement.classList.remove('dark')
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      isDark.value = prefersDark
      console.log("prefersDark:", prefersDark)
      if (prefersDark) {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
    }
  }

  function setThemeMode(mode) {
    themeMode.value = mode
    localStorage.setItem('theme-mode', mode)
    applyTheme()
  }

  function initTheme() {
    applyTheme()

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (themeMode.value === 'system') {
        isDark.value = e.matches
        if (e.matches) {
          document.documentElement.classList.add('dark')
        } else {
          document.documentElement.classList.remove('dark')
        }
      }
    })
  }

  return {
    themeMode,
    isDark,
    setThemeMode,
    initTheme
  }
},{
  persist: true
})
