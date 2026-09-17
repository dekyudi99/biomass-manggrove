import { useState, useMemo, useEffect } from 'react'
import {
  MapContainer,
  TileLayer,
  WMSTileLayer,
  Marker,
  Popup,
  Polygon,
  Polyline,
  CircleMarker,
  Tooltip,
  useMap,
  useMapEvents,
} from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import LayerBaseControl from '../components/LayerBaseControl'
import { BASE_LAYERS } from '../constants/layers'
import Sidebar from '../components/Sidebar'
import SpatialSidebar from '../components/SpatialSidebar/SpatialSidebar'
import MapFlyController from '../components/MapFlyController'
import FloatingMapControls from '../components/FloatingMapControls'
import { useLanguage } from '../context/LanguageContext'

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
  const { t, currentLanguage } = useLanguage()
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

  // State untuk Layer & Group WMS AstraGIS yang aktif di peta
  const [visibleLayers, setVisibleLayers] = useState([])
  const [visibleGroups, setVisibleGroups] = useState([])
  const [flyTarget, setFlyTarget] = useState(null)

  // State responsif sidebar: di desktop default kiri terbuka, di mobile (<1024px) saling eksklusif
  const [isLeftOpen, setIsLeftOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 1024
    }
    return true
  })
  const [isRightOpen, setIsRightOpen] = useState(false)

  const handleToggleLeft = (open) => {
    setIsLeftOpen(open)
    if (open && typeof window !== 'undefined' && window.innerWidth < 1024) {
      setIsRightOpen(false)
    }
  }

  const handleToggleRight = (open) => {
    setIsRightOpen(open)
    if (open && typeof window !== 'undefined' && window.innerWidth < 1024) {
      setIsLeftOpen(false)
    }
  }

  const handleZoomToLayer = (target) => {
    if (target?.bbox) {
      setFlyTarget({ bbox: target.bbox, epsg: target.epsg, timestamp: Date.now() })
    } else if (Array.isArray(target) && target.length === 4) {
      setFlyTarget({ bbox: target, epsg: 4326, timestamp: Date.now() })
    }
  }

  const handleZoomToGroup = (target) => {
    if (target?.bbox) {
      setFlyTarget({ bbox: target.bbox, epsg: target.epsg, timestamp: Date.now() })
    } else if (Array.isArray(target) && target.length === 4) {
      setFlyTarget({ bbox: target, epsg: 4326, timestamp: Date.now() })
    }
  }

  const handleToggleLayer = (layer, isVisible) => {
    if (isVisible) {
      setVisibleLayers((prev) => [
        ...prev.filter((l) => l.id !== layer.id),
        { ...layer, opacity: 0.85 },
      ])
      if (layer.bbox) {
        handleZoomToLayer(layer)
      }
    } else {
      setVisibleLayers((prev) => prev.filter((l) => l.id !== layer.id))
    }
  }

  const handleChangeLayerOpacity = (layerId, opacity) => {
    setVisibleLayers((prev) =>
      prev.map((l) => (l.id === layerId ? { ...l, opacity } : l))
    )
  }

  const handleToggleGroup = (group, isVisible) => {
    if (isVisible) {
      setVisibleGroups((prev) => [
        ...prev.filter((g) => g.id !== group.id),
        { ...group, opacity: 0.85 },
      ])
      if (group.bbox) {
        handleZoomToGroup(group)
      }
    } else {
      setVisibleGroups((prev) => prev.filter((g) => g.id !== group.id))
    }
  }

  const handleChangeGroupOpacity = (groupId, opacity) => {
    setVisibleGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, opacity } : g))
    )
  }

  // Callback saat style SLD layer diperbarui di GeoServer -> update styleVersion agar Leaflet memuat ulang tile tanpa reload halaman
  const handleStyleApplied = (layerId) => {
    const timestamp = Date.now()
    setVisibleLayers((prev) =>
      prev.map((l) => (l.id === layerId ? { ...l, styleVersion: timestamp } : l))
    )
  }

  // Hitung luas poligon hanya saat area sudah ditutup
  const areaHectares = useMemo(() => {
    if (!isAreaClosed || areaPoints.length < 3) return 0
    return calculatePolygonAreaInHectares(areaPoints)
  }, [areaPoints, isAreaClosed])

  // Helper resolve URL WMS dengan opsi override dari .env (VITE_GEOSERVER_WMS_URL)
  const resolveWmsUrl = (wmsUrl) => {
    const overrideBase = import.meta.env.VITE_GEOSERVER_WMS_URL
    if (!overrideBase || !wmsUrl) return wmsUrl
    try {
      const parsed = new URL(wmsUrl)
      const geoserverIdx = parsed.pathname.indexOf('/geoserver/')
      const relPath =
        geoserverIdx !== -1
          ? parsed.pathname.substring(geoserverIdx + '/geoserver'.length)
          : parsed.pathname
      return `${overrideBase.replace(/\/+$/, '')}${relPath}${parsed.search}`
    } catch {
      return wmsUrl
    }
  }

  // Reverse Geocoding dengan bahasa dinamis sesuai pilihan user
  const fetchAddress = async (lat, lng) => {
    setIsAddressLoading(true)
    try {
      const nominatimBase = (
        import.meta.env.VITE_NOMINATIM_URL || 'https://nominatim.openstreetmap.org'
      ).replace(/\/+$/, '')
      const response = await fetch(
        `${nominatimBase}/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        {
          headers: {
            'Accept-Language': currentLanguage || 'id',
          },
        }
      )
      const data = await response.json()
      setPointAddress(data.display_name || t('addressNotFound'))
    } catch (error) {
      console.error('Gagal mengambil data alamat:', error)
      setPointAddress(t('failedAddress'))
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
    <div className="relative h-[100dvh] w-screen overflow-hidden">
      {/* Backdrop gelap di mobile (<1024px) jika salah satu sidebar dibuka */}
      {(isLeftOpen || isRightOpen) && (
        <div
          onClick={() => {
            setIsLeftOpen(false)
            setIsRightOpen(false)
          }}
          className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[990] lg:hidden transition-opacity cursor-pointer"
          aria-label="Close menus"
        />
      )}

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
        isOpen={isLeftOpen}
        onToggle={handleToggleLeft}
      />

      {/* Sidebar Spasial AstraGIS di Kanan Atas */}
      <SpatialSidebar
        visibleLayers={visibleLayers}
        onToggleLayer={handleToggleLayer}
        onChangeLayerOpacity={handleChangeLayerOpacity}
        onZoomToLayer={handleZoomToLayer}
        visibleGroups={visibleGroups}
        onToggleGroup={handleToggleGroup}
        onChangeGroupOpacity={handleChangeGroupOpacity}
        onZoomToGroup={handleZoomToGroup}
        onStyleApplied={handleStyleApplied}
        isOpen={isRightOpen}
        onToggle={handleToggleRight}
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
        <MapFlyController flyTarget={flyTarget} />
        <FloatingMapControls defaultCenter={defaultCenter} />

        {/* TileLayer dasar */}
        <TileLayer
          key={currentLayer.id}
          url={currentLayer.url}
          attribution={currentLayer.attribution}
          maxZoom={currentLayer.maxZoom}
        />

        {/* Render Layer WMS AstraGIS yang Aktif (dengan cache-busting instant saat style diubah) */}
        {visibleLayers.map((layer) => (
          <WMSTileLayer
            key={`wms-layer-${layer.id}-${layer.wms_layers_param}-${layer.styleVersion || 1}`}
            url={resolveWmsUrl(layer.wms_url)}
            params={{
              layers: layer.wms_layers_param,
              format: 'image/png',
              transparent: true,
              version: '1.1.1',
              _t: layer.styleVersion || 1,
            }}
            opacity={layer.opacity ?? 0.85}
            zIndex={100}
          />
        ))}

        {/* Render Layer Group WMS AstraGIS yang Aktif */}
        {visibleGroups.map((grp) => (
          <WMSTileLayer
            key={`wms-grp-${grp.id}-${grp.wms_layers_param}-${grp.styleVersion || 1}`}
            url={resolveWmsUrl(grp.wms_url)}
            params={{
              layers: grp.wms_layers_param,
              format: 'image/png',
              transparent: true,
              version: '1.1.1',
              _t: grp.styleVersion || 1,
            }}
            opacity={grp.opacity ?? 0.85}
            zIndex={100}
          />
        ))}

        {/* 1. RENDER TITIK PIN LOKASI */}
        {selectedPoint && (
          <Marker position={[selectedPoint.lat, selectedPoint.lng]}>
            <Popup>
              <div className="text-xs text-gray-800 max-w-xs">
                <p className="font-bold text-emerald-800 text-sm mb-1">{t('selectedPointMarker')}</p>
                <p className="font-mono text-[11px] text-gray-500 mb-1">
                  Lat: {selectedPoint.lat.toFixed(5)}, Lng: {selectedPoint.lng.toFixed(5)}
                </p>
                <p className="text-gray-700 leading-snug">
                  {isAddressLoading ? t('fetchingAddress') : pointAddress}
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
                <p className="font-bold text-emerald-800">{t('mangroveAreaDone')}</p>
                <p className="mt-1">
                  {t('areaSize')} <strong>{areaHectares.toFixed(2)} Ha</strong>
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
                    {t('clickHereToCloseArea')}
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