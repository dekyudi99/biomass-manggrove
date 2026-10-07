import L from 'leaflet'
import { Marker, Popup, Tooltip } from 'react-leaflet'

const MAX_DRAGGABLE_VERTICES = 150
const MAX_INSERTABLE_VERTICES = 60

const createVertexIcon = (index) => L.divIcon({
  className: 'custom-edit-vertex-icon',
  html: `
    <div style="
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background-color: #f59e0b;
      border: 2px solid #ffffff;
      box-shadow: 0 2px 6px rgba(0,0,0,0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      font-weight: bold;
      font-size: 10px;
      cursor: grab;
    ">
      ${index + 1}
    </div>
  `,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
})

const createMidpointIcon = () => L.divIcon({
  className: 'custom-mid-vertex-icon',
  html: `
    <div style="
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background-color: #3b82f6;
      border: 2px solid #ffffff;
      box-shadow: 0 1px 4px rgba(0,0,0,0.3);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      font-size: 11px;
      font-weight: bold;
      line-height: 1;
    ">+</div>
  `,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
})

const AoiEditorLayer = ({ areaPoints, isEditingRoi, isAreaClosed, setAreaPoints, t }) => {
  if (!isEditingRoi || !isAreaClosed) return null

  return (
    <>
      {areaPoints.length <= MAX_DRAGGABLE_VERTICES && areaPoints.map((point, index) => (
        <Marker
          key={`edit-vertex-${index}`}
          position={point}
          draggable
          icon={createVertexIcon(index)}
          eventHandlers={{
            dragend: (event) => {
              const { lat, lng } = event.target.getLatLng()
              setAreaPoints((previousPoints) => {
                const updatedPoints = [...previousPoints]
                updatedPoints[index] = [lat, lng]
                return updatedPoints
              })
            },
          }}
        >
          <Popup>
            <div className="text-xs p-1">
              <p className="font-bold text-amber-800 text-sm mb-1">Titik Sudut #{index + 1}</p>
              <p className="font-mono text-[10px] text-gray-600 mb-1">
                Lat: {point[0].toFixed(6)}, Lng: {point[1].toFixed(6)}
              </p>
              <p className="text-[10px] text-gray-500 mb-2">
                💡 Geser marker ini di peta untuk mengubah bentuk area.
              </p>
              {areaPoints.length > 3 && (
                <button
                  type="button"
                  onClick={() => {
                    setAreaPoints((previousPoints) =>
                      previousPoints.filter((_, pointIndex) => pointIndex !== index),
                    )
                  }}
                  className="w-full py-1 px-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 text-[11px] font-bold border border-red-200 cursor-pointer transition"
                >
                  🗑️ Hapus Titik Ini
                </button>
              )}
            </div>
          </Popup>
        </Marker>
      ))}

      {areaPoints.length >= 3 && areaPoints.length <= MAX_INSERTABLE_VERTICES &&
        areaPoints.map((point, index) => {
          const nextPoint = areaPoints[(index + 1) % areaPoints.length]
          const midpoint = [
            (point[0] + nextPoint[0]) / 2,
            (point[1] + nextPoint[1]) / 2,
          ]

          return (
            <Marker
              key={`mid-vertex-${index}`}
              position={midpoint}
              icon={createMidpointIcon()}
              eventHandlers={{
                click: () => {
                  setAreaPoints((previousPoints) => {
                    const updatedPoints = [...previousPoints]
                    updatedPoints.splice(index + 1, 0, midpoint)
                    return updatedPoints
                  })
                },
              }}
            >
              <Tooltip direction="top" offset={[0, -8]}>
                <span className="text-[10px] font-semibold">{t('insertVertexTip')}</span>
              </Tooltip>
            </Marker>
          )
        })}
    </>
  )
}

export default AoiEditorLayer