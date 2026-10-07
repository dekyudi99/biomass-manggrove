import LandingHeader from '../../organisms/landing/LandingHeader/LandingHeader'
import LandingHero from '../../organisms/landing/LandingHero/LandingHero'
import FeatureSection from '../../organisms/landing/FeatureSection/FeatureSection'
import WorkflowSection from '../../organisms/landing/WorkflowSection/WorkflowSection'
import LandingCta from '../../organisms/landing/LandingCta/LandingCta'
import LandingFooter from '../../organisms/landing/LandingFooter/LandingFooter'

const LandingTemplate = ({ copy, language, onLanguageChange }) => (
  <div className="min-h-screen scroll-smooth overflow-hidden bg-[#fbfcfa] text-slate-900 transition-colors duration-200 dark:bg-slate-950 dark:text-slate-100">
    <LandingHeader copy={copy} language={language} onLanguageChange={onLanguageChange} />
    <main>
      <LandingHero copy={copy} />
      <FeatureSection copy={copy} />
      <WorkflowSection copy={copy} />
      <LandingCta copy={copy} />
    </main>
    <LandingFooter copy={copy} />
  </div>
)

export default LandingTemplate