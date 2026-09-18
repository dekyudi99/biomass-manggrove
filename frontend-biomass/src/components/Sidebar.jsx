import { useState } from 'react'
import { useLanguage } from '../context/LanguageContext'

const Sidebar = ({
  mode,
  setMode,
  selectedPoint,
  setSelectedPoint,
  areaPoints,
  setAreaPoints,
  isAreaClosed,
  setIsAreaClosed,
  areaHectares,
  isAddressLoading,
  pointAddress,
  onCloseArea,
  onOpenGeeAnalysis,
  isAoiVisible = true,
  onToggleAoi,
  isAoiFillVisible = true,
  onToggleAoiFill,
  isOpen: propIsOpen,
  onToggle: propOnToggle,
  otherSidebarOpen = false,
}) => {
  const { t } = useLanguage()
  const [localIsOpen, setLocalIsOpen] = useState(true)
  const isControlled = typeof propIsOpen === 'boolean'
  const isOpen = isControlled ? propIsOpen : localIsOpen

  const toggleOpen = () => {
    if (isControlled && propOnToggle) {
      propOnToggle(!isOpen)
    } else {
      setLocalIsOpen((prev) => !prev)
    }
  }

  const [copied, setCopied] = useState(false)

  const handleCopyCoord = (text) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleUndoPoint = () => {
    setAreaPoints((prev) => prev.slice(0, -1))
    setIsAreaClosed(false)
  }

  const handleResetArea = () => {
    setAreaPoints([])
    setIsAreaClosed(false)
  }

  const handleResetPoint = () => {
    setSelectedPoint(null)
  }

  return (
    <aside className="absolute top-3 left-3 sm:top-4 sm:left-4 z-[1000] flex flex-col gap-2 pointer-events-none max-w-[calc(100vw-1.5rem)]">
      {/* Tombol Buka/Tutup Sidebar jika diminimize (sembunyi di mobile jika sidebar kanan terbuka) */}
      <div className={`pointer-events-auto flex items-center gap-2 ${otherSidebarOpen ? 'hidden lg:flex' : 'flex'}`}>
        <button
          onClick={toggleOpen}
          className="bg-white/95 backdrop-blur-md px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl shadow-lg border border-gray-200/80 text-gray-700 hover:text-emerald-600 hover:bg-emerald-50 transition-all flex items-center gap-1.5 font-medium text-xs sm:text-sm cursor-pointer active:scale-95"
          title={isOpen ? t('closePanel') : t('openPanel')}
          aria-label={isOpen ? t('closePanel') : t('openPanel')}
        >
          <svg className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          <span className="hidden sm:inline truncate max-w-[140px]">{isOpen ? t('closePanel') : t('openPanel')}</span>
          <span className="inline sm:hidden text-xs font-semibold text-emerald-800">Biomass</span>
        </button>
      </div>

      {/* Konten Panel Utama */}
      {isOpen && (
        <div className="pointer-events-auto w-[calc(100vw-1.5rem)] sm:w-96 max-w-sm sm:max-w-md max-h-[calc(100dvh-5.5rem)] overflow-y-auto overscroll-contain bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-200/80 p-3 sm:p-4 transition-all duration-300 flex flex-col gap-3 sm:gap-4 text-gray-800">
          {/* Header Panel */}
          <div className="flex items-center justify-between border-b border-gray-100 pb-2.5 sm:pb-3 gap-2">
            <div className="min-w-0 flex-1">
              <h2 className="text-sm sm:text-base font-bold text-gray-900 flex items-center gap-1.5 truncate">
                <span>🌿</span> <span className="truncate">{t('appTitle')}</span>
              </h2>
              <p className="text-[11px] sm:text-xs text-gray-500 truncate">{t('appSubtitle')}</p>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider hidden sm:inline-block">
                {t('geeReady')}
              </span>
              <button
                onClick={toggleOpen}
                className="lg:hidden p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg cursor-pointer transition"
                title={t('closePanel')}
                aria-label={t('closePanel')}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-gray-100/90 rounded-xl">
            <button
              onClick={() => setMode('point')}
              className={`py-2 px-3 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                mode === 'point'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {t('pointMode')}
            </button>

            <button
              onClick={() => setMode('area')}
              className={`py-2 px-3 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                mode === 'area'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              {t('areaMode')}
            </button>
          </div>

          {/* TAB 1: MODE TITIK LOKASI */}
          {mode === 'point' && (
            <div className="flex flex-col gap-3">
              <div className="bg-emerald-50/70 border border-emerald-200/60 rounded-xl p-3 text-xs text-emerald-900 leading-relaxed">
                👉 <strong>{t('pointUsageTitle')}</strong> {t('pointUsageDesc')}
              </div>

              {selectedPoint ? (
                <div className="flex flex-col gap-2.5 bg-gray-50 border border-gray-200/70 rounded-xl p-3">
                  {/* Koordinat */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('coordinates')}:</span>
                    <button
                      onClick={() => handleCopyCoord(`${selectedPoint.lat.toFixed(6)}, ${selectedPoint.lng.toFixed(6)}`)}
                      className="text-[11px] text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1 cursor-pointer"
                    >
                      {copied ? t('copied') : t('copy')}
                    </button>
                  </div>
                  <div className="font-mono text-xs font-bold text-gray-800 bg-white px-2.5 py-1.5 rounded-lg border border-gray-200 flex justify-between">
                    <span>Lat: {selectedPoint.lat.toFixed(6)}</span>
                    <span>Lng: {selectedPoint.lng.toFixed(6)}</span>
                  </div>

                  {/* Alamat Lengkap */}
                  <div className="mt-1">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('locationAddress')}:</span>
                    <div className="mt-1 text-xs text-gray-700 bg-white p-2.5 rounded-lg border border-gray-200 min-h-[48px] leading-relaxed">
                      {isAddressLoading ? (
                        <div className="flex items-center gap-2 text-gray-400 italic">
                          <span className="animate-spin text-base">⏳</span> {t('fetchingAddress')}
                        </div>
                      ) : (
                        pointAddress || t('addressNotFound')
                      )}
                    </div>
                  </div>

                  <button
                    onClick={handleResetPoint}
                    className="mt-1 w-full py-1.5 px-3 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-xs font-medium transition-colors cursor-pointer"
                  >
                    {t('deletePointPin')}
                  </button>
                </div>
              ) : (
                <div className="text-center py-6 text-gray-400 text-xs border-2 border-dashed border-gray-200 rounded-xl">
                  {t('noPointSelected')}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: MODE POLIGON AREA */}
          {mode === 'area' && (
            <div className="flex flex-col gap-3">
              {/* Petunjuk Interaktif */}
              <div className="bg-emerald-50/70 border border-emerald-200/60 rounded-xl p-3 text-xs text-emerald-900 leading-relaxed">
                {!isAreaClosed ? (
                  <>
                    👉 <strong>{t('drawUsageTitle')}</strong> {t('drawUsageDesc')}
                  </>
                ) : (
                  <>
                    ✅ <strong>{t('areaClosedTitle')}</strong> {t('areaClosedDesc')}
                  </>
                )}
              </div>

              {/* Status Area & Luas */}
              <div className="bg-gray-50 border border-gray-200/70 rounded-xl p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500 font-medium">{t('areaStatus')}</span>
                  <span
                    className={`font-semibold px-2 py-0.5 rounded text-[11px] ${
                      isAreaClosed
                        ? 'bg-emerald-100 text-emerald-800'
                        : areaPoints.length >= 3
                        ? 'bg-amber-100 text-amber-800 animate-pulse'
                        : 'bg-gray-200 text-gray-700'
                    }`}
                  >
                    {isAreaClosed
                      ? t('statusLocked')
                      : areaPoints.length >= 3
                      ? t('statusReadyToClose')
                      : t('statusDrawing')}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500 font-medium">{t('vertices')}</span>
                  <span className="font-bold text-gray-800 bg-white px-2 py-0.5 rounded border border-gray-200">
                    {areaPoints.length} {t('pointsUnit')}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs border-t border-gray-200/60 pt-2">
                  <span className="text-gray-500 font-medium">{t('estimatedArea')}</span>
                  <div className="text-right">
                    <span className="font-bold text-emerald-700 text-sm">
                      {isAreaClosed && areaPoints.length >= 3 ? `${areaHectares.toFixed(2)} Ha` : '-'}
                    </span>
                    {isAreaClosed && areaPoints.length >= 3 && (
                      <p className="text-[10px] text-gray-400 font-mono">
                        ≈ {(areaHectares * 10000).toLocaleString('id-ID')} m²
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Tombol Tutup Area (Jika min 3 titik dan belum ditutup) */}
              {areaPoints.length >= 3 && !isAreaClosed && (
                <button
                  onClick={onCloseArea}
                  className="w-full py-2 px-3 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5 animate-bounce"
                >
                  <span>🎯</span> {t('connectAndLockArea')}
                </button>
              )}

              {/* Jika sudah ditutup, sediakan opsi buka kembali jika mau diedit & toggle AOI */}
              {isAreaClosed && (
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setIsAreaClosed(false)}
                      className="flex-1 py-1.5 px-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium text-xs rounded-lg border border-gray-300 transition-all cursor-pointer flex items-center justify-center gap-1"
                    >
                      <span>✏️</span> {t('reopenOrAddPoints')}
                    </button>
                    {onToggleAoi && (
                      <button
                        type="button"
                        onClick={onToggleAoi}
                        className={`py-1.5 px-2.5 font-semibold text-xs rounded-lg border transition-all cursor-pointer flex items-center justify-center gap-1 shrink-0 ${
                          !isAoiVisible
                            ? 'bg-amber-100 text-amber-900 border-amber-400 font-bold ring-1 ring-amber-400/30'
                            : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                        }`}
                        title={t('aoiFillHiddenHint')}
                      >
                        <span>{!isAoiVisible ? '🙈' : '👁️'}</span>
                        <span className="text-[11px]">{!isAoiVisible ? t('showAoi') : t('hideAoi')}</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Tombol Kontrol Poligon */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleUndoPoint}
                  disabled={areaPoints.length === 0}
                  className="flex-1 py-1.5 px-3 rounded-lg border border-gray-200 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-medium text-gray-700 transition-colors cursor-pointer"
                >
                  ↩ {t('undoPoint')}
                </button>
                <button
                  onClick={handleResetArea}
                  disabled={areaPoints.length === 0}
                  className="flex-1 py-1.5 px-3 rounded-lg border border-red-200 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-medium text-red-600 transition-colors cursor-pointer"
                >
                  🗑️ {t('resetArea')}
                </button>
              </div>

              {/* Daftar Koordinat Poligon Ringkas */}
              {areaPoints.length > 0 && (
                <div className="max-h-24 overflow-y-auto border border-gray-200 rounded-lg p-2 bg-white flex flex-col gap-1 text-[11px] font-mono text-gray-600">
                  {areaPoints.map((pt, idx) => (
                    <div key={idx} className="flex justify-between border-b border-gray-100 last:border-0 pb-0.5">
                      <span className="text-emerald-600 font-semibold">
                        {idx === 0 ? '🎯 #1' : `#${idx + 1}`}
                      </span>
                      <span>
                        {pt[0].toFixed(5)}, {pt[1].toFixed(5)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Tombol Aksi Analisis GEE (Hanya aktif jika SUDAH DITUTUP) */}
              <button
                disabled={!isAreaClosed || areaPoints.length < 3}
                onClick={() => {
                  if (onOpenGeeAnalysis) {
                    onOpenGeeAnalysis()
                  }
                }}
                className="w-full mt-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <span>🛰️</span> {t('analyzeBiomassGEE')}
              </button>
            </div>
          )}
        </div>
      )}
    </aside>
  )
}

export default Sidebar