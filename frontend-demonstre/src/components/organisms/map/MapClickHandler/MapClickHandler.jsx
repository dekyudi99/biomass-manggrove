import { useMapEvents } from 'react-leaflet'

const MapClickHandler = ({ mode, isAreaClosed, onMapClick }) => {
  useMapEvents({
    click(event) {
      if (mode === 'area' && isAreaClosed) return
      onMapClick(event.latlng)
    },
  })

  return null
}

export default MapClickHandler