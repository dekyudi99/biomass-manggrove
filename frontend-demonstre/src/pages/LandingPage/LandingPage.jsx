import { useEffect, useMemo } from 'react'
import { message } from 'antd'
import { useLanguage } from '../../context/LanguageContext'
import landingTranslations from '../../i18n/landingTranslations'
import LandingTemplate from '../../components/templates/LandingTemplate/LandingTemplate'

const LandingPage = () => {
  useEffect(() => {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const termMsg = sessionStorage.getItem('SESSION_TERMINATED_MSG')
      if (termMsg) {
        sessionStorage.removeItem('SESSION_TERMINATED_MSG')
        sessionStorage.removeItem('SESSION_EXPIRED')
        message.info(termMsg)
      }
    }
  }, [])
  const { language, setLanguage } = useLanguage()
  const copy = useMemo(() => landingTranslations[language] || landingTranslations.id, [language])

  return <LandingTemplate copy={copy} language={language} onLanguageChange={setLanguage} />
}

export default LandingPage