import { useState } from 'react'
import { BASE_LAYERS } from '../constants/layers'

const LayerBaseControl = ({ activeLayer, onSelectLayer }) => {
    const [isHovered, setIsHovered] = useState(false)
    const mainThumbLayer = activeLayer === 'satellite' ? BASE_LAYERS.satellite: activeLayer === 'osm'? BASE_LAYERS.osm : BASE_LAYERS.terrain

    return (
      <div
        className="absolute bottom-6 left-6 z-[1000] flex items-end gap-2"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        >
        {/* Tombol Utama (Thumbnail Kotak persis Google Maps) */}
        <button
            onClick={() => onSelectLayer(mainThumbLayer.id)}
            className="relative group w-16 h-16 rounded-xl overflow-hidden border-2 border-white shadow-xl cursor-pointer transition-transform duration-200 hover:scale-105 active:scale-95 focus:outline-none"
            title={`Ganti ke ${mainThumbLayer.name}`}
        >
            <img
            src={mainThumbLayer.preview}
            alt={mainThumbLayer.name}
            className="w-full h-full object-cover group-hover:brightness-95 transition-all"
            />
            {/* Label di bawah thumbnail */}
            <span className="absolute inset-x-0 bottom-0 py-0.5 text-center text-[10px] font-medium text-white bg-black/60 backdrop-blur-xs">
            {mainThumbLayer.name}
            </span>
        </button>
        {/* Menu Pop-up Pilihan Layer yang Muncul Saat di-Hover (Gaya Google Maps) */}
        <div
            className={`flex items-center gap-2 p-2 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-200/80 transition-all duration-300 origin-left ${
            isHovered
                ? 'opacity-100 scale-100 pointer-events-auto translate-x-0'
                : 'opacity-0 scale-95 pointer-events-none -translate-x-2'
            }`}
        >
            {Object.values(BASE_LAYERS).map((layer) => {
            const isActive = activeLayer === layer.id
            return (
                <button
                key={layer.id}
                onClick={() => onSelectLayer(layer.id)}
                className="flex flex-col items-center gap-1 group cursor-pointer focus:outline-none"
                >
                <div
                    className={`w-12 h-12 rounded-xl overflow-hidden border-2 transition-all duration-200 ${
                    isActive
                        ? 'border-emerald-600 ring-2 ring-emerald-500/40 scale-105 shadow-md'
                        : 'border-transparent group-hover:border-gray-300 group-hover:scale-105 opacity-80 group-hover:opacity-100'
                    }`}
                >
                    <img
                    src={layer.preview}
                    alt={layer.name}
                    className="w-full h-full object-cover"
                    />
                </div>
                <span
                    className={`text-[11px] font-medium transition-colors ${
                    isActive
                        ? 'text-emerald-700 font-semibold'
                        : 'text-gray-600 group-hover:text-gray-900'
                    }`}
                >
                    {layer.name}
                </span>
                </button>
            )
            })}
        </div>
        </div>
    )
}

export default LayerBaseControl