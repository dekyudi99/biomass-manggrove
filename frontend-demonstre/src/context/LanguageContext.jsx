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

  const t = (key, fallback) => {
    const langDict = translations[language] || translations.id
    return langDict[key] || translations.id[key] || fallback || key
  }

  const translateApi = (err, defaultKey = 'operationFailed') => {
    const apiDetail = err?.response?.data?.detail || err?.response?.data?.message || err?.message
    return apiDetail || t(defaultKey, 'Operasi gagal')
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, translateApi }}>
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
