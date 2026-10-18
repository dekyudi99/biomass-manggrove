import { useEffect, useState } from 'react'
import { GeoJSON } from 'react-leaflet'

const ModelCoverageLayer = ({ isVisible = true }) => {
  const [geoData, setGeoData] = useState(null)

  useEffect(() => {
    let isMounted = true
    fetch('/mangrove_zones.geojson')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch mangrove zones')
        return res.json()
      })
      .then((data) => {
        if (isMounted) setGeoData(data)
      })
      .catch((err) => {
        console.error('Error loading mangrove zones GeoJSON:', err)
      })

    return () => {
      isMounted = false
    }
  }, [])

  if (!isVisible || !geoData) return null

  return (
    /* Render sebaran aktual poligon hutan mangrove (non-interaktif agar klik draw AOI lolos ke peta) */
    <GeoJSON
      key="mangrove-zones-layer"
      data={geoData}
      interactive={false}
      pathOptions={{
        color: '#10b981', // emerald-500 terang agar kontras terlihat jelas di atas basemap satelit maupun jalan
        weight: 2,
        dashArray: '6, 6', // garis putus-putus
        fill: false,
        fillOpacity: 0,
        interactive: false,
      }}
    />
  )
}

export default ModelCoverageLayer
