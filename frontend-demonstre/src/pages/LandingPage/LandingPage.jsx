import { useMemo } from 'react'
import { useLanguage } from '../../context/LanguageContext'
import landingTranslations from '../../i18n/landingTranslations'
import LandingTemplate from '../../components/templates/LandingTemplate/LandingTemplate'

const LandingPage = () => {
  const { language, setLanguage } = useLanguage()
  const copy = useMemo(() => landingTranslations[language] || landingTranslations.id, [language])

  return <LandingTemplate copy={copy} language={language} onLanguageChange={setLanguage} />
}

export default LandingPage