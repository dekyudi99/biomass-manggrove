import { useState } from 'react'
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
  const { login, isAuthenticated, isLoading } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (isAuthenticated && !isLoading) return <Navigate to="/dashboard" replace />

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
      footer={(
        <div className="space-y-3">
          <Link className="block font-semibold text-emerald-700 hover:text-emerald-800 dark:text-emerald-300" to="/forgot-password">
            {copy.forgotPassword}
          </Link>
          <span>{copy.noAccount} <Link className="font-semibold text-emerald-700 hover:text-emerald-800 dark:text-emerald-300" to="/register">{copy.signUp}</Link></span>
        </div>
      )}
    >
      {error && [copy.errors.AUTH_EMAIL_NOT_VERIFIED, copy.errors.AUTH_EMAIL_PENDING].includes(error) && <Alert className="mb-4 rounded-xl" type="info" showIcon message={<Link to="/verify-email">{copy.verifyEmail}</Link>} />}
      <form className="space-y-5" onSubmit={submit}>
        <AuthTextField label={copy.email} name="email" type="email" placeholder={copy.emailPlaceholder} autoComplete="email" />
        <AuthPasswordField label={copy.password} name="password" autoComplete="current-password" />
        <AuthFormActions loading={isSubmitting} label={copy.signIn} />
      </form>
    </AuthTemplate>
  )
}

export default LoginPage