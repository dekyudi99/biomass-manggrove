const GeePreviewIndicator = ({
  previewLayer,
  isAoiVisible,
  onToggleAoi,
  onOpenResults,
  onClearPreview,
  t,
}) => {
  if (!previewLayer) return null

  return (
    <div className="absolute top-16 sm:top-4 left-1/2 -translate-x-1/2 z-[900] bg-white/95 backdrop-blur-md px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full shadow-lg border border-emerald-300 flex items-center gap-2 sm:gap-2.5 text-[11px] sm:text-xs max-w-[calc(100vw-1.5rem)] overflow-x-auto no-scrollbar">
      <span className="flex h-2 w-2 relative shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
      </span>
      <span className="font-bold text-gray-800 whitespace-nowrap">
        Preview GEE: <span className="text-emerald-700 uppercase">{previewLayer.analysisType}</span>
      </span>

      <button
        onClick={onToggleAoi}
        className={`px-2 py-0.5 sm:px-2.5 sm:py-0.5 rounded-full font-bold text-[10px] sm:text-[11px] cursor-pointer transition border whitespace-nowrap flex items-center gap-1 sm:gap-1.5 ${
          !isAoiVisible
            ? 'bg-amber-100 text-amber-900 border-amber-400 ring-1 ring-amber-400/40'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-gray-300'
        }`}
        title={t('aoiFillHiddenHint')}
      >
        <span>{!isAoiVisible ? '🙈' : '👁️'}</span>
        <span>{!isAoiVisible ? t('showAoi') : t('hideAoi')}</span>
      </button>

      <button
        onClick={onOpenResults}
        className="text-blue-600 hover:text-blue-800 font-medium underline text-[10px] sm:text-[11px] cursor-pointer whitespace-nowrap"
      >
        {t('analysisResults')}
      </button>
      <button
        onClick={onClearPreview}
        className="text-gray-400 hover:text-red-500 font-bold ml-0.5 sm:ml-1 text-xs sm:text-sm cursor-pointer shrink-0"
        title="Tutup preview"
      >
        ✕
      </button>
    </div>
  )
}

export default GeePreviewIndicator