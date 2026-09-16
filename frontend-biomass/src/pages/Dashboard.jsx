import { useState, useMemo } from 'react'
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polygon,
  Polyline,
  CircleMarker,
  Tooltip,
  useMapEvents,
} from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import LayerBaseControl from '../components/LayerBaseControl'
import { BASE_LAYERS } from '../constants/layers'
import Sidebar from '../components/Sidebar'

// Fix icon marker bawaan Leaflet di React/Vite
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
})

// Fungsi akurat menghitung luas area poligon di bumi dalam satuan Hektar (Ha)
function calculatePolygonAreaInHectares(coords) {
  if (!coords || coords.length < 3) return 0
  const R = 6378137 // Radius bumi dalam meter
  let area = 0
  const n = coords.length
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    const [lat1, lon1] = coords[i]
    const [lat2, lon2] = coords[j]
    const p1 = (lat1 * Math.PI) / 180
    const p2 = (lat2 * Math.PI) / 180
    const dLon = ((lon2 - lon1) * Math.PI) / 180
    area += dLon * (2 + Math.sin(p1) + Math.sin(p2))
  }
  area = Math.abs((area * R * R) / 4)
  return area / 10000 // 1 Ha = 10,000 m^2
}

// Komponen penangkap event klik pada peta
function MapEvents({ mode, isAreaClosed, onMapClick }) {
  useMapEvents({
    click(e) {
      if (mode === 'area' && isAreaClosed) {
        // Jika area sudah ditutup, jangan tambah titik baru
        return
      }
      onMapClick(e.latlng)
    },
  })
  return null
}

const Dashboard = () => {
  const defaultCenter = [13.652913414797453, 100.49455240687257]
  const [activeLayer, setActiveLayer] = useState('osm')
  const currentLayer = BASE_LAYERS[activeLayer]

  // State mode: 'point' (Titik Pin) atau 'area' (Poligon)
  const [mode, setMode] = useState('point')

  // State untuk Titik Lokasi
  const [selectedPoint, setSelectedPoint] = useState(null)
  const [pointAddress, setPointAddress] = useState('')
  const [isAddressLoading, setIsAddressLoading] = useState(false)

  // State untuk Poligon Area
  const [areaPoints, setAreaPoints] = useState([])
  const [isAreaClosed, setIsAreaClosed] = useState(false)

  // Hitung luas poligon hanya saat area sudah ditutup
  const areaHectares = useMemo(() => {
    if (!isAreaClosed || areaPoints.length < 3) return 0
    return calculatePolygonAreaInHectares(areaPoints)
  }, [areaPoints, isAreaClosed])

  // Reverse Geocoding
  const fetchAddress = async (lat, lng) => {
    setIsAddressLoading(true)
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        {
          headers: {
            'Accept-Language': 'id',
          },
        }
      )
      const data = await response.json()
      setPointAddress(data.display_name || 'Alamat tidak ditemukan')
    } catch (error) {
      console.error('Gagal mengambil data alamat:', error)
      setPointAddress('Gagal memuat alamat')
    } finally {
      setIsAddressLoading(false)
    }
  }

  // Handler saat user mengklik peta
  const handleMapClick = (latlng) => {
    const { lat, lng } = latlng

    if (mode === 'point') {
      setSelectedPoint({ lat, lng })
      fetchAddress(lat, lng)
    } else if (mode === 'area') {
      setAreaPoints((prev) => [...prev, [lat, lng]])
    }
  }

  // Tutup area saat titik awal diklik
  const handleCloseArea = () => {
    if (areaPoints.length >= 3) {
      setIsAreaClosed(true)
    }
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      {/* Sidebar Tool di Kiri Atas */}
      <Sidebar
        mode={mode}
        setMode={setMode}
        selectedPoint={selectedPoint}
        setSelectedPoint={setSelectedPoint}
        areaPoints={areaPoints}
        setAreaPoints={setAreaPoints}
        isAreaClosed={isAreaClosed}
        setIsAreaClosed={setIsAreaClosed}
        areaHectares={areaHectares}
        isAddressLoading={isAddressLoading}
        pointAddress={pointAddress}
        onCloseArea={handleCloseArea}
      />

      {/* Peta Utama */}
      <MapContainer
        center={defaultCenter}
        zoom={10}
        zoomControl={false}
        scrollWheelZoom={true}
        className="h-full w-full z-0 cursor-crosshair"
      >
        <MapEvents mode={mode} isAreaClosed={isAreaClosed} onMapClick={handleMapClick} />

        {/* TileLayer dasar */}
        <TileLayer
          key={currentLayer.id}
          url={currentLayer.url}
          attribution={currentLayer.attribution}
          maxZoom={currentLayer.maxZoom}
        />

        {/* 1. RENDER TITIK PIN LOKASI */}
        {selectedPoint && (
          <Marker position={[selectedPoint.lat, selectedPoint.lng]}>
            <Popup>
              <div className="text-xs text-gray-800 max-w-xs">
                <p className="font-bold text-emerald-800 text-sm mb-1">📍 Titik Terpilih</p>
                <p className="font-mono text-[11px] text-gray-500 mb-1">
                  Lat: {selectedPoint.lat.toFixed(5)}, Lng: {selectedPoint.lng.toFixed(5)}
                </p>
                <p className="text-gray-700 leading-snug">
                  {isAddressLoading ? 'Memuat alamat...' : pointAddress}
                </p>
              </div>
            </Popup>
          </Marker>
        )}

        {/* 2. RENDER AREA POLIGON (Hanya jika SUDAH DITUTUP oleh user) */}
        {isAreaClosed && areaPoints.length >= 3 && (
          <Polygon
            positions={areaPoints}
            pathOptions={{
              color: '#059669',
              fillColor: '#10b981',
              fillOpacity: 0.35,
              weight: 2.5,
            }}
          >
            <Popup>
              <div className="text-xs text-gray-800">
                <p className="font-bold text-emerald-800">🌿 Area Mangrove Selesai</p>
                <p className="mt-1">
                  Luas: <strong>{areaHectares.toFixed(2)} Ha</strong>
                </p>
                <p className="text-gray-500 text-[10px]">
                  ≈ {(areaHectares * 10000).toLocaleString('id-ID')} m²
                </p>
              </div>
            </Popup>
          </Polygon>
        )}

        {/* Garis terbuka saat user masih menggambar (belum ditutup) */}
        {!isAreaClosed && areaPoints.length >= 2 && (
          <Polyline
            positions={areaPoints}
            pathOptions={{
              color: '#059669',
              weight: 3,
              dashArray: '5, 5',
            }}
          />
        )}

        {/* Render titik-titik sudut yang diklik */}
        {areaPoints.map((point, index) => {
          const isFirstPoint = index === 0
          const canCloseNow = isFirstPoint && areaPoints.length >= 3 && !isAreaClosed

          return (
            <CircleMarker
              key={index}
              center={point}
              radius={canCloseNow ? 9 : 5}
              eventHandlers={{
                click: (e) => {
                  if (canCloseNow) {
                    L.DomEvent.stopPropagation(e)
                    handleCloseArea()
                  }
                },
              }}
              pathOptions={{
                color: canCloseNow ? '#d97706' : '#047857',
                fillColor: canCloseNow ? '#fbbf24' : '#34d399',
                fillOpacity: 1,
                weight: canCloseNow ? 3 : 2,
              }}
            >
              {canCloseNow && (
                <Tooltip direction="top" offset={[0, -10]} opacity={1} permanent>
                  <span className="text-[11px] font-bold text-amber-900">
                    🎯 Klik di sini untuk menutup area
                  </span>
                </Tooltip>
              )}
            </CircleMarker>
          )
        })}
      </MapContainer>

      {/* Layer Control melayang di pojok kiri bawah (Google Maps Style) */}
      <LayerBaseControl
        activeLayer={activeLayer}
        onSelectLayer={setActiveLayer}
      />
    </div>
  )
}

export default Dashboard