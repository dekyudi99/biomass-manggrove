import { useEffect, useState } from 'react'
import { App } from 'antd'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import AuthTemplate from '../../components/templates/AuthTemplate/AuthTemplate'
import AuthTextField from '../../components/atoms/auth/AuthTextField'
import AuthPasswordField from '../../components/molecules/auth/AuthPasswordField'
import AuthFormActions from '../../components/molecules/auth/AuthFormActions'
import authApi from '../../api/AuthApi'
import { useLanguage } from '../../context/LanguageContext'
import { getAuthCopy, getAuthError } from '../../utils/authI18n'

const OTP_RESEND_COOLDOWN_SECONDS = 60

const ForgotPasswordPage = () => {
  const { language, setLanguage } = useLanguage()
  const copy = getAuthCopy(language)
  const { message } = App.useApp()
  const navigate = useNavigate()
  const isAuthLocalEnabled =
    import.meta.env.VITE_AUTH_LOCAL_ENABLED === 'true' ||
    (import.meta.env.VITE_LEGACY_LOGIN_ENABLED !== 'false' && import.meta.env.VITE_AUTH_LOCAL_ENABLED !== 'false')

  if (!isAuthLocalEnabled) {
    return <Navigate to="/login" replace />
  }

  const [email, setEmail] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (cooldown <= 0) return undefined
    const timer = window.setTimeout(() => setCooldown((seconds) => seconds - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [cooldown])

  const sendCode = async (normalizedEmail) => {
    setError('')
    setIsSubmitting(true)
    try {
      const { data } = await authApi.requestPasswordResetOtp({ email: normalizedEmail })
      setEmail(normalizedEmail)
      setOtpSent(true)
      setCooldown(data.retry_after || OTP_RESEND_COOLDOWN_SECONDS)
      message.success(copy.passwordResetOtpAccepted)
    } catch (requestError) {
      setError(getAuthError(requestError, copy))
      if (requestError.response?.status === 429) setCooldown(OTP_RESEND_COOLDOWN_SECONDS)
    } finally {
      setIsSubmitting(false)
    }
  }

  const submit = async (event) => {
    event.preventDefault()
    const values = Object.fromEntries(new FormData(event.currentTarget))
    const normalizedEmail = values.email.trim().toLowerCase()
    setError('')
    if (!otpSent) {
      await sendCode(normalizedEmail)
      return
    }

    if (values.new_password !== values.new_password_confirmation) {
      setError(copy.validation.passwordConfirmation)
      return
    }

    setIsSubmitting(true)
    try {
      await authApi.resetPassword({
        email: values.email,
        otp: values.otp,
        new_password: values.new_password,
        new_password_confirmation: values.new_password_confirmation,
      })
      message.success(copy.passwordResetComplete)
      navigate('/login', { replace: true })
    } catch (requestError) {
      setError(getAuthError(requestError, copy))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthTemplate
      title={otpSent ? copy.resetPassword : copy.forgotPassword}
      description={otpSent ? copy.passwordResetOtpHint : copy.forgotPasswordIntro}
      language={language}
      onLanguageChange={setLanguage}
      controlsLabel={copy.languageLabel}
      error={error}
      footer={<Link className="font-semibold text-emerald-700 hover:text-emerald-800 dark:text-emerald-300" to="/login">{copy.backToLogin}</Link>}
    >
      <form className="space-y-5" onSubmit={submit}>
        {otpSent ? (
          <>
            <p className="text-sm text-slate-600 dark:text-slate-300">{copy.email}: <strong>{email}</strong></p>
            <input type="hidden" name="email" value={email} readOnly />
          </>
        ) : (
          <AuthTextField
            label={copy.email}
            name="email"
            type="email"
            placeholder={copy.emailPlaceholder}
            autoComplete="email"
            maxLength={254}
            defaultValue={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        )}
        {otpSent && (
          <>
            <AuthTextField label={copy.otp} name="otp" inputMode="numeric" maxLength={6} autoComplete="one-time-code" />
            <AuthPasswordField label={copy.newPassword} name="new_password" autoComplete="new-password" help={copy.passwordHint} />
            <AuthPasswordField label={copy.confirmNewPassword} name="new_password_confirmation" autoComplete="new-password" />
          </>
        )}
        <AuthFormActions loading={isSubmitting} label={otpSent ? copy.resetPassword : copy.sendPasswordResetOtp} />
      </form>
      {otpSent && (
        <button
          type="button"
          disabled={isSubmitting || cooldown > 0}
          onClick={() => sendCode(email.trim().toLowerCase())}
          className="mt-4 w-full text-center text-sm font-semibold text-emerald-700 hover:text-emerald-800 disabled:cursor-not-allowed disabled:text-slate-400 dark:text-emerald-300"
        >
          {cooldown > 0 ? copy.resendIn.replace('{seconds}', String(cooldown)) : copy.resendCode}
        </button>
      )}
    </AuthTemplate>
  )
}

export default ForgotPasswordPage