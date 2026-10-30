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
  Progress,
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
  LockOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { useLanguage } from '../context/LanguageContext'
import useAuth from '../hooks/useAuth'
import geeApi from '../api/GeeApi'

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
  initialSection = 'vegetation',
  areaPoints = [],
  areaHectares = 0,
  onApplyGeePreviewLayer,
  onClearGeePreviewLayer,
  activeGeeLayer,
  onLayerSavedToAstraGis,
  onEnableAgbLayer,
  isAoiVisible = true,
  onToggleAoi,
  isAoiFillVisible = true,
  onToggleAoiFill,
}) => {
  const { t } = useLanguage()
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()

  // State Pilihan Indeks
  const [selectedSection, setSelectedSection] = useState(initialSection || 'vegetation')
  const [selectedIndex, setSelectedIndex] = useState(initialSection === 'biomass' ? 'agb' : 'ndvi')

  // Filter kategori berdasarkan mode tombol pemanggil
  const activeSections = React.useMemo(() => {
    if (initialSection === 'biomass') {
      return GEE_SECTIONS.filter((sec) => sec.key === 'biomass')
    }
    return GEE_SECTIONS.filter((sec) => sec.key !== 'biomass')
  }, [initialSection])

  useEffect(() => {
    if (isOpen) {
      const targetSec = initialSection || 'vegetation'
      setSelectedSection(targetSec)
      const sec = GEE_SECTIONS.find((s) => s.key === targetSec)
      if (sec && sec.indices.length > 0) {
        setSelectedIndex(sec.indices[0].id)
      }
    }
  }, [isOpen, initialSection])

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
  const [analysisJob, setAnalysisJob] = useState(null)
  const [analysisJobHistory, setAnalysisJobHistory] = useState([])
  const [analysisNotifications, setAnalysisNotifications] = useState([])
  const [modelInfo, setModelInfo] = useState(null)

  // State Simpan ke AstraGIS
  const [layerName, setLayerName] = useState('')
  const [layerDescription, setLayerDescription] = useState('')
  const [isSavingAstraGis, setIsSavingAstraGis] = useState(false)

  // Handle Unduh CSV Format Excel (Lat, Long, NDVI, VV, VH, AGB_Revised_kg)
  const handleDownloadAgbCsv = () => {
    if (!analysisResult?.points || analysisResult.points.length === 0) {
      message.warning('Tidak ada data piksel AGB untuk diekspor.')
      return
    }

    const headers = [
      'Lat', 'Long', 'NDVI', 'VV', 'VH', 'AGB_Revised_kg',
      'Unit', 'Model_Version', 'Model_Status', 'Disclaimer',
    ]
    const rows = analysisResult.points.map((pt) => [
      pt.lat,
      pt.long,
      pt.ndvi,
      pt.vv,
      pt.vh,
      pt.agb_revised_kg,
      analysisResult.model_unit || modelInfo?.unit || '',
      analysisResult.model_version || '',
      analysisResult.model_status || '',
      analysisResult.disclaimer || '',
    ])

    const escapeCsvCell = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`
    const csvContent = [headers, ...rows]
      .map((row) => row.map(escapeCsvCell).join(','))
      .join('\n')
    const encodedUri = `data:text/csv;charset=utf-8,${encodeURIComponent(csvContent)}`
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

  // Siapkan nama layer saat modal dibuka.
  useEffect(() => {
    if (isOpen) {
      const nowStr = dayjs().format('YYYYMMDD')
      setLayerName(`Mangrove_${selectedIndex.toUpperCase()}_${nowStr}`)
    }
  }, [isOpen, selectedIndex])

  useEffect(() => {
    if (!isOpen) return undefined
    let isCurrent = true
    geeApi.getModelStatus().then((model) => {
      if (isCurrent) setModelInfo(model)
    }).catch((error) => console.error('Failed to load AGB model status:', error))
    if (isAuthenticated) {
      geeApi.listAnalysisJobs().then((jobs) => {
        if (isCurrent) setAnalysisJobHistory(jobs)
      }).catch((error) => console.error('Failed to load AGB job history:', error))
      geeApi.listAnalysisNotifications().then((items) => {
        if (isCurrent) setAnalysisNotifications(items)
      }).catch((error) => console.error('Failed to load AGB notifications:', error))
    }
    return () => { isCurrent = false }
  }, [isOpen, isAuthenticated])

  useEffect(() => {
    if (!analysisJob || !['queued', 'running'].includes(analysisJob.status)) return undefined
    const intervalId = window.setInterval(async () => {
      try {
        const updatedJob = await geeApi.getAnalysisJob(analysisJob.id)
        setAnalysisJob(updatedJob)
        setAnalysisJobHistory((jobs) => [
          updatedJob,
          ...jobs.filter((job) => job.id !== updatedJob.id),
        ])
        if (!['queued', 'running'].includes(updatedJob.status)) {
          if (updatedJob.status === 'succeeded' && updatedJob.result?.layer?.id && onEnableAgbLayer) {
            const layer = {
              ...updatedJob.result.layer,
              layer_name: updatedJob.result.layer.name,
              geoserver_name: updatedJob.result.layer.name,
              layer_type: 'raster',
              type: 'raster',
            }
            const registeredJob = await geeApi.registerAnalysisLayer(updatedJob.id, layer)
            setAnalysisJob(registeredJob)
            setAnalysisJobHistory((jobs) => [
              registeredJob,
              ...jobs.filter((job) => job.id !== registeredJob.id),
            ])
            onEnableAgbLayer(registeredJob.result.layer)
          }
          const [jobs, items] = await Promise.all([
            geeApi.listAnalysisJobs(),
            geeApi.listAnalysisNotifications(),
          ])
          setAnalysisJobHistory(jobs)
          setAnalysisNotifications(items)
        }
      } catch (error) {
        console.error('Failed to poll AGB job:', error)
      }
    }, 3000)
    return () => window.clearInterval(intervalId)
  }, [analysisJob?.id, analysisJob?.status, onEnableAgbLayer])

  // Handle Quick Date Presets
  const setQuickDate = (months) => {
    setActiveQuickMonths(months)
    setDateRange([dayjs().subtract(months, 'month'), dayjs()])
  }

  const handleCancelAnalysisJob = async () => {
    if (!analysisJob) return
    try {
      setAnalysisJob(await geeApi.cancelAnalysisJob(analysisJob.id))
    } catch (error) {
      message.error(error.response?.data?.detail || t('agbCancelFailed'))
    }
  }

  // Jalankan Analisis GEE
  const handleRunAnalysis = async () => {
    const currentSec = GEE_SECTIONS.find((s) => s.key === selectedSection)
    if (currentSec?.underDevelopment) {
      message.warning(t('biomassUnderDevNotice'))
      return
    }

    if (!areaPoints || areaPoints.length < 3) {
      message.warning(t('noAoiAnalysisWarning'))
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

      if (selectedIndex === 'agb') {
        if (!isAuthenticated) {
          message.warning(t('loginRequiredForAgb') || 'Analisis Biomassa Mangrove (AGB) memerlukan login karena hasil perlu disimpan dan notifikasi akan dikirimkan melalui email.')
          navigate('/login')
          return
        }
        const coordinates = areaPoints.map((point) => [point[1], point[0]])
        const firstCoordinate = coordinates[0]
        const lastCoordinate = coordinates[coordinates.length - 1]
        if (firstCoordinate[0] !== lastCoordinate[0] || firstCoordinate[1] !== lastCoordinate[1]) {
          coordinates.push([...coordinates[0]])
        }
        const job = await geeApi.createAnalysisJob({
          aoi_geojson: { type: 'Polygon', coordinates: [coordinates] },
          start_date: startDateStr,
          end_date: endDateStr,
        })
        setAnalysisJob(job)
        setAnalysisResult(null)
        setAnalysisJobHistory((jobs) => [job, ...jobs.filter((item) => item.id !== job.id)])
        const [jobs, notifications] = await Promise.all([
          geeApi.listAnalysisJobs(),
          geeApi.listAnalysisNotifications(),
        ])
        setAnalysisJobHistory(jobs)
        setAnalysisNotifications(notifications)
        message.info(t('agbJobQueued'))
        return
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
          modelVersion: result.model_version,
          modelStatus: result.model_status,
          modelUnit: result.model_unit,
          disclaimer: result.disclaimer,
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

  // Handle Simpan ke Spatial
  const handleSaveToAstraGis = async () => {
    if (!isAuthenticated) {
      message.warning(t('loginRequiredToSave') || 'Silakan masuk terlebih dahulu untuk menyimpan data.')
      navigate('/login')
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
        err.response?.data?.detail || 'Gagal menyimpan layer.'
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
        modelVersion: analysisResult.model_version,
        modelStatus: analysisResult.model_status,
        modelUnit: analysisResult.model_unit,
        disclaimer: analysisResult.disclaimer,
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
            <div className={`w-8 h-8 rounded-xl text-white flex items-center justify-center font-bold text-base shadow-sm shrink-0 ${
              initialSection === 'biomass'
                ? 'bg-gradient-to-br from-violet-600 to-indigo-600 shadow-indigo-200'
                : 'bg-emerald-600'
            }`}>
              {initialSection === 'biomass' ? '🤖' : '🛰️'}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm sm:text-base font-bold text-gray-800 leading-tight truncate">
                {initialSection === 'biomass' ? t('agbModalTitle') : t('geeAnalysisTitle')}
              </h3>
              <p className="text-[11px] sm:text-xs text-gray-500 font-normal truncate">
                {initialSection === 'biomass' ? t('agbModalSubtitle') : t('geeAnalysisSubtitle')} • {areaPoints && areaPoints.length >= 3 ? `${areaHectares.toFixed(2)} Ha (${areaPoints.length} ${t('pointsUnit')})` : t('noAoiSelected')}
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
          {activeSections.length > 1 && (
            <div className="flex gap-2 border-b border-gray-200 pb-2 mb-3 overflow-x-auto no-scrollbar">
              {activeSections.map((sec) => (
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
          )}

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

              <div className="grid grid-cols-1 gap-2">
                {sec.indices.map((idx) => {
                  const isUnderDev = sec.underDevelopment || idx.underDevelopment
                  const isSelected = selectedIndex === idx.id
                  const isAgb = idx.id === 'agb'
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
                          ? isAgb
                            ? 'bg-gradient-to-r from-violet-50 to-indigo-50/90 border-indigo-500 ring-2 ring-indigo-500/25 shadow-sm cursor-pointer'
                            : 'bg-emerald-50/80 border-emerald-500 ring-2 ring-emerald-500/20 shadow-sm cursor-pointer'
                          : isAgb
                          ? 'bg-white border-indigo-200/80 hover:border-indigo-300 hover:bg-indigo-50/20 cursor-pointer'
                          : 'bg-white border-gray-200 hover:border-gray-300 cursor-pointer'
                      }`}
                      title={isUnderDev ? t('underDevNoticeShort') : localizedName}
                    >
                      <div className="flex flex-col h-full justify-between gap-1.5">
                        <div>
                          <div className="flex items-center justify-between gap-1.5 mb-1.5">
                            <span className="font-bold text-xs sm:text-sm text-gray-800 truncate flex items-center gap-1.5" title={localizedName}>
                              {isAgb && <span>🤖</span>}
                              <span>{shortName}</span>
                            </span>
                            <span
                              className={`text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0 ${
                                isUnderDev
                                  ? 'bg-amber-100 text-amber-800 border border-amber-200/60'
                                  : isAgb
                                  ? 'bg-indigo-100 text-indigo-800 border border-indigo-200 font-semibold'
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
          const isAgb = selectedIndex === 'agb'
          const hasValidAoi = areaPoints && areaPoints.length >= 3
          const isRunDisabled = isAnalyzing || isUnderDev || !hasValidAoi

          return (
            <div className="flex flex-col gap-2">
              {isAgb && !isAuthenticated && (
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-2.5 text-[11px] text-amber-900 flex items-start gap-2 shadow-xs">
                  <span className="text-base leading-none">🔐</span>
                  <div className="flex-1 leading-relaxed">
                    <strong>{t('loginRequiredForAgb')}</strong>
                  </div>
                </div>
              )}

              {isAgb && !isAuthenticated ? (
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="w-full py-2.5 px-4 rounded-xl font-bold text-xs shadow-md bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-700 hover:from-violet-700 hover:via-indigo-700 text-white cursor-pointer flex items-center justify-center gap-2 ring-2 ring-indigo-400/30"
                >
                  <LockOutlined className="text-sm" />
                  <span>{t('signInToRunAgb')}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleRunAnalysis}
                  disabled={isRunDisabled}
                  className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs shadow-md transition flex items-center justify-center gap-2 ${
                    isUnderDev
                      ? 'bg-amber-100 text-amber-800 border border-amber-300 cursor-not-allowed opacity-90 shadow-none'
                      : !hasValidAoi
                      ? 'bg-gray-200 text-gray-500 border border-gray-300 cursor-not-allowed opacity-80 shadow-none'
                      : isAgb
                      ? 'bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-700 hover:from-violet-700 hover:via-indigo-700 hover:to-purple-800 active:from-violet-900 active:to-purple-900 shadow-indigo-300/50 shadow-md text-white cursor-pointer ring-2 ring-indigo-400/30'
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
                      <span>{isAgb ? t('runningAgbAnalysis') : t('runningAnalysis')}</span>
                    </>
                  ) : isAgb ? (
                    <>
                      <span className="text-sm">🤖</span>
                      <span>{t('runAgbModelBtn')}</span>
                    </>
                  ) : (
                    <>
                      <ThunderboltOutlined className="text-sm font-extrabold" />
                      <span>{t('runAnalysisBtn')}</span>
                    </>
                  )}
                </button>
              )}

              {!hasValidAoi && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-2 text-center text-[11px] text-amber-900 flex items-center justify-center gap-1.5 font-medium">
                  <span>💡</span>
                  <span>{t('noAoiAnalysisWarning')}</span>
                </div>
              )}
            </div>
          )
        })()}

        {selectedIndex === 'agb' && modelInfo && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950">
            <div className="mb-1 flex flex-wrap items-center gap-2 font-bold">
              <Badge color="orange" text={t('agbBetaBadge')} />
              <span>{modelInfo.model_version}</span>
            </div>
            <p>{t('agbBetaDisclaimer')}</p>
            <p className="mt-1 font-semibold">{t('agbUnitLabel')}: {t('agbUnitVal')}</p>
            {!modelInfo.metrics_display_allowed && (
              <p className="mt-1 text-amber-900/80">{t('agbMetricsUnavailable')}</p>
            )}
          </div>
        )}

        {selectedIndex === 'agb' && analysisJob && (
          <div className={`rounded-xl border p-3 text-xs ${
            analysisJob.status === 'succeeded'
              ? 'border-emerald-300 bg-emerald-50/60'
              : analysisJob.status === 'failed'
              ? 'border-red-300 bg-red-50/70'
              : analysisJob.status === 'running'
              ? 'border-blue-300 bg-blue-50/60'
              : 'border-amber-300 bg-white'
          }`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  color={
                    analysisJob.status === 'succeeded'
                      ? 'green'
                      : analysisJob.status === 'failed'
                      ? 'red'
                      : analysisJob.status === 'running'
                      ? 'blue'
                      : 'orange'
                  }
                />
                <span className="font-bold text-gray-800">
                  {t('agbJobStatus')}: {t(`agbJobStatus_${analysisJob.status}`)}
                </span>
                <span className="text-gray-500">
                  {analysisJob.model_version} · {t('agbUnitVal')}
                </span>
              </div>
              {['queued', 'running'].includes(analysisJob.status) && (
                <button
                  type="button"
                  onClick={handleCancelAnalysisJob}
                  className="rounded-lg border border-red-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-50 transition"
                >
                  {t('agbCancelJob')}
                </button>
              )}
            </div>

            <p className="mt-1 text-[11px] text-gray-500">{t('agbBetaDisclaimer')}</p>
            <p className="mt-1 text-gray-700">{t('agbJobTileCount')}: <span className="font-semibold">{analysisJob.tile_count}</span></p>

            {(analysisJob.warnings || []).map((warning) => (
              <p key={warning} className="mt-1 text-amber-800">{warning}</p>
            ))}

            {analysisJob.status === 'queued' && (
              <div className="mt-2.5 rounded-lg border border-amber-200 bg-amber-50 p-2.5 flex items-center gap-2 text-amber-900">
                <span>⏳</span>
                <p className="font-semibold text-xs">{t('agbWorkerPending')}</p>
              </div>
            )}

            {analysisJob.status === 'running' && (
              <div className="mt-2.5 rounded-xl border border-blue-200 bg-white p-3 shadow-xs">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2 font-bold text-blue-900">
                    <Spin size="small" />
                    <span>{t('agbJobRunningDesc')}</span>
                  </div>
                  <span className="font-mono font-bold text-blue-700">{analysisJob.progress || 0}%</span>
                </div>
                <Progress percent={analysisJob.progress || 0} size="small" status="active" />
              </div>
            )}

            {analysisJob.status === 'failed' && (
              <div className="mt-2.5 rounded-xl border border-red-200 bg-white p-3 shadow-xs flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5 font-bold text-red-700">
                  <span>❌</span>
                  <span>{t('agbFailedDesc')}</span>
                </div>
                <div className="rounded-lg bg-red-50 border border-red-200 p-2.5 text-xs text-red-950 flex flex-col gap-1">
                  <span className="font-bold text-red-800">{t('agbFailureReason')}:</span>
                  <span className="font-mono text-red-900 text-[11px] break-words">
                    {analysisJob.error_message || t('agbDefaultFailureReason')}
                  </span>
                </div>
              </div>
            )}

            {analysisJob.status === 'succeeded' && analysisJob.result?.statistics && (
              <div className="mt-2.5 rounded-xl border border-emerald-200 bg-white p-3 shadow-xs flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-emerald-900">
                    <CheckCircleOutlined className="text-emerald-600 text-base" />
                    <span>{t('agbJobCompleteDesc')}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold text-[10px] border border-emerald-300">
                    ✓ {t('agbJobStatus_succeeded')}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs mt-1">
                  <div className="bg-emerald-50/50 p-2 rounded-lg border border-emerald-100">
                    <p className="text-[10px] text-gray-500 font-medium">{t('agbValidPredictionPixels')}</p>
                    <p className="font-mono font-bold text-emerald-900">
                      {analysisJob.result.statistics.valid_pixel_count?.toLocaleString() || 0}
                    </p>
                  </div>
                  <div className="bg-emerald-50/50 p-2 rounded-lg border border-emerald-100">
                    <p className="text-[10px] text-gray-500 font-medium">{t('agbPredictionRange')}</p>
                    <p className="font-mono font-bold text-emerald-900">
                      {analysisJob.result.statistics.minimum_kg_per_pixel} – {analysisJob.result.statistics.maximum_kg_per_pixel} {t('agbUnitVal')}
                    </p>
                  </div>
                </div>

                <p className="text-[11px] text-emerald-900/80">
                  {t('agbExtrapolation')}: <span className="font-bold font-mono">{analysisJob.result.statistics.extrapolation_percentage}%</span>
                </p>

                {analysisJob.result.layer?.name && (
                  <div className="flex items-center justify-between gap-2 bg-emerald-50/80 p-2 rounded-lg border border-emerald-200">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span>🗺️</span>
                      <span className="font-medium text-xs truncate" title={analysisJob.result.layer.name}>
                        {analysisJob.result.layer.name}
                      </span>
                    </div>
                    {onEnableAgbLayer && (
                      <button
                        type="button"
                        onClick={() => onEnableAgbLayer(analysisJob.result.layer)}
                        className="shrink-0 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] rounded-lg transition"
                      >
                        {t('agbOpenLayer')}
                      </button>
                    )}
                  </div>
                )}

                {analysisJob.result.artifact?.download_url && (
                  <a
                    className="mt-1 inline-flex items-center gap-1.5 font-bold text-xs text-emerald-700 hover:text-emerald-800 underline"
                    href={geeApi.getAnalysisDownloadUrl(analysisJob.id)}
                  >
                    <DownloadOutlined /> {t('agbDownloadPredictionRaster')}
                  </a>
                )}
                {(analysisJob.result.warnings || []).map((warning) => (
                  <p key={warning} className="mt-1 text-amber-800">{warning}</p>
                ))}
              </div>
            )}
          </div>
        )}

        {selectedIndex === 'agb' && (analysisJobHistory.length > 0 || analysisNotifications.length > 0) && (
          <div className="rounded-xl border border-gray-200 bg-white p-3 text-xs">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-bold text-gray-800 flex items-center gap-1.5">
                <span>🕒</span>
                <span>{t('agbJobHistory')}</span>
              </h4>
              <span className="text-[11px] text-gray-400 font-mono">
                {analysisJobHistory.length} jobs
              </span>
            </div>
            <ul className="flex flex-col gap-2">
              {analysisJobHistory.slice(0, 5).map((job) => {
                const isComplete = job.status === 'succeeded'
                const isFailed = job.status === 'failed'
                const isRunning = job.status === 'running'
                const isQueued = job.status === 'queued'

                return (
                  <li
                    key={job.id}
                    className={`rounded-xl p-3 border transition-all ${
                      isComplete
                        ? 'border-emerald-200 bg-emerald-50/30 hover:bg-emerald-50/60'
                        : isFailed
                        ? 'border-red-200 bg-red-50/40 hover:bg-red-50/70'
                        : isRunning
                        ? 'border-blue-200 bg-blue-50/50'
                        : 'border-gray-200 bg-gray-50/60'
                    }`}
                  >
                    {/* Header baris: Version, Unit, Status Badge */}
                    <div className="flex flex-wrap items-center justify-between gap-1.5 mb-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          color={isComplete ? 'green' : isFailed ? 'red' : isRunning ? 'blue' : 'orange'}
                        />
                        <span className="font-bold text-gray-800">{job.model_version}</span>
                        <span className="text-gray-400">·</span>
                        <span className="text-[11px] text-gray-600">{t('agbUnitVal')}</span>
                      </div>

                      {/* Status Tag */}
                      <div>
                        {isComplete && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px] border border-emerald-300">
                            ✓ {t('agbJobStatus_succeeded')}
                          </span>
                        )}
                        {isFailed && (
                          <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-800 font-bold text-[10px] border border-red-300">
                            ❌ {t('agbJobStatus_failed')}
                          </span>
                        )}
                        {isRunning && (
                          <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold text-[10px] border border-blue-300 flex items-center gap-1">
                            <Spin size="small" /> {t('agbJobStatus_running')}
                          </span>
                        )}
                        {isQueued && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px] border border-amber-300">
                            ⏳ {t('agbJobStatus_queued')}
                          </span>
                        )}
                        {job.status === 'cancelled' && (
                          <span className="px-2 py-0.5 rounded-full bg-gray-200 text-gray-700 font-medium text-[10px]">
                            {t('agbJobStatus_cancelled')}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Metadata: Tile count, Date, ID */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-500 mb-1">
                      <span>{job.tile_count} {t('agbJobTileCount').toLowerCase()}</span>
                      {job.created_at && (
                        <span>{dayjs(job.created_at).format('YYYY-MM-DD HH:mm')}</span>
                      )}
                      <span className="font-mono text-[10px] text-gray-400">ID: {job.id.slice(0, 8)}...</span>
                    </div>

                    {/* DETAIL SESUAI STATUS */}
                    {/* 1. Jika FAILED: Tampilkan alasan kegagalan */}
                    {isFailed && (
                      <div className="mt-2 rounded-lg bg-white/90 border border-red-200 p-2.5 text-[11px] text-red-950 flex flex-col gap-1">
                        <div className="flex items-center gap-1 font-bold text-red-800">
                          <span>⚠️</span>
                          <span>{t('agbFailureReason')}:</span>
                        </div>
                        <p className="font-mono text-red-900 bg-red-50/70 p-1.5 rounded border border-red-100 break-words leading-relaxed">
                          {job.error_message || t('agbDefaultFailureReason')}
                        </p>
                      </div>
                    )}

                    {/* 2. Jika RUNNING: Tampilkan progres */}
                    {isRunning && (
                      <div className="mt-2 bg-white/80 p-2 rounded-lg border border-blue-100">
                        <div className="flex justify-between text-[11px] font-semibold text-blue-800 mb-1">
                          <span>{t('agbJobRunningDesc')}</span>
                          <span className="font-mono">{job.progress || 0}%</span>
                        </div>
                        <Progress percent={job.progress || 0} size="small" status="active" />
                      </div>
                    )}

                    {/* 3. Jika COMPLETE: Tampilkan konfirmasi & tombol aksi */}
                    {isComplete && (
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-emerald-100 text-[11px]">
                        <span className="text-emerald-800 font-medium">
                          {t('agbJobCompleteDesc')}
                        </span>
                        <div className="flex items-center gap-2">
                          {job.result?.layer && onEnableAgbLayer && (
                            <button
                              type="button"
                              onClick={() => onEnableAgbLayer(job.result.layer)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] rounded transition cursor-pointer"
                            >
                              {t('agbOpenLayer')}
                            </button>
                          )}
                          {job.result?.artifact?.download_url && (
                            <a
                              className="text-emerald-700 hover:text-emerald-800 font-semibold underline text-[10px]"
                              href={geeApi.getAnalysisDownloadUrl(job.id)}
                            >
                              GeoTIFF
                            </a>
                          )}
                        </div>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
            {analysisNotifications.length > 0 && (
              <div className="mt-3 border-t border-gray-100 pt-2">
                <h5 className="mb-1 font-semibold text-gray-700">{t('agbNotifications')}</h5>
                {analysisNotifications.slice(0, 3).map((item) => (
                  <div key={item.id} className="mb-1.5 p-2 rounded-lg bg-gray-50 border border-gray-100 text-[11px]">
                    <span className="font-bold text-gray-700">{item.title}</span>
                    <p className="text-gray-600 mt-0.5">{item.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

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
            <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
              <div className="bg-white p-2.5 rounded-xl border border-gray-200/80">
                <p className="text-[11px] text-gray-500 font-medium">{t('minValLabel')}</p>
                <p className="font-mono font-bold text-gray-800 text-sm">
                  {analysisResult.statistics.min} {analysisResult.analysis_type === 'agb' ? t('agbUnitVal') : ''}
                </p>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-gray-200/80">
                <p className="text-[11px] text-gray-500 font-medium">{t('maxValLabel')}</p>
                <p className="font-mono font-bold text-gray-800 text-sm">
                  {analysisResult.statistics.max} {analysisResult.analysis_type === 'agb' ? t('agbUnitVal') : ''}
                </p>
              </div>
              {analysisResult.analysis_type !== 'agb' && (
                <>
                  <div className="bg-white p-2.5 rounded-xl border border-gray-200/80">
                    <p className="text-[11px] text-gray-500 font-medium">{t('meanValLabel')}</p>
                    <p className="font-mono font-bold text-emerald-700 text-sm">{analysisResult.statistics.mean}</p>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-gray-200/80">
                    <p className="text-[11px] text-gray-500 font-medium">{t('totalAoiAreaLabel')}</p>
                    <p className="font-mono font-bold text-gray-800 text-sm">{analysisResult.statistics.area_hectares} Ha</p>
                  </div>
                </>
              )}
            </div>

            {/* KARTU MODEL MACHINE LEARNING AGB & UNDUH CSV (FORMAT EXCEL) */}
            {analysisResult.analysis_type === 'agb' && (
              <div className="bg-gradient-to-r from-emerald-50 to-teal-50/80 p-3.5 rounded-xl border border-emerald-300 flex flex-col gap-2.5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🤖</span>
                    <div>
                      <h5 className="font-bold text-xs text-emerald-950 flex items-center gap-1.5 flex-wrap">
                        <span>{t('mlModelBadge')}</span>
                        <Badge color="orange" text={t('agbBetaBadge')} />
                        <span className="text-[10px] bg-emerald-200 text-emerald-900 font-mono px-1.5 py-0.5 rounded-md font-semibold">
                          {analysisResult.model_version}
                        </span>
                      </h5>
                      <p className="text-[11px] text-emerald-800/80">
                        {t('mlFeaturesUsed')} · {t('agbUnitVal')}
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

                <div className="rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-[11px] text-amber-950">
                  <p className="font-semibold">{analysisResult.disclaimer}</p>
                  {!analysisResult.metrics_display_allowed && <p className="mt-1">{t('agbMetricsUnavailable')}</p>}
                </div>

                <div className="bg-white/90 p-2.5 rounded-lg border border-emerald-200/80 text-[11px] flex flex-col gap-1 text-emerald-900">
                  <div className="flex items-center gap-1.5">
                    <span className="text-emerald-700 font-bold">🌿 {t('greenGradLegendNote') || 'Gradasi Hijau: Semakin besar nilainya maka warnanya semakin hijau pekat.'}</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-gray-500 font-medium mt-0.5">
                    <span>{t('agbLegendLow')}</span>
                    <span className="h-2 flex-1 mx-2 rounded-full shadow-inner" style={{ background: 'linear-gradient(to right, #ffffd4, #d9f0a3, #78c679, #41ab5d, #238443, #004529)' }}></span>
                    <span className="text-emerald-950 font-bold">{t('agbLegendHigh')}</span>
                  </div>
                </div>
              </div>
            )}

            {/* COLOR PALETTE BAR */}
            {analysisResult.palette && (
              <div className="bg-white p-2.5 rounded-xl border border-gray-200/80">
                <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                  <span>Min: {analysisResult.palette.min} {analysisResult.analysis_type === 'agb' ? analysisResult.model_unit : ''}</span>
                  <span className="font-semibold text-gray-700">Visual Ramp</span>
                  <span>Maks: {analysisResult.palette.max} {analysisResult.analysis_type === 'agb' ? analysisResult.model_unit : ''}</span>
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

            {/* FORM SIMPAN KE SPATIAL */}
            <div className="bg-white p-3.5 rounded-xl border border-gray-200 flex flex-col gap-2.5 mt-1">
              <h5 className="font-bold text-xs text-gray-800 flex items-center gap-1.5">
                <SaveOutlined className="text-blue-600" />
                {t('saveToAstraGis')}
              </h5>

              {!isAuthenticated ? (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs text-amber-900">
                  <div className="flex items-center gap-2">
                    <LockOutlined className="text-amber-600 text-sm shrink-0" />
                    <span className="leading-snug">{t('loginRequiredToSave')}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate('/login')}
                    className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg shadow-xs transition cursor-pointer shrink-0"
                  >
                    {t('signIn') || 'Masuk'}
                  </button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-2">
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
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

export default GeeAnalysisModal
