import React, { useState, useEffect } from 'react'
import {
  Modal,
  Tabs,
  Button,
  Select,
  Input,
  Slider,
  DatePicker,
  message,
  Spin,
  Tooltip,
  Badge,
} from 'antd'
import {
  ThunderboltOutlined,
  CloudUploadOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  CheckCircleOutlined,
  InfoCircleOutlined,
  SaveOutlined,
  ExperimentOutlined,
  CalendarOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { useLanguage } from '../context/LanguageContext'
import geeApi from '../api/GeeApi'
import workspaceApi from '../api/WorkspaceApi'

const { RangePicker } = DatePicker

const GEE_SECTIONS = [
  {
    key: 'vegetation',
    titleKey: 'categoryVegetation',
    descKey: 'categoryVegetationDesc',
    icon: '🌿',
    indices: [
      {
        id: 'ndvi',
        name: 'NDVI (Normalized Difference Vegetation Index)',
        tag: 'Vigor & Klorofil',
        desc: 'Standar emas untuk memantau kerapatan dan kehijauan tajuk mangrove.',
        defaultName: 'Mangrove_NDVI',
      },
      {
        id: 'evi',
        name: 'EVI (Enhanced Vegetation Index)',
        tag: 'Anti-Saturasi',
        desc: 'Sangat baik untuk tutupan kanopi mangrove lebat tanpa efek saturasi.',
        defaultName: 'Mangrove_EVI',
      },
      {
        id: 'savi',
        name: 'SAVI (Soil-Adjusted Vegetation Index)',
        tag: 'Koreksi Lumpur',
        desc: 'Mengurangi pantulan substrat tanah lumpur di kawasan pesisir pasang surut.',
        defaultName: 'Mangrove_SAVI',
      },
    ],
  },
  {
    key: 'water_mangrove',
    titleKey: 'categoryWater',
    descKey: 'categoryWaterDesc',
    icon: '🌊',
    indices: [
      {
        id: 'cmri',
        name: 'CMRI (Combined Mangrove Recognition Index)',
        tag: 'Isolasi Mangrove',
        desc: 'Formula kombinasi NDVI - NDWI untuk memisahkan mangrove dari vegetasi darat & air.',
        defaultName: 'Mangrove_CMRI',
      },
      {
        id: 'mndwi',
        name: 'MNDWI (Modified NDWI)',
        tag: 'Genangan Pasang',
        desc: 'Kontras mendeteksi air laut pasang surut dan alur sungai estuari.',
        defaultName: 'Mangrove_MNDWI',
      },
      {
        id: 'ndwi',
        name: 'NDWI (Normalized Difference Water Index)',
        tag: 'Kadar Air Tajuk',
        desc: 'Mendeteksi batas badan air dan kelembaban kanopi daun mangrove.',
        defaultName: 'Mangrove_NDWI',
      },
    ],
  },
  {
    key: 'biomass_carbon',
    titleKey: 'categoryBiomass',
    descKey: 'categoryBiomassDesc',
    icon: '🌳',
    indices: [
      {
        id: 'agb',
        name: 'Estimasi Biomassa (AGB - Above Ground Biomass)',
        tag: 'Model Alometrik',
        desc: 'Estimasi biomassa di atas permukaan dalam satuan Ton/Ha dan total biomassa area.',
        defaultName: 'Mangrove_Biomass_AGB',
      },
      {
        id: 'carbon',
        name: 'Cadangan Karbon (Carbon Stock)',
        tag: 'Faktor IPCC 0.47',
        desc: 'Estimasi kandungan simpanan karbon organik (Ton C) pada biomassa mangrove.',
        defaultName: 'Mangrove_Carbon_Stock',
      },
      {
        id: 'canopy_density',
        name: 'Klasifikasi Kerapatan Kanopi',
        tag: '3 Kelas Kerapatan',
        desc: 'Zonasi tingkat tutupan tajuk: Lebat (>70%), Sedang (50-70%), Jarang (<50%).',
        defaultName: 'Mangrove_Canopy_Density',
      },
    ],
  },
]

const GeeAnalysisModal = ({
  isOpen,
  onClose,
  areaPoints = [],
  areaHectares = 0,
  onApplyGeePreviewLayer,
  onClearGeePreviewLayer,
  activeGeeLayer,
  onLayerSavedToAstraGis,
  isAoiVisible = true,
  onToggleAoi,
  isAoiFillVisible = true,
  onToggleAoiFill,
}) => {
  const { t } = useLanguage()

  // State Pilihan Indeks
  const [selectedSection, setSelectedSection] = useState('vegetation')
  const [selectedIndex, setSelectedIndex] = useState('ndvi')

  // State Parameter Satelit
  const [activeQuickMonths, setActiveQuickMonths] = useState(6)
  const [dateRange, setDateRange] = useState([
    dayjs().subtract(6, 'month'),
    dayjs(),
  ])
  const [cloudPct, setCloudPct] = useState(20)

  // Deteksi preset rentang tanggal aktif secara reaktif & akurat
  const activePreset = React.useMemo(() => {
    if (activeQuickMonths) return activeQuickMonths
    if (dateRange && dateRange[0] && dateRange[1]) {
      const diffDays = Math.abs(dateRange[1].diff(dateRange[0], 'day'))
      if (diffDays >= 80 && diffDays <= 100) return 3
      if (diffDays >= 170 && diffDays <= 195) return 6
      if (diffDays >= 350 && diffDays <= 380) return 12
    }
    return null
  }, [activeQuickMonths, dateRange])

  // State Eksekusi Analisis
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState(null)

  // State Simpan ke AstraGIS
  const [workspaces, setWorkspaces] = useState([])
  const [isLoadingWorkspaces, setIsLoadingWorkspaces] = useState(false)
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(null)
  const [layerName, setLayerName] = useState('')
  const [layerDescription, setLayerDescription] = useState('')
  const [isSavingAstraGis, setIsSavingAstraGis] = useState(false)

  // Load Workspaces saat modal dibuka
  useEffect(() => {
    if (isOpen) {
      loadWorkspaces()
      // Generate default layer name
      const nowStr = dayjs().format('YYYYMMDD')
      setLayerName(`Mangrove_${selectedIndex.toUpperCase()}_${nowStr}`)
    }
  }, [isOpen, selectedIndex])

  const loadWorkspaces = async () => {
    setIsLoadingWorkspaces(true)
    try {
      const res = await workspaceApi.getAll()
      const wsList = res.data?.data || res.data || []
      setWorkspaces(wsList)
      if (wsList.length > 0 && !selectedWorkspaceId) {
        setSelectedWorkspaceId(wsList[0].id)
      }
    } catch (err) {
      console.warn('Failed loading workspaces:', err)
    } finally {
      setIsLoadingWorkspaces(false)
    }
  }

  // Handle Quick Date Presets
  const setQuickDate = (months) => {
    setActiveQuickMonths(months)
    setDateRange([dayjs().subtract(months, 'month'), dayjs()])
  }

  // Jalankan Analisis GEE
  const handleRunAnalysis = async () => {
    if (!areaPoints || areaPoints.length < 3) {
      message.error('Area poligon minimal harus memiliki 3 titik koordinat.')
      return
    }

    setIsAnalyzing(true)
    try {
      const startDateStr = dateRange[0].format('YYYY-MM-DD')
      const endDateStr = dateRange[1].format('YYYY-MM-DD')

      const payload = {
        coordinates: areaPoints,
        analysis_type: selectedIndex,
        start_date: startDateStr,
        end_date: endDateStr,
        cloud_percentage: cloudPct,
      }

      const result = await geeApi.analyzeArea(payload)
      setAnalysisResult(result)
      message.success('Komputasi Google Earth Engine selesai!')

      // Otomatis aktifkan preview di peta
      if (onApplyGeePreviewLayer && result.tile_url) {
        onApplyGeePreviewLayer({
          tileUrl: result.tile_url,
          analysisType: result.analysis_type,
          statistics: result.statistics,
          palette: result.palette,
          opacity: 0.85,
        })
        // Otomatis nonaktifkan fill hijau AOI agar warna raster GEE murni dan jelas terlihat
        if (onToggleAoiFill) {
          onToggleAoiFill(false)
        }
      }
    } catch (err) {
      console.error('GEE analysis error:', err)
      message.error(
        err.response?.data?.detail || 'Gagal menjalankan analisis Google Earth Engine.'
      )
    } finally {
      setIsAnalyzing(false)
    }
  }

  // Handle Simpan ke AstraGIS
  const handleSaveToAstraGis = async () => {
    if (!selectedWorkspaceId) {
      message.warning(t('selectTargetWorkspace'))
      return
    }
    if (!layerName.trim()) {
      message.warning('Harap isi nama layer.')
      return
    }

    setIsSavingAstraGis(true)
    try {
      const startDateStr = dateRange[0].format('YYYY-MM-DD')
      const endDateStr = dateRange[1].format('YYYY-MM-DD')

      const payload = {
        coordinates: areaPoints,
        analysis_type: selectedIndex,
        workspace_id: selectedWorkspaceId,
        layer_name: layerName.trim(),
        description:
          layerDescription ||
          `GEE ${selectedIndex.toUpperCase()} Analysis (${startDateStr} s/d ${endDateStr}) - Luas: ${areaHectares.toFixed(2)} Ha`,
        start_date: startDateStr,
        end_date: endDateStr,
        cloud_percentage: cloudPct,
      }

      const res = await geeApi.saveToAstraGis(payload)
      message.success(t('savedSuccessAstraGis'))

      if (onLayerSavedToAstraGis) {
        onLayerSavedToAstraGis(res)
      }
    } catch (err) {
      console.error('Save to AstraGIS error:', err)
      message.error(
        err.response?.data?.detail || 'Gagal menyimpan layer ke AstraGIS.'
      )
    } finally {
      setIsSavingAstraGis(false)
    }
  }

  // Toggle Preview di Peta
  const isCurrentlyPreviewed =
    activeGeeLayer && activeGeeLayer.tileUrl === analysisResult?.tile_url

  const handleTogglePreview = () => {
    if (isCurrentlyPreviewed) {
      if (onClearGeePreviewLayer) onClearGeePreviewLayer()
    } else if (analysisResult?.tile_url && onApplyGeePreviewLayer) {
      onApplyGeePreviewLayer({
        tileUrl: analysisResult.tile_url,
        analysisType: analysisResult.analysis_type,
        statistics: analysisResult.statistics,
        palette: analysisResult.palette,
        opacity: 0.85,
      })
    }
  }

  return (
    <Modal
      open={isOpen}
      onCancel={onClose}
      footer={null}
      width={780}
      centered
      title={
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-base shadow-sm">
            🛰️
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-800 leading-tight">
              {t('geeAnalysisTitle')}
            </h3>
            <p className="text-xs text-gray-500 font-normal">
              {t('geeAnalysisSubtitle')} • {areaHectares.toFixed(2)} Ha ({areaPoints.length} Titik)
            </p>
          </div>
        </div>
      }
      className="custom-gee-modal"
    >
      <div className="flex flex-col gap-4 mt-2 max-h-[78vh] overflow-y-auto pr-1">
        {/* TAB PILIHAN KATEGORI INDEKS */}
        <div className="bg-gray-50 p-3 rounded-2xl border border-gray-200/80">
          <div className="flex gap-2 border-b border-gray-200 pb-2 mb-3 overflow-x-auto no-scrollbar">
            {GEE_SECTIONS.map((sec) => (
              <button
                key={sec.key}
                onClick={() => {
                  setSelectedSection(sec.key)
                  setSelectedIndex(sec.indices[0].id)
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  selectedSection === sec.key
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200/70'
                }`}
              >
                <span>{sec.icon}</span>
                <span>{t(sec.titleKey)}</span>
              </button>
            ))}
          </div>

          {/* DAFTAR INDEKS PADA KATEGORI AKTIF */}
          {GEE_SECTIONS.filter((s) => s.key === selectedSection).map((sec) => (
            <div key={sec.key} className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {sec.indices.map((idx) => {
                const isSelected = selectedIndex === idx.id
                return (
                  <div
                    key={idx.id}
                    onClick={() => setSelectedIndex(idx.id)}
                    className={`p-2.5 rounded-xl border transition cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'bg-emerald-50/80 border-emerald-500 ring-2 ring-emerald-500/20 shadow-sm'
                        : 'bg-white border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="font-bold text-xs text-gray-800 truncate">
                          {idx.name.split('(')[0].trim()}
                        </span>
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                          {idx.tag}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-500 leading-snug line-clamp-2">
                        {idx.desc}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        {/* PARAMETER CITRA SATELIT & AWAN */}
        <div className="bg-white p-3.5 rounded-2xl border border-gray-200/80 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Rentang Waktu */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                <CalendarOutlined className="text-emerald-600" />
                {t('dateRangeLabel')}
              </label>
              <div className="flex gap-1 text-[10px]">
                <button
                  type="button"
                  onClick={() => setQuickDate(3)}
                  className={`px-2 py-0.5 rounded-lg cursor-pointer transition-all ${
                    activePreset === 3
                      ? 'bg-emerald-600 text-white font-bold shadow-xs'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                  }`}
                >
                  3B
                </button>
                <button
                  type="button"
                  onClick={() => setQuickDate(6)}
                  className={`px-2 py-0.5 rounded-lg cursor-pointer transition-all ${
                    activePreset === 6
                      ? 'bg-emerald-600 text-white font-bold shadow-xs'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                  }`}
                >
                  6B
                </button>
                <button
                  type="button"
                  onClick={() => setQuickDate(12)}
                  className={`px-2 py-0.5 rounded-lg cursor-pointer transition-all ${
                    activePreset === 12
                      ? 'bg-emerald-600 text-white font-bold shadow-xs'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                  }`}
                >
                  1Th
                </button>
              </div>
            </div>
            <RangePicker
              value={dateRange}
              onChange={(vals) => {
                if (vals) {
                  setDateRange(vals)
                  setActiveQuickMonths(null)
                }
              }}
              className="w-full text-xs rounded-xl"
              format="YYYY-MM-DD"
              allowClear={false}
            />
          </div>

          {/* Masking Awan */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-gray-700">
                {t('cloudCoverageLabel')}:{' '}
                <span className="text-emerald-700 font-extrabold">{cloudPct}%</span>
              </label>
              <span className="text-[10px] text-gray-400">Sentinel-2 SR</span>
            </div>
            <Slider
              min={5}
              max={50}
              step={5}
              value={cloudPct}
              onChange={setCloudPct}
              className="mb-0"
            />
          </div>
        </div>

        {/* TOMBOL JALANKAN ANALISIS */}
        <button
          onClick={handleRunAnalysis}
          disabled={isAnalyzing}
          className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
        >
          {isAnalyzing ? (
            <>
              <Spin size="small" />
              <span>{t('runningAnalysis')}</span>
            </>
          ) : (
            <>
              <ThunderboltOutlined className="text-sm font-extrabold" />
              <span>{t('runAnalysisBtn')}</span>
            </>
          )}
        </button>

        {/* HASIL ANALISIS GEE */}
        {analysisResult && (
          <div className="bg-emerald-50/40 p-4 rounded-2xl border border-emerald-200 flex flex-col gap-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <CheckCircleOutlined className="text-emerald-600 text-base" />
                <h4 className="font-bold text-xs text-emerald-950 uppercase tracking-wide">
                  {t('analysisResults')} - {analysisResult.analysis_type.toUpperCase()}
                </h4>
              </div>

              <div className="flex items-center gap-2">
                {/* Tombol Toggle Sembunyikan / Tampilkan AOI Poligon */}
                {onToggleAoi && (
                  <button
                    type="button"
                    onClick={onToggleAoi}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold flex items-center gap-1.5 transition cursor-pointer border ${
                      !isAoiVisible
                        ? 'bg-amber-100 text-amber-900 border-amber-300 font-bold ring-1 ring-amber-400/30'
                        : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                    }`}
                    title={t('aoiFillHiddenHint')}
                  >
                    <span>{!isAoiVisible ? '🙈' : '👁️'}</span>
                    <span>{!isAoiVisible ? t('showAoi') : t('hideAoi')}</span>
                  </button>
                )}

                {/* Tombol Preview di Peta */}
                <button
                  type="button"
                  onClick={handleTogglePreview}
                  className={`px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                    isCurrentlyPreviewed
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-white text-blue-700 border border-blue-200 hover:bg-blue-50'
                  }`}
                >
                  {isCurrentlyPreviewed ? (
                    <>
                      <EyeInvisibleOutlined />
                      <span>{t('hidePreview')}</span>
                    </>
                  ) : (
                    <>
                      <EyeOutlined />
                      <span>{t('previewOnMap')}</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* GRID METRIK STATISTIK */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="bg-white p-2.5 rounded-xl border border-gray-200/80">
                <p className="text-[11px] text-gray-500 font-medium">{t('minValLabel')}</p>
                <p className="font-mono font-bold text-gray-800 text-sm">
                  {analysisResult.statistics.min}
                </p>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-gray-200/80">
                <p className="text-[11px] text-gray-500 font-medium">{t('maxValLabel')}</p>
                <p className="font-mono font-bold text-gray-800 text-sm">
                  {analysisResult.statistics.max}
                </p>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-gray-200/80">
                <p className="text-[11px] text-gray-500 font-medium">{t('meanValLabel')}</p>
                <p className="font-mono font-bold text-emerald-700 text-sm">
                  {analysisResult.statistics.mean}
                </p>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-gray-200/80">
                <p className="text-[11px] text-gray-500 font-medium">Luas Area</p>
                <p className="font-mono font-bold text-gray-800 text-sm">
                  {analysisResult.statistics.area_hectares} Ha
                </p>
              </div>
            </div>

            {/* KHUSUS ESTIMASI BIOMASSA & KARBON TOTAL (Hanya pada kategori Biomass & Carbon) */}
            {['agb', 'carbon'].includes(analysisResult.analysis_type) &&
              analysisResult.statistics.total_biomass_tons !== null && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-white p-3 rounded-xl border border-emerald-200">
                <div>
                  <p className="text-[11px] text-gray-500 font-medium flex items-center gap-1">
                    <span>🪵</span> {t('totalBiomassLabel')}
                  </p>
                  <p className="font-bold text-emerald-800 text-base font-mono">
                    {analysisResult.statistics.total_biomass_tons?.toLocaleString('id-ID')}{' '}
                    <span className="text-xs font-normal text-gray-500">Ton</span>
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-500 font-medium flex items-center gap-1">
                    <span>🌱</span> {t('carbonStockLabel')}
                  </p>
                  <p className="font-bold text-teal-800 text-base font-mono">
                    {analysisResult.statistics.total_carbon_tons?.toLocaleString('id-ID')}{' '}
                    <span className="text-xs font-normal text-gray-500">Ton C</span>
                  </p>
                </div>
              </div>
            )}

            {/* COLOR PALETTE BAR */}
            {analysisResult.palette && (
              <div className="bg-white p-2.5 rounded-xl border border-gray-200/80">
                <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                  <span>Min: {analysisResult.palette.min}</span>
                  <span className="font-semibold text-gray-700">Visual Ramp</span>
                  <span>Maks: {analysisResult.palette.max}</span>
                </div>
                <div
                  className="h-3 rounded-md w-full shadow-inner"
                  style={{
                    background: `linear-gradient(to right, ${analysisResult.palette.colors.join(
                      ', '
                    )})`,
                  }}
                />
              </div>
            )}

            {/* FORM SIMPAN KE ASTRAGIS */}
            <div className="bg-white p-3.5 rounded-xl border border-gray-200 flex flex-col gap-2.5 mt-1">
              <h5 className="font-bold text-xs text-gray-800 flex items-center gap-1.5">
                <SaveOutlined className="text-blue-600" />
                {t('saveToAstraGis')}
              </h5>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {/* Target Workspace */}
                <div>
                  <label className="text-[11px] font-semibold text-gray-600 block mb-1">
                    {t('selectTargetWorkspace')} *
                  </label>
                  <Select
                    className="w-full text-xs"
                    value={selectedWorkspaceId}
                    onChange={setSelectedWorkspaceId}
                    loading={isLoadingWorkspaces}
                    options={workspaces.map((ws) => ({
                      label: `${ws.name || ws.ws_name} (${ws.ws_name})`,
                      value: ws.id,
                    }))}
                  />
                </div>

                {/* Nama Layer */}
                <div>
                  <label className="text-[11px] font-semibold text-gray-600 block mb-1">
                    Nama Layer GeoTIFF *
                  </label>
                  <Input
                    className="text-xs"
                    value={layerName}
                    onChange={(e) => setLayerName(e.target.value)}
                    placeholder={t('layerNamePlaceholder')}
                  />
                </div>
              </div>

              {/* Deskripsi */}
              <div>
                <label className="text-[11px] font-semibold text-gray-600 block mb-1">
                  Deskripsi Layer
                </label>
                <Input.TextArea
                  rows={2}
                  className="text-xs"
                  value={layerDescription}
                  onChange={(e) => setLayerDescription(e.target.value)}
                  placeholder="Keterangan hasil analisis GEE..."
                />
              </div>

              {/* Tombol Simpan */}
              <button
                onClick={handleSaveToAstraGis}
                disabled={isSavingAstraGis}
                className="w-full mt-1 py-2 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSavingAstraGis ? (
                  <>
                    <Spin size="small" />
                    <span>{t('savingToAstraGis')}</span>
                  </>
                ) : (
                  <>
                    <CloudUploadOutlined className="text-sm font-bold" />
                    <span>{t('saveToAstraGis')}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

export default GeeAnalysisModal
