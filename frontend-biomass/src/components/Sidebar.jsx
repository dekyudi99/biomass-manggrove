import { useState } from 'react'

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
}) => {
  const [isOpen, setIsOpen] = useState(true)
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
    <aside className="absolute top-4 left-4 z-[1000] flex flex-col gap-2 pointer-events-none">
      {/* Tombol Buka/Tutup Sidebar jika diminimize */}
      <div className="pointer-events-auto flex items-center gap-2">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="bg-white/95 backdrop-blur-md px-3 py-2 rounded-xl shadow-lg border border-gray-200/80 text-gray-700 hover:text-emerald-600 hover:bg-emerald-50 transition-all flex items-center gap-2 font-medium text-sm cursor-pointer"
        >
          <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          <span>{isOpen ? 'Tutup Panel' : 'Panel Mangrove Tools'}</span>
        </button>
      </div>

      {/* Konten Panel Utama */}
      {isOpen && (
        <div className="pointer-events-auto w-84 sm:w-96 max-h-[85vh] overflow-y-auto bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-200/80 p-4 transition-all duration-300 flex flex-col gap-4 text-gray-800">
          {/* Header Panel */}
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div>
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-1.5">
                <span>🌿</span> Mangrove Biomass GIS
              </h2>
              <p className="text-xs text-gray-500">Alat Pemetaan Titik & Area Poligon</p>
            </div>
            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider">
              GEE Ready
            </span>
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
              Titik Lokasi
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
              Area Poligon
            </button>
          </div>

          {/* TAB 1: MODE TITIK LOKASI */}
          {mode === 'point' && (
            <div className="flex flex-col gap-3">
              <div className="bg-emerald-50/70 border border-emerald-200/60 rounded-xl p-3 text-xs text-emerald-900 leading-relaxed">
                👉 <strong>Cara Pakai:</strong> Klik sembarang lokasi di peta untuk menaruh pin marker, melihat koordinat, dan mengambil alamat otomatis.
              </div>

              {selectedPoint ? (
                <div className="flex flex-col gap-2.5 bg-gray-50 border border-gray-200/70 rounded-xl p-3">
                  {/* Koordinat */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Koordinat:</span>
                    <button
                      onClick={() => handleCopyCoord(`${selectedPoint.lat.toFixed(6)}, ${selectedPoint.lng.toFixed(6)}`)}
                      className="text-[11px] text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1 cursor-pointer"
                    >
                      {copied ? '✓ Tersalin' : '📋 Salin'}
                    </button>
                  </div>
                  <div className="font-mono text-xs font-bold text-gray-800 bg-white px-2.5 py-1.5 rounded-lg border border-gray-200 flex justify-between">
                    <span>Lat: {selectedPoint.lat.toFixed(6)}</span>
                    <span>Lng: {selectedPoint.lng.toFixed(6)}</span>
                  </div>

                  {/* Alamat Lengkap */}
                  <div className="mt-1">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Alamat Lokasi:</span>
                    <div className="mt-1 text-xs text-gray-700 bg-white p-2.5 rounded-lg border border-gray-200 min-h-[48px] leading-relaxed">
                      {isAddressLoading ? (
                        <div className="flex items-center gap-2 text-gray-400 italic">
                          <span className="animate-spin text-base">⏳</span> Mengambil data alamat...
                        </div>
                      ) : (
                        pointAddress || 'Alamat tidak ditemukan'
                      )}
                    </div>
                  </div>

                  <button
                    onClick={handleResetPoint}
                    className="mt-1 w-full py-1.5 px-3 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-xs font-medium transition-colors cursor-pointer"
                  >
                    Hapus Titik Pin
                  </button>
                </div>
              ) : (
                <div className="text-center py-6 text-gray-400 text-xs border-2 border-dashed border-gray-200 rounded-xl">
                  Belum ada titik yang dipilih di peta.
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
                    👉 <strong>Cara Menggambar:</strong> Klik titik-titik di peta keliling area. Jika sudah selesai (min. 3 titik), <strong>klik titik awal (🎯) di peta</strong> atau tombol di bawah untuk menyambungkan dan mengunci area.
                  </>
                ) : (
                  <>
                    ✅ <strong>Area Berhasil Ditutup:</strong> Area poligon sudah terbentuk dan luasnya telah dihitung. Anda siap menganalisisnya ke Google Earth Engine!
                  </>
                )}
              </div>

              {/* Status Area & Luas */}
              <div className="bg-gray-50 border border-gray-200/70 rounded-xl p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500 font-medium">Status Area:</span>
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
                      ? '✓ Terkunci (Selesai)'
                      : areaPoints.length >= 3
                      ? 'Siap Ditutup'
                      : 'Sedang Menggambar...'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500 font-medium">Titik Sudut:</span>
                  <span className="font-bold text-gray-800 bg-white px-2 py-0.5 rounded border border-gray-200">
                    {areaPoints.length} Titik
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs border-t border-gray-200/60 pt-2">
                  <span className="text-gray-500 font-medium">Estimasi Luas:</span>
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
                  <span>🎯</span> Sambungkan & Kunci Area
                </button>
              )}

              {/* Jika sudah ditutup, sediakan opsi buka kembali jika mau diedit */}
              {isAreaClosed && (
                <button
                  onClick={() => setIsAreaClosed(false)}
                  className="w-full py-1.5 px-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium text-xs rounded-lg border border-gray-300 transition-all cursor-pointer flex items-center justify-center gap-1"
                >
                  <span>✏️</span> Buka Kembali / Tambah Titik
                </button>
              )}

              {/* Tombol Kontrol Poligon */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleUndoPoint}
                  disabled={areaPoints.length === 0}
                  className="flex-1 py-1.5 px-3 rounded-lg border border-gray-200 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-medium text-gray-700 transition-colors cursor-pointer"
                >
                  ↩ Undo Titik
                </button>
                <button
                  onClick={handleResetArea}
                  disabled={areaPoints.length === 0}
                  className="flex-1 py-1.5 px-3 rounded-lg border border-red-200 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-medium text-red-600 transition-colors cursor-pointer"
                >
                  🗑️ Reset Area
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
                onClick={() => alert(`Area poligon (${areaPoints.length} titik, ${areaHectares.toFixed(2)} Ha) siap dikirim ke backend FastAPI GEE!`)}
                className="w-full mt-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <span>🛰️</span> Analisis Biomassa di GEE
              </button>
            </div>
          )}
        </div>
      )}
    </aside>
  )
}

export default Sidebar