import useAuth from './useAuth'
import { useLanguage } from '../context/LanguageContext'
import { getAuthCopy } from '../utils/authI18n'

const useMapEntryAction = (authenticatedLabel) => {
  const { isAuthenticated, isLoading } = useAuth()
  const { language } = useLanguage()
  const authCopy = getAuthCopy(language)

  return {
    to: isAuthenticated && !isLoading ? '/dashboard' : '/login',
    label: isLoading ? authCopy.loadingSession : isAuthenticated ? authenticatedLabel : authCopy.signIn,
    isLoading,
  }
}

export default useMapEntryAction