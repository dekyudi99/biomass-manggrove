import { ArrowRightOutlined, DatabaseOutlined, EnvironmentOutlined, GlobalOutlined, NodeIndexOutlined } from '@ant-design/icons'
import heroImage from '../../../../assets/hero.png'
import ActionLink from '../../../atoms/ActionLink/ActionLink'
import useMapEntryAction from '../../../../hooks/useMapEntryAction'

const LandingHero = ({ copy }) => {
  const mapAction = useMapEntryAction(copy.primaryAction)

  return (
  <section id="home" className="relative isolate overflow-hidden">
    <div className="pointer-events-none absolute -right-48 -top-36 -z-10 h-[34rem] w-[34rem] rounded-full bg-emerald-100/70 blur-3xl dark:bg-emerald-900/30" />
    <div className="mx-auto grid min-h-[650px] w-full max-w-7xl items-center gap-12 px-5 pb-16 pt-12 sm:px-8 md:grid-cols-[1.04fr_0.96fr] md:pb-24 md:pt-16 lg:px-10">
      <div className="max-w-2xl">
        <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-emerald-200/80 bg-white/75 px-4 py-2 text-xs font-semibold text-emerald-800 shadow-sm shadow-emerald-950/5 dark:border-emerald-800 dark:bg-slate-900/80 dark:text-emerald-200">
          <span className="h-2 w-2 rounded-full bg-emerald-500 ring-4 ring-emerald-100" />
          {copy.eyebrow}
        </div>
        <h1 className="text-5xl font-semibold leading-[1.05] tracking-[-0.055em] text-slate-950 sm:text-6xl lg:text-[4.6rem] dark:text-slate-50">
          {copy.titleLead}<br />
          <span className="bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-500 bg-clip-text text-transparent dark:from-emerald-300 dark:via-emerald-200 dark:to-teal-300">{copy.titleAccent}</span>
        </h1>
        <p className="mt-7 max-w-xl text-base leading-8 text-slate-600 sm:text-lg dark:text-slate-300">{copy.description}</p>
        <div className="mt-9 flex flex-wrap items-center gap-3">
          <ActionLink
            to={mapAction.to}
            aria-busy={mapAction.isLoading}
            className={mapAction.isLoading ? 'pointer-events-none opacity-70' : ''}
          >
            {mapAction.label}<ArrowRightOutlined aria-hidden="true" />
          </ActionLink>
          <ActionLink href="#features" variant="secondary">{copy.secondaryAction}</ActionLink>
        </div>
        <div className="mt-12 flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
          <span className="flex -space-x-2" aria-hidden="true">
            <span className="grid h-9 w-9 place-items-center rounded-full border-2 border-white bg-emerald-100 text-emerald-800 dark:border-slate-950 dark:bg-emerald-900 dark:text-emerald-200"><GlobalOutlined /></span>
            <span className="grid h-9 w-9 place-items-center rounded-full border-2 border-white bg-teal-100 text-teal-800 dark:border-slate-950 dark:bg-teal-900 dark:text-teal-200"><NodeIndexOutlined /></span>
            <span className="grid h-9 w-9 place-items-center rounded-full border-2 border-white bg-lime-100 text-lime-800 dark:border-slate-950 dark:bg-lime-900 dark:text-lime-200"><EnvironmentOutlined /></span>
          </span>
          <span>{copy.trustedLabel}</span>
        </div>
      </div>

      <div className="relative mx-auto w-full max-w-[550px] py-8 md:py-0">
        <div className="absolute inset-8 rounded-[3rem] bg-gradient-to-br from-emerald-100 via-teal-50 to-lime-100 blur-2xl dark:from-emerald-950 dark:via-teal-950 dark:to-slate-900" />
        <div className="relative overflow-hidden rounded-[2rem] border border-white/80 bg-gradient-to-br from-[#e9f6ed] via-[#f5faf4] to-[#e3f1e8] p-7 shadow-[0_32px_90px_-42px_rgba(6,78,59,0.42)] sm:p-10 dark:border-slate-700 dark:from-slate-800 dark:via-slate-900 dark:to-emerald-950">
          <div className="absolute inset-0 opacity-[0.24]" style={{ backgroundImage: 'radial-gradient(#527b68 0.7px, transparent 0.7px)', backgroundSize: '18px 18px' }} />
          <div className="relative flex min-h-[340px] items-center justify-center sm:min-h-[395px]">
            <div className="absolute left-0 top-3 z-10 rounded-2xl border border-white/80 bg-white/90 px-4 py-3 shadow-lg shadow-emerald-950/5 backdrop-blur dark:border-slate-700 dark:bg-slate-800/95">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">{copy.visualLabel}</p>
              <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">{copy.visualTitle}</p>
            </div>
            <img src={heroImage} alt="Ilustrasi lapisan data spasial Grovia" className="relative z-0 h-64 w-64 object-contain drop-shadow-[0_24px_28px_rgba(91,33,182,0.16)] sm:h-80 sm:w-80" />
            <div className="absolute bottom-3 right-0 z-10 flex max-w-[90%] items-center gap-3 rounded-2xl border border-white/80 bg-white/95 px-4 py-3 shadow-lg shadow-emerald-950/10 backdrop-blur dark:border-slate-700 dark:bg-slate-800/95">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200"><EnvironmentOutlined /></span>
              <div>
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">Grovia workspace</p>
          <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-300">{copy.visualCaption}</p>
              </div>
              <span className="ml-1 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
            </div>
          </div>
        </div>
        <div className="absolute -bottom-5 left-7 z-20 flex items-center gap-2.5 rounded-2xl border border-white/90 bg-white/95 px-3 py-2.5 shadow-xl shadow-emerald-950/10 backdrop-blur dark:border-slate-700 dark:bg-slate-800/95">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
            <DatabaseOutlined aria-hidden="true" />
          </span>
          <div>
            <p className="text-[11px] font-semibold text-slate-800 dark:text-slate-100">{copy.dataCardTitle}</p>
          <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-300">{copy.dataCardDescription}</p>
          </div>
        </div>
      </div>
    </div>
  </section>
  )
}

export default LandingHero