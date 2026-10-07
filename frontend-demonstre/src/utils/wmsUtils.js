const DEFAULT_GEOSERVER_WMS_URL = 'http://localhost:8080/geoserver'
const GEOSERVER_PATH_SEGMENT = '/geoserver'

export const getWmsLayersParam = (layer) => {
  if (!layer) return ''
  if (layer.wms_layers_param) return layer.wms_layers_param

  const layerName =
    layer.geoserver_name || layer.table_name || layer.store_name || layer.layer_name
  if (layer.workspace_name && layerName) {
    return `${layer.workspace_name}:${layerName}`
  }

  return layerName || ''
}

export const resolveWmsUrl = (wmsUrl, workspaceName) => {
  const configuredWmsUrl = import.meta.env.VITE_GEOSERVER_WMS_URL || DEFAULT_GEOSERVER_WMS_URL
  const baseWmsUrl = configuredWmsUrl.trim().replace(/\/+$/, '')

  if (!wmsUrl) {
    return workspaceName
      ? `${baseWmsUrl}/${workspaceName}/wms`
      : `${baseWmsUrl}/wms`
  }

  try {
    const parsedUrl = new URL(wmsUrl, window.location.origin)
    const geoserverPathIndex = parsedUrl.pathname.indexOf(GEOSERVER_PATH_SEGMENT)

    if (geoserverPathIndex !== -1) {
      const pathAfterGeoserver = parsedUrl.pathname.substring(
        geoserverPathIndex + GEOSERVER_PATH_SEGMENT.length,
      )
      return `${baseWmsUrl}${pathAfterGeoserver}${parsedUrl.search}`
    }

    return `${baseWmsUrl}${parsedUrl.pathname}${parsedUrl.search}`
  } catch {
    return wmsUrl || `${baseWmsUrl}/wms`
  }
}