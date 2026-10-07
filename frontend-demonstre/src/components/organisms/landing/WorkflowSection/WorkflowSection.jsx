const WorkflowSection = ({ copy }) => (
  <section id="workflow" className="scroll-mt-10 bg-[#f5f8f5] py-20 sm:py-28 dark:bg-slate-950">
    <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
      <div className="max-w-2xl">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-300">{copy.workflowEyebrow}</p>
        <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl dark:text-slate-50">{copy.workflowTitle}</h2>
        <p className="mt-4 leading-7 text-slate-600 dark:text-slate-300">{copy.workflowDescription}</p>
      </div>
      <div className="relative mt-12 grid gap-8 md:grid-cols-3 md:gap-10">
        <div className="absolute left-[15%] right-[15%] top-7 hidden border-t border-dashed border-emerald-300 md:block" />
        {copy.workflowSteps.map(([number, title, description]) => (
          <article key={number} className="relative">
            <span className="relative z-[1] grid h-14 w-14 place-items-center rounded-2xl border border-emerald-200 bg-white text-sm font-bold text-emerald-800 shadow-sm dark:border-emerald-800 dark:bg-slate-800 dark:text-emerald-200">{number}</span>
            <h3 className="mt-5 text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
            <p className="mt-2 max-w-sm text-sm leading-6 text-slate-600 dark:text-slate-300">{description}</p>
          </article>
        ))}
      </div>
    </div>
  </section>
)

export default WorkflowSection