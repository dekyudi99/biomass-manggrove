import L from 'leaflet'
import { Circle, Marker, Popup } from 'react-leaflet'

const USER_LOCATION_ICON = L.divIcon({
  className: 'custom-user-location-marker',
  html: `
    <div style="position: relative; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;">
      <div style="position: absolute; width: 30px; height: 30px; border-radius: 50%; background-color: rgba(59, 130, 246, 0.35); animation: user-loc-ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
      <div style="position: absolute; width: 22px; height: 22px; border-radius: 50%; background-color: rgba(59, 130, 246, 0.3);"></div>
      <div style="width: 14px; height: 14px; border-radius: 50%; background-color: #2563eb; border: 2.5px solid #ffffff; box-shadow: 0 0 10px rgba(37, 99, 235, 0.8); position: relative; z-index: 10;"></div>
    </div>
  `,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
})

const MapLocationLayers = ({ selectedPoint, userLocation, isAddressLoading, pointAddress, t }) => (
  <>
    {selectedPoint && (
      <Marker position={[selectedPoint.lat, selectedPoint.lng]}>
        <Popup>
          <div className="text-xs text-gray-800 max-w-xs">
            <p className="font-bold text-emerald-800 text-sm mb-1">{t('selectedPointMarker')}</p>
            <p className="font-mono text-[11px] text-gray-500 mb-1">
              Lat: {selectedPoint.lat.toFixed(5)}, Lng: {selectedPoint.lng.toFixed(5)}
            </p>
            <p className="text-gray-700 leading-snug">
              {isAddressLoading ? t('fetchingAddress') : pointAddress}
            </p>
          </div>
        </Popup>
      </Marker>
    )}

    {userLocation && (
      <>
        {userLocation.accuracy && (
          <Circle
            center={[userLocation.lat, userLocation.lng]}
            radius={userLocation.accuracy}
            pathOptions={{
              color: '#3b82f6',
              fillColor: '#60a5fa',
              fillOpacity: 0.15,
              weight: 1.5,
            }}
          />
        )}
        <Marker position={[userLocation.lat, userLocation.lng]} icon={USER_LOCATION_ICON}>
          <Popup>
            <div className="text-xs text-gray-800 p-0.5">
              <p className="font-bold text-blue-700 text-sm mb-1 flex items-center gap-1.5">
                <span>📍</span> {t('yourCurrentLocation')}
              </p>
              <p className="font-mono text-[11px] text-gray-600 mb-1">
                Lat: {userLocation.lat.toFixed(6)}, Lng: {userLocation.lng.toFixed(6)}
              </p>
              {userLocation.accuracy && (
                <p className="text-[10px] text-gray-500 bg-blue-50 px-2 py-0.5 rounded-full inline-block border border-blue-200">
                  {t('accuracy')}: ±{Math.round(userLocation.accuracy)} m
                </p>
              )}
            </div>
          </Popup>
        </Marker>
      </>
    )}
  </>
)

export default MapLocationLayers