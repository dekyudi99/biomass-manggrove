import { Card, Space } from 'antd'
import BrandLogo from '../../atoms/BrandLogo/BrandLogo'
import LanguageSwitcher from '../../molecules/LanguageSwitcher/LanguageSwitcher'
import ThemeToggle from '../../atoms/ThemeToggle/ThemeToggle'

const AuthCard = ({ title, description, children, language, onLanguageChange, error, footer, controlsLabel }) => (
  <main className="auth-page flex min-h-dvh flex-col bg-[#f8fbf8] px-4 py-6 text-slate-900 dark:bg-slate-950 dark:text-slate-100 sm:px-6">
    <div className="mx-auto flex w-full max-w-7xl items-center justify-center gap-3 sm:justify-between">
      <BrandLogo />
      <Space size="small">
        <ThemeToggle showLabel={false} />
        <LanguageSwitcher value={language} onChange={onLanguageChange} label={controlsLabel} />
      </Space>
    </div>
    <section className="grid flex-1 place-items-center py-8">
      <Card className="w-full max-w-md rounded-3xl border-white/80 shadow-xl shadow-emerald-950/5 dark:border-slate-700 dark:bg-slate-900" styles={{ body: { padding: 28 } }}>
        <div className="mb-7 space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">{title}</h1>
          <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">{description}</p>
        </div>
        {error && <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-100">{error}</div>}
        {children}
        {footer && <div className="mt-6 border-t border-slate-100 pt-5 text-center text-sm dark:border-slate-700">{footer}</div>}
      </Card>
    </section>
  </main>
)

export default AuthCard