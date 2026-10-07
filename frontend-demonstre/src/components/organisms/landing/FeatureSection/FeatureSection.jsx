import {
  AppstoreOutlined,
  CloudDownloadOutlined,
  GlobalOutlined,
  RadarChartOutlined,
} from '@ant-design/icons'

const FEATURE_ICONS = [GlobalOutlined, RadarChartOutlined, AppstoreOutlined, CloudDownloadOutlined]

const FeatureSection = ({ copy }) => (
  <section id="features" className="scroll-mt-10 bg-white py-20 sm:py-28 dark:bg-slate-900">
    <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-300">{copy.featuresEyebrow}</p>
        <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl dark:text-slate-50">{copy.featuresTitle}</h2>
        <p className="mt-4 leading-7 text-slate-600 dark:text-slate-300">{copy.featuresDescription}</p>
      </div>
      <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {copy.featureTitles.map((title, index) => {
          const Icon = FEATURE_ICONS[index]
          return (
            <article key={title} className="group rounded-3xl border border-slate-200/80 bg-slate-50/70 p-6 transition duration-300 hover:-translate-y-1 hover:border-emerald-200 hover:bg-white hover:shadow-xl hover:shadow-emerald-950/5 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-emerald-800 dark:hover:bg-slate-700">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-100 text-lg text-emerald-800 transition group-hover:bg-emerald-700 group-hover:text-white dark:bg-emerald-900 dark:text-emerald-200 dark:group-hover:bg-emerald-600"><Icon /></span>
              <h3 className="mt-6 text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{copy.featureDescriptions[index]}</p>
            </article>
          )
        })}
      </div>
    </div>
  </section>
)

export default FeatureSection