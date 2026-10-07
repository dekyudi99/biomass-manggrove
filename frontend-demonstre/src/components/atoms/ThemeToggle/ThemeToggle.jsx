import { MoonOutlined, SunOutlined } from '@ant-design/icons'
import useTheme from '../../../hooks/useTheme'

const ThemeToggle = ({ lightLabel = 'Light mode', darkLabel = 'Dark mode', showLabel = true, className = '' }) => {
  const { isDark, toggleTheme } = useTheme()
  const label = isDark ? darkLabel : lightLabel

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white/80 px-3 text-sm font-medium text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:border-emerald-700 dark:hover:bg-slate-700 ${className}`}
    >
      {isDark ? <MoonOutlined aria-hidden="true" /> : <SunOutlined aria-hidden="true" />}
      {showLabel && label && <span>{label}</span>}
    </button>
  )
}

export default ThemeToggle