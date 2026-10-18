import { getLayerDisplayName } from '../../../../utils/wmsUtils'

const hasRenderableLegend = (layer) => {
  const classes = layer.symbology?.classes || layer.saved_symbology?.classes
  const isRaster = (layer.layer_type || layer.type) === 'raster'
  const symbology = layer.symbology || layer.saved_symbology
  const hasVectorSymbol = (layer.layer_type || layer.type) === 'vector' && symbology?.symbol

  return (isRaster && classes?.length) || hasVectorSymbol
}

const WmsLayerLegend = ({ visibleLayers, t }) => {
  if (!visibleLayers.some(hasRenderableLegend)) return null

  return (
    <section className="pointer-events-auto max-h-[40vh] w-[min(22rem,calc(100vw-6rem))] overflow-y-auto rounded-2xl border border-blue-200 bg-white/95 p-3 text-xs shadow-xl backdrop-blur-md">
      <h3 className="font-bold text-gray-800 mb-2 pb-1.5 border-b border-gray-100">
        {t('wmsLegendTitle') || 'Legenda Layer WMS'}
      </h3>
      <div className="space-y-3">
        {visibleLayers.map((layer) => {
          const classes = layer.symbology?.classes || layer.saved_symbology?.classes || []
          const layerType = layer.layer_type || layer.type
          const symbology = layer.symbology || layer.saved_symbology
          const symbol = symbology?.symbol
          if (layerType === 'raster' && classes.length === 0) return null
          if (layerType === 'vector' && !symbol) return null

          return (
            <section key={`legend-${layer.id}`}>
              <h4 className="font-semibold text-gray-700 truncate mb-1" title={getLayerDisplayName(layer, t)}>
                {getLayerDisplayName(layer, t)}
              </h4>
              {layerType === 'raster' ? (
                <div className="space-y-1">
                  {classes.map((item, index) => (
                    <div key={`${layer.id}-legend-${index}`} className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-3 h-3 rounded-sm shrink-0 border border-black/10"
                        style={{
                          backgroundColor: item.opacity === 0 ? 'transparent' : item.color || '#9ca3af',
                          opacity: Number(item.opacity ?? 1),
                        }}
                      />
                      <span className="text-gray-600 truncate">
                        {item.label || (item.min !== undefined && item.max !== undefined
                          ? `${item.min} – ${item.max}`
                          : `≤ ${item.quantity ?? item.max ?? ''}`)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-gray-600">
                  {(symbology?.geometry_type || layer.geometry_type || layer.geom_type || '').toLowerCase().includes('line') ? (
                    <span
                      className="h-0 w-6 border-t-2"
                      style={{
                        borderColor: symbol.stroke_color || '#0f766e',
                        borderStyle: symbol.stroke_dasharray ? 'dashed' : 'solid',
                        borderWidth: `${symbol.stroke_width || 1.5}px 0 0`,
                        opacity: symbol.stroke_opacity ?? 1,
                      }}
                    />
                  ) : (
                    <span
                      className="h-3 w-3 shrink-0 border"
                      style={{
                        borderRadius: (symbology?.geometry_type || layer.geometry_type || layer.geom_type || '').toLowerCase().includes('point')
                          ? symbol.mark === 'circle' ? '50%' : 2
                          : 2,
                        clipPath: symbol.mark === 'triangle'
                          ? 'polygon(50% 0%, 0% 100%, 100% 100%)'
                          : symbol.mark === 'star'
                            ? 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)'
                            : symbol.mark === 'cross'
                              ? 'polygon(35% 0%, 65% 0%, 65% 35%, 100% 35%, 100% 65%, 65% 65%, 65% 100%, 35% 100%, 35% 65%, 0% 65%, 0% 35%, 35% 35%)'
                              : undefined,
                        backgroundColor: symbol.fill_color || '#0d9488',
                        borderColor: symbol.stroke_color || '#0f766e',
                        borderWidth: `${Math.max(1, symbol.stroke_width || 1)}px`,
                        opacity: symbol.fill_opacity ?? 1,
                      }}
                    />
                  )}
                  <span className="truncate">
                    {symbology?.geometry_type || layer.geometry_type || layer.geom_type || 'Vector'} · {t('singleSymbolLegend')}
                  </span>
                </div>
              )}
            </section>
          )
        })}
      </div>
    </section>
  )
}

export default WmsLayerLegend