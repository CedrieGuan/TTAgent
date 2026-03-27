/**
 * useTheme Hook
 * 根据设置中的主题和字体大小更新 document 根元素的 CSS 变量
 * 支持 dark / light / system 三种主题模式
 */
import { useEffect } from 'react'
import { useSettingsStore } from '@stores/settings.store'

export function useTheme(): void {
  const { settings } = useSettingsStore()

  useEffect(() => {
    const root = document.documentElement

    // system 模式：跟随系统偏好；其他模式直接使用设置值
    const theme =
      settings.theme === 'system'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
        : settings.theme

    root.setAttribute('data-theme', theme)
    root.style.setProperty('--font-size-base', `${settings.fontSize}px`)
  }, [settings.theme, settings.fontSize])
}
