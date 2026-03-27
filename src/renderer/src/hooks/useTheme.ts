import { useEffect } from 'react'
import { useSettingsStore } from '@stores/settings.store'

export function useTheme(): void {
  const { settings } = useSettingsStore()

  useEffect(() => {
    const root = document.documentElement
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
