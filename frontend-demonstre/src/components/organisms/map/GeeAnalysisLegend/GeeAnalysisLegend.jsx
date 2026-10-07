const getLegendLabel = (palette, index) => {
  if (palette.labels?.[index]) return palette.labels[index]

  const colorCount = palette.colors?.length || 1
  const min = Number(palette.min)
  const max = Number(palette.max)
  if (!Number.isFinite(min) || !Number.isFinite(max)) return `Kelas ${index + 1}`

  const value = min + ((max - min) * index) / Math.max(1, colorCount - 1)
  return Number(value.toFixed(2)).toString()
}

const GeeAnalysisLegend = ({ previewLayer, isMinimized, onToggleMinimized }) => {
  const palette = previewLayer?.palette
  if (!palette?.colors?.length) return null

  return (
    <section className="pointer-events-auto max-h-[40vh] w-[min(20rem,calc(100vw-6rem))] overflow-y-auto rounded-2xl border border-emerald-300 bg-white/95 p-3 text-xs shadow-xl backdrop-blur-md">
      <div className="mb-1.5 flex items-center justify-between gap-2 border-b border-gray-100 pb-1.5">
        <h3 className="flex min-w-0 items-center gap-1.5 font-bold text-gray-800">
          <span className="text-emerald-600" aria-hidden="true">📊</span>
          <span className="truncate">
            Legenda: <span className="text-emerald-700 uppercase">{previewLayer.analysisType}</span>
          </span>
        </h3>
        <div className="flex shrink-0 items-center gap-1">
          <span className="rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 font-mono text-[10px] text-gray-500">
            {previewLayer.statistics?.unit || palette.unit || 'Index'}
          </span>
          <button
            type="button"
            onClick={onToggleMinimized}
            className="cursor-pointer px-1 text-xs font-bold text-gray-400 hover:text-gray-600"
            title={isMinimized ? 'Perluas legenda' : 'Minimalkan legenda'}
            aria-label={isMinimized ? 'Perluas legenda' : 'Minimalkan legenda'}
            aria-expanded={!isMinimized}
          >
            {isMinimized ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          <div
            className="mb-1 h-2.5 w-full rounded-md shadow-inner"
            aria-label={`Gradasi warna ${previewLayer.analysisType}`}
            style={{ background: `linear-gradient(to right, ${palette.colors.join(', ')})` }}
          />
          <div className="mb-2 flex justify-between font-mono text-[10px] text-gray-500">
            <span>Min: {palette.min}</span>
            <span>Maks: {palette.max}</span>
          </div>
          <div className="space-y-1 text-[10px]">
            {palette.colors.map((color, index) => (
              <div key={`${color}-${index}`} className="flex min-w-0 items-center gap-1.5">
                <span
                  className="h-3 w-3 shrink-0 rounded-sm border border-black/10"
                  style={{ backgroundColor: color }}
                />
                <span className="truncate text-gray-700">{getLegendLabel(palette, index)}</span>
              </div>
            ))}
          </div>

          {previewLayer.analysisType === 'agb' && (
            <div className="mt-2 flex items-center gap-1 border-t border-emerald-100 pt-1.5 text-[10px] font-semibold text-emerald-800">
              <span aria-hidden="true">🌿</span>
              <span>Nilai AGB makin tinggi = warna semakin hijau pekat.</span>
            </div>
          )}
        </>
      )}
    </section>
  )
}

export default GeeAnalysisLegend