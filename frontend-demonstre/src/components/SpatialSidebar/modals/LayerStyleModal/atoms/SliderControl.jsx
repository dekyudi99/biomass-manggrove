const SliderControl = ({
  label,
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.05,
  formatValue,
}) => {
  const displayVal = formatValue ? formatValue(value) : value

  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1 font-semibold text-slate-700">
        <span>{label}</span>
        <span className="font-mono text-teal-700 text-[10px] bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200">
          {displayVal}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-teal-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
      />
    </div>
  )
}

export default SliderControl
