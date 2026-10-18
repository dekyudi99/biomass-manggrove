const ShapeOptionButton = ({ option, isSelected, onClick }) => {
  const IconComponent = option.icon

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg border text-xs font-medium transition cursor-pointer ${
        isSelected
          ? 'border-teal-500 bg-teal-50 text-teal-800 font-semibold shadow-xs ring-1 ring-teal-200'
          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300'
      }`}
    >
      <IconComponent className={`w-3.5 h-3.5 ${isSelected ? 'text-teal-600' : 'text-slate-400'}`} />
      <span className="text-[10px]">{option.label}</span>
    </button>
  )
}

export default ShapeOptionButton
