import { useState, useRef, useEffect } from 'react'
import { BASE_LAYERS } from '../constants/layers'
import { useLanguage } from '../context/LanguageContext'

const LayerBaseControl = ({ activeLayer, onSelectLayer }) => {
  const { t } = useLanguage()
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef(null)

  const mainThumbLayer =
    activeLayer === 'satellite'
      ? BASE_LAYERS.satellite
      : activeLayer === 'osm'
      ? BASE_LAYERS.osm
      : BASE_LAYERS.terrain

  const getLayerDisplayName = (layerId) => {
    switch (layerId) {
      case 'osm':
        return t('baseLayerStandard')
      case 'satellite':
        return t('baseLayerSatellite')
      case 'terrain':
        return t('baseLayerTerrain')
      default:
        return layerId
    }
  }

  const activeLayerName = getLayerDisplayName(mainThumbLayer.id)

  // Tutup popup jika user klik di luar area kontrol (terutama di mobile)
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('pointerdown', handleClickOutside)
    return () => document.removeEventListener('pointerdown', handleClickOutside)
  }, [])

  const handleThumbnailClick = (e) => {
    e.stopPropagation()
    setIsOpen((prev) => !prev)
  }

  const handleSelect = (layerId) => {
    onSelectLayer(layerId)
    setIsOpen(false)
  }

  return (
    <div
      ref={containerRef}
      className="absolute bottom-3 left-3 sm:bottom-6 sm:left-6 z-[950] flex items-end gap-1.5 sm:gap-2 max-w-[calc(100vw-1.5rem)]"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      {/* Tombol Utama (Thumbnail Kotak persis Google Maps) */}
      <button
        onClick={handleThumbnailClick}
        className="relative group w-13 h-13 sm:w-16 sm:h-16 rounded-xl overflow-hidden border-2 border-white shadow-xl cursor-pointer transition-transform duration-200 hover:scale-105 active:scale-95 focus:outline-none flex-shrink-0"
        title={`${t('switchBaseLayer')} ${activeLayerName}`}
        aria-label={t('switchBaseLayer')}
      >
        <img
          src={mainThumbLayer.preview}
          alt={activeLayerName}
          className="w-full h-full object-cover group-hover:brightness-95 transition-all"
        />
        {/* Label di bawah thumbnail */}
        <span className="absolute inset-x-0 bottom-0 py-0.5 text-center text-[9px] sm:text-[10px] font-medium text-white bg-black/60 backdrop-blur-xs truncate px-1">
          {activeLayerName}
        </span>
      </button>

      {/* Menu Pop-up Pilihan Layer yang Muncul Saat di-Hover atau di-Klik (Responsif Mobile) */}
      <div
        className={`flex items-center gap-1.5 sm:gap-2 p-1.5 sm:p-2 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-200/80 transition-all duration-300 origin-left overflow-x-auto max-w-[calc(100vw-5.5rem)] sm:max-w-none ${
          isOpen
            ? 'opacity-100 scale-100 pointer-events-auto translate-x-0'
            : 'opacity-0 scale-95 pointer-events-none -translate-x-2'
        }`}
      >
        {Object.values(BASE_LAYERS).map((layer) => {
          const isActive = activeLayer === layer.id
          const displayName = getLayerDisplayName(layer.id)
          return (
            <button
              key={layer.id}
              onClick={() => handleSelect(layer.id)}
              className="flex flex-col items-center gap-1 group cursor-pointer focus:outline-none flex-shrink-0 p-0.5"
            >
              <div
                className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl overflow-hidden border-2 transition-all duration-200 ${
                  isActive
                    ? 'border-emerald-600 ring-2 ring-emerald-500/40 scale-105 shadow-md'
                    : 'border-transparent group-hover:border-gray-300 group-hover:scale-105 opacity-80 group-hover:opacity-100'
                }`}
              >
                <img
                  src={layer.preview}
                  alt={displayName}
                  className="w-full h-full object-cover"
                />
              </div>
              <span
                className={`text-[10px] sm:text-[11px] font-medium transition-colors truncate max-w-[56px] text-center ${
                  isActive
                    ? 'text-emerald-700 font-semibold'
                    : 'text-gray-600 group-hover:text-gray-900'
                }`}
              >
                {displayName}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default LayerBaseControl