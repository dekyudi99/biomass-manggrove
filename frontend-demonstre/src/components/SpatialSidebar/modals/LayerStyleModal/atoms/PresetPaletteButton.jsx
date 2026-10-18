import { CheckIcon } from './StyleIcons'

const PresetPaletteButton = ({ preset, isSelected, onClick }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      title={preset.name}
      className={`flex flex-col items-center gap-1 p-1.5 rounded-xl border transition-all cursor-pointer ${
        isSelected
          ? 'border-teal-500 bg-teal-50/80 ring-2 ring-teal-200 shadow-xs'
          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
      }`}
    >
      <div
        className="w-6 h-6 rounded-full border border-black/10 shadow-inner flex items-center justify-center"
        style={{ backgroundColor: preset.fill }}
      >
        {isSelected && <CheckIcon className="w-3.5 h-3.5 text-white drop-shadow" />}
      </div>
      <span className="text-[9px] font-medium text-slate-600 truncate w-full text-center">
        {preset.label}
      </span>
    </button>
  )
}

export default PresetPaletteButton
