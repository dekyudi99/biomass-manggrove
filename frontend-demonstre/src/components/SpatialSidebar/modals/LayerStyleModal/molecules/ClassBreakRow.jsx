import { Trash2Icon } from '../atoms/StyleIcons'

const ClassBreakRow = ({ cls, index, onUpdate, onRemove }) => {
  return (
    <div className="flex items-center gap-2 p-1.5 bg-white rounded-lg border border-slate-200 text-xs hover:border-slate-300 hover:shadow-xs transition">
      {/* Symbol / Color Picker */}
      <div className="flex items-center gap-1.5 w-24 flex-shrink-0">
        <input
          type="color"
          value={cls.color}
          onChange={(e) => onUpdate(index, 'color', e.target.value)}
          className="w-7 h-7 rounded border border-slate-200 cursor-pointer p-0 bg-transparent"
          title="Pick Symbol Color"
        />
        <input
          type="text"
          value={cls.color}
          onChange={(e) => onUpdate(index, 'color', e.target.value)}
          className="w-14 px-1 py-0.5 text-[10px] font-mono border border-slate-200 rounded uppercase text-slate-700"
        />
      </div>

      {/* Range (Min - Max) */}
      <div className="w-36 flex items-center gap-1 flex-shrink-0">
        <input
          type="number"
          step="any"
          value={cls.min ?? ''}
          placeholder="Min"
          onChange={(e) => onUpdate(index, 'min', parseFloat(e.target.value))}
          className="w-16 px-1.5 py-1 text-xs border border-slate-200 rounded text-slate-800 font-mono text-center"
        />
        <span className="text-slate-400 font-bold">-</span>
        <input
          type="number"
          step="any"
          value={cls.max ?? cls.quantity ?? ''}
          placeholder="Max"
          onChange={(e) => onUpdate(index, 'max', parseFloat(e.target.value))}
          className="w-16 px-1.5 py-1 text-xs border border-slate-200 rounded text-slate-800 font-mono text-center font-medium"
        />
      </div>

      {/* Label */}
      <div className="flex-1 min-w-0">
        <input
          type="text"
          value={cls.label || ''}
          placeholder="Custom Label..."
          onChange={(e) => onUpdate(index, 'label', e.target.value)}
          className="w-full px-2 py-1 text-xs border border-slate-200 rounded text-slate-700"
        />
      </div>

      {/* Value Threshold (GeoServer quantity) */}
      <div className="w-20 flex-shrink-0">
        <input
          type="number"
          step="any"
          value={cls.quantity !== undefined ? cls.quantity : (cls.max ?? 0)}
          onChange={(e) => onUpdate(index, 'quantity', parseFloat(e.target.value))}
          className="w-full px-1.5 py-1 text-xs border border-slate-200 rounded text-slate-800 font-mono text-center"
        />
      </div>

      {/* Opacity */}
      <div className="w-20 flex items-center gap-1 flex-shrink-0">
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={cls.opacity ?? 1.0}
          onChange={(e) => onUpdate(index, 'opacity', parseFloat(e.target.value))}
          className="w-12 accent-teal-600 cursor-pointer"
        />
        <span className="text-[10px] font-mono text-slate-500">
          {Math.round((cls.opacity ?? 1.0) * 100)}%
        </span>
      </div>

      {/* Hapus */}
      <button
        type="button"
        onClick={() => onRemove(index)}
        className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition cursor-pointer"
        title="Remove Class"
      >
        <Trash2Icon className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

export default ClassBreakRow
