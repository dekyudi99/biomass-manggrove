const LegendChipsPreview = ({ classes }) => {
  if (!classes || classes.length === 0) return null

  return (
    <div className="mt-3.5 p-3 bg-slate-50 rounded-xl border border-slate-200">
      <span className="text-[11px] font-semibold text-slate-600 block mb-1.5">
        Legend Preview:
      </span>
      <div className="flex flex-wrap gap-1.5">
        {classes.map((cls, idx) => (
          <div
            key={idx}
            className="flex items-center gap-1.5 text-[11px] text-slate-700 bg-white px-2 py-1 rounded-md border border-slate-200 shadow-2xs"
          >
            <span
              className="w-3 h-3 rounded-sm flex-shrink-0 border border-black/10"
              style={{
                backgroundColor: cls.opacity === 0 ? 'transparent' : cls.color,
              }}
            />
            <span className="font-semibold text-slate-800">
              {cls.label || (cls.min !== undefined && cls.max !== undefined ? `${cls.min} - ${cls.max}` : `Val ${cls.quantity}`)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default LegendChipsPreview
