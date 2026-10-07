import BrandLogo from '../../../atoms/BrandLogo/BrandLogo'

const LandingFooter = ({ copy }) => (
  <footer className="border-t border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900">
    <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-7 sm:px-8 md:flex-row md:items-center md:justify-between lg:px-10">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-5">
        <BrandLogo imageClassName="h-8 w-8" />
        <p className="max-w-md text-xs leading-5 text-slate-500 dark:text-slate-300">{copy.footerDescription}</p>
      </div>
      <p className="text-xs text-slate-400">© {new Date().getFullYear()} Grovia · {copy.footerNote}</p>
    </div>
  </footer>
)

export default LandingFooter