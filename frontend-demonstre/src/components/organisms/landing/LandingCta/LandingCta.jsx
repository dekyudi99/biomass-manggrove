import { ArrowRightOutlined } from '@ant-design/icons'
import ActionLink from '../../../atoms/ActionLink/ActionLink'
import useMapEntryAction from '../../../../hooks/useMapEntryAction'

const LandingCta = ({ copy }) => {
  const mapAction = useMapEntryAction(copy.ctaAction)

  return (
  <section className="px-5 py-16 sm:px-8 sm:py-24 lg:px-10">
    <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-800 px-7 py-12 text-white sm:px-12 sm:py-16 lg:px-16">
      <div className="pointer-events-none absolute -right-20 -top-36 h-96 w-96 rounded-full border border-white/10" />
      <div className="pointer-events-none absolute -right-4 -top-20 h-64 w-64 rounded-full border border-white/10" />
      <div className="relative max-w-2xl">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-200">{copy.ctaEyebrow}</p>
        <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">{copy.ctaTitle}</h2>
        <p className="mt-4 leading-7 text-emerald-100/80">{copy.ctaDescription}</p>
        <ActionLink
          to={mapAction.to}
          variant="inverse"
          aria-busy={mapAction.isLoading}
          className={`mt-8 ${mapAction.isLoading ? 'pointer-events-none opacity-70' : ''}`}
        >
          {mapAction.label}<ArrowRightOutlined aria-hidden="true" />
        </ActionLink>
      </div>
    </div>
  </section>
  )
}

export default LandingCta