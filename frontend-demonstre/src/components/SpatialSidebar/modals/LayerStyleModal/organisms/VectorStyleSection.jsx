import { SparklesIcon, RotateCcwIcon, CircleIcon, SquareIcon, TriangleIcon, StarIcon, PlusIcon } from '../atoms/StyleIcons'
import PresetPaletteButton from '../atoms/PresetPaletteButton'
import ShapeOptionButton from '../atoms/ShapeOptionButton'
import ColorPickerField from '../atoms/ColorPickerField'
import StrokeDashSelector from '../atoms/StrokeDashSelector'
import SliderControl from '../atoms/SliderControl'
import VectorLivePreviewCard from '../molecules/VectorLivePreviewCard'

export const VECTOR_PRESET_PALETTES = [
  { name: 'Teal AstraGIS', fill: '#0d9488', stroke: '#0f766e', label: 'Teal' },
  { name: 'Ocean Blue', fill: '#0284c7', stroke: '#0369a1', label: 'Blue' },
  { name: 'Crimson Alert', fill: '#e11d48', stroke: '#be123c', label: 'Red' },
  { name: 'Sunset Amber', fill: '#d97706', stroke: '#b45309', label: 'Amber' },
  { name: 'Emerald Forest', fill: '#059669', stroke: '#047857', label: 'Green' },
  { name: 'Royal Purple', fill: '#7c3aed', stroke: '#6d28d9', label: 'Purple' },
  { name: 'Slate Gray', fill: '#475569', stroke: '#1e293b', label: 'Slate' },
]

export const MARK_OPTIONS = [
  { id: 'circle', label: 'Lingkaran', icon: CircleIcon },
  { id: 'square', label: 'Persegi', icon: SquareIcon },
  { id: 'triangle', label: 'Segitiga', icon: TriangleIcon },
  { id: 'star', label: 'Bintang', icon: StarIcon },
  { id: 'cross', label: 'Salib (+)', icon: PlusIcon },
]

export const STROKE_DASH_OPTIONS = [
  { id: 'solid', label: 'Garis Utuh', value: null },
  { id: 'dashed', label: 'Putus-putus', value: '6,4' },
  { id: 'dotted', label: 'Titik-titik', value: '2,4' },
]

const VectorStyleSection = ({
  fillColor,
  setFillColor,
  strokeColor,
  setStrokeColor,
  strokeWidth,
  setStrokeWidth,
  fillOpacity,
  setFillOpacity,
  strokeOpacity,
  setStrokeOpacity,
  pointSize,
  setPointSize,
  mark,
  setMark,
  strokeDash,
  setStrokeDash,
  isPoint,
  isLine,
  isPolygon,
  geomLabel,
  onReset,
  t,
}) => {
  return (
    <div className="mt-3.5 space-y-4">
      {/* Preset Palet Warna Cepat */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
            <SparklesIcon className="w-3.5 h-3.5 text-teal-600" /> {t('quickPresetColors', 'Preset Warna Cepat')}
          </label>
          <button
            type="button"
            onClick={onReset}
            className="text-[11px] text-slate-500 hover:text-teal-600 font-medium flex items-center gap-1 transition cursor-pointer"
            title="Reset ke warna default"
          >
            <RotateCcwIcon className="w-3 h-3" /> {t('resetDefault', 'Reset Default')}
          </button>
        </div>
        <div className="grid grid-cols-7 gap-2">
          {VECTOR_PRESET_PALETTES.map((preset) => {
            const isSelected = fillColor.toLowerCase() === preset.fill.toLowerCase()
            return (
              <PresetPaletteButton
                key={preset.name}
                preset={preset}
                isSelected={isSelected}
                onClick={() => {
                  setFillColor(preset.fill)
                  setStrokeColor(preset.stroke)
                }}
              />
            )
          })}
        </div>
      </div>

      {/* Live Preview Card */}
      <VectorLivePreviewCard
        isPolygon={isPolygon}
        isLine={isLine}
        isPoint={isPoint}
        fillColor={fillColor}
        fillOpacity={fillOpacity}
        strokeColor={strokeColor}
        strokeWidth={strokeWidth}
        strokeOpacity={strokeOpacity}
        strokeDash={strokeDash}
        mark={mark}
        pointSize={pointSize}
        geomLabel={geomLabel}
        t={t}
      />

      {/* Pilihan Bentuk Marker (Point Mark) - KHUSUS DATA TITIK (POINT) */}
      {isPoint && (
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-2">
            {t('pointMarkerShape', 'Bentuk Marker Titik (Point Marker)')}
          </label>
          <div className="grid grid-cols-5 gap-1.5">
            {MARK_OPTIONS.map((opt) => (
              <ShapeOptionButton
                key={opt.id}
                option={opt}
                isSelected={mark === opt.id}
                onClick={() => setMark(opt.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Form Kontrol Warna */}
      <div className={`grid grid-cols-1 ${isLine ? '' : 'sm:grid-cols-2'} gap-3.5`}>
        {/* Fill Color */}
        {!isLine && (
          <ColorPickerField
            label={t('fillColor', 'Warna Isian (Fill Color)')}
            value={fillColor}
            onChange={setFillColor}
          />
        )}

        {/* Stroke Color */}
        <ColorPickerField
          label={
            isLine
              ? t('lineColor', 'Warna Garis (Line Color)')
              : isPoint
              ? t('pointBorderColor', 'Warna Border Titik (Border Color)')
              : t('strokeColor', 'Warna Garis Tepi (Stroke Color)')
          }
          value={strokeColor}
          onChange={setStrokeColor}
        />
      </div>

      {/* Tipe Garis Tepi (Stroke Style) */}
      {!isPoint && (
        <StrokeDashSelector
          label={
            isLine
              ? t('lineStyle', 'Pola Garis (Line Style)')
              : t('strokeStyle', 'Pola Garis Tepi (Stroke Style)')
          }
          value={strokeDash}
          onChange={setStrokeDash}
          options={STROKE_DASH_OPTIONS}
        />
      )}

      {/* Slider Transparansi & Ukuran */}
      <div className={`grid grid-cols-1 ${isPolygon ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-3.5 pt-1`}>
        {!isLine && (
          <SliderControl
            label={t('fillOpacity', 'Transparansi Isian (Fill Opacity)')}
            value={fillOpacity}
            onChange={setFillOpacity}
            min={0}
            max={1}
            step={0.05}
            formatValue={(v) => `${Math.round(v * 100)}%`}
          />
        )}

        <SliderControl
          label={
            isLine
              ? t('lineOpacity', 'Transparansi Garis (Line Opacity)')
              : t('strokeOpacity', 'Transparansi Garis (Stroke Opacity)')
          }
          value={strokeOpacity}
          onChange={setStrokeOpacity}
          min={0}
          max={1}
          step={0.05}
          formatValue={(v) => `${Math.round(v * 100)}%`}
        />

        <SliderControl
          label={
            isPoint
              ? t('pointBorderWidth', 'Tebal Border Titik')
              : isLine
              ? t('lineWidth', 'Ketebalan Garis (Line Width)')
              : t('strokeWidth', 'Ketebalan Garis (Stroke Width)')
          }
          value={strokeWidth}
          onChange={setStrokeWidth}
          min={0.5}
          max={8}
          step={0.5}
          formatValue={(v) => `${v} px`}
        />

        {isPoint && (
          <SliderControl
            label={t('pointSize', 'Ukuran Marker Titik (Point Size)')}
            value={pointSize}
            onChange={setPointSize}
            min={4}
            max={24}
            step={1}
            formatValue={(v) => `${v} px`}
          />
        )}
      </div>
    </div>
  )
}

export default VectorStyleSection
