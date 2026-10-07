import { useState } from 'react'
import { getWmsLayersParam } from '../utils/wmsUtils'

const DEFAULT_LAYER_OPACITY = 0.85

const createFlyTarget = (target) => {
  if (target?.bbox) {
    return { bbox: target.bbox, epsg: target.epsg, timestamp: Date.now() }
  }
  if (Array.isArray(target) && target.length === 4) {
    return { bbox: target, epsg: 4326, timestamp: Date.now() }
  }
  return null
}

const useMapLayers = (setFlyTarget) => {
  const [visibleLayers, setVisibleLayers] = useState([])
  const [visibleGroups, setVisibleGroups] = useState([])

  const handleZoomToLayer = (target) => {
    const flyTarget = createFlyTarget(target)
    if (flyTarget) setFlyTarget(flyTarget)
  }

  const handleZoomToGroup = (target) => {
    const flyTarget = createFlyTarget(target)
    if (flyTarget) setFlyTarget(flyTarget)
  }

  const handleToggleLayer = (layer, isVisible) => {
    if (!isVisible) {
      setVisibleLayers((previousLayers) => previousLayers.filter(({ id }) => id !== layer.id))
      return
    }

    const enrichedLayer = {
      ...layer,
      wms_layers_param: getWmsLayersParam(layer),
      opacity: layer.opacity ?? DEFAULT_LAYER_OPACITY,
      styleVersion: layer.styleVersion || Date.now(),
    }

    setVisibleLayers((previousLayers) => [
      ...previousLayers.filter(({ id }) => id !== layer.id),
      enrichedLayer,
    ])
    if (layer.bbox) handleZoomToLayer(layer)
  }

  const handleChangeLayerOpacity = (layerId, opacity) => {
    setVisibleLayers((previousLayers) =>
      previousLayers.map((layer) => (layer.id === layerId ? { ...layer, opacity } : layer)),
    )
  }

  const handleToggleGroup = (group, isVisible) => {
    if (!isVisible) {
      setVisibleGroups((previousGroups) => previousGroups.filter(({ id }) => id !== group.id))
      return
    }

    setVisibleGroups((previousGroups) => [
      ...previousGroups.filter(({ id }) => id !== group.id),
      { ...group, opacity: DEFAULT_LAYER_OPACITY },
    ])
    if (group.bbox) handleZoomToGroup(group)
  }

  const handleChangeGroupOpacity = (groupId, opacity) => {
    setVisibleGroups((previousGroups) =>
      previousGroups.map((group) => (group.id === groupId ? { ...group, opacity } : group)),
    )
  }

  const handleStyleApplied = (layerId, symbology) => {
    const timestamp = Date.now()
    setVisibleLayers((previousLayers) =>
      previousLayers.map((layer) =>
        layer.id === layerId
          ? {
              ...layer,
              ...(symbology
                ? { symbology, style_name: symbology.style_name || layer.style_name }
                : {}),
              styleVersion: timestamp,
            }
          : layer,
      ),
    )
  }

  return {
    visibleLayers,
    visibleGroups,
    handleZoomToLayer,
    handleZoomToGroup,
    handleToggleLayer,
    handleChangeLayerOpacity,
    handleToggleGroup,
    handleChangeGroupOpacity,
    handleStyleApplied,
  }
}

export default useMapLayers