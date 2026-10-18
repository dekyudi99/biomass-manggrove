import { SlidersIcon } from '../atoms/StyleIcons'

const VectorLivePreviewCard = ({
  isPolygon,
  isLine,
  isPoint,
  fillColor,
  fillOpacity,
  strokeColor,
  strokeWidth,
  strokeOpacity,
  strokeDash,
  mark,
  pointSize,
  geomLabel,
  t,
}) => {
  const svgDashArray = strokeDash === 'dashed' ? '6,4' : strokeDash === 'dotted' ? '2,4' : undefined

  const renderPointPreview = () => {
    const s = Math.min(26, Math.max(10, pointSize * 1.5))
    const cx = 22
    const cy = 22

    switch (mark) {
      case 'square':
        return (
          <rect
            x={cx - s / 2}
            y={cy - s / 2}
            width={s}
            height={s}
            rx="1"
            fill={fillColor}
            fillOpacity={fillOpacity}
            stroke={strokeColor}
            strokeWidth={Math.min(3, strokeWidth)}
            strokeOpacity={strokeOpacity}
          />
        )
      case 'triangle':
        return (
          <polygon
            points={`${cx},${cy - s / 2} ${cx + s / 2},${cy + s / 2} ${cx - s / 2},${cy + s / 2}`}
            fill={fillColor}
            fillOpacity={fillOpacity}
            stroke={strokeColor}
            strokeWidth={Math.min(3, strokeWidth)}
            strokeOpacity={strokeOpacity}
          />
        )
      case 'star': {
        const rOuter = s / 2
        const rInner = rOuter * 0.45
        const points = []
        for (let i = 0; i < 10; i++) {
          const angle = (i * Math.PI) / 5 - Math.PI / 2
          const r = i % 2 === 0 ? rOuter : rInner
          points.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`)
        }
        return (
          <polygon
            points={points.join(' ')}
            fill={fillColor}
            fillOpacity={fillOpacity}
            stroke={strokeColor}
            strokeWidth={Math.min(2.5, strokeWidth)}
            strokeOpacity={strokeOpacity}
          />
        )
      }
      case 'cross': {
        const half = s / 2
        return (
          <g>
            <line
              x1={cx - half}
              y1={cy}
              x2={cx + half}
              y2={cy}
              stroke={strokeColor}
              strokeWidth={Math.min(4, Math.max(2, strokeWidth))}
              strokeOpacity={strokeOpacity}
            />
            <line
              x1={cx}
              y1={cy - half}
              x2={cx}
              y2={cy + half}
              stroke={strokeColor}
              strokeWidth={Math.min(4, Math.max(2, strokeWidth))}
              strokeOpacity={strokeOpacity}
            />
          </g>
        )
      }
      case 'circle':
      default:
        return (
          <circle
            cx={cx}
            cy={cy}
            r={Math.min(16, Math.max(4, pointSize))}
            fill={fillColor}
            fillOpacity={fillOpacity}
            stroke={strokeColor}
            strokeWidth={Math.min(3, strokeWidth)}
            strokeOpacity={strokeOpacity}
          />
        )
    }
  }

  return (
    <div className="p-3.5 bg-gradient-to-b from-slate-50 to-slate-100/70 border border-slate-200 rounded-xl">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
          <SlidersIcon className="w-3 h-3 text-teal-600" /> {t('livePreview', 'Pratinjau Tampilan (Live Preview)')}
        </span>
        <span className="text-[10px] text-slate-400 font-mono">
          {geomLabel}
        </span>
      </div>

      <div className="h-20 bg-white rounded-lg border border-slate-200 flex items-center justify-center px-4 relative overflow-hidden shadow-inner">
        {/* Preview Polygon */}
        {isPolygon && (
          <div className="flex items-center gap-4 py-1">
            <svg width="52" height="52" className="drop-shadow-xs shrink-0">
              <polygon
                points="26,4 48,18 40,48 12,48 4,18"
                fill={fillColor}
                fillOpacity={fillOpacity}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                strokeOpacity={strokeOpacity}
                strokeDasharray={svgDashArray}
              />
            </svg>
            <div className="text-left">
              <span className="text-xs font-bold text-teal-800 block">
                {t('previewPolygonArea', 'Pratinjau Area Poligon')}
              </span>
              <span className="text-[10px] text-slate-500 font-mono block">
                Fill: {fillColor} ({Math.round(fillOpacity * 100)}%) • Stroke: {strokeColor} ({strokeWidth}px)
              </span>
              {strokeDash !== 'solid' && (
                <span className="text-[10px] text-teal-600 font-medium">
                  {t('strokePattern', 'Pola Garis')}: {strokeDash === 'dashed' ? t('dashedLine', 'Putus-putus') : t('dottedLine', 'Titik-titik')}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Preview Line */}
        {isLine && (
          <div className="flex items-center gap-4 py-1">
            <svg width="64" height="44" className="shrink-0">
              <path
                d="M 4,36 Q 32,4 60,36"
                fill="none"
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                strokeOpacity={strokeOpacity}
                strokeLinecap="round"
                strokeDasharray={svgDashArray}
              />
            </svg>
            <div className="text-left">
              <span className="text-xs font-bold text-teal-800 block">
                {t('previewLineString', 'Pratinjau Garis Vektor')}
              </span>
              <span className="text-[10px] text-slate-500 font-mono block">
                Warna: {strokeColor} • Tebal: {strokeWidth}px • Opacity: {Math.round(strokeOpacity * 100)}%
              </span>
              {strokeDash !== 'solid' && (
                <span className="text-[10px] text-teal-600 font-medium">
                  {t('strokePattern', 'Pola Garis')}: {strokeDash === 'dashed' ? t('dashedLine', 'Putus-putus') : t('dottedLine', 'Titik-titik')}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Preview Point */}
        {isPoint && (
          <div className="flex items-center gap-4 py-1">
            <svg width="44" height="44" className="shrink-0">
              {renderPointPreview()}
            </svg>
            <div className="text-left">
              <span className="text-xs font-bold text-teal-800 block capitalize">
                {t('previewPointMarker', 'Pratinjau Marker Titik')} ({mark})
              </span>
              <span className="text-[10px] text-slate-500 font-mono block">
                Ukuran: {pointSize}px • Fill: {fillColor} • Border: {strokeColor} ({strokeWidth}px)
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default VectorLivePreviewCard
