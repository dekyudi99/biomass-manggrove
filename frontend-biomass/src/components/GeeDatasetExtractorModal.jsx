import React, { useState, useEffect, useMemo } from 'react'
import {
  Modal,
  Button,
  Select,
  Input,
  Slider,
  DatePicker,
  message,
  Spin,
  Tooltip,
  Tag,
} from 'antd'
import {
  ExperimentOutlined,
  DownloadOutlined,
  EyeOutlined,
  CopyOutlined,
  CloudUploadOutlined,
  CheckCircleOutlined,
  CalendarOutlined,
  FileTextOutlined,
  CodeOutlined,
  SlidersOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { useLanguage } from '../context/LanguageContext'
import geeApi from '../api/GeeApi'
import workspaceApi from '../api/WorkspaceApi'

const { RangePicker } = DatePicker

const GeeDatasetExtractorModal = ({
  isOpen,
  onClose,
  areaPoints = [],
  areaHectares = 0,
  onApplyPreviewLayer,
  onClearPreviewLayer,
  activePreviewLayer,
}) => {
  const { t } = useLanguage()

  // State Satelit & Katalog
  const [satellites, setSatellites] = useState([])
  const [selectedSatelliteId, setSelectedSatelliteId] = useState('sentinel2')
  const [selectedBands, setSelectedBands] = useState(['B4', 'B3', 'B2'])

  // State Parameter
  const [activeQuickMonths, setActiveQuickMonths] = useState(6)
  const [dateRange, setDateRange] = useState([
    dayjs().subtract(6, 'month'),
    dayjs(),
  ])
  const [cloudPct, setCloudPct] = useState(20)
  const [compositeMethod, setCompositeMethod] = useState('median')
  const [orbitPass, setOrbitPass] = useState('ANY')

  // State Hasil Ekstraksi
  const [isPreviewing, setIsPreviewing] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [datasetResult, setDatasetResult] = useState(null)
  const [isCodeModalVisible, setIsCodeModalVisible] = useState(false)

  // State Simpan ke AstraGIS
  const [workspaces, setWorkspaces] = useState([])
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(null)
  const [layerName, setLayerName] = useState('')
  const [layerDescription, setLayerDescription] = useState('')
  const [isSavingAstraGis, setIsSavingAstraGis] = useState(false)

  // Load katalog satelit saat komponen dibuka
  useEffect(() => {
    if (isOpen) {
      loadSatellites()
      loadWorkspaces()
    }
  }, [isOpen])

  const loadSatellites = async () => {
    try {
      const res = await geeApi.getSatellites()
      if (res && res.satellites) {
        setSatellites(res.satellites)
      }
    } catch (err) {
      console.warn('Gagal memuat katalog satelit:', err)
    }
  }

  const loadWorkspaces = async () => {
    try {
      const res = await workspaceApi.getAll()
      const wsList = res.data?.data || res.data || []
      setWorkspaces(wsList)
      if (wsList.length > 0 && !selectedWorkspaceId) {
        setSelectedWorkspaceId(wsList[0].id)
      }
    } catch (err) {
      console.warn('Gagal memuat workspace AstraGIS:', err)
    }
  }

  const currentSatellite = useMemo(() => {
    return satellites.find((s) => s.id === selectedSatelliteId) || {
      id: 'sentinel2',
      name: 'Sentinel-2 MSI (Level-2A)',
      agency: 'ESA',
      type: 'optical',
      native_scale: 10,
      bands: [],
      presets: [],
      default_rgb: ['B4', 'B3', 'B2'],
    }
  }, [satellites, selectedSatelliteId])

  // Update default bands saat satelit berganti
  const handleSatelliteChange = (satId) => {
    setSelectedSatelliteId(satId)
    const target = satellites.find((s) => s.id === satId)
    if (target) {
      setSelectedBands(target.default_rgb || target.bands.slice(0, 3).map((b) => b.id))
      const nowStr = dayjs().format('YYYYMMDD')
      setLayerName(`${satId.toUpperCase()}_DATASET_${nowStr}`)
    }
  }

  // Handle Preset Band Selector
  const applyBandPreset = (presetBands) => {
    setSelectedBands([...presetBands])
  }

  // Toggle band individual
  const toggleBand = (bandId) => {
    setSelectedBands((prev) => {
      if (prev.includes(bandId)) {
        return prev.filter((id) => id !== bandId)
      } else {
        return [...prev, bandId]
      }
    })
  }

  // Quick Date Presets
  const setQuickDate = (months) => {
    setActiveQuickMonths(months)
    setDateRange([dayjs().subtract(months, 'month'), dayjs()])
  }

  // Jalankan Preview Peta
  const handlePreviewMap = async () => {
    if (!areaPoints || areaPoints.length < 3) {
      message.error('Area poligon minimal harus memiliki 3 titik koordinat.')
      return
    }
    if (selectedBands.length === 0) {
      message.warning(t('noBandsSelectedWarning'))
      return
    }

    setIsPreviewing(true)
    try {
      const payload = {
        coordinates: areaPoints,
        satellite: selectedSatelliteId,
        bands: selectedBands,
        start_date: dateRange[0].format('YYYY-MM-DD'),
        end_date: dateRange[1].format('YYYY-MM-DD'),
        cloud_percentage: cloudPct,
        composite_method: compositeMethod,
        orbit_pass: orbitPass,
      }

      const res = await geeApi.previewDataset(payload)
      if (res && res.tile_url) {
        if (onApplyPreviewLayer) {
          onApplyPreviewLayer({
            tileUrl: res.tile_url,
            analysisType: `${res.satellite_name} (${res.preview_bands.join('-')})`,
            statistics: {
              area_hectares: res.area_hectares,
              bands: res.preview_bands,
            },
            opacity: 0.9,
          })
        }
        message.success(t('previewSuccess'))
      }
    } catch (err) {
      message.error(err.response?.data?.detail || 'Gagal mempratinjau dataset citra satelit.')
    } finally {
      setIsPreviewing(false)
    }
  }

  // Generate GeoTIFF Multi-Band & Manifest
  const handleGenerateDownload = async () => {
    if (!areaPoints || areaPoints.length < 3) {
      message.error('Area poligon minimal harus memiliki 3 titik koordinat.')
      return
    }
    if (selectedBands.length === 0) {
      message.warning(t('noBandsSelectedWarning'))
      return
    }

    setIsExporting(true)
    try {
      const payload = {
        coordinates: areaPoints,
        satellite: selectedSatelliteId,
        bands: selectedBands,
        start_date: dateRange[0].format('YYYY-MM-DD'),
        end_date: dateRange[1].format('YYYY-MM-DD'),
        cloud_percentage: cloudPct,
        composite_method: compositeMethod,
        orbit_pass: orbitPass,
        custom_name: layerName || undefined,
      }

      const res = await geeApi.getDatasetDownloadUrl(payload)
      setDatasetResult(res)
      message.success(t('downloadGeotiffSuccess'))
    } catch (err) {
      message.error(err.response?.data?.detail || 'Gagal menghasilkan URL GeoTIFF dari GEE.')
    } finally {
      setIsExporting(false)
    }
  }

  // Unduh Berkas Manifest JSON
  const handleDownloadManifestJson = () => {
    if (!datasetResult || !datasetResult.manifest) return
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(datasetResult.manifest, null, 2))
    const downloadAnchor = document.createElement('a')
    downloadAnchor.setAttribute('href', dataStr)
    downloadAnchor.setAttribute('download', `${datasetResult.dataset_name}_manifest.json`)
    document.body.appendChild(downloadAnchor)
    downloadAnchor.click()
    downloadAnchor.remove()
    message.success(t('manifestDownloaded'))
  }

  // Salin Kode Python ke Clipboard
  const handleCopyPythonCode = () => {
    if (!datasetResult || !datasetResult.python_snippet) return
    navigator.clipboard.writeText(datasetResult.python_snippet)
    message.success(t('copiedToClipboard'))
  }

  // Simpan Dataset ke AstraGIS Workspace
  const handleSaveToAstraGis = async () => {
    if (!selectedWorkspaceId) {
      message.warning(t('selectTargetWorkspace'))
      return
    }
    if (!layerName.trim()) {
      message.warning('Nama layer tidak boleh kosong.')
      return
    }

    setIsSavingAstraGis(true)
    try {
      const payload = {
        coordinates: areaPoints,
        satellite: selectedSatelliteId,
        bands: selectedBands,
        workspace_id: selectedWorkspaceId,
        layer_name: layerName.trim(),
        description: layerDescription.trim(),
        start_date: dateRange[0].format('YYYY-MM-DD'),
        end_date: dateRange[1].format('YYYY-MM-DD'),
        cloud_percentage: cloudPct,
        composite_method: compositeMethod,
        orbit_pass: orbitPass,
      }

      await geeApi.saveDatasetToAstraGis(payload)
      message.success(t('saveDatasetSuccess'))
    } catch (err) {
      message.error(err.response?.data?.detail || 'Gagal menyimpan dataset ke AstraGIS.')
    } finally {
      setIsSavingAstraGis(false)
    }
  }

  return (
    <>
      <Modal
        open={isOpen}
        onCancel={onClose}
        footer={null}
        width={780}
        centered
        closable={false}
        title={
          <div className="flex items-center justify-between pb-2.5 border-b border-gray-100 pr-0">
            {/* Header Kiri: Info Judul */}
            <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-lg shrink-0 shadow-xs border border-blue-200/60">
                🔬
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-xs sm:text-sm font-bold text-gray-800 leading-tight truncate">
                  {t('datasetExtractorTitle')}
                </h3>
                <p className="text-[10px] sm:text-[11px] text-gray-500 font-normal leading-snug truncate">
                  {t('datasetExtractorSubtitle')} • {areaHectares.toFixed(2)} Ha ({areaPoints.length} Titik)
                </p>
              </div>
            </div>

            {/* Header Kanan: Tombol Close Window */}
            <div className="flex items-center gap-1.5 shrink-0 ml-1">
              <Tooltip title={t('close')} placement="bottom">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg text-gray-400 hover:text-red-600 bg-gray-50 hover:bg-red-50 flex items-center justify-center font-bold text-xs sm:text-sm transition cursor-pointer border border-gray-200 hover:border-red-300 active:scale-95 shadow-sm"
                  aria-label={t('close')}
                >
                  ✕
                </button>
              </Tooltip>
            </div>
          </div>
        }
      >
        <div className="flex flex-col gap-4 mt-2 max-h-[76vh] overflow-y-auto pr-1">
          {/* 1. PILIHAN MISI SATELIT */}
          <div className="bg-gray-50 p-3 rounded-2xl border border-gray-200/80">
            <label className="text-xs font-bold text-gray-700 block mb-2 flex items-center justify-between">
              <span>🛰️ {t('selectSatelliteLabel')}</span>
              <span className="text-[10px] text-gray-400 font-normal">Google Earth Engine Catalog</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {satellites.map((sat) => {
                const isSelected = selectedSatelliteId === sat.id
                return (
                  <button
                    key={sat.id}
                    type="button"
                    onClick={() => handleSatelliteChange(sat.id)}
                    className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50/80 border-blue-500 ring-2 ring-blue-500/20 shadow-sm'
                        : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50/50'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="font-bold text-xs text-gray-900 truncate">
                          {sat.id === 'sentinel2' ? 'Sentinel-2 MSI' : sat.id === 'landsat89' ? 'Landsat 8/9 SR' : 'Sentinel-1 SAR'}
                        </span>
                        <Tag color={sat.type === 'sar' ? 'purple' : 'blue'} className="mr-0 text-[9px] px-1 py-0">
                          {sat.native_scale}m
                        </Tag>
                      </div>
                      <p className="text-[10px] text-gray-500 line-clamp-2 leading-tight">
                        {sat.description}
                      </p>
                    </div>
                    <div className="mt-2 pt-1 border-t border-gray-100 flex items-center justify-between text-[9px] text-gray-400 font-medium">
                      <span>{sat.agency}</span>
                      <span className="uppercase">{sat.type}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* 2. PILIHAN BAND SPEKTRAL & PRESET CEPAT */}
          <div className="bg-white p-3.5 rounded-2xl border border-gray-200/80">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-2.5">
              <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                <SlidersOutlined className="text-blue-600" />
                {t('selectBandsLabel')}:{' '}
                <span className="text-blue-700 font-extrabold ml-1">
                  {selectedBands.length} / {currentSatellite.bands?.length || 0}
                </span>
              </label>

              {/* Tombol Pilih Semua / Batal */}
              <div className="flex gap-1.5 text-[10px]">
                <button
                  type="button"
                  onClick={() => setSelectedBands(currentSatellite.bands.map((b) => b.id))}
                  className="px-2 py-0.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 cursor-pointer transition font-medium"
                >
                  {t('selectAllBands')}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedBands([])}
                  className="px-2 py-0.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 cursor-pointer transition font-medium"
                >
                  {t('deselectAllBands')}
                </button>
              </div>
            </div>

            {/* Quick Presets */}
            {currentSatellite.presets && currentSatellite.presets.length > 0 && (
              <div className="mb-3 flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-semibold text-gray-400 mr-1">
                  {t('bandPresetLabel')}:
                </span>
                {currentSatellite.presets.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applyBandPreset(preset.bands)}
                    className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-[10px] font-semibold border border-blue-200/60 cursor-pointer transition active:scale-95"
                    title={preset.desc}
                  >
                    ⚡ {preset.name}
                  </button>
                ))}
              </div>
            )}

            {/* Grid Checkbox Band */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 max-h-48 overflow-y-auto pr-1">
              {currentSatellite.bands?.map((band) => {
                const isChecked = selectedBands.includes(band.id)
                return (
                  <div
                    key={band.id}
                    onClick={() => toggleBand(band.id)}
                    className={`p-2 rounded-xl border text-left cursor-pointer transition select-none flex flex-col justify-between ${
                      isChecked
                        ? 'bg-blue-50/70 border-blue-500 shadow-xs'
                        : 'bg-gray-50/50 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="font-bold text-xs text-gray-800">{band.id}</span>
                      <span
                        className={`w-3.5 h-3.5 rounded flex items-center justify-center text-[9px] font-bold ${
                          isChecked ? 'bg-blue-600 text-white' : 'border border-gray-300 bg-white'
                        }`}
                      >
                        {isChecked && '✓'}
                      </span>
                    </div>
                    <div className="text-[9px] text-gray-500 truncate" title={band.desc}>
                      {band.wavelength}
                    </div>
                    <div className="text-[8px] text-gray-400 font-mono mt-0.5">
                      Res: {band.resolution}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 3. PARAMETER TEMPORAL, AWAN & METODE KOMPOSIT */}
          <div className="bg-gray-50 p-3.5 rounded-2xl border border-gray-200/80 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Rentang Waktu */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-gray-700 flex items-center gap-1">
                  <CalendarOutlined className="text-blue-600" />
                  {t('dateRangeLabel')}
                </label>
                <div className="flex gap-1 text-[9px]">
                  <button
                    type="button"
                    onClick={() => setQuickDate(3)}
                    className={`px-1.5 py-0.5 rounded cursor-pointer ${
                      activeQuickMonths === 3 ? 'bg-blue-600 text-white font-bold' : 'bg-white border border-gray-200 text-gray-600'
                    }`}
                  >
                    3B
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickDate(6)}
                    className={`px-1.5 py-0.5 rounded cursor-pointer ${
                      activeQuickMonths === 6 ? 'bg-blue-600 text-white font-bold' : 'bg-white border border-gray-200 text-gray-600'
                    }`}
                  >
                    6B
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickDate(12)}
                    className={`px-1.5 py-0.5 rounded cursor-pointer ${
                      activeQuickMonths === 12 ? 'bg-blue-600 text-white font-bold' : 'bg-white border border-gray-200 text-gray-600'
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

            {/* Filter Awan (Optik) atau Orbit (SAR) */}
            <div>
              {currentSatellite.type === 'sar' ? (
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1.5">
                    {t('orbitPassLabel')}
                  </label>
                  <Select
                    value={orbitPass}
                    onChange={setOrbitPass}
                    className="w-full text-xs"
                    options={[
                      { value: 'ANY', label: t('orbitAny') },
                      { value: 'ASCENDING', label: t('orbitAscending') },
                      { value: 'DESCENDING', label: t('orbitDescending') },
                    ]}
                  />
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-gray-700">
                      {t('cloudCoverageLabel')}: <span className="text-blue-600 font-extrabold">{cloudPct}%</span>
                    </label>
                  </div>
                  <Slider
                    min={5}
                    max={50}
                    step={5}
                    value={cloudPct}
                    onChange={setCloudPct}
                    className="mb-0 mt-1"
                  />
                </div>
              )}
            </div>

            {/* Metode Komposit Reduksi */}
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1.5">
                {t('compositeMethodLabel')}
              </label>
              <Select
                value={compositeMethod}
                onChange={setCompositeMethod}
                className="w-full text-xs"
                options={[
                  { value: 'median', label: t('compositeMedian') },
                  { value: 'mean', label: t('compositeMean') },
                  { value: 'min', label: t('compositeMin') },
                  { value: 'max', label: t('compositeMax') },
                  { value: 'mosaic', label: t('compositeMosaic') },
                ]}
              />
            </div>
          </div>

          {/* 4. TOMBOL AKSI UTAMA (PREVIEW & GENERATE DOWNLOAD) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={handlePreviewMap}
              disabled={isPreviewing || selectedBands.length === 0}
              className="py-2.5 px-4 rounded-xl font-bold text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-300 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2 cursor-pointer shadow-xs"
            >
              {isPreviewing ? <Spin size="small" /> : <EyeOutlined />}
              <span>{t('btnPreviewOnMap')}</span>
            </button>

            <button
              type="button"
              onClick={handleGenerateDownload}
              disabled={isExporting || selectedBands.length === 0}
              className="py-2.5 px-4 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white disabled:bg-gray-300 disabled:cursor-not-allowed transition flex items-center justify-center gap-2 cursor-pointer shadow-md"
            >
              {isExporting ? <Spin size="small" /> : <DownloadOutlined />}
              <span>{t('btnDownloadGeotiff')}</span>
            </button>
          </div>

          {/* 5. PANEL HASIL EKSTRAKSI & DOWNLOAD (JIKA SUDAH GENERATE) */}
          {datasetResult && (
            <div className="bg-emerald-50/50 p-3.5 rounded-2xl border border-emerald-200 flex flex-col gap-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <CheckCircleOutlined className="text-emerald-600 text-base" />
                  <span className="font-bold text-xs text-emerald-950 uppercase tracking-wide">
                    {t('datasetReadyForDownload')}
                  </span>
                </div>
                <Tag color="green" className="mr-0 text-[10px]">
                  Scale: {datasetResult.spatial_resolution_meters}m • {datasetResult.area_hectares} Ha
                </Tag>
              </div>

              {/* Tombol Unduhan & Salin Kode */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <a
                  href={datasetResult.download_url}
                  target="_blank"
                  rel="noreferrer"
                  className="py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition"
                >
                  <DownloadOutlined />
                  <span>GeoTIFF (.tif)</span>
                </a>

                <button
                  type="button"
                  onClick={handleDownloadManifestJson}
                  className="py-2 px-3 rounded-xl bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer"
                >
                  <FileTextOutlined className="text-blue-600" />
                  <span>Manifest (.json)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsCodeModalVisible(true)}
                  className="py-2 px-3 rounded-xl bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer"
                >
                  <CodeOutlined className="text-purple-600" />
                  <span>Python / PyTorch</span>
                </button>
              </div>

              {/* Form Simpan ke AstraGIS */}
              <div className="mt-2 pt-3 border-t border-emerald-200/70 flex flex-col gap-2">
                <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                  <CloudUploadOutlined className="text-blue-600" />
                  {t('saveDatasetToAstraGis')}
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Select
                    placeholder={t('selectTargetWorkspace')}
                    value={selectedWorkspaceId}
                    onChange={setSelectedWorkspaceId}
                    className="w-full text-xs"
                    options={workspaces.map((w) => ({
                      value: w.id,
                      label: `${w.title || w.name} (${w.name})`,
                    }))}
                  />
                  <Input
                    placeholder="Nama Layer GeoTIFF"
                    value={layerName}
                    onChange={(e) => setLayerName(e.target.value)}
                    className="text-xs rounded-lg"
                  />
                </div>

                <div className="flex gap-2">
                  <Input
                    placeholder="Keterangan dataset (opsional)..."
                    value={layerDescription}
                    onChange={(e) => setLayerDescription(e.target.value)}
                    className="text-xs rounded-lg flex-1"
                  />
                  <Button
                    type="primary"
                    onClick={handleSaveToAstraGis}
                    loading={isSavingAstraGis}
                    className="bg-blue-600 hover:bg-blue-700 font-bold text-xs shrink-0"
                  >
                    {t('save')}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* MODAL VIEW CUPLIKAN KODE PYTHON / PYTORCH */}
      <Modal
        open={isCodeModalVisible}
        onCancel={() => setIsCodeModalVisible(false)}
        footer={null}
        width={680}
        title={
          <div className="flex items-center gap-2">
            <CodeOutlined className="text-purple-600" />
            <span className="text-sm font-bold">{t('pythonSnippetTitle')}</span>
          </div>
        }
      >
        <p className="text-xs text-gray-500 mb-2 leading-relaxed">
          {t('pythonSnippetDesc')}
        </p>

        <div className="relative bg-gray-900 text-gray-100 rounded-xl p-3 text-xs font-mono overflow-x-auto max-h-80">
          <button
            type="button"
            onClick={handleCopyPythonCode}
            className="absolute top-2.5 right-2.5 px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-white text-[10px] font-sans font-bold flex items-center gap-1 cursor-pointer transition border border-gray-700"
          >
            <CopyOutlined />
            <span>{t('btnCopyPython')}</span>
          </button>
          <pre>{datasetResult?.python_snippet}</pre>
        </div>
      </Modal>
    </>
  )
}

export default GeeDatasetExtractorModal
