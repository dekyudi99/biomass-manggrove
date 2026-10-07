import { useMemo, useState } from 'react'
import { Button, ColorPicker, InputNumber, Modal, Select, Slider, message } from 'antd'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import layerApi from '../../../api/LayerApi'
import { useLanguage } from '../../../context/LanguageContext'
import { QUERY_KEYS } from '../../../constants/queryKeys'

const DEFAULT_SYMBOL = {
  fill_color: '#0d9488',
  fill_opacity: 0.45,
  stroke_color: '#0f766e',
  stroke_width: 1.5,
  stroke_opacity: 1,
  point_size: 8,
  mark: 'circle',
  stroke_dasharray: '',
}

const normalizeGeometry = (geometryType = '') => {
  const normalized = geometryType.toLowerCase().replaceAll(' ', '')
  if (normalized.includes('point')) return 'point'
  if (normalized.includes('line') || normalized.includes('string')) return 'line'
  if (normalized.includes('polygon')) return 'polygon'
  return 'unknown'
}

const VectorPreview = ({ family, symbol }) => {
  const stroke = symbol.stroke_color
  const fill = symbol.fill_color
  const opacity = symbol.fill_opacity

  if (family === 'line') {
    return (
      <div className="flex h-20 items-center justify-center rounded-xl border border-gray-200 bg-white">
        <div
          className="w-3/4"
          style={{
            borderTopColor: stroke,
            borderTopStyle: symbol.stroke_dasharray ? 'dashed' : 'solid',
            borderTopWidth: `${Math.max(1, symbol.stroke_width)}px`,
            opacity: symbol.stroke_opacity,
          }}
        />
      </div>
    )
  }

  if (family === 'point') {
    const shapeStyles = {
      circle: { borderRadius: '50%' },
      square: { borderRadius: 2 },
      triangle: { clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)' },
      star: { clipPath: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)' },
      cross: { clipPath: 'polygon(35% 0%, 65% 0%, 65% 35%, 100% 35%, 100% 65%, 65% 65%, 65% 100%, 35% 100%, 35% 65%, 0% 65%, 0% 35%, 35% 35%)' },
    }
    return (
      <div className="flex h-20 items-center justify-center rounded-xl border border-gray-200 bg-white">
        <span
          style={{
            ...shapeStyles[symbol.mark || 'circle'],
            display: 'inline-block',
            width: symbol.point_size,
            height: symbol.point_size,
            backgroundColor: fill,
            border: `${Math.max(1, symbol.stroke_width)}px solid ${stroke}`,
            opacity: Math.max(opacity, symbol.stroke_opacity),
          }}
        />
      </div>
    )
  }

  return (
    <div className="flex h-20 items-center justify-center rounded-xl border border-gray-200 bg-white">
      <div
        className="h-12 w-3/4 rounded-md"
        style={{
          backgroundColor: fill,
          borderColor: stroke,
          borderStyle: symbol.stroke_dasharray ? 'dashed' : 'solid',
          borderWidth: `${Math.max(1, symbol.stroke_width)}px`,
          opacity,
        }}
      />
    </div>
  )
}

const VectorStyleModal = ({ layer, open, onClose, onStyleApplied }) => {
  const { t } = useLanguage()
  const queryClient = useQueryClient()
  const geometryType = layer?.geometry_type || layer?.geom_type || 'Polygon'
  const family = normalizeGeometry(geometryType)
  const geometryLabel = useMemo(() => {
    if (family === 'point') return 'Point'
    if (family === 'line') return 'Line'
    if (family === 'polygon') return 'Polygon'
    return geometryType
  }, [family, geometryType])
  const [symbol, setSymbol] = useState(() => ({
    ...DEFAULT_SYMBOL,
    ...(layer?.symbology?.symbol || {}),
  }))

  const setProperty = (key, value) => setSymbol((current) => ({ ...current, [key]: value }))
  const updateAndApplyStyle = (symbology) => {
    queryClient.setQueryData(['layers'], (current) => {
      if (!Array.isArray(current)) return current
      return current.map((item) => item.id === layer.id
        ? { ...item, symbology, style_name: symbology.style_name || item.style_name }
        : item)
    })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.layers })
    onStyleApplied?.(layer.id, symbology)
  }

  const mutation = useMutation({
    mutationFn: (payload) => layerApi.updateStyle({ layerId: layer.id, data: payload }),
    onSuccess: (response) => {
      const symbology = response?.data?.symbology || {
        layer_kind: 'vector',
        style_mode: 'single',
        geometry_type: geometryType,
        symbol,
        style_name: response?.data?.style_name || layer.style_name,
      }
      message.success(response?.data?.detail || 'Style vector berhasil diterapkan.')
      updateAndApplyStyle(symbology)
      onClose()
    },
    onError: (error) => {
      message.error(error?.response?.data?.detail || 'Gagal menerapkan style vector.')
    },
  })

  const handleSubmit = () => {
    if (!layer || family === 'unknown') return
    const vectorSymbol = { ...symbol }
    if (family !== 'polygon') {
      delete vectorSymbol.fill_color
      delete vectorSymbol.fill_opacity
    }
    if (family === 'point') delete vectorSymbol.stroke_dasharray

    mutation.mutate({
      layer_id: layer.id,
      layer_kind: 'vector',
      geometry_type: geometryType,
      style_mode: 'single',
      symbol: vectorSymbol,
    })
  }

  const renderColor = (label, key) => (
    <label className="flex items-center justify-between gap-3 text-xs text-gray-700">
      <span>{label}</span>
      <ColorPicker
        value={symbol[key]}
        showText
        format="hex"
        onChangeComplete={(color) => setProperty(key, color.toHexString())}
      />
    </label>
  )

  const renderOpacity = (label, key) => (
    <label className="block text-xs text-gray-700">
      <span className="mb-1 flex justify-between">
        <span>{label}</span>
        <span>{Math.round(symbol[key] * 100)}%</span>
      </span>
      <Slider
        min={0}
        max={1}
        step={0.05}
        value={symbol[key]}
        onChange={(value) => setProperty(key, value)}
      />
    </label>
  )

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      centered
      width={520}
      title={t('vectorStyleTitle')}
      destroyOnHidden
    >
      <div className="space-y-4 pt-2">
        <div className="text-xs text-gray-500">
          Layer: <strong className="text-gray-800">{layer?.layer_name}</strong>
          {' · '}{layer?.workspace_name}
        </div>

        <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 px-3 py-2 text-xs">
          {t('geometryType')}: <strong>{geometryLabel}</strong> · {t('singleSymbol')}
        </div>

        {family === 'unknown' ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            {t('unsupportedGeometry')} Style was not applied.
          </div>
        ) : (
          <>
            {family === 'point' && (
              <>
                <label className="block text-xs text-gray-700">
                  {t('markerShape')}
                  <Select
                    className="mt-1 w-full"
                    value={symbol.mark}
                    onChange={(value) => setProperty('mark', value)}
                    options={[
                      { value: 'circle', label: t('circle') },
                      { value: 'square', label: t('square') },
                      { value: 'triangle', label: t('triangle') },
                      { value: 'star', label: t('star') },
                      { value: 'cross', label: t('cross') },
                    ]}
                  />
                </label>
                <label className="block text-xs text-gray-700">
                  {t('markerSize')}
                  <InputNumber
                    className="mt-1 w-full"
                    min={1}
                    max={80}
                    value={symbol.point_size}
                    onChange={(value) => setProperty('point_size', value || 1)}
                  />
                </label>
                {renderColor(t('markerColor'), 'fill_color')}
                {renderOpacity(t('markerOpacity'), 'fill_opacity')}
              </>
            )}

            {family === 'polygon' && (
              <>
                {renderColor(t('fillColor'), 'fill_color')}
                {renderOpacity(t('fillOpacity'), 'fill_opacity')}
              </>
            )}

            {family !== 'point' && family !== 'polygon' && (
              <label className="block text-xs text-gray-700">
                {t('linePattern')}
                <Select
                  className="mt-1 w-full"
                  value={symbol.stroke_dasharray || 'solid'}
                  onChange={(value) => setProperty('stroke_dasharray', value === 'solid' ? '' : value)}
                  options={[
                    { value: 'solid', label: t('solid') },
                    { value: '8,4', label: t('dashed') },
                    { value: '2,3', label: t('dotted') },
                  ]}
                />
              </label>
            )}

            {renderColor(family === 'line' ? t('lineColor') : t('outlineColor'), 'stroke_color')}
            <label className="block text-xs text-gray-700">
              {family === 'line' ? t('lineWidth') : t('outlineWidth')}
              <InputNumber
                className="mt-1 w-full"
                min={0}
                max={20}
                step={0.5}
                value={symbol.stroke_width}
                onChange={(value) => setProperty('stroke_width', value ?? 0)}
              />
            </label>
            {renderOpacity('Outline opacity', 'stroke_opacity')}

            <section>
              <h3 className="mb-2 text-xs font-semibold text-gray-700">{t('livePreview')}</h3>
              <VectorPreview family={family} symbol={symbol} />
            </section>
          </>
        )}

        <div className="flex justify-end gap-2 border-t border-gray-100 pt-3">
          <Button onClick={onClose} disabled={mutation.isPending}>{t('cancel')}</Button>
          <Button
            type="primary"
            onClick={handleSubmit}
            loading={mutation.isPending}
            disabled={family === 'unknown'}
            className="bg-emerald-600"
          >
            {t('applyStyle')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default VectorStyleModal