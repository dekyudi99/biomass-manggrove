import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import { bboxToWGS84 } from '../utils/geoUtils'

/**
 * Controller di dalam MapContainer untuk melakukan fly-to secara halus
 * ke lokasi layer atau layer group berdasarkan bbox dan EPSG.
 * Mendukung konversi dinamis berbagai proyeksi (EPSG:32647, EPSG:3857, dll) ke WGS84.
 */
const MapFlyController = ({ flyTarget }) => {
  const map = useMap()
  const lastTargetRef = useRef(null)

  useEffect(() => {
    if (!flyTarget?.bbox) return

    const { bbox, epsg, timestamp } = flyTarget
    // Hindari pemanggilan ganda jika target sama persis dan timestamp tidak berubah
    if (
      lastTargetRef.current &&
      lastTargetRef.current.timestamp === timestamp &&
      lastTargetRef.current.bbox === bbox
    ) {
      return
    }
    lastTargetRef.current = flyTarget

    const safeEpsg = epsg ?? 4326

    bboxToWGS84(bbox, safeEpsg).then((coords) => {
      if (!coords) return

      const { minLng, minLat, maxLng, maxLat } = coords

      if ([minLng, minLat, maxLng, maxLat].some((v) => v == null || isNaN(v))) {
        return
      }

      // Jika titik tunggal (min == max)
      if (Math.abs(minLng - maxLng) < 1e-6 && Math.abs(minLat - maxLat) < 1e-6) {
        map.flyTo([minLat, minLng], 14, { duration: 1.2 })
      } else {
        map.flyToBounds(
          [
            [minLat, minLng],
            [maxLat, maxLng],
          ],
          {
            duration: 1.2,
            padding: [50, 50],
            maxZoom: 16,
          }
        )
      }
    })
  }, [flyTarget, map])

  return null
}

export default MapFlyController
