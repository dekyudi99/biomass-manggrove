import AuthCard from '../../organisms/auth/AuthCard'

const AuthTemplate = ({ title, description, language, onLanguageChange, error, footer, controlsLabel, children }) => (
  <AuthCard
    title={title}
    description={description}
    language={language}
    onLanguageChange={onLanguageChange}
    error={error}
    footer={footer}
    controlsLabel={controlsLabel}
  >
    {children}
  </AuthCard>
)

export default AuthTemplate