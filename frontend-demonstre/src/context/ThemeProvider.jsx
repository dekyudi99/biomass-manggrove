import { useEffect, useState } from 'react'
import ThemeContext from './ThemeContext'

const THEME_STORAGE_KEY = 'app_theme'
const THEMES = { light: 'light', dark: 'dark' }

const getSystemTheme = () =>
  window.matchMedia('(prefers-color-scheme: dark)').matches ? THEMES.dark : THEMES.light

const getInitialTheme = () => {
  const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)
  return Object.values(THEMES).includes(savedTheme) ? savedTheme : getSystemTheme()
}

const ThemeProvider = ({ children }) => {
  const [theme, setThemeState] = useState(getInitialTheme)
  const [hasUserPreference, setHasUserPreference] = useState(() =>
    Object.values(THEMES).includes(window.localStorage.getItem(THEME_STORAGE_KEY)),
  )
  const isDark = theme === THEMES.dark

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', isDark)
    root.style.colorScheme = theme
  }, [isDark, theme])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleSystemThemeChange = (event) => {
      if (hasUserPreference) return
      setThemeState(event.matches ? THEMES.dark : THEMES.light)
    }

    mediaQuery.addEventListener('change', handleSystemThemeChange)
    return () => mediaQuery.removeEventListener('change', handleSystemThemeChange)
  }, [hasUserPreference])

  const setTheme = (nextTheme) => {
    if (!Object.values(THEMES).includes(nextTheme)) return
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme)
    setHasUserPreference(true)
    setThemeState(nextTheme)
  }

  const toggleTheme = () => setTheme(isDark ? THEMES.light : THEMES.dark)

  return (
    <ThemeContext.Provider value={{ theme, isDark, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export default ThemeProvider