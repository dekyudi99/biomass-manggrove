const StrokeDashSelector = ({ label, value, onChange, options }) => {
  return (
    <div>
      {label && (
        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
          {label}
        </label>
      )}
      <div className="grid grid-cols-3 gap-2">
        {options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={`py-1.5 px-3 rounded-lg border text-xs font-medium text-center transition cursor-pointer ${
              value === opt.id
                ? 'border-teal-500 bg-teal-50 text-teal-800 font-semibold ring-1 ring-teal-200'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export default StrokeDashSelector
