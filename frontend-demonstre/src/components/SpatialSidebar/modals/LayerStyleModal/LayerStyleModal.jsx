import { useState, useEffect } from 'react'
import { Modal, Button, message } from 'antd'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import layerApi from '../../../../api/LayerApi'
import {
  COLOR_RAMP_PREVIEWS,
  loadSavedCustomRamps,
  saveCustomRampsToStorage,
  generateClassificationClasses,
  findMatchingColorRamp,
} from '../../../../utils/styleConstants'
import { useLanguage } from '../../../../context/LanguageContext'
import { QUERY_KEYS } from '../../../../constants/queryKeys'

import { PaletteIcon, CheckIcon } from './atoms/StyleIcons'
import VectorStyleSection, { STROKE_DASH_OPTIONS } from './organisms/VectorStyleSection'
import RasterStyleSection from './organisms/RasterStyleSection'
import SaveCustomRampModal from './molecules/SaveCustomRampModal'

const LayerStyleModal = ({ open, onClose, layer, workspace, onStyleApplied }) => {
  const { t, translateApi } = useLanguage()
  const queryClient = useQueryClient()
  const isWorkspaceMode = Boolean(workspace)

  // Deteksi tipe data (Vector vs Raster)
  const isVector = !isWorkspaceMode && (
    layer?.layer_type === 'vector' ||
    layer?.type === 'vector' ||
    ['SHP', 'GEOJSON', 'KML', 'KMZ'].includes(String(layer?.data_type || layer?.file_format || '').toUpperCase()) ||
    Boolean(layer?.geometry_type)
  )

  const rawGeom = String(layer?.geom_type || layer?.geometry_type || '').toLowerCase()
  const isPoint = rawGeom.includes('point')
  const isLine = rawGeom.includes('line') || rawGeom.includes('string')
  const isPolygon = !isPoint && !isLine
  const geomLabel = layer?.geom_type || (isPoint ? 'Point' : isLine ? 'Line' : 'Polygon')

  // ==================== STATE VEKTOR ====================
  const [fillColor, setFillColor] = useState('#0d9488')
  const [strokeColor, setStrokeColor] = useState('#0f766e')
  const [strokeWidth, setStrokeWidth] = useState(2)
  const [fillOpacity, setFillOpacity] = useState(0.65)
  const [strokeOpacity, setStrokeOpacity] = useState(1.0)
  const [pointSize, setPointSize] = useState(8)
  const [mark, setMark] = useState('circle')
  const [strokeDash, setStrokeDash] = useState('solid')

  // ==================== STATE RASTER ====================
  const [method, setMethod] = useState('jenks')
  const [nClasses, setNClasses] = useState(10)
  const [colorRamp, setColorRamp] = useState('cyan_blue_magenta')
  const [styleType, setStyleType] = useState('intervals')

  // Custom Color Ramps State
  const [customRamps, setCustomRamps] = useState(loadSavedCustomRamps)
  const [detectedLayerRamp, setDetectedLayerRamp] = useState(null)
  const [originalLayerClasses, setOriginalLayerClasses] = useState([])
  const [isSaveRampModalOpen, setIsSaveRampModalOpen] = useState(false)
  const [newRampName, setNewRampName] = useState('')

  // Raster stats & saved status
  const [loadingInfo, setLoadingInfo] = useState(false)
  const [calculating, setCalculating] = useState(false)
  const [stats, setStats] = useState(null)
  const [lastSavedTime, setLastSavedTime] = useState(null)

  // Table classes
  const [classes, setClasses] = useState([])

  const allRamps = [...COLOR_RAMP_PREVIEWS, ...customRamps]

  // Inisialisasi data saat modal dibuka
  useEffect(() => {
    if (!open) return
    if (!layer) return

    if (isVector) {
      const sym = layer?.symbology?.symbol || (typeof layer?.symbology === 'object' ? layer?.symbology : null) || {}
      setFillColor(sym.fill_color || '#0d9488')
      setStrokeColor(sym.stroke_color || '#0f766e')
      setStrokeWidth(sym.stroke_width !== undefined ? Number(sym.stroke_width) : 2)
      setFillOpacity(sym.fill_opacity !== undefined ? Number(sym.fill_opacity) : 0.65)
      setStrokeOpacity(sym.stroke_opacity !== undefined ? Number(sym.stroke_opacity) : 1.0)
      setPointSize(sym.point_size !== undefined ? Number(sym.point_size) : 8)

      const rawMark = sym.mark || 'circle'
      setMark(rawMark)

      if (sym.stroke_dasharray === '2,4') {
        setStrokeDash('dotted')
      } else if (sym.stroke_dasharray) {
        setStrokeDash('dashed')
      } else {
        setStrokeDash('solid')
      }

      setLastSavedTime(layer?.symbology?.updated_at || null)
      return
    }

    const applySymbologyToState = (sym) => {
      const rawClasses = sym.classes || sym.colors || []
      const formattedClasses = rawClasses.map((c, i) => ({
        min: c.min !== undefined ? c.min : (c.quantity !== undefined ? c.quantity : i),
        max: c.max !== undefined ? c.max : (c.quantity !== undefined ? c.quantity : i),
        quantity: c.quantity !== undefined ? c.quantity : (c.max !== undefined ? c.max : i),
        color: c.color || '#00e5ff',
        opacity: c.opacity ?? 1.0,
        label: c.label || (c.min !== undefined && c.max !== undefined ? `${c.min} - ${c.max}` : `Class ${i + 1}`),
      }))

      setStyleType(sym.style_type || 'intervals')
      setMethod(sym.classification_method || 'manual')
      setNClasses(sym.classes_count || formattedClasses.length)
      setClasses(formattedClasses)
      setOriginalLayerClasses(formattedClasses)
      setLastSavedTime(sym.updated_at || null)

      const classColors = formattedClasses.map((c) => c.color)
      const matched = findMatchingColorRamp(classColors, allRamps)

      if (sym.color_ramp && sym.color_ramp !== 'custom' && allRamps.some((r) => r.id === sym.color_ramp)) {
        setColorRamp(sym.color_ramp)
        setDetectedLayerRamp(null)
      } else if (matched) {
        setColorRamp(matched.id)
        setDetectedLayerRamp(null)
      } else {
        const detected = {
          id: 'layer_style',
          name: t('layerCurrentStyle', 'Style Layer Saat Ini'),
          colors: classColors,
        }
        setDetectedLayerRamp(detected)
        setColorRamp('layer_style')
      }
    }

    const initialSym = (layer?.symbology && (layer.symbology.classes?.length > 0 || layer.symbology.colors?.length > 0))
      ? layer.symbology
      : null

    if (initialSym) {
      applySymbologyToState(initialSym)
    }

    setLoadingInfo(true)
    Promise.resolve(layerApi.getRasterInfo(layer.id))
      .then((res) => {
        const data = res?.data
        if (data?.statistics) {
          setStats(data.statistics)
        }

        const sym = (data?.saved_symbology && (data.saved_symbology.classes?.length > 0 || data.saved_symbology.colors?.length > 0))
          ? data.saved_symbology
          : initialSym

        if (sym && (sym.classes?.length > 0 || sym.colors?.length > 0)) {
          applySymbologyToState(sym)
        } else {
          setLastSavedTime(null)
          setDetectedLayerRamp(null)
          setOriginalLayerClasses([])
          const topRamp = allRamps[0]?.id || COLOR_RAMP_PREVIEWS[0].id
          setColorRamp(topRamp)
          handleRunClassification(10, 'jenks', topRamp, data?.statistics)
        }
      })
      .catch((err) => {
        console.warn('Failed to load raster info, falling back:', err)
        if (!initialSym) {
          const topRamp = allRamps[0]?.id || COLOR_RAMP_PREVIEWS[0].id
          setColorRamp(topRamp)
          handleRunClassification(10, 'jenks', topRamp)
        }
      })
      .finally(() => {
        setLoadingInfo(false)
      })
  }, [open, layer, workspace, isVector, isWorkspaceMode])

  const handleRunClassification = async (
    classesCount = nClasses,
    classMethod = method,
    rampId = colorRamp,
    incomingStats = null
  ) => {
    const activeRamps = detectedLayerRamp ? [detectedLayerRamp, ...allRamps] : allRamps
    const selectedRamp = activeRamps.find((r) => r.id === rampId) || allRamps[0]
    const colors = selectedRamp?.colors || ['#00e5ff', '#0044ff', '#ff00ee']
    const count = Number(classesCount) || 10
    const currentStats = incomingStats || stats

    setCalculating(true)
    try {
      if (layer && layer.id && !isVector) {
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
      console.warn('Classification computation fallback:', err)
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

  const handleDeleteCustomRamp = (e, rampId) => {
    e.stopPropagation()
    const updated = customRamps.filter((r) => r.id !== rampId)
    setCustomRamps(updated)
    saveCustomRampsToStorage(updated)
    if (colorRamp === rampId) {
      setColorRamp('cyan_blue_magenta')
      handleRunClassification(nClasses, method, 'cyan_blue_magenta')
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

      if (field === 'color') {
        const updatedColors = updated.map((c) => c.color)
        setDetectedLayerRamp({
          id: 'layer_style',
          name: t('layerCurrentStyle', 'Style Layer Saat Ini'),
          colors: updatedColors,
        })
        setColorRamp('layer_style')
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
        color: '#3b82f6',
        opacity: 1.0,
        label: `${lastQty} - ${newQty}`,
      },
    ])
  }

  const removeClass = (index) => {
    if (classes.length <= 1) {
      message.warning(t('minOneColorClass', 'Minimal harus ada 1 kelas warna!'))
      return
    }
    setClasses((prev) => prev.filter((_, i) => i !== index))
  }

  const handleResetVector = () => {
    setFillColor('#0d9488')
    setStrokeColor('#0f766e')
    setStrokeWidth(2)
    setFillOpacity(0.65)
    setStrokeOpacity(1.0)
    setPointSize(8)
    setMark('circle')
    setStrokeDash('solid')
  }

  const handleRampChange = (val) => {
    setColorRamp(val)
    if (val === 'layer_style') {
      if (originalLayerClasses.length > 0) {
        setClasses(originalLayerClasses)
        setNClasses(originalLayerClasses.length)
      }
    } else {
      handleRunClassification(nClasses, method, val)
    }
  }

  const mutation = useMutation({
    mutationFn: (data) => layerApi.updateStyle(data),
    onSuccess: (res) => {
      message.success(
        res?.data?.detail || t('styleSavedSuccess', 'Klasifikasi & style layer berhasil disimpan!')
      )
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.layers })
      if (onStyleApplied && layer) {
        onStyleApplied(layer.id)
      }
      onClose()
    },
    onError: (err) => {
      message.error(translateApi ? translateApi(err, 'styleApplyFailed') : (err?.response?.data?.detail || err?.message || 'Gagal menerapkan style'))
    },
  })

  const handleSubmit = () => {
    if (!layer) return

    if (isVector) {
      const dashParam = STROKE_DASH_OPTIONS.find((opt) => opt.id === strokeDash)?.value || null
      const geomType = layer.geom_type || layer.geometry_type || (isPoint ? 'Point' : isLine ? 'LineString' : 'Polygon')

      mutation.mutate({
        layer_id: layer.id,
        workspace_name: layer.workspace_name,
        layer_name: layer.geoserver_name || layer.table_name || layer.layer_name,
        layer_kind: 'vector',
        geometry_type: geomType,
        style_mode: 'single',
        symbol: {
          fill_color: fillColor,
          fill_opacity: Number(fillOpacity),
          stroke_color: strokeColor,
          stroke_width: Number(strokeWidth),
          stroke_opacity: Number(strokeOpacity),
          point_size: Number(pointSize),
          mark: mark,
          stroke_dasharray: dashParam,
          marker_type: 'shape',
        },
      })
      return
    }

    mutation.mutate({
      layer_id: layer.id,
      workspace_name: layer.workspace_name,
      layer_name: layer.geoserver_name || layer.table_name || layer.store_name || layer.layer_name,
      layer_kind: 'raster',
      style_type: styleType,
      classification_method: method,
      classes_count: classes.length,
      color_ramp: colorRamp === 'layer_style' ? 'custom' : colorRamp,
      colors: classes.map((c) => ({
        min: c.min !== undefined ? Number(c.min) : null,
        max: c.max !== undefined ? Number(c.max) : null,
        quantity: Number(c.quantity !== undefined ? c.quantity : c.max),
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
        width={isVector ? 620 : 780}
        centered
        className="rounded-2xl overflow-hidden"
      >
        <div className="pt-2">
          {/* Header Modal */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-teal-50 text-teal-600 rounded-xl">
                <PaletteIcon className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-800">
                    {isVector
                      ? t('vectorSymbologyTitle', 'Vector Layer Style & Symbology')
                      : t('rasterSymbologyTitle', 'Raster Symbology & Classification')}
                  </h2>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 uppercase">
                    {isVector ? (layer?.geom_type || layer?.geometry_type || layer?.data_type || 'Vector') : 'Raster'}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Layer:{' '}
                  <span className="font-semibold text-slate-700">
                    {layer?.layer_name || layer?.display_name}
                  </span>{' '}
                  ({layer?.workspace_name})
                </p>
              </div>
            </div>
          </div>

          {/* Section: Organism Vector or Raster */}
          {isVector ? (
            <VectorStyleSection
              fillColor={fillColor}
              setFillColor={setFillColor}
              strokeColor={strokeColor}
              setStrokeColor={setStrokeColor}
              strokeWidth={strokeWidth}
              setStrokeWidth={setStrokeWidth}
              fillOpacity={fillOpacity}
              setFillOpacity={setFillOpacity}
              strokeOpacity={strokeOpacity}
              setStrokeOpacity={setStrokeOpacity}
              pointSize={pointSize}
              setPointSize={setPointSize}
              mark={mark}
              setMark={setMark}
              strokeDash={strokeDash}
              setStrokeDash={setStrokeDash}
              isPoint={isPoint}
              isLine={isLine}
              isPolygon={isPolygon}
              geomLabel={geomLabel}
              onReset={handleResetVector}
              t={t}
            />
          ) : (
            <RasterStyleSection
              stats={stats}
              method={method}
              setMethod={setMethod}
              nClasses={nClasses}
              setNClasses={setNClasses}
              colorRamp={colorRamp}
              setColorRamp={setColorRamp}
              detectedLayerRamp={detectedLayerRamp}
              standardRamps={COLOR_RAMP_PREVIEWS}
              customRamps={customRamps}
              onOpenSaveCustomRamp={() => setIsSaveRampModalOpen(true)}
              onDeleteCustomRamp={handleDeleteCustomRamp}
              classes={classes}
              onClassify={handleRunClassification}
              calculating={calculating}
              loadingInfo={loadingInfo}
              onAddClass={addClass}
              onUpdateClass={updateClass}
              onRemoveClass={removeClass}
              onRampChange={handleRampChange}
              t={t}
            />
          )}

          {/* Footer Buttons */}
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
            <div className="text-[11px] text-slate-400">
              {lastSavedTime && (
                <span>
                  Last saved: {new Date(lastSavedTime).toLocaleString()}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={onClose}
                disabled={mutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="primary"
                onClick={handleSubmit}
                loading={mutation.isPending}
                icon={<CheckIcon className="w-4 h-4" />}
                className="bg-teal-600 hover:bg-teal-500 flex items-center gap-1 cursor-pointer"
              >
                {isVector
                  ? t('applySaveVectorStyle', 'Terapkan & Simpan Style Vektor')
                  : t('applySaveRasterStyle', 'Apply & Save Classification')}
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Modal Simpan Custom Color Ramp */}
      <SaveCustomRampModal
        open={isSaveRampModalOpen}
        onCancel={() => setIsSaveRampModalOpen(false)}
        onSave={handleSaveCurrentAsCustomRamp}
        classes={classes}
        rampName={newRampName}
        setRampName={setNewRampName}
      />
    </>
  )
}

export default LayerStyleModal
