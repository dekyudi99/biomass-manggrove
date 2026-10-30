import useAuth from './useAuth'
import { useLanguage } from '../context/LanguageContext'
import { getAuthCopy } from '../utils/authI18n'

const useMapEntryAction = (authenticatedLabel) => {
  const { isAuthenticated, isLoading } = useAuth()
  const { language } = useLanguage()
  const authCopy = getAuthCopy(language)

  return {
    to: '/dashboard',
    label: isLoading ? authCopy.loadingSession : (authenticatedLabel || authCopy.openDashboard || 'Dashboard'),
    isLoading,
  }
}

export default useMapEntryAction