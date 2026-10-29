import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { App } from 'antd'
import AuthTemplate from '../../components/templates/AuthTemplate/AuthTemplate'
import AuthTextField from '../../components/atoms/auth/AuthTextField'
import AuthPasswordField from '../../components/molecules/auth/AuthPasswordField'
import AuthFormActions from '../../components/molecules/auth/AuthFormActions'
import authApi from '../../api/AuthApi'
import { useLanguage } from '../../context/LanguageContext'
import { getAuthCopy, getAuthError } from '../../utils/authI18n'
import { PENDING_VERIFICATION_EMAIL_KEY } from '../../constants/auth'

const RegisterPage = () => {
  const { language, setLanguage } = useLanguage()
  const copy = getAuthCopy(language)
  const { message } = App.useApp()
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isAuthLocalEnabled =
    import.meta.env.VITE_AUTH_LOCAL_ENABLED === 'true' ||
    (import.meta.env.VITE_LEGACY_LOGIN_ENABLED !== 'false' && import.meta.env.VITE_AUTH_LOCAL_ENABLED !== 'false')

  if (!isAuthLocalEnabled) {
    return <Navigate to="/login" replace />
  }

  const validateRegistration = (values) => {
    const name = values.name.trim().replace(/\s+/g, ' ')
    const email = values.email.trim().toLowerCase()
    const password = values.password
    const confirmation = values.password_confirmation

    if (name.length < 2 || name.length > 120) return copy.validation.name
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return copy.validation.email
    if (
      password.length < 10
      || password.length > 128
      || !/[\p{L}]/u.test(password)
      || !/[0-9]/.test(password)
    ) return copy.validation.passwordPolicy
    if (password !== confirmation) return copy.validation.passwordConfirmation
    return null
  }

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    const values = Object.fromEntries(new FormData(event.currentTarget))
    values.name = values.name.trim().replace(/\s+/g, ' ')
    values.email = values.email.trim().toLowerCase()
    const validationError = validateRegistration(values)
    if (validationError) {
      setError(validationError)
      return
    }

    setIsSubmitting(true)
    try {
      await authApi.register(values)
      sessionStorage.setItem(PENDING_VERIFICATION_EMAIL_KEY, values.email.trim().toLowerCase())
      message.success(copy.registrationComplete)
      navigate('/verify-email', { state: { email: values.email.trim().toLowerCase() } })
    } catch (requestError) {
      const code = requestError.response?.data?.detail?.code
      setError(getAuthError(requestError, copy))
      if (code === 'AUTH_EMAIL_PENDING') {
        sessionStorage.setItem(PENDING_VERIFICATION_EMAIL_KEY, values.email.trim().toLowerCase())
        navigate('/verify-email', { state: { email: values.email.trim().toLowerCase() } })
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthTemplate
      title={copy.createAccount}
      description={copy.registerIntro}
      language={language}
      onLanguageChange={setLanguage}
      controlsLabel={copy.email}
      error={error}
      footer={<span>{copy.haveAccount} <Link className="font-semibold text-emerald-700 hover:text-emerald-800 dark:text-emerald-300" to="/login">{copy.signIn}</Link></span>}
    >
      <form className="space-y-5" onSubmit={submit}>
        <AuthTextField label={copy.name} name="name" placeholder={copy.namePlaceholder} autoComplete="name" maxLength={120} />
        <AuthTextField label={copy.email} name="email" type="email" placeholder={copy.emailPlaceholder} autoComplete="email" maxLength={254} />
        <AuthPasswordField label={copy.password} name="password" autoComplete="new-password" help={copy.passwordHint} />
        <AuthPasswordField label={copy.confirmPassword} name="password_confirmation" autoComplete="new-password" />
        <AuthFormActions loading={isSubmitting} label={copy.signUp} />
      </form>
    </AuthTemplate>
  )
}

export default RegisterPage