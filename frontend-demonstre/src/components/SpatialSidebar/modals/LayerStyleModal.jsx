import { useState, useEffect } from 'react'
import { Modal, Button, Select, Input, message, Spin } from 'antd'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import layerApi from '../../../api/LayerApi'
import {
  COLOR_RAMP_PREVIEWS,
  PRESETS,
  loadSavedCustomRamps,
  saveCustomRampsToStorage,
  generateClassificationClasses,
} from '../../../utils/styleConstants'
import { useLanguage } from '../../../context/LanguageContext'

// Clean SVG Icons for zero-dependency reliability
const PaletteIcon = ({ className = 'w-5 h-5' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
    <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
    <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
    <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
    <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
  </svg>
)

const CalculatorIcon = ({ className = 'w-3.5 h-3.5' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="16" height="20" x="4" y="2" rx="2" />
    <line x1="8" x2="16" y1="6" y2="6" />
    <line x1="16" x2="16" y1="14" />
    <path d="M16 10h.01M12 10h.01M8 10h.01M12 14h.01M8 14h.01M12 18h.01M8 18h.01" />
  </svg>
)

const BookmarkPlusIcon = ({ className = 'w-3 h-3' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
    <line x1="12" x2="12" y1="7" y2="13" />
    <line x1="9" x2="15" y1="10" y2="10" />
  </svg>
)

const SlidersIcon = ({ className = 'w-3.5 h-3.5' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="21" x2="14" y1="4" y2="4" />
    <line x1="10" x2="3" y1="4" y2="4" />
    <line x1="21" x2="12" y1="12" y2="12" />
    <line x1="8" x2="3" y1="12" y2="12" />
    <line x1="21" x2="16" y1="20" y2="20" />
    <line x1="12" x2="3" y1="20" y2="20" />
    <line x1="14" x2="14" y1="2" y2="6" />
    <line x1="8" x2="8" y1="10" y2="14" />
    <line x1="16" x2="16" y1="18" y2="22" />
  </svg>
)

const PlusIcon = ({ className = 'w-3.5 h-3.5' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M12 5v14" />
  </svg>
)

const TrashIcon = ({ className = 'w-3.5 h-3.5' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    <line x1="10" x2="10" y1="11" y2="17" />
    <line x1="14" x2="14" y1="11" y2="17" />
  </svg>
)

const CheckIcon = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

const LayerStyleModal = ({ layer, open, onClose, onStyleApplied }) => {
  const { t } = useLanguage()
  const queryClient = useQueryClient()

  // Classification configuration
  const [method, setMethod] = useState('jenks') // 'jenks', 'equal_interval', 'quantile', 'manual'
  const [nClasses, setNClasses] = useState(10) // default 10 kelas
  const [colorRamp, setColorRamp] = useState('greens')
  const [styleType, setStyleType] = useState('intervals')

  // Custom Color Ramps
  const [customRamps, setCustomRamps] = useState(loadSavedCustomRamps)
  const [isSaveRampModalOpen, setIsSaveRampModalOpen] = useState(false)
  const [newRampName, setNewRampName] = useState('')

  // Statistics & loading state
  const [loadingInfo, setLoadingInfo] = useState(false)
  const [calculating, setCalculating] = useState(false)
  const [stats, setStats] = useState(null)
  const [lastSavedTime, setLastSavedTime] = useState(null)

  // Classes list: [{ min, max, quantity, color, opacity, label }]
  const [classes, setClasses] = useState([])

  const allRamps = [...COLOR_RAMP_PREVIEWS, ...customRamps]

  // Inisialisasi data & raster info saat modal dibuka
  useEffect(() => {
    if (!open || !layer) return

    let cancelled = false
    setLoadingInfo(true)
    setStats(null)
    setClasses([])
    setLastSavedTime(null)
    layerApi
      .getRasterInfo(layer.id)
      .then((res) => {
        if (cancelled) return
        const data = res?.data
        if (data?.statistics) {
          setStats(data.statistics)
        }

        if (data?.saved_symbology && data.saved_symbology.classes?.length > 0) {
          const sym = data.saved_symbology
          setStyleType(sym.style_type || 'intervals')
          setMethod(sym.classification_method || 'jenks')
          setNClasses(sym.classes_count || sym.classes.length)
          setColorRamp(sym.color_ramp || 'greens')
          setClasses(sym.classes.map((cls) => ({
            ...cls,
            quantity: Number(cls.quantity ?? cls.max ?? 0),
            opacity: Number(cls.opacity ?? 1),
            label: cls.label || (cls.min !== undefined && cls.max !== undefined
              ? `${cls.min} - ${cls.max}`
              : String(cls.quantity ?? cls.max ?? '')),
          })))
          setLastSavedTime(sym.updated_at)
        } else {
          setLastSavedTime(null)
          handleRunClassification(10, 'jenks', 'greens', data?.statistics)
        }
      })
      .catch((err) => {
        if (cancelled) return
        console.warn('Gagal memuat raster info GeoServer:', err)
        handleRunClassification(10, 'jenks', 'greens')
      })
      .finally(() => {
        if (!cancelled) setLoadingInfo(false)
      })

    return () => {
      cancelled = true
    }
  }, [open, layer?.id])

  // Menjalankan algoritma klasifikasi (Jenks / Equal Interval / Quantile)
  const handleRunClassification = async (
    classesCount = nClasses,
    classMethod = method,
    rampId = colorRamp,
    incomingStats = null
  ) => {
    const selectedRamp = allRamps.find((r) => r.id === rampId) || allRamps[0]
    const colors = selectedRamp?.colors || ['#edf8fb', '#b2e2e2', '#66c2a4', '#2ca25f', '#006d2c']
    const count = Number(classesCount) || 10
    const currentStats = incomingStats || stats

    setCalculating(true)
    try {
      if (layer && layer.id) {
        const res = await layerApi.classifyPreview(layer.id, {
          n_classes: count,
          method: classMethod,
          custom_colors: colors,
        })
        const result = res?.data?.data
        if (result?.classes && result.classes.length > 0) {
          setClasses(result.classes)
          setStyleType('intervals')
          if (result.statistics) {
            setStats(result.statistics)
          }
          return
        }
      }

      // Fallback hitung lokal
      const minVal = currentStats?.min ?? 0
      const maxVal = currentStats?.max ?? 100
      const newClasses = generateClassificationClasses({
        min: minVal,
        max: maxVal,
        count,
        method: classMethod,
        colors,
      })
      setClasses(newClasses)
      setStyleType('intervals')
    } catch (err) {
      console.warn('Perhitungan klasifikasi lokal fallback:', err)
      const newClasses = generateClassificationClasses({
        min: 0,
        max: 100,
        count,
        method: classMethod,
        colors,
      })
      setClasses(newClasses)
      setStyleType('intervals')
    } finally {
      setCalculating(false)
    }
  }

  // Menerapkan template preset cepat
  const applyPreset = (preset) => {
    setStyleType(preset.styleType || 'intervals')
    setClasses(JSON.parse(JSON.stringify(preset.classes)))
    setMethod('manual')
    setNClasses(preset.classes.length)
  }

  // Menyimpan susunan warna saat ini sebagai Custom Color Ramp
  const handleSaveCurrentAsCustomRamp = () => {
    if (!newRampName.trim()) {
      message.warning('Masukkan nama Color Ramp terlebih dahulu!')
      return
    }
    const currentColors = classes.map((c) => c.color).filter(Boolean)
    if (currentColors.length < 2) {
      message.warning('Minimal harus ada 2 warna pada kelas untuk disimpan sebagai Color Ramp!')
      return
    }

    const newRamp = {
      id: `custom_${Date.now()}`,
      name: newRampName.trim(),
      colors: currentColors,
      isCustom: true,
    }

    const updated = [newRamp, ...customRamps]
    setCustomRamps(updated)
    saveCustomRampsToStorage(updated)
    setColorRamp(newRamp.id)
    setNewRampName('')
    setIsSaveRampModalOpen(false)
    message.success(`Color Ramp '${newRamp.name}' berhasil disimpan!`)
  }

  // Hapus Custom Color Ramp
  const handleDeleteCustomRamp = (e, rampId) => {
    e.stopPropagation()
    const updated = customRamps.filter((r) => r.id !== rampId)
    setCustomRamps(updated)
    saveCustomRampsToStorage(updated)
    if (colorRamp === rampId) {
      setColorRamp('greens')
      handleRunClassification(nClasses, method, 'greens')
    }
    message.info('Color Ramp kustom berhasil dihapus.')
  }

  const updateClass = (index, field, value) => {
    setClasses((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }

      if (field === 'quantity') {
        updated[index].max = Number(value)
        if (updated[index].min !== undefined) {
          updated[index].label = `${updated[index].min} - ${value}`
        }
      } else if (field === 'max') {
        updated[index].quantity = Number(value)
        if (updated[index].min !== undefined) {
          updated[index].label = `${updated[index].min} - ${value}`
        }
      }
      return updated
    })
  }

  const addClass = () => {
    const lastCls = classes.length > 0 ? classes[classes.length - 1] : null
    const lastQty = lastCls ? Number(lastCls.quantity || lastCls.max || 0) : 0
    const newQty = Number((lastQty + 1).toFixed(2))
    setClasses((prev) => [
      ...prev,
      {
        min: lastQty,
        max: newQty,
        quantity: newQty,
        color: '#10b981',
        opacity: 1.0,
        label: `${lastQty} - ${newQty}`,
      },
    ])
  }

  const removeClass = (index) => {
    if (classes.length <= 1) {
      message.warning('Minimal harus ada 1 kelas warna!')
      return
    }
    setClasses((prev) => prev.filter((_, i) => i !== index))
  }

  // Mutation untuk mengirim SLD Style ke GeoServer Microservice v1
  const mutation = useMutation({
    mutationFn: (data) => layerApi.updateStyle({ layerId: layer.id, data }),
    onSuccess: (res) => {
      message.success(res?.data?.detail || 'Klasifikasi & style layer berhasil disimpan di GeoServer!')
      queryClient.invalidateQueries({ queryKey: ['layers'] })
      if (onStyleApplied && layer) {
        onStyleApplied(layer.id, {
          style_name: layer.style_name || layer.symbology?.style_name || `style_${layer.geoserver_name || layer.store_name || layer.layer_name}`,
          style_type: styleType,
          classification_method: method,
          classes_count: classes.length,
          color_ramp: colorRamp,
          updated_at: new Date().toISOString(),
          classes: classes.map((cls) => ({
            ...cls,
            quantity: Number(cls.quantity ?? cls.max ?? 0),
            opacity: Number(cls.opacity ?? 1),
          })),
        })
      }
      onClose()
    },
    onError: (err) => {
      message.error(err?.response?.data?.detail || 'Gagal menerapkan style ke GeoServer')
    },
  })

  const handleSubmit = () => {
    if (!layer) return
    mutation.mutate({
      layer_id: layer.id,
      workspace_name: layer.workspace_name,
      layer_name: layer.geoserver_name || layer.table_name || layer.store_name || layer.layer_name,
      style_type: styleType,
      classification_method: method,
      classes_count: classes.length,
      color_ramp: colorRamp,
      colors: classes.map((c) => ({
        min: c.min !== undefined ? Number(c.min) : null,
        max: c.max !== undefined ? Number(c.max) : null,
        quantity: Number(c.quantity !== undefined ? c.quantity : (c.max ?? 0)),
        color: c.color,
        opacity: Number(c.opacity ?? 1.0),
        label: c.label || '',
      })),
    })
  }

  return (
    <>
      <Modal
        open={open}
        onCancel={onClose}
        footer={null}
        width={780}
        centered
        className="rounded-2xl overflow-hidden"
      >
        <div className="pt-2">
          {/* Header Modal - Gaya AstraGIS */}
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                <PaletteIcon className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-800">
                  {t('rasterSymbologyTitle') || 'Raster Symbology & Classification'}
                </h2>
                <p className="text-xs text-gray-500">
                  Layer:{' '}
                  <span className="font-semibold text-gray-700">
                    {layer?.layer_name}
                  </span>{' '}
                  ({layer?.workspace_name})
                </p>
              </div>
            </div>
          </div>

          {/* Raster Statistics Banner */}
          {stats && (
            <div className="mt-3 flex items-center justify-between px-3.5 py-2 bg-gradient-to-r from-emerald-50/80 to-teal-50/80 rounded-xl border border-emerald-100 text-xs text-gray-700">
              <div className="flex items-center gap-3">
                <span className="font-semibold text-emerald-900 flex items-center gap-1">
                  <SlidersIcon className="w-3.5 h-3.5 text-emerald-600" />
                  Statistik Raster:
                </span>
                <span>
                  Min: <strong className="font-mono text-emerald-800">{stats.min}</strong>
                </span>
                <span className="text-gray-300">|</span>
                <span>
                  Max: <strong className="font-mono text-emerald-800">{stats.max}</strong>
                </span>
                <span className="text-gray-300">|</span>
                <span>
                  Mean: <strong className="font-mono text-emerald-800">{stats.mean}</strong>
                </span>
                <span className="text-gray-300">|</span>
                <span>
                  Std: <strong className="font-mono text-emerald-800">{stats.std}</strong>
                </span>
              </div>
              {stats.valid_pixels && (
                <span className="text-[11px] text-gray-400">
                  {stats.valid_pixels.toLocaleString()} piksel
                </span>
              )}
            </div>
          )}

          {/* Preset Cepat Tematik Mangrove & Analisis */}
          <div className="mt-3">
            <span className="text-[11px] font-semibold text-gray-600 block mb-1.5">
              Preset Tematik Cepat:
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className="flex flex-col text-left p-2 rounded-xl border border-gray-200 hover:border-emerald-500 hover:bg-emerald-50/40 transition group cursor-pointer"
                >
                  <span className="text-[11px] font-semibold text-gray-800 group-hover:text-emerald-700 truncate">
                    {p.name}
                  </span>
                  <div className="flex h-2 w-full rounded overflow-hidden shadow-inner my-1">
                    {p.classes.map((c, i) => (
                      <div
                        key={i}
                        style={{
                          backgroundColor: c.opacity === 0 ? 'transparent' : c.color,
                          flex: 1,
                        }}
                      />
                    ))}
                  </div>
                  <span className="text-[9px] text-gray-400 truncate">{p.description}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Classification Controls Panel */}
          <div className="mt-3.5 p-3.5 bg-gray-50/80 rounded-xl border border-gray-200">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Classification Method */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                  Metode Klasifikasi:
                </label>
                <Select
                  value={method}
                  onChange={(val) => {
                    setMethod(val)
                    if (val !== 'manual') {
                      handleRunClassification(nClasses, val, colorRamp)
                    }
                  }}
                  className="w-full text-xs"
                  options={[
                    { value: 'jenks', label: 'Natural Breaks (Jenks)' },
                    { value: 'equal_interval', label: 'Equal Interval' },
                    { value: 'quantile', label: 'Quantile' },
                    { value: 'manual', label: 'Manual (Custom)' },
                  ]}
                />
              </div>

              {/* Number of Classes */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                  Jumlah Kelas:
                </label>
                <Select
                  value={nClasses}
                  onChange={(val) => {
                    setNClasses(val)
                    handleRunClassification(val, method, colorRamp)
                  }}
                  className="w-full text-xs"
                  options={[
                    { value: 3, label: '3 Kelas' },
                    { value: 4, label: '4 Kelas' },
                    { value: 5, label: '5 Kelas' },
                    { value: 6, label: '6 Kelas' },
                    { value: 7, label: '7 Kelas' },
                    { value: 8, label: '8 Kelas' },
                    { value: 9, label: '9 Kelas' },
                    { value: 10, label: '10 Kelas (Default)' },
                    { value: 12, label: '12 Kelas' },
                    { value: 15, label: '15 Kelas' },
                  ]}
                />
              </div>

              {/* Color Ramp Selector */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-semibold text-gray-600">
                    Palet Warna (Color Ramp):
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsSaveRampModalOpen(true)}
                    className="text-[10px] text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-0.5 hover:underline cursor-pointer"
                    title="Simpan susunan warna saat ini sebagai Color Ramp kustom"
                  >
                    <BookmarkPlusIcon className="w-3 h-3 text-emerald-600" />
                    + Simpan Custom
                  </button>
                </div>
                <Select
                  value={colorRamp}
                  onChange={(val) => {
                    setColorRamp(val)
                    handleRunClassification(nClasses, method, val)
                  }}
                  className="w-full text-xs"
                >
                  <Select.OptGroup label="Palet Warna Standar">
                    {COLOR_RAMP_PREVIEWS.map((ramp) => (
                      <Select.Option key={ramp.id} value={ramp.id}>
                        <div className="flex items-center gap-2">
                          <div className="flex h-2.5 w-14 rounded overflow-hidden shadow-inner flex-shrink-0">
                            {ramp.colors.map((c, i) => (
                              <div key={i} style={{ backgroundColor: c, flex: 1 }} />
                            ))}
                          </div>
                          <span className="text-xs truncate">{ramp.name}</span>
                        </div>
                      </Select.Option>
                    ))}
                  </Select.OptGroup>

                  {customRamps.length > 0 && (
                    <Select.OptGroup label="Custom Color Ramps (Tersimpan)">
                      {customRamps.map((ramp) => (
                        <Select.Option key={ramp.id} value={ramp.id}>
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="flex h-2.5 w-14 rounded overflow-hidden shadow-inner flex-shrink-0">
                                {ramp.colors.map((c, i) => (
                                  <div key={i} style={{ backgroundColor: c, flex: 1 }} />
                                ))}
                              </div>
                              <span className="text-xs truncate font-medium text-emerald-700">{ramp.name}</span>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => handleDeleteCustomRamp(e, ramp.id)}
                              className="text-gray-400 hover:text-red-500 p-0.5"
                              title="Hapus color ramp ini"
                            >
                              <TrashIcon className="w-3 h-3 text-red-500" />
                            </button>
                          </div>
                        </Select.Option>
                      ))}
                    </Select.OptGroup>
                  )}
                </Select>
              </div>
            </div>

            {/* Sub-baris: SLD Style Type & Re-classify */}
            <div className="mt-3 flex items-center justify-between pt-2 border-t border-gray-200">
              <div className="flex items-center gap-2 text-[11px] text-gray-500">
                <span>Tipe SLD:</span>
                <Select
                  value={styleType}
                  onChange={setStyleType}
                  size="small"
                  className="w-32"
                  options={[
                    { value: 'intervals', label: 'Intervals (Range)' },
                    { value: 'ramp', label: 'Ramp (Gradasi Halus)' },
                    { value: 'values', label: 'Values (Diskrit)' },
                  ]}
                />
              </div>
              <Button
                size="small"
                type="default"
                icon={<CalculatorIcon className="w-3.5 h-3.5 text-emerald-600 inline" />}
                onClick={() => handleRunClassification(nClasses, method, colorRamp)}
                loading={calculating}
                className="text-xs flex items-center gap-1 font-medium border-emerald-300 text-emerald-700 hover:border-emerald-500"
              >
                Hitung Otomatis
              </Button>
            </div>
          </div>

          {/* Tabel Rentang Kelas (Classification Breaks) */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-700">
                Daftar Rentang Kelas ({classes.length} kelas):
              </span>
              <Button
                type="dashed"
                size="small"
                icon={<PlusIcon className="w-3.5 h-3.5 inline" />}
                onClick={addClass}
                className="text-xs flex items-center text-emerald-700 border-emerald-300 hover:border-emerald-500"
              >
                Tambah Kelas
              </Button>
            </div>

            {loadingInfo || calculating ? (
              <div className="flex items-center justify-center py-10 bg-gray-50 rounded-xl border border-gray-200">
                <Spin tip="Menghitung nilai raster & interval kelas..." />
              </div>
            ) : (
              <div className="max-h-[260px] overflow-y-auto overflow-x-auto pr-1 border border-gray-200 rounded-xl bg-gray-50/50 p-1.5">
                <div className="min-w-[620px] space-y-1.5">
                  {/* Header Tabel */}
                  <div className="flex items-center gap-2 px-2 py-1 text-[11px] font-semibold text-gray-500 bg-gray-100 rounded-lg">
                    <div className="w-24">Simbol</div>
                    <div className="w-36">Rentang (Min - Max)</div>
                    <div className="flex-1">Label</div>
                    <div className="w-20">Nilai (≤)</div>
                    <div className="w-20">Opacity</div>
                    <div className="w-6"></div>
                  </div>

                  {classes.map((cls, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 p-1.5 bg-white rounded-lg border border-gray-200 text-xs hover:border-gray-300 hover:shadow-xs transition"
                    >
                      {/* Simbol / Color Picker */}
                      <div className="flex items-center gap-1.5 w-24 flex-shrink-0">
                        <input
                          type="color"
                          value={cls.color}
                          onChange={(e) => updateClass(idx, 'color', e.target.value)}
                          className="w-7 h-7 rounded border border-gray-200 cursor-pointer p-0 bg-transparent"
                          title="Pilih Warna"
                        />
                        <input
                          type="text"
                          value={cls.color}
                          onChange={(e) => updateClass(idx, 'color', e.target.value)}
                          className="w-14 px-1 py-0.5 text-[10px] font-mono border border-gray-200 rounded uppercase text-gray-700"
                        />
                      </div>

                      {/* Rentang Min - Max */}
                      <div className="w-36 flex items-center gap-1 flex-shrink-0">
                        <input
                          type="number"
                          step="any"
                          value={cls.min ?? ''}
                          placeholder="Min"
                          onChange={(e) => updateClass(idx, 'min', parseFloat(e.target.value))}
                          className="w-16 px-1.5 py-1 text-xs border border-gray-200 rounded text-gray-800 font-mono text-center"
                        />
                        <span className="text-gray-400 font-bold">-</span>
                        <input
                          type="number"
                          step="any"
                          value={cls.max ?? cls.quantity ?? ''}
                          placeholder="Max"
                          onChange={(e) => updateClass(idx, 'max', parseFloat(e.target.value))}
                          className="w-16 px-1.5 py-1 text-xs border border-gray-200 rounded text-gray-800 font-mono text-center font-medium"
                        />
                      </div>

                      {/* Label Kelas */}
                      <div className="flex-1 min-w-0">
                        <input
                          type="text"
                          value={cls.label || ''}
                          placeholder="Label Kelas..."
                          onChange={(e) => updateClass(idx, 'label', e.target.value)}
                          className="w-full px-2 py-1 text-xs border border-gray-200 rounded text-gray-700"
                        />
                      </div>

                      {/* Nilai Threshold GeoServer (quantity) */}
                      <div className="w-20 flex-shrink-0">
                        <input
                          type="number"
                          step="any"
                          value={cls.quantity !== undefined ? cls.quantity : (cls.max ?? 0)}
                          onChange={(e) => updateClass(idx, 'quantity', parseFloat(e.target.value))}
                          className="w-full px-1.5 py-1 text-xs border border-gray-200 rounded text-gray-800 font-mono text-center"
                        />
                      </div>

                      {/* Opacity */}
                      <div className="w-20 flex items-center gap-1 flex-shrink-0">
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          value={cls.opacity ?? 1.0}
                          onChange={(e) => updateClass(idx, 'opacity', parseFloat(e.target.value))}
                          className="w-12 accent-emerald-600 cursor-pointer"
                        />
                        <span className="text-[10px] font-mono text-gray-500">
                          {Math.round((cls.opacity ?? 1.0) * 100)}%
                        </span>
                      </div>

                      {/* Hapus Baris */}
                      <button
                        type="button"
                        onClick={() => removeClass(idx)}
                        className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition cursor-pointer"
                        title="Hapus Kelas"
                      >
                        <TrashIcon className="w-3.5 h-3.5 text-gray-400 hover:text-red-600" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Live Preview Legenda */}
          <div className="mt-3.5 p-3 bg-gray-50 rounded-xl border border-gray-200">
            <span className="text-[11px] font-semibold text-gray-600 block mb-1.5">
              Pratinjau Legenda:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {classes.map((cls, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-1.5 text-[11px] text-gray-700 bg-white px-2 py-1 rounded-md border border-gray-200 shadow-xs"
                >
                  <span
                    className="w-3 h-3 rounded-xs flex-shrink-0 border border-black/10"
                    style={{
                      backgroundColor: cls.opacity === 0 ? 'transparent' : cls.color,
                    }}
                  />
                  <span className="font-semibold text-gray-800">
                    {cls.label || (cls.min !== undefined && cls.max !== undefined ? `${cls.min} - ${cls.max}` : `Val ${cls.quantity}`)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Footer Action Buttons */}
          <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
            <div className="text-[11px] text-gray-400">
              {lastSavedTime && (
                <span>
                  Terakhir disimpan: {new Date(lastSavedTime).toLocaleString()}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={onClose} disabled={mutation.isPending}>
                Batal
              </Button>
              <Button
                type="primary"
                onClick={handleSubmit}
                loading={mutation.isPending}
                icon={<CheckIcon className="w-4 h-4 inline" />}
                className="bg-emerald-600 hover:bg-emerald-500 border-none flex items-center gap-1"
              >
                Terapkan & Simpan ke GeoServer
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Sub-modal Simpan Custom Color Ramp */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-sm font-bold text-gray-800">
            <BookmarkPlusIcon className="w-4 h-4 text-emerald-600 inline" />
            Simpan Color Ramp Custom
          </div>
        }
        open={isSaveRampModalOpen}
        onCancel={() => setIsSaveRampModalOpen(false)}
        onOk={handleSaveCurrentAsCustomRamp}
        okText="Simpan"
        cancelText="Batal"
        okButtonProps={{ className: 'bg-emerald-600 hover:bg-emerald-500' }}
        centered
        width={420}
      >
        <div className="py-2 space-y-3">
          <p className="text-xs text-gray-500">
            Warna-warna dari susunan kelas saat ini ({classes.length} warna) akan disimpan ke daftar Color Ramp Anda:
          </p>

          <div className="flex h-3.5 w-full rounded-md overflow-hidden shadow-inner border border-gray-200">
            {classes.map((c, i) => (
              <div key={i} style={{ backgroundColor: c.color, flex: 1 }} />
            ))}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Nama Color Ramp:
            </label>
            <Input
              placeholder="Contoh: Kerapatan Mangrove Lebat..."
              value={newRampName}
              onChange={(e) => setNewRampName(e.target.value)}
              onPressEnter={handleSaveCurrentAsCustomRamp}
              maxLength={40}
              autoFocus
            />
          </div>
        </div>
      </Modal>
    </>
  )
}

export default LayerStyleModal
