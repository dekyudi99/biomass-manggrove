import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Alert, App } from 'antd'
import AuthTemplate from '../../components/templates/AuthTemplate/AuthTemplate'
import AuthTextField from '../../components/atoms/auth/AuthTextField'
import AuthPasswordField from '../../components/molecules/auth/AuthPasswordField'
import AuthFormActions from '../../components/molecules/auth/AuthFormActions'
import useAuth from '../../hooks/useAuth'
import { useLanguage } from '../../context/LanguageContext'
import { getAuthCopy, getAuthError } from '../../utils/authI18n'
import { PENDING_VERIFICATION_EMAIL_KEY } from '../../constants/auth'

const LoginPage = () => {
  const { language, setLanguage } = useLanguage()
  const copy = getAuthCopy(language)
  const { message } = App.useApp()
  const { login, signinRedirect, isAuthenticated, isLoading } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isAuthLocalEnabled =
    import.meta.env.VITE_AUTH_LOCAL_ENABLED === 'true' ||
    (import.meta.env.VITE_LEGACY_LOGIN_ENABLED !== 'false' && import.meta.env.VITE_AUTH_LOCAL_ENABLED !== 'false')
  const isLegacyEnabled = isAuthLocalEnabled

  const hasExpiredSession = typeof window !== 'undefined' && Boolean(sessionStorage.getItem('SESSION_EXPIRED') || sessionStorage.getItem('SESSION_TERMINATED_MSG'))

  useEffect(() => {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const termMsg = sessionStorage.getItem('SESSION_TERMINATED_MSG')
      if (termMsg) {
        sessionStorage.removeItem('SESSION_TERMINATED_MSG')
        sessionStorage.removeItem('SESSION_EXPIRED')
        message.info(termMsg)
      }
    }
  }, [message])

  useEffect(() => {
    if (!isAuthLocalEnabled && !isAuthenticated && !isLoading && !hasExpiredSession) {
      signinRedirect()
    }
  }, [isAuthLocalEnabled, isAuthenticated, isLoading, hasExpiredSession, signinRedirect])

  if (isAuthenticated && !isLoading && !hasExpiredSession) return <Navigate to="/dashboard" replace />

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)
    const values = Object.fromEntries(new FormData(event.currentTarget))
    try {
      await login(values)
      message.success(copy.loginSuccess)
      const destination = location.state?.from
      navigate(destination?.startsWith('/') ? destination : '/dashboard', { replace: true })
    } catch (requestError) {
      const nextError = getAuthError(requestError, copy)
      setError(nextError)
      if (requestError.response?.data?.detail?.code === 'AUTH_EMAIL_NOT_VERIFIED') {
        sessionStorage.setItem(PENDING_VERIFICATION_EMAIL_KEY, values.email)
        navigate('/verify-email', { state: { email: values.email.trim().toLowerCase() } })
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthTemplate
      title={copy.welcomeBack}
      description={copy.authIntro}
      language={language}
      onLanguageChange={setLanguage}
      controlsLabel={copy.languageLabel || copy.email}
      error={error}
      footer={isLegacyEnabled ? (
        <div className="space-y-3">
          <Link className="block font-semibold text-emerald-700 hover:text-emerald-800 dark:text-emerald-300" to="/forgot-password">
            {copy.forgotPassword}
          </Link>
          <span>{copy.noAccount} <Link className="font-semibold text-emerald-700 hover:text-emerald-800 dark:text-emerald-300" to="/register">{copy.signUp}</Link></span>
        </div>
      ) : null}
    >
      <div className="space-y-5">
        <button
          type="button"
          onClick={() => signinRedirect()}
          className="w-full flex items-center justify-center gap-2.5 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold rounded-xl shadow-md shadow-emerald-600/20 transition-all cursor-pointer text-sm"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
          <span>Login dengan SSO Keycloak</span>
        </button>

        {isLegacyEnabled && (
          <>
            <div className="relative my-4 flex items-center justify-center">
              <div className="w-full border-t border-slate-200 dark:border-slate-700" />
              <span className="absolute bg-white dark:bg-slate-900 px-3 text-xs text-slate-500 font-medium">
                atau login manual
              </span>
            </div>

            {error && [copy.errors.AUTH_EMAIL_NOT_VERIFIED, copy.errors.AUTH_EMAIL_PENDING].includes(error) && (
              <Alert className="mb-4 rounded-xl" type="info" showIcon message={<Link to="/verify-email">{copy.verifyEmail}</Link>} />
            )}
            <form className="space-y-4" onSubmit={submit}>
              <AuthTextField label={copy.email} name="email" type="email" placeholder={copy.emailPlaceholder} autoComplete="email" />
              <AuthPasswordField label={copy.password} name="password" autoComplete="current-password" />
              <AuthFormActions loading={isSubmitting} label={copy.signIn} />
            </form>
          </>
        )}
      </div>
    </AuthTemplate>
  )
}

export default LoginPage