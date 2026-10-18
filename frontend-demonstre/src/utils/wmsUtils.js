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

export const getLayerDisplayName = (layer, t = (k) => k) => {
  if (!layer) return ''

  const rawName =
    layer.layer_name ||
    layer.name ||
    layer.geoserver_name ||
    layer.table_name ||
    layer.store_name ||
    ''

  const isAgbJob =
    rawName.startsWith('agb_') ||
    String(layer.id || '').startsWith('agb_') ||
    String(layer.title || '').includes('Estimasi AGB') ||
    String(layer.title || '').includes('AGB')

  if (isAgbJob) {
    const cleanId = rawName.replace(/^agb_/, '').replace(/[^a-zA-Z0-9-]/g, '')
    const shortId = cleanId ? cleanId.slice(0, 8) : ''
    const baseTitle = typeof t === 'function' ? t('agbEstimationLayer') : 'Estimasi Biomassa AGB Mangrove'
    return shortId ? `${baseTitle} (${shortId})` : baseTitle
  }

  if (layer.display_name && !layer.display_name.startsWith('agb_')) {
    return layer.display_name
  }
  if (layer.title && !layer.title.startsWith('agb_')) {
    return layer.title
  }

  return layer.display_name || layer.title || rawName || layer.id || 'Layer'
}