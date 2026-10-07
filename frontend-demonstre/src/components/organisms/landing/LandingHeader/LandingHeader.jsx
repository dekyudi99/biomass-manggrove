import { ArrowRightOutlined } from '@ant-design/icons'
import BrandLogo from '../../../atoms/BrandLogo/BrandLogo'
import LanguageSwitcher from '../../../molecules/LanguageSwitcher/LanguageSwitcher'
import ActionLink from '../../../atoms/ActionLink/ActionLink'
import ThemeToggle from '../../../atoms/ThemeToggle/ThemeToggle'
import useMapEntryAction from '../../../../hooks/useMapEntryAction'

const LandingHeader = ({ copy, language, onLanguageChange }) => {
  const mapAction = useMapEntryAction(copy.primaryAction)

  return (
    <header className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-4 sm:px-8 lg:px-10">
      <BrandLogo />
      <nav className="hidden items-center gap-8 md:flex" aria-label="Main navigation">
        <a href="#home" className="text-sm font-medium text-slate-600 transition hover:text-emerald-700 dark:hover:text-emerald-300">{copy.navigation[0]}</a>
        <a href="#features" className="text-sm font-medium text-slate-600 transition hover:text-emerald-700 dark:hover:text-emerald-300">{copy.navigation[1]}</a>
        <a href="#workflow" className="text-sm font-medium text-slate-600 transition hover:text-emerald-700 dark:hover:text-emerald-300">{copy.navigation[2]}</a>
      </nav>
      <div className="flex items-center gap-2 sm:gap-3">
        <ThemeToggle
          lightLabel={copy.lightMode}
          darkLabel={copy.darkMode}
          showLabel={false}
          className="min-h-9 w-9 rounded-full px-0 sm:min-h-10 sm:w-10 sm:px-0"
        />
        <LanguageSwitcher value={language} onChange={onLanguageChange} label={copy.languageLabel} />
        <ActionLink
          to={mapAction.to}
          aria-label={mapAction.label}
          aria-busy={mapAction.isLoading}
          className={`h-10 min-h-10 w-10 px-0 py-0 sm:h-auto sm:w-auto sm:px-5 sm:py-2 ${mapAction.isLoading ? 'pointer-events-none opacity-70' : ''}`}
        >
          <span className="hidden sm:inline">{mapAction.label}</span>
          <span className="sm:hidden" aria-hidden="true"><ArrowRightOutlined /></span>
        </ActionLink>
      </div>
    </header>
  )
}

export default LandingHeader