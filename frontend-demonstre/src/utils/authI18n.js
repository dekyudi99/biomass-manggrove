import authTranslations from '../i18n/authTranslations'

export const getAuthCopy = (language) => authTranslations[language] || authTranslations.id

export const getAuthError = (error, copy) => {
  if (!error.response) return copy.errors.NETWORK_ERROR
  const detail = error.response.data?.detail
  const code = detail?.code
  if (code) return copy.errors[code] || copy.errors.DEFAULT
  if (error.response.status === 422 && Array.isArray(detail)) {
    const firstError = detail[0]
    const field = firstError?.loc?.at(-1)
    const validationType = firstError?.type
    const fieldMessages = copy.validation

    if (field === 'password' && ['value_error', 'string_too_short', 'string_too_long'].includes(validationType)) return fieldMessages.passwordPolicy
    if (field === 'password_confirmation') return fieldMessages.passwordConfirmation
    if (field === 'email') return fieldMessages.email
    if (field === 'name') return fieldMessages.name
    return fieldMessages.DEFAULT
  }
  return copy.errors.DEFAULT
}
