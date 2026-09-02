import { useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'

const THEME_KEY = 'mamayo-kitchen-theme'

export const resolveTheme = (storedTheme: string | null, systemPrefersDark: boolean): Theme => {
  if (storedTheme === 'dark' || storedTheme === 'light') return storedTheme
  return systemPrefersDark ? 'dark' : 'light'
}

const readStoredTheme = () => {
  try {
    return window.localStorage.getItem(THEME_KEY)
  } catch {
    return null
  }
}

const readSystemTheme = () => {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  } catch {
    return false
  }
}

export const getInitialTheme = () => resolveTheme(readStoredTheme(), readSystemTheme())

const applyTheme = (theme: Theme) => {
  document.documentElement.dataset.theme = theme
}

export const useTheme = () => {
  const [theme, setTheme] = useState<Theme>(() => {
    const initialTheme = getInitialTheme()
    applyTheme(initialTheme)
    return initialTheme
  })

  useEffect(() => {
    applyTheme(theme)
    try {
      window.localStorage.setItem(THEME_KEY, theme)
    } catch {
      // Theme still works when storage is unavailable.
    }
  }, [theme])

  return { theme, toggleTheme: () => setTheme((current) => current === 'dark' ? 'light' : 'dark') }
}
