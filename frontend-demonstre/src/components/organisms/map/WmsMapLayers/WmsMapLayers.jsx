import { WMSTileLayer } from 'react-leaflet'
import { getWmsLayersParam, resolveWmsUrl } from '../../../../utils/wmsUtils'

const DEFAULT_LAYER_OPACITY = 0.85
const WMS_VERSION = '1.1.1'

const WmsMapLayers = ({ visibleLayers, visibleGroups }) => (
  <>
    {visibleLayers.map((layer) => {
      const layersParam = getWmsLayersParam(layer)
      const targetWmsUrl = resolveWmsUrl(layer.wms_url, layer.workspace_name)
      if (!layersParam) return null

      return (
        <WMSTileLayer
          key={`wms-layer-${layer.id}-${layersParam}-${layer.styleVersion || 1}`}
          url={targetWmsUrl}
          params={{
            layers: layersParam,
            format: 'image/png',
            transparent: true,
            version: WMS_VERSION,
            _t: layer.styleVersion || 1,
            styles: layer.style_name || layer.styles || '',
          }}
          opacity={layer.opacity ?? DEFAULT_LAYER_OPACITY}
          zIndex={100}
        />
      )
    })}

    {visibleGroups.map((group) => {
      const groupParam = group.wms_layers_param || group.group_name || group.name || ''
      const targetWmsUrl = resolveWmsUrl(group.wms_url, group.workspace_name)
      if (!groupParam) return null

      return (
        <WMSTileLayer
          key={`wms-grp-${group.id}-${groupParam}-${group.styleVersion || 1}`}
          url={targetWmsUrl}
          params={{
            layers: groupParam,
            format: 'image/png',
            transparent: true,
            version: WMS_VERSION,
            _t: group.styleVersion || 1,
          }}
          opacity={group.opacity ?? DEFAULT_LAYER_OPACITY}
          zIndex={100}
        />
      )
    })}
  </>
)

export default WmsMapLayers