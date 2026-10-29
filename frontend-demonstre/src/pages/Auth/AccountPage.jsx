import { useState } from 'react'
import { Link } from 'react-router-dom'
import { App } from 'antd'
import AuthTemplate from '../../components/templates/AuthTemplate/AuthTemplate'
import AuthPasswordField from '../../components/molecules/auth/AuthPasswordField'
import AuthFormActions from '../../components/molecules/auth/AuthFormActions'
import authApi from '../../api/AuthApi'
import useAuth from '../../hooks/useAuth'
import { useLanguage } from '../../context/LanguageContext'
import { getAuthCopy, getAuthError } from '../../utils/authI18n'

const AccountPage = () => {
  const { language, setLanguage } = useLanguage()
  const copy = getAuthCopy(language)
  const { message } = App.useApp()
  const { logout, portalUrl } = useAuth()
  const isAuthLocalEnabled = import.meta.env.VITE_AUTH_LOCAL_ENABLED === 'true'

  if (!isAuthLocalEnabled) {
    window.location.href = `${portalUrl || 'http://localhost:5170'}/profile`
    return null
  }

  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    const values = Object.fromEntries(new FormData(event.currentTarget))
    if (values.new_password !== values.new_password_confirmation) {
      setError(copy.validation.passwordConfirmation)
      return
    }
    if (values.current_password === values.new_password) {
      setError(copy.validation.passwordMustDiffer)
      return
    }

    setIsSubmitting(true)
    try {
      await authApi.changePassword(values)
      message.success(copy.passwordChanged)
      await logout().catch(() => {})
    } catch (requestError) {
      setError(getAuthError(requestError, copy))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthTemplate
      title={copy.changePassword}
      description={copy.changePasswordDescription}
      language={language}
      onLanguageChange={setLanguage}
      controlsLabel={copy.languageLabel}
      error={error}
      footer={<Link className="font-semibold text-emerald-700 hover:text-emerald-800 dark:text-emerald-300" to="/dashboard">{copy.backToDashboard}</Link>}
    >
      <form className="space-y-5" onSubmit={submit}>
        <AuthPasswordField label={copy.currentPassword} name="current_password" autoComplete="current-password" />
        <AuthPasswordField label={copy.newPassword} name="new_password" autoComplete="new-password" help={copy.passwordHint} />
        <AuthPasswordField label={copy.confirmNewPassword} name="new_password_confirmation" autoComplete="new-password" />
        <AuthFormActions loading={isSubmitting} label={copy.changePassword} />
      </form>
    </AuthTemplate>
  )
}

export default AccountPage