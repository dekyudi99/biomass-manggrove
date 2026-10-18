import { useState, useMemo, useEffect } from 'react'
import { message } from 'antd'
import {
  MapContainer,
  TileLayer,
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
import useDashboardSidebars from '../hooks/useDashboardSidebars'
import useMapLayers from '../hooks/useMapLayers'
import GeeAnalysisLegend from '../components/organisms/map/GeeAnalysisLegend/GeeAnalysisLegend'
import WmsLayerLegend from '../components/organisms/map/WmsLayerLegend/WmsLayerLegend'
import MapClickHandler from '../components/organisms/map/MapClickHandler/MapClickHandler'
import WmsMapLayers from '../components/organisms/map/WmsMapLayers/WmsMapLayers'
import MapLocationLayers from '../components/organisms/map/MapLocationLayers/MapLocationLayers'
import AoiDrawingLayer from '../components/organisms/map/AoiDrawingLayer/AoiDrawingLayer'
import AoiEditorLayer from '../components/organisms/map/AoiEditorLayer/AoiEditorLayer'
import ModelCoverageLayer from '../components/organisms/map/ModelCoverageLayer/ModelCoverageLayer'
import GeePreviewIndicator from '../components/organisms/map/GeePreviewIndicator/GeePreviewIndicator'
import { reverseGeocode } from '../services/nominatimService'
import { calculatePolygonAreaInHectares, getCoordinatesBbox } from '../utils/mapGeometry'

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

const Dashboard = () => {
  useEffect(() => {
    document.title = 'Dashboard - Grovia'
  }, [])

  const { t, currentLanguage } = useLanguage()
  const defaultCenter = [ 8.363693, 98.640747 ]
  const [activeLayer, setActiveLayer] = useState('osm')
  const currentLayer = BASE_LAYERS[activeLayer]

  // Batas vertikal bumi (kutub utara & selatan) untuk Web Mercator, tanpa batas horizontal agar bisa looping/berputar terus
  const batasBumi = [
    [-85.051129, -Infinity],
    [85.051129, Infinity]
  ];

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
  const [geeModalSection, setGeeModalSection] = useState('vegetation')
  const [isDatasetExtractorOpen, setIsDatasetExtractorOpen] = useState(false)
  const [isExportModalOpen, setIsExportModalOpen] = useState(false)
  const [isEditingRoi, setIsEditingRoi] = useState(false)
  const [geePreviewLayer, setGeePreviewLayer] = useState(null)
  const [isLegendMinimized, setIsLegendMinimized] = useState(false)

  // State untuk Visibilitas AOI Poligon (agar warna hijau tidak menimpa/mengubah warna GEE)
  const [isAoiVisible, setIsAoiVisible] = useState(true)
  const [isAoiFillVisible, setIsAoiFillVisible] = useState(true)

  // State untuk Layer & Group WMS AstraGIS yang aktif di peta
  const [flyTarget, setFlyTarget] = useState(null)
  const {
    isLeftOpen,
    isRightOpen,
    handleToggleLeft,
    handleToggleRight,
    closeSidebars,
  } = useDashboardSidebars()
  const {
    visibleLayers,
    visibleGroups,
    handleZoomToLayer,
    handleZoomToGroup,
    handleToggleLayer,
    handleChangeLayerOpacity,
    handleToggleGroup,
    handleChangeGroupOpacity,
    handleStyleApplied,
  } = useMapLayers(setFlyTarget)

  // Hitung luas poligon hanya saat area sudah ditutup
  const areaHectares = useMemo(() => {
    if (!isAreaClosed || areaPoints.length < 3) return 0
    return calculatePolygonAreaInHectares(areaPoints)
  }, [areaPoints, isAreaClosed])

  // Reverse Geocoding dengan bahasa dinamis sesuai pilihan user
  const fetchAddress = async (lat, lng) => {
    setIsAddressLoading(true)
    try {
      const data = await reverseGeocode(lat, lng, currentLanguage || 'id')
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
    setFlyTarget({
      bbox: getCoordinatesBbox(points),
      epsg: 4326,
      timestamp: Date.now(),
    })
  }

  // State untuk menampilkan/menyembunyikan batas wilayah model mangrove
  const [isModelCoverageVisible, setIsModelCoverageVisible] = useState(true)

  // Handler untuk memusatkan peta ke wilayah masker mangrove (Ranong, Thailand Selatan)
  const handleFocusMangroveArea = () => {
    setFlyTarget({
      bbox: [98.50, 9.78, 98.66, 9.96],
      epsg: 4326,
      timestamp: Date.now(),
    })
    setIsModelCoverageVisible(true)
    message.success(t('focusedMangroveArea') || 'Peta diarahkan ke wilayah hutan mangrove Ranong (Thailand Selatan)')
  }

  return (
    <div className="dashboard-root relative h-[100dvh] w-full overflow-hidden bg-white dark:bg-slate-950">
      {/* Backdrop gelap di mobile (<1024px) jika salah satu sidebar dibuka */}
      {(isLeftOpen || isRightOpen) && (
        <div
          onClick={closeSidebars}
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
        onOpenVegetationIndices={() => {
          setGeeModalSection('vegetation')
          setIsGeeModalOpen(true)
        }}
        onOpenAgbAnalysis={() => {
          setGeeModalSection('biomass')
          setIsGeeModalOpen(true)
        }}
        onOpenGeeAnalysis={(section) => {
          setGeeModalSection(section === 'biomass' || section === 'agb' ? 'biomass' : 'vegetation')
          setIsGeeModalOpen(true)
        }}
        onOpenDatasetExtractor={() => setIsDatasetExtractorOpen(true)}
        onUploadAoi={handleAoiUploaded}
        isEditingRoi={isEditingRoi}
        onToggleEditRoi={() => {
          if (!isEditingRoi && areaPoints.length > 150) {
            message.warning(
              'Poligon memiliki lebih dari 150 titik sudut. Mode edit per-titik dinonaktifkan demi kelancaran browser.'
            )
            return
          }
          setIsEditingRoi((prev) => !prev)
        }}
        onOpenExportModal={() => setIsExportModalOpen(true)}
        isAoiVisible={isAoiVisible}
        onToggleAoi={() => setIsAoiVisible((prev) => !prev)}
        isAoiFillVisible={isAoiFillVisible}
        onToggleAoiFill={() => setIsAoiFillVisible((prev) => !prev)}
        isOpen={isLeftOpen}
        onToggle={handleToggleLeft}
        otherSidebarOpen={isRightOpen}
        onFocusMangroveArea={handleFocusMangroveArea}
        isModelCoverageVisible={isModelCoverageVisible}
        onToggleModelCoverage={() => setIsModelCoverageVisible((prev) => !prev)}
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
        zoom={12}
        minZoom={2} // <-- KUNCINYA DI SINI: Makin gede angkanya, makin sempit zoom out-nya
        maxZoom={18}
        maxBounds={batasBumi} // <-- Ngunci batas kutub utara & selatan
        maxBoundsViscosity={1.0} // <-- Solid kaga tembus ke area abu-abu di kutub
        worldCopyJump={true} // <-- Looping horizontal mulus ketika melewati garis tanggal/ujung timur-barat
        zoomControl={false}
        scrollWheelZoom={true}
        className="h-full w-full z-0 cursor-crosshair"
      >
        <MapClickHandler mode={mode} isAreaClosed={isAreaClosed} onMapClick={handleMapClick} />
        <MapFlyController flyTarget={flyTarget} />
        <FloatingMapControls
          defaultCenter={defaultCenter}
          userLocation={userLocation}
          onToggleUserLocation={setUserLocation}
          hasAoi={isAreaClosed && areaPoints.length >= 3}
          isAoiVisible={isAoiVisible}
          onToggleAoi={() => setIsAoiVisible((prev) => !prev)}
          onFocusMangroveArea={handleFocusMangroveArea}
          isModelCoverageVisible={isModelCoverageVisible}
          onToggleModelCoverage={() => setIsModelCoverageVisible((prev) => !prev)}
        />

        {/* Layer Visual Batas Wilayah Masker Model Mangrove */}
        <ModelCoverageLayer isVisible={isModelCoverageVisible} />

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


        <WmsMapLayers visibleLayers={visibleLayers} visibleGroups={visibleGroups} />

        <MapLocationLayers
          selectedPoint={selectedPoint}
          userLocation={userLocation}
          isAddressLoading={isAddressLoading}
          pointAddress={pointAddress}
          t={t}
        />

        <AoiDrawingLayer
          areaPoints={areaPoints}
          isAreaClosed={isAreaClosed}
          isAoiVisible={isAoiVisible}
          isAoiFillVisible={isAoiFillVisible}
          geePreviewLayer={geePreviewLayer}
          areaHectares={areaHectares}
          onCloseArea={handleCloseArea}
          t={t}
        />

        <AoiEditorLayer
          areaPoints={areaPoints}
          isEditingRoi={isEditingRoi}
          isAreaClosed={isAreaClosed}
          setAreaPoints={setAreaPoints}
          t={t}
        />
      </MapContainer>

      {/* Layer Control melayang di pojok kiri bawah (Google Maps Style) */}
      <LayerBaseControl
        activeLayer={activeLayer}
        onSelectLayer={setActiveLayer}
      />

      <GeePreviewIndicator
        previewLayer={geePreviewLayer}
        isAoiVisible={isAoiVisible}
        onToggleAoi={() => setIsAoiVisible((previousValue) => !previousValue)}
        onOpenResults={() => {
          if (geePreviewLayer?.isDataset) {
            setIsDatasetExtractorOpen(true)
          } else {
            setIsGeeModalOpen(true)
          }
        }}
        onClearPreview={() => setGeePreviewLayer(null)}
        t={t}
      />

      <div className="pointer-events-none absolute bottom-8 right-16 z-[900] flex max-h-[calc(100dvh-4rem)] max-w-[calc(100vw-6rem)] flex-col-reverse items-end gap-2 overflow-y-auto sm:bottom-6 sm:right-20">
        <GeeAnalysisLegend
          previewLayer={geePreviewLayer}
          isMinimized={isLegendMinimized}
          onToggleMinimized={() => setIsLegendMinimized((prev) => !prev)}
        />
        <WmsLayerLegend visibleLayers={visibleLayers} t={t} />
      </div>

      {/* Modal Analisis Komputasi Citra Satelit GEE / Model AGB */}
      <GeeAnalysisModal
        isOpen={isGeeModalOpen}
        onClose={() => setIsGeeModalOpen(false)}
        initialSection={geeModalSection}
        areaPoints={areaPoints}
        areaHectares={areaHectares}
        onEnableAgbLayer={(layer) => handleToggleLayer(layer, true)}
        onApplyGeePreviewLayer={setGeePreviewLayer}
        onClearGeePreviewLayer={() => setGeePreviewLayer(null)}
        activeGeeLayer={geePreviewLayer}
        isAoiVisible={isAoiVisible}
        onToggleAoi={() => setIsAoiVisible((prev) => !prev)}
        isAoiFillVisible={isAoiFillVisible}
        onToggleAoiFill={setIsAoiFillVisible}
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