import { SlidersHorizontalIcon } from '../atoms/StyleIcons'

const RasterStatsBanner = ({ stats, t }) => {
  if (!stats) return null

  return (
    <div className="mt-3 flex items-center justify-between px-3 py-2 bg-gradient-to-r from-blue-50/70 to-teal-50/70 rounded-xl border border-blue-100 text-xs text-slate-700">
      <div className="flex items-center gap-3">
        <span className="font-semibold text-blue-900 flex items-center gap-1">
          <SlidersHorizontalIcon className="w-3.5 h-3.5 text-blue-600" />
          {t('dataStatistics', 'Data Statistics:')}
        </span>
        <span>
          Min: <strong className="font-mono text-blue-800">{stats.min}</strong>
        </span>
        <span className="text-slate-300">|</span>
        <span>
          Max: <strong className="font-mono text-blue-800">{stats.max}</strong>
        </span>
        <span className="text-slate-300">|</span>
        <span>
          Mean: <strong className="font-mono text-blue-800">{stats.mean}</strong>
        </span>
        <span className="text-slate-300">|</span>
        <span>
          Std: <strong className="font-mono text-blue-800">{stats.std}</strong>
        </span>
      </div>
      {stats.valid_pixels && (
        <span className="text-[11px] text-slate-400">
          {stats.valid_pixels.toLocaleString()} pixels
        </span>
      )}
    </div>
  )
}

export default RasterStatsBanner
