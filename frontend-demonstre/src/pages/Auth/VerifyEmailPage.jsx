import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { App } from 'antd'
import AuthTemplate from '../../components/templates/AuthTemplate/AuthTemplate'
import AuthTextField from '../../components/atoms/auth/AuthTextField'
import AuthFormActions from '../../components/molecules/auth/AuthFormActions'
import authApi from '../../api/AuthApi'
import { useLanguage } from '../../context/LanguageContext'
import { getAuthCopy, getAuthError } from '../../utils/authI18n'
import { PENDING_VERIFICATION_EMAIL_KEY } from '../../constants/auth'

const VerifyEmailPage = () => {
  const { language, setLanguage } = useLanguage()
  const copy = getAuthCopy(language)
  const { message } = App.useApp()
  const location = useLocation()
  const navigate = useNavigate()
  const initialEmail = location.state?.email || sessionStorage.getItem(PENDING_VERIFICATION_EMAIL_KEY) || ''
  const [email, setEmail] = useState(initialEmail)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (cooldown <= 0) return undefined
    const timer = window.setTimeout(() => setCooldown((remaining) => remaining - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [cooldown])

  const verify = async (event) => {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)
    const values = Object.fromEntries(new FormData(event.currentTarget))
    const normalizedEmail = values.email.trim().toLowerCase()
    setEmail(normalizedEmail)
    try {
      await authApi.verifyEmail({ ...values, email: normalizedEmail })
      sessionStorage.removeItem(PENDING_VERIFICATION_EMAIL_KEY)
      message.success(copy.verificationComplete)
      navigate('/login', { replace: true })
    } catch (requestError) {
      setError(getAuthError(requestError, copy))
    } finally {
      setIsSubmitting(false)
    }
  }

  const resend = async () => {
    setError('')
    setIsResending(true)
    try {
      await authApi.resendVerification({ email: email.trim().toLowerCase() })
      setCooldown(60)
      message.success(copy.resendAccepted)
    } catch (requestError) {
      setError(getAuthError(requestError, copy))
      if (requestError.response?.status === 429) setCooldown(60)
    } finally {
      setIsResending(false)
    }
  }

  return (
    <AuthTemplate
      title={copy.verifyEmail}
      description={copy.otpIntro}
      language={language}
      onLanguageChange={setLanguage}
      controlsLabel={copy.email}
      error={error}
      footer={<Link className="font-semibold text-emerald-700 hover:text-emerald-800 dark:text-emerald-300" to="/login">{copy.backToLogin}</Link>}
    >
      <form className="space-y-5" onSubmit={verify}>
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
        <AuthTextField label={copy.otp} name="otp" inputMode="numeric" maxLength={6} autoComplete="one-time-code" />
        <AuthFormActions loading={isSubmitting} label={copy.verifyEmail} />
      </form>
      <button
        type="button"
        disabled={!email || isResending || cooldown > 0}
        onClick={resend}
        className="mt-5 w-full text-center text-sm font-semibold text-emerald-700 hover:text-emerald-800 disabled:cursor-not-allowed disabled:text-slate-400 dark:text-emerald-300"
      >
        {cooldown > 0 ? copy.resendIn.replace('{seconds}', String(cooldown)) : isResending ? copy.continue : copy.resendCode}
      </button>
    </AuthTemplate>
  )
}

export default VerifyEmailPage