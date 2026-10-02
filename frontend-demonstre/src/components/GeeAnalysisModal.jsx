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
  DownloadOutlined,
  TableOutlined,
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
        nameKey: 'idxName_ndvi',
        tagKey: 'idxTag_ndvi',
        descKey: 'idxDesc_ndvi',
        defaultName: 'Mangrove_NDVI',
      },
      {
        id: 'evi',
        nameKey: 'idxName_evi',
        tagKey: 'idxTag_evi',
        descKey: 'idxDesc_evi',
        defaultName: 'Mangrove_EVI',
      },
      {
        id: 'savi',
        nameKey: 'idxName_savi',
        tagKey: 'idxTag_savi',
        descKey: 'idxDesc_savi',
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
        nameKey: 'idxName_cmri',
        tagKey: 'idxTag_cmri',
        descKey: 'idxDesc_cmri',
        defaultName: 'Mangrove_CMRI',
      },
      {
        id: 'mndwi',
        nameKey: 'idxName_mndwi',
        tagKey: 'idxTag_mndwi',
        descKey: 'idxDesc_mndwi',
        defaultName: 'Mangrove_MNDWI',
      },
      {
        id: 'ndwi',
        nameKey: 'idxName_ndwi',
        tagKey: 'idxTag_ndwi',
        descKey: 'idxDesc_ndwi',
        defaultName: 'Mangrove_NDWI',
      },
    ],
  },
  {
    key: 'biomass',
    titleKey: 'categoryBiomass',
    descKey: 'categoryBiomassDesc',
    icon: '🌳',
    indices: [
      {
        id: 'agb',
        nameKey: 'idxName_agb',
        tagKey: 'idxTag_agb',
        descKey: 'idxDesc_agb',
        defaultName: 'Mangrove_Biomass_AGB',
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

  // Handle Unduh CSV Format Excel (Lat, Long, NDVI, VV, VH, AGB_Revised_kg)
  const handleDownloadAgbCsv = () => {
    if (!analysisResult?.points || analysisResult.points.length === 0) {
      message.warning('Tidak ada data piksel AGB untuk diekspor.')
      return
    }

    const headers = ['Lat', 'Long', 'NDVI', 'VV', 'VH', 'AGB_Revised_kg']
    const rows = analysisResult.points.map((pt) => [
      pt.lat,
      pt.long,
      pt.ndvi,
      pt.vv,
      pt.vh,
      pt.agb_revised_kg,
    ])

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute(
      'download',
      `mangrove_agb_predictions_${dayjs().format('YYYYMMDD_HHmmss')}.csv`
    )
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    message.success('Dataset CSV hasil prediksi model AGB berhasil diunduh!')
  }

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
    const currentSec = GEE_SECTIONS.find((s) => s.key === selectedSection)
    if (currentSec?.underDevelopment) {
      message.warning(t('biomassUnderDevNotice'))
      return
    }

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
          points: result.points,
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
        points: analysisResult.points,
        opacity: 0.85,
      })
    }
  }

  // Handle Minimize (-) : Menutup modal tanpa menghapus hasil analisis & preview di peta
  const handleMinimize = (e) => {
    if (e && e.stopPropagation) e.stopPropagation()
    onClose()
  }

  // Handle Close & Clear (✕) : Menutup modal dan membersihkan hasil analisis serta preview layer di peta
  const handleCloseAndClear = (e) => {
    if (e && e.stopPropagation) e.stopPropagation()
    setAnalysisResult(null)
    if (onClearGeePreviewLayer) {
      onClearGeePreviewLayer()
    }
    onClose()
    message.info(t('analysisClearedNotice'))
  }

  return (
    <Modal
      open={isOpen}
      onCancel={handleMinimize}
      footer={null}
      width={780}
      centered
      closable={false}
      title={
        <div className="flex items-center justify-between gap-2.5 w-full">
          {/* Header Kiri: Icon, Judul, & Subtitle Area */}
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-base shadow-sm shrink-0">
              🛰️
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm sm:text-base font-bold text-gray-800 leading-tight truncate">
                {t('geeAnalysisTitle')}
              </h3>
              <p className="text-[11px] sm:text-xs text-gray-500 font-normal truncate">
                {t('geeAnalysisSubtitle')} • {areaHectares.toFixed(2)} Ha ({areaPoints.length} Titik)
              </p>
            </div>
          </div>

          {/* Header Kanan: Window Controls (Minimize & Close) */}
          <div className="flex items-center gap-1.5 shrink-0 ml-1">
            {/* Tombol Minimize (-) */}
            <Tooltip title={t('minimizeModal')} placement="bottom">
              <button
                type="button"
                onClick={handleMinimize}
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg text-gray-600 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 flex items-center justify-center font-bold text-base transition cursor-pointer border border-gray-200 active:scale-95 shadow-sm"
                aria-label={t('minimizeModal')}
              >
                —
              </button>
            </Tooltip>

            {/* Tombol Close & Clear (✕) */}
            <Tooltip title={t('closeAndClearModal')} placement="bottom">
              <button
                type="button"
                onClick={handleCloseAndClear}
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg text-gray-400 hover:text-red-600 bg-gray-50 hover:bg-red-50 flex items-center justify-center font-bold text-xs sm:text-sm transition cursor-pointer border border-gray-200 hover:border-red-300 active:scale-95 shadow-sm"
                aria-label={t('closeAndClearModal')}
              >
                ✕
              </button>
            </Tooltip>
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
                type="button"
                onClick={() => {
                  setSelectedSection(sec.key)
                  if (!sec.underDevelopment) {
                    setSelectedIndex(sec.indices[0].id)
                  }
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  selectedSection === sec.key
                    ? sec.underDevelopment
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200/70'
                }`}
              >
                <span>{sec.icon}</span>
                <span>{t(sec.titleKey)}</span>
                {sec.underDevelopment && (
                  <span
                    className={`text-[9px] px-1.5 py-0.2 rounded-full font-semibold uppercase tracking-wider ${
                      selectedSection === sec.key
                        ? 'bg-amber-200 text-amber-950'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {t('underDevBadge')}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* DAFTAR INDEKS PADA KATEGORI AKTIF */}
          {GEE_SECTIONS.filter((s) => s.key === selectedSection).map((sec) => (
            <div key={sec.key}>
              {/* Banner Peringatan Kategori Dalam Masa Pengembangan */}
              {sec.underDevelopment && (
                <div className="mb-3 p-3 rounded-2xl bg-amber-50/90 border border-amber-200/90 flex items-start gap-3 text-amber-950 shadow-sm">
                  <div className="w-7 h-7 rounded-xl bg-amber-200/80 text-amber-900 flex items-center justify-center font-bold text-sm shrink-0 mt-0.5">
                    🚧
                  </div>
                  <div className="text-xs min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-amber-900 text-xs sm:text-sm">
                        {t('underDevTitle')}
                      </p>
                      <span className="text-[10px] bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full font-semibold">
                        {t('underDevBadge')}
                      </span>
                    </div>
                    <p className="text-amber-800/90 mt-1 leading-relaxed text-[11px] sm:text-xs">
                      {t('biomassUnderDevNotice')}
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {sec.indices.map((idx) => {
                  const isUnderDev = sec.underDevelopment || idx.underDevelopment
                  const isSelected = selectedIndex === idx.id
                  const localizedName = t(idx.nameKey)
                  const localizedTag = t(idx.tagKey)
                  const localizedDesc = t(idx.descKey)
                  const shortName = localizedName.includes('(')
                    ? localizedName.split('(')[0].trim()
                    : localizedName

                  return (
                    <div
                      key={idx.id}
                      onClick={() => {
                        if (!isUnderDev) {
                          setSelectedIndex(idx.id)
                        } else {
                          message.info(t('underDevNoticeShort'))
                        }
                      }}
                      className={`p-2.5 sm:p-3 rounded-xl border transition flex flex-col justify-between ${
                        isUnderDev
                          ? 'bg-gray-50/80 border-dashed border-gray-300 opacity-60 cursor-not-allowed select-none'
                          : isSelected
                          ? 'bg-emerald-50/80 border-emerald-500 ring-2 ring-emerald-500/20 shadow-sm cursor-pointer'
                          : 'bg-white border-gray-200 hover:border-gray-300 cursor-pointer'
                      }`}
                      title={isUnderDev ? t('underDevNoticeShort') : localizedName}
                    >
                      <div className="flex flex-col h-full justify-between gap-1.5">
                        <div>
                          <div className="flex items-center justify-between gap-1.5 mb-1.5">
                            <span className="font-bold text-xs sm:text-sm text-gray-800 truncate" title={localizedName}>
                              {shortName}
                            </span>
                            <span
                              className={`text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0 ${
                                isUnderDev
                                  ? 'bg-amber-100 text-amber-800 border border-amber-200/60'
                                  : 'bg-gray-100 text-gray-600'
                              }`}
                            >
                              {isUnderDev ? t('underDevBadge') : localizedTag}
                            </span>
                          </div>
                          <p className="text-[11px] sm:text-xs text-gray-500 leading-snug">
                            {localizedDesc}
                          </p>
                        </div>
                        {isUnderDev && (
                          <div className="mt-1 pt-1.5 border-t border-gray-200/60 text-[10px] text-amber-700 font-semibold flex items-center gap-1">
                            <span>🔒</span>
                            <span>{t('underDevBadge')}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
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
        {(() => {
          const isUnderDev = GEE_SECTIONS.find((s) => s.key === selectedSection)?.underDevelopment
          return (
            <button
              type="button"
              onClick={handleRunAnalysis}
              disabled={isAnalyzing || isUnderDev}
              className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs shadow-md transition flex items-center justify-center gap-2 ${
                isUnderDev
                  ? 'bg-amber-100 text-amber-800 border border-amber-300 cursor-not-allowed opacity-90 shadow-none'
                  : 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:bg-gray-300 disabled:cursor-not-allowed text-white cursor-pointer'
              }`}
            >
              {isUnderDev ? (
                <>
                  <span>🚧</span>
                  <span>{t('btnUnderDevelopment')}</span>
                </>
              ) : isAnalyzing ? (
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
          )
        })()}

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
            <div className={`grid gap-2 text-xs ${analysisResult.statistics.mangrove_area_hectares && analysisResult.analysis_type === 'agb' ? 'grid-cols-2 sm:grid-cols-5' : 'grid-cols-2 sm:grid-cols-4'}`}>
              <div className="bg-white p-2.5 rounded-xl border border-gray-200/80">
                <p className="text-[11px] text-gray-500 font-medium">{t('minValLabel')}</p>
                <p className="font-mono font-bold text-gray-800 text-sm">
                  {analysisResult.statistics.min} {analysisResult.analysis_type === 'agb' ? 'kg' : ''}
                </p>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-gray-200/80">
                <p className="text-[11px] text-gray-500 font-medium">{t('maxValLabel')}</p>
                <p className="font-mono font-bold text-gray-800 text-sm">
                  {analysisResult.statistics.max} {analysisResult.analysis_type === 'agb' ? 'kg' : ''}
                </p>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-gray-200/80">
                <p className="text-[11px] text-gray-500 font-medium">
                  {analysisResult.analysis_type === 'agb' ? t('meanCanopyBiomassLabel') : t('meanValLabel')}
                </p>
                <p className="font-mono font-bold text-emerald-700 text-sm">
                  {analysisResult.statistics.mean} {analysisResult.analysis_type === 'agb' ? 'kg' : ''}
                </p>
              </div>
              {analysisResult.statistics.mangrove_area_hectares && analysisResult.analysis_type === 'agb' && (
                <div className="bg-emerald-50/80 p-2.5 rounded-xl border border-emerald-300">
                  <p className="text-[11px] text-emerald-800 font-bold flex items-center gap-1">
                    <span>🌿</span> {t('mangroveAreaLabel')}
                  </p>
                  <p className="font-mono font-extrabold text-emerald-950 text-sm">
                    {analysisResult.statistics.mangrove_area_hectares} Ha
                  </p>
                </div>
              )}
              <div className="bg-white p-2.5 rounded-xl border border-gray-200/80">
                <p className="text-[11px] text-gray-500 font-medium">{t('totalAoiAreaLabel') || 'Luas Total Poligon'}</p>
                <p className="font-mono font-bold text-gray-800 text-sm">
                  {analysisResult.statistics.area_hectares} Ha
                </p>
              </div>
            </div>

            {/* KARTU MODEL MACHINE LEARNING AGB & UNDUH CSV (FORMAT EXCEL) */}
            {analysisResult.analysis_type === 'agb' && (
              <div className="bg-gradient-to-r from-emerald-50 to-teal-50/80 p-3.5 rounded-xl border border-emerald-300 flex flex-col gap-2.5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🤖</span>
                    <div>
                      <h5 className="font-bold text-xs text-emerald-950 flex items-center gap-1.5 flex-wrap">
                        <span>{t('mlModelBadge') || 'Model ML LightGBM Terverifikasi'}</span>
                        <span className="text-[10px] bg-emerald-200 text-emerald-900 font-mono px-1.5 py-0.5 rounded-md font-semibold">
                          best_mangrove_agb_model.joblib
                        </span>
                        <span className="text-[10px] bg-teal-100 text-teal-800 border border-teal-300 px-2 py-0.5 rounded-full font-semibold">
                          ✨ {t('fullPixelMethodBadge')}
                        </span>
                      </h5>
                      <p className="text-[11px] text-emerald-800/80">
                        {t('mlFeaturesUsed') || 'Fitur Masukan: Sentinel-1 SAR (VV, VH) + Sentinel-2 MSI (NDVI)'}
                      </p>
                    </div>
                  </div>

                  {/* Tombol Unduh CSV Format Excel */}
                  <button
                    type="button"
                    onClick={handleDownloadAgbCsv}
                    className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white font-bold text-xs flex items-center gap-1.5 shadow transition cursor-pointer"
                    title={t('btnDownloadAgbCsvDesc') || 'Ekspor dataset titik Lat, Long, NDVI, VV, VH, AGB_Revised_kg'}
                  >
                    <DownloadOutlined className="text-sm font-extrabold" />
                    <span>{t('btnDownloadAgbCsv') || 'Unduh Hasil Prediksi CSV (Format Excel)'}</span>
                  </button>
                </div>

                {/* Info Gradasi Hijau & Penjelasan */}
                <div className="bg-white/90 p-2.5 rounded-lg border border-emerald-200/80 text-[11px] flex flex-col gap-1 text-emerald-900">
                  <div className="flex items-center gap-1.5">
                    <span className="text-emerald-700 font-bold">🌿 {t('greenGradLegendNote') || 'Gradasi Hijau: Semakin besar nilainya maka warnanya semakin hijau pekat.'}</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-gray-500 font-medium mt-0.5">
                    <span>Rendah (&lt;250 kg)</span>
                    <span className="h-2 flex-1 mx-2 rounded-full shadow-inner" style={{ background: 'linear-gradient(to right, #ffffd4, #d9f0a3, #78c679, #41ab5d, #238443, #004529)' }}></span>
                    <span className="text-emerald-950 font-bold">Sangat Lebat (&gt;2.250 kg)</span>
                  </div>
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
