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
  Circle,
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
import GeeAnalysisModal from '../components/GeeAnalysisModal'
import GeeDatasetExtractorModal from '../components/GeeDatasetExtractorModal'
import AoiExportModal from '../components/AoiExportModal'
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

// Icon khusus lokasi GPS pengguna saat ini (Google Maps Style pulsating blue dot)
const userLocationIcon = L.divIcon({
  className: 'custom-user-location-marker',
  html: `
    <div style="position: relative; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;">
      <div style="position: absolute; width: 30px; height: 30px; border-radius: 50%; background-color: rgba(59, 130, 246, 0.35); animation: user-loc-ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
      <div style="position: absolute; width: 22px; height: 22px; border-radius: 50%; background-color: rgba(59, 130, 246, 0.3);"></div>
      <div style="width: 14px; height: 14px; border-radius: 50%; background-color: #2563eb; border: 2.5px solid #ffffff; box-shadow: 0 0 10px rgba(37, 99, 235, 0.8); position: relative; z-index: 10;"></div>
    </div>
  `,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
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
  const defaultCenter = [-8.7291, 115.2105]
  const [activeLayer, setActiveLayer] = useState('osm')
  const currentLayer = BASE_LAYERS[activeLayer]

  // State mode: 'point' (Titik Pin) atau 'area' (Poligon)
  const [mode, setMode] = useState('point')

  // State untuk Titik Lokasi
  const [selectedPoint, setSelectedPoint] = useState(null)
  const [pointAddress, setPointAddress] = useState('')
  const [isAddressLoading, setIsAddressLoading] = useState(false)

  // State untuk Lokasi GPS Pengguna Saat Ini (Google Maps Style)
  const [userLocation, setUserLocation] = useState(null)

  // State untuk Poligon Area
  const [areaPoints, setAreaPoints] = useState([])
  const [isAreaClosed, setIsAreaClosed] = useState(false)

  // State untuk Modal Analisis GEE & Layer Preview GEE di Peta
  const [isGeeModalOpen, setIsGeeModalOpen] = useState(false)
  const [isDatasetExtractorOpen, setIsDatasetExtractorOpen] = useState(false)
  const [isExportModalOpen, setIsExportModalOpen] = useState(false)
  const [isEditingRoi, setIsEditingRoi] = useState(false)
  const [geePreviewLayer, setGeePreviewLayer] = useState(null)

  // State untuk Visibilitas AOI Poligon (agar warna hijau tidak menimpa/mengubah warna GEE)
  const [isAoiVisible, setIsAoiVisible] = useState(true)
  const [isAoiFillVisible, setIsAoiFillVisible] = useState(true)

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

  // Helper resolve URL WMS:
  // Selalu gunakan same-origin /geoserver jika diakses lewat HTTPS/domain publik
  // agar tidak terblokir Mixed Content (HTTPS vs HTTP) dan selalu ter-proxy dengan aman.
  const resolveWmsUrl = (wmsUrl) => {
    if (!wmsUrl) return wmsUrl
    try {
      const parsed = new URL(wmsUrl, window.location.origin)
      const geoserverIdx = parsed.pathname.indexOf('/geoserver')
      if (geoserverIdx !== -1) {
        const isHttpsPage = window.location.protocol === 'https:'
        const customWms = import.meta.env.VITE_GEOSERVER_WMS_URL
        if (customWms && !isHttpsPage && !customWms.includes('localhost')) {
          const relPath = parsed.pathname.substring(geoserverIdx + '/geoserver'.length)
          return `${customWms.replace(/\/+$/, '')}${relPath}${parsed.search}`
        }
        const relPath = parsed.pathname.substring(geoserverIdx)
        return `${window.location.origin}${relPath}${parsed.search}`
      }
      return wmsUrl
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

  // Handler saat file AOI diunggah (GeoJSON / CSV)
  const handleAoiUploaded = (points) => {
    if (!points || points.length < 3) return
    setAreaPoints(points)
    setIsAreaClosed(true)
    setMode('area')
    setIsEditingRoi(false)

    // Hitung bounding box koordinat untuk otomatis mengarahkan peta (fitBounds)
    const lats = points.map((p) => p[0])
    const lngs = points.map((p) => p[1])
    const minLat = Math.min(...lats)
    const maxLat = Math.max(...lats)
    const minLng = Math.min(...lngs)
    const maxLng = Math.max(...lngs)

    setFlyTarget({
      bbox: [minLng, minLat, maxLng, maxLat],
      epsg: 4326,
      timestamp: Date.now(),
    })
  }

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden">
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
        onOpenGeeAnalysis={() => setIsGeeModalOpen(true)}
        onOpenDatasetExtractor={() => setIsDatasetExtractorOpen(true)}
        onUploadAoi={handleAoiUploaded}
        isEditingRoi={isEditingRoi}
        onToggleEditRoi={() => setIsEditingRoi((prev) => !prev)}
        onOpenExportModal={() => setIsExportModalOpen(true)}
        isAoiVisible={isAoiVisible}
        onToggleAoi={() => setIsAoiVisible((prev) => !prev)}
        isAoiFillVisible={isAoiFillVisible}
        onToggleAoiFill={() => setIsAoiFillVisible((prev) => !prev)}
        isOpen={isLeftOpen}
        onToggle={handleToggleLeft}
        otherSidebarOpen={isRightOpen}
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
        otherSidebarOpen={isLeftOpen}
      />

      {/* Peta Utama */}
      <MapContainer
        center={defaultCenter}
        zoom={15}
        zoomControl={false}
        scrollWheelZoom={true}
        className="h-full w-full z-0 cursor-crosshair"
      >
        <MapEvents mode={mode} isAreaClosed={isAreaClosed} onMapClick={handleMapClick} />
        <MapFlyController flyTarget={flyTarget} />
        <FloatingMapControls
          defaultCenter={defaultCenter}
          userLocation={userLocation}
          onToggleUserLocation={setUserLocation}
          hasAoi={isAreaClosed && areaPoints.length >= 3}
          isAoiVisible={isAoiVisible}
          onToggleAoi={() => setIsAoiVisible((prev) => !prev)}
        />

        {/* TileLayer dasar */}
        <TileLayer
          key={currentLayer.id}
          url={currentLayer.url}
          attribution={currentLayer.attribution}
          maxZoom={currentLayer.maxZoom}
        />

        {/* Render Layer Preview Hasil Komputasi GEE */}
        {geePreviewLayer && (
          <TileLayer
            key={`gee-preview-${geePreviewLayer.tileUrl}`}
            url={geePreviewLayer.tileUrl}
            opacity={geePreviewLayer.opacity ?? 0.85}
            zIndex={150}
          />
        )}

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

        {/* 1b. RENDER LOKASI GPS PENGGUNA SAAT INI (GOOGLE MAPS STYLE TOGGLE) */}
        {userLocation && (
          <>
            {userLocation.accuracy && (
              <Circle
                center={[userLocation.lat, userLocation.lng]}
                radius={userLocation.accuracy}
                pathOptions={{
                  color: '#3b82f6',
                  fillColor: '#60a5fa',
                  fillOpacity: 0.15,
                  weight: 1.5,
                }}
              />
            )}
            <Marker
              position={[userLocation.lat, userLocation.lng]}
              icon={userLocationIcon}
            >
              <Popup>
                <div className="text-xs text-gray-800 p-0.5">
                  <p className="font-bold text-blue-700 text-sm mb-1 flex items-center gap-1.5">
                    <span>📍</span> {t('yourCurrentLocation')}
                  </p>
                  <p className="font-mono text-[11px] text-gray-600 mb-1">
                    Lat: {userLocation.lat.toFixed(6)}, Lng: {userLocation.lng.toFixed(6)}
                  </p>
                  {userLocation.accuracy && (
                    <p className="text-[10px] text-gray-500 bg-blue-50 px-2 py-0.5 rounded-full inline-block border border-blue-200">
                      {t('accuracy')}: ±{Math.round(userLocation.accuracy)} m
                    </p>
                  )}
                </div>
              </Popup>
            </Marker>
          </>
        )}

        {/* 2. RENDER AREA POLIGON (Hanya jika SUDAH DITUTUP oleh user) */}
        {isAreaClosed && areaPoints.length >= 3 && isAoiVisible && (
          <Polygon
            positions={areaPoints}
            pathOptions={{
              color: '#059669',
              fillColor: '#10b981',
              fillOpacity: isAoiFillVisible ? (geePreviewLayer ? 0.12 : 0.35) : 0,
              weight: 2.5,
              smoothFactor: 1.5,
              dashArray: !isAoiFillVisible ? '6, 6' : undefined,
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

        {/* Render titik-titik sudut HANYA saat user masih menggambar manual (belum ditutup) seperti di QGIS */}
        {!isAreaClosed && areaPoints.map((point, index) => {
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

        {/* MODE EDIT ROI: Render Marker Interaktif yang Dapat Digeser (Draggable) */}
        {isEditingRoi && isAreaClosed && (
          <>
            {/* 1. Marker Titik Sudut Utama (Draggable) */}
            {areaPoints.map((point, idx) => (
              <Marker
                key={`edit-vertex-${idx}`}
                position={point}
                draggable={true}
                icon={L.divIcon({
                  className: 'custom-edit-vertex-icon',
                  html: `
                    <div style="
                      width: 22px;
                      height: 22px;
                      border-radius: 50%;
                      background-color: #f59e0b;
                      border: 2px solid #ffffff;
                      box-shadow: 0 2px 6px rgba(0,0,0,0.4);
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      color: #ffffff;
                      font-weight: bold;
                      font-size: 10px;
                      cursor: grab;
                    ">
                      ${idx + 1}
                    </div>
                  `,
                  iconSize: [22, 22],
                  iconAnchor: [11, 11],
                })}
                eventHandlers={{
                  dragend: (e) => {
                    const newLatLng = e.target.getLatLng()
                    setAreaPoints((prev) => {
                      const updated = [...prev]
                      updated[idx] = [newLatLng.lat, newLatLng.lng]
                      return updated
                    })
                  },
                }}
              >
                <Popup>
                  <div className="text-xs p-1">
                    <p className="font-bold text-amber-800 text-sm mb-1">Titik Sudut #{idx + 1}</p>
                    <p className="font-mono text-[10px] text-gray-600 mb-1">
                      Lat: {point[0].toFixed(6)}, Lng: {point[1].toFixed(6)}
                    </p>
                    <p className="text-[10px] text-gray-500 mb-2">
                      💡 Geser marker ini di peta untuk mengubah bentuk area.
                    </p>
                    {areaPoints.length > 3 && (
                      <button
                        type="button"
                        onClick={() => {
                          setAreaPoints((prev) => prev.filter((_, i) => i !== idx))
                        }}
                        className="w-full py-1 px-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 text-[11px] font-bold border border-red-200 cursor-pointer transition"
                      >
                        🗑️ Hapus Titik Ini
                      </button>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* 2. Marker Midpoint Virtual (Klik untuk menambah titik baru di tengah sisi) */}
            {areaPoints.length >= 3 && areaPoints.map((point, idx) => {
              const nextPoint = areaPoints[(idx + 1) % areaPoints.length]
              const midLat = (point[0] + nextPoint[0]) / 2
              const midLng = (point[1] + nextPoint[1]) / 2

              return (
                <Marker
                  key={`mid-vertex-${idx}`}
                  position={[midLat, midLng]}
                  icon={L.divIcon({
                    className: 'custom-mid-vertex-icon',
                    html: `
                      <div style="
                        width: 16px;
                        height: 16px;
                        border-radius: 50%;
                        background-color: #3b82f6;
                        border: 2px solid #ffffff;
                        box-shadow: 0 1px 4px rgba(0,0,0,0.3);
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: #ffffff;
                        font-size: 11px;
                        font-weight: bold;
                        line-height: 1;
                      ">+</div>
                    `,
                    iconSize: [16, 16],
                    iconAnchor: [8, 8],
                  })}
                  eventHandlers={{
                    click: () => {
                      setAreaPoints((prev) => {
                        const updated = [...prev]
                        updated.splice(idx + 1, 0, [midLat, midLng])
                        return updated
                      })
                    },
                  }}
                >
                  <Tooltip direction="top" offset={[0, -8]}>
                    <span className="text-[10px] font-semibold">{t('insertVertexTip')}</span>
                  </Tooltip>
                </Marker>
              )
            })}
          </>
        )}
      </MapContainer>

      {/* Layer Control melayang di pojok kiri bawah (Google Maps Style) */}
      <LayerBaseControl
        activeLayer={activeLayer}
        onSelectLayer={setActiveLayer}
      />

      {/* Floating Indicator Layer Preview GEE Aktif */}
      {geePreviewLayer && (
        <div className="absolute top-16 sm:top-4 left-1/2 -translate-x-1/2 z-[900] bg-white/95 backdrop-blur-md px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full shadow-lg border border-emerald-300 flex items-center gap-2 sm:gap-2.5 text-[11px] sm:text-xs max-w-[calc(100vw-1.5rem)] overflow-x-auto no-scrollbar">
          <span className="flex h-2 w-2 relative shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="font-bold text-gray-800 whitespace-nowrap">
            Preview GEE: <span className="text-emerald-700 uppercase">{geePreviewLayer.analysisType}</span>
          </span>

          {/* Quick Toggle Sembunyikan/Tampilkan AOI agar warna satelit GEE murni */}
          <button
            onClick={() => setIsAoiVisible((prev) => !prev)}
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
            onClick={() => {
              if (geePreviewLayer?.isDataset) {
                setIsDatasetExtractorOpen(true)
              } else {
                setIsGeeModalOpen(true)
              }
            }}
            className="text-blue-600 hover:text-blue-800 font-medium underline text-[10px] sm:text-[11px] cursor-pointer whitespace-nowrap"
          >
            {t('analysisResults')}
          </button>
          <button
            onClick={() => setGeePreviewLayer(null)}
            className="text-gray-400 hover:text-red-500 font-bold ml-0.5 sm:ml-1 text-xs sm:text-sm cursor-pointer shrink-0"
            title="Tutup preview"
          >
            ✕
          </button>
        </div>
      )}

      {/* Modal Analisis Komputasi Citra Satelit GEE */}
      <GeeAnalysisModal
        isOpen={isGeeModalOpen}
        onClose={() => setIsGeeModalOpen(false)}
        areaPoints={areaPoints}
        areaHectares={areaHectares}
        onApplyGeePreviewLayer={setGeePreviewLayer}
        onClearGeePreviewLayer={() => setGeePreviewLayer(null)}
        activeGeeLayer={geePreviewLayer}
        isAoiVisible={isAoiVisible}
        onToggleAoi={() => setIsAoiVisible((prev) => !prev)}
        isAoiFillVisible={isAoiFillVisible}
        onToggleAoiFill={setIsAoiFillVisible}
        onLayerSavedToAstraGis={(result) => {
          // Trigger refresh layer jika ada
        }}
      />

      {/* Modal Ekstraksi Dataset Citra Satelit GEE untuk Peneliti / ML Training */}
      <GeeDatasetExtractorModal
        isOpen={isDatasetExtractorOpen}
        onClose={() => setIsDatasetExtractorOpen(false)}
        areaPoints={areaPoints}
        areaHectares={areaHectares}
        onApplyPreviewLayer={(layerData) => {
          setGeePreviewLayer({
            ...layerData,
            isDataset: true,
          })
        }}
        onClearPreviewLayer={() => setGeePreviewLayer(null)}
        activePreviewLayer={geePreviewLayer}
      />

      {/* Modal Ekspor & Unduh Data AOI (GeoJSON, CSV, GeoTIFF / AstraGIS) */}
      <AoiExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        areaPoints={areaPoints}
        areaHectares={areaHectares}
        onOpenGeeAnalysis={() => setIsGeeModalOpen(true)}
        onOpenDatasetExtractor={() => setIsDatasetExtractorOpen(true)}
      />
    </div>
  )
}

export default Dashboard