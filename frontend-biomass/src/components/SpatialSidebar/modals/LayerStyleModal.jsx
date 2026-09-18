import { useState, useEffect } from 'react'
import { Modal, Select, Button, message } from 'antd'
import { PlusOutlined, DeleteOutlined, CheckOutlined } from '@ant-design/icons'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import layerApi from '../../../api/LayerApi'
import { useLanguage } from '../../../context/LanguageContext'

const LayerStyleModal = ({ layer, open, onClose, onStyleApplied }) => {
  const { t } = useLanguage()
  const queryClient = useQueryClient()

  const [styleType, setStyleType] = useState('ramp')
  const [classes, setClasses] = useState([])

  const PRESETS = [
    {
      name: t('presetMangrove'),
      description: t('presetMangroveDesc'),
      method: 'ramp',
      classes: [
        { quantity: -0.2, color: '#004da8', opacity: 0, label: t('waterBody') },
        { quantity: 0.1, color: '#e7d8b1', opacity: 1, label: t('bareLand') },
        { quantity: 0.3, color: '#fcd34d', opacity: 1, label: t('lowVegetation') },
        { quantity: 0.6, color: '#34d399', opacity: 1, label: t('mediumMangrove') },
        { quantity: 0.9, color: '#047857', opacity: 1, label: t('denseMangrove') },
      ],
    },
    {
      name: t('presetElevation'),
      description: t('presetElevationDesc'),
      method: 'ramp',
      classes: [
        { quantity: 0, color: '#0284c7', opacity: 1, label: t('seaLevel') },
        { quantity: 10, color: '#22c55e', opacity: 1, label: t('coastal') },
        { quantity: 50, color: '#eab308', opacity: 1, label: t('plains') },
        { quantity: 150, color: '#d97706', opacity: 1, label: t('hills') },
        { quantity: 500, color: '#b45309', opacity: 1, label: t('highland') },
      ],
    },
    {
      name: t('presetRisk'),
      description: t('presetRiskDesc'),
      method: 'values',
      classes: [
        { quantity: 1, color: '#10b981', opacity: 1, label: t('veryLow') },
        { quantity: 2, color: '#84cc16', opacity: 1, label: t('low') },
        { quantity: 3, color: '#eab308', opacity: 1, label: t('medium') },
        { quantity: 4, color: '#f97316', opacity: 1, label: t('high') },
        { quantity: 5, color: '#ef4444', opacity: 1, label: t('veryHigh') },
      ],
    },
    {
      name: t('presetGrayscale'),
      description: t('presetGrayscaleDesc'),
      method: 'ramp',
      classes: [
        { quantity: 0, color: '#000000', opacity: 1, label: t('minVal') },
        { quantity: 128, color: '#737373', opacity: 1, label: t('midVal') },
        { quantity: 255, color: '#ffffff', opacity: 1, label: t('maxVal') },
      ],
    },
  ]

  useEffect(() => {
    if (open && layer) {
      const defaultPreset = PRESETS[0]
      setStyleType(defaultPreset.method)
      setClasses(JSON.parse(JSON.stringify(defaultPreset.classes)))
    }
  }, [open, layer])

  const styleMutation = useMutation({
    mutationFn: ({ layerId, data }) => layerApi.updateStyle({ layerId, data }),
    onSuccess: (res) => {
      message.success(res.data?.detail || 'Style berhasil diterapkan!')
      queryClient.invalidateQueries({ queryKey: ['layers'] })
      if (onStyleApplied && layer) {
        onStyleApplied(layer.id)
      }
      onClose()
    },
    onError: (err) => {
      message.error(err.response?.data?.detail || 'Gagal menerapkan style ke GeoServer')
    },
  })

  const applyPreset = (preset) => {
    setStyleType(preset.method)
    setClasses(JSON.parse(JSON.stringify(preset.classes)))
  }

  const addClass = () => {
    const last = classes[classes.length - 1]
    const newQty = last ? Number(last.quantity) + 1 : 1
    setClasses([
      ...classes,
      { quantity: newQty, color: '#10b981', opacity: 1, label: `Kelas ${classes.length + 1}` },
    ])
  }

  const removeClass = (index) => {
    if (classes.length <= 1) {
      message.warning(t('minOneClass'))
      return
    }
    setClasses(classes.filter((_, i) => i !== index))
  }

  const updateClass = (index, field, value) => {
    setClasses((prev) =>
      prev.map((c, i) => (i === index ? { ...c, [field]: value } : c))
    )
  }

  const handleSubmit = () => {
    if (!layer) return
    const payload = {
      style_type: styleType,
      colors: classes.map((c) => ({
        quantity: parseFloat(c.quantity) || 0,
        color: c.color,
        opacity: parseFloat(c.opacity) ?? 1.0,
        label: c.label || '',
      })),
    }
    styleMutation.mutate({ layerId: layer.id, data: payload })
  }

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width="min(680px, 95vw)"
      destroyOnClose
      title={
        <div className="flex items-center gap-2 text-gray-800">
          <span className="text-base font-bold">🎨 {t('styleModalTitle')}:</span>
          <span className="text-emerald-700 font-medium text-sm truncate max-w-xs">
            {layer?.layer_name}
          </span>
        </div>
      }
    >
      <div className="py-2 space-y-4">
        {/* Preset Cepat */}
        <div>
          <span className="text-xs font-semibold text-gray-700 block mb-1.5">
            {t('presetColor')}:
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {PRESETS.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => applyPreset(p)}
                className="flex flex-col text-left p-2 rounded-xl border border-gray-200 hover:border-emerald-500 hover:bg-emerald-50/40 transition group cursor-pointer"
              >
                <span className="text-xs font-semibold text-gray-800 group-hover:text-emerald-700 truncate">
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
                <span className="text-[10px] text-gray-400 truncate">{p.description}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Tipe SLD Method */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200 gap-2.5">
          <div>
            <span className="text-xs font-semibold text-gray-700 block">{t('colorMethod')}</span>
            <span className="text-[11px] text-gray-500">
              {styleType === 'ramp' && t('rampDesc')}
              {styleType === 'values' && t('valuesDesc')}
              {styleType === 'intervals' && t('intervalsDesc')}
            </span>
          </div>
          <Select
            value={styleType}
            onChange={setStyleType}
            className="w-full sm:w-40"
            options={[
              { value: 'ramp', label: t('rampMethod') },
              { value: 'values', label: t('discreteMethod') },
              { value: 'intervals', label: t('intervalMethod') },
            ]}
          />
        </div>

        {/* Editor Kelas Warna */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-700">
              {t('customClasses')} ({classes.length} kelas):
            </span>
            <Button
              type="dashed"
              size="small"
              icon={<PlusOutlined />}
              onClick={addClass}
              className="text-xs text-emerald-700 border-emerald-300 hover:border-emerald-500"
            >
              {t('addClass')}
            </Button>
          </div>

          <div className="max-h-56 overflow-y-auto pr-1 space-y-2">
            {classes.map((cls, idx) => (
              <div
                key={idx}
                className="flex flex-wrap sm:flex-nowrap items-center gap-2 p-2 bg-white rounded-lg border border-gray-200 hover:border-emerald-300 transition text-xs"
              >
                {/* Color Picker */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <input
                    type="color"
                    value={cls.color}
                    onChange={(e) => updateClass(idx, 'color', e.target.value)}
                    className="w-7 h-7 rounded border border-gray-300 cursor-pointer p-0 bg-transparent"
                    title={t('chooseColor')}
                  />
                  <input
                    type="text"
                    value={cls.color}
                    onChange={(e) => updateClass(idx, 'color', e.target.value)}
                    className="w-16 px-1.5 py-1 text-[11px] font-mono border border-gray-200 rounded uppercase text-gray-700"
                  />
                </div>

                {/* Pixel Value */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <span className="text-[10px] text-gray-400">{t('val')}:</span>
                  <input
                    type="number"
                    step="any"
                    value={cls.quantity}
                    onChange={(e) => updateClass(idx, 'quantity', e.target.value)}
                    className="w-16 px-1.5 py-1 text-xs border border-gray-200 rounded text-gray-800 font-medium text-center"
                  />
                </div>

                {/* Label */}
                <div className="flex-1 min-w-0">
                  <input
                    type="text"
                    value={cls.label}
                    placeholder={t('labelPlaceholder')}
                    onChange={(e) => updateClass(idx, 'label', e.target.value)}
                    className="w-full px-2 py-1 text-xs border border-gray-200 rounded text-gray-700"
                  />
                </div>

                {/* Opacity */}
                <div className="flex items-center gap-1 flex-shrink-0 w-24">
                  <span className="text-[10px] text-gray-400">Op:</span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={cls.opacity}
                    onChange={(e) => updateClass(idx, 'opacity', parseFloat(e.target.value))}
                    className="w-12 accent-emerald-600 cursor-pointer"
                  />
                  <span className="text-[10px] font-mono text-gray-500 w-6">
                    {Math.round(cls.opacity * 100)}%
                  </span>
                </div>

                {/* Hapus */}
                <button
                  type="button"
                  onClick={() => removeClass(idx)}
                  className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition cursor-pointer"
                  title={t('removeClass')}
                >
                  <DeleteOutlined />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Live Preview Bar */}
        <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
          <span className="text-[11px] font-semibold text-gray-600 block mb-1.5">
            {t('legendPreview')}:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {classes.map((cls, idx) => (
              <div
                key={idx}
                className="flex items-center gap-1.5 text-[11px] text-gray-700 bg-white px-2 py-1 rounded-md border border-gray-200 shadow-xs"
              >
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0 border border-black/10"
                  style={{ backgroundColor: cls.opacity === 0 ? 'transparent' : cls.color }}
                />
                <span className="font-semibold text-gray-800">
                  {cls.label || `Val ${cls.quantity}`}
                </span>
                <span className="text-gray-400 text-[10px]">({cls.quantity})</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer Action */}
        <div className="pt-2 border-t border-gray-100 flex items-center justify-end gap-2">
          <Button onClick={onClose} disabled={styleMutation.isPending}>
            {t('cancel')}
          </Button>
          <Button
            type="primary"
            onClick={handleSubmit}
            loading={styleMutation.isPending}
            icon={<CheckOutlined />}
            className="bg-emerald-600 hover:bg-emerald-700 border-none"
          >
            {t('applyToGeoServer')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default LayerStyleModal
