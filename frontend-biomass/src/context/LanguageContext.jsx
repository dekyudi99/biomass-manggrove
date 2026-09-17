import { createContext, useContext, useState, useEffect } from 'react'
import { translations } from '../i18n/translations'

const LanguageContext = createContext()

export const LanguageProvider = ({ children }) => {
  const [language, setLanguageState] = useState(() => {
    return (
      localStorage.getItem('app_language') ||
      import.meta.env.VITE_DEFAULT_LANGUAGE ||
      'id'
    )
  })

  const setLanguage = (lang) => {
    setLanguageState(lang)
    localStorage.setItem('app_language', lang)
  }

  const t = (key) => {
    const langDict = translations[language] || translations.id
    return langDict[key] || translations.id[key] || key
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export const useLanguage = () => {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
}

export default LanguageContext
