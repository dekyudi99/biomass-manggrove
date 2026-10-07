import L from 'leaflet'
import { Fragment } from 'react'
import { CircleMarker, Polygon, Polyline, Popup, Tooltip } from 'react-leaflet'

const CLOSE_AREA_HIT_RADIUS = 28
const FIRST_VERTEX_RADIUS = 9
const OTHER_VERTEX_RADIUS = 5

const AREA_COLORS = {
  outline: '#059669',
  fill: '#10b981',
  vertex: '#047857',
  firstVertex: '#d97706',
  firstVertexFill: '#fbbf24',
}

const AoiDrawingLayer = ({
  areaPoints,
  isAreaClosed,
  isAoiVisible,
  isAoiFillVisible,
  geePreviewLayer,
  areaHectares,
  onCloseArea,
  t,
}) => (
  <>
    {isAreaClosed && areaPoints.length >= 3 && isAoiVisible && (
      <Polygon
        positions={areaPoints}
        pathOptions={{
          color: AREA_COLORS.outline,
          fillColor: AREA_COLORS.fill,
          fillOpacity: isAoiFillVisible ? (geePreviewLayer ? 0.12 : 0.35) : 0,
          weight: 2.5,
          smoothFactor: 1.5,
          dashArray: !isAoiFillVisible ? '6, 6' : undefined,
        }}
      >
        <Popup>
          <div className="text-xs text-gray-800">
            <p className="font-bold text-emerald-800">{t('mangroveAreaDone')}</p>
            <p className="mt-1">
              {t('areaSize')} <strong>{areaHectares.toFixed(2)} Ha</strong>
            </p>
            <p className="text-gray-500 text-[10px]">
              ≈ {(areaHectares * 10000).toLocaleString('id-ID')} m²
            </p>
          </div>
        </Popup>
      </Polygon>
    )}

    {!isAreaClosed && areaPoints.length >= 2 && (
      <Polyline
        positions={areaPoints}
        pathOptions={{ color: AREA_COLORS.outline, weight: 3, dashArray: '5, 5' }}
      />
    )}

    {!isAreaClosed && areaPoints.map((point, index) => {
      const canCloseArea = index === 0 && areaPoints.length >= 3

      return (
        <Fragment key={index}>
          {canCloseArea && (
            <CircleMarker
              center={point}
              radius={CLOSE_AREA_HIT_RADIUS}
              eventHandlers={{
                click: (event) => {
                  L.DomEvent.stopPropagation(event)
                  onCloseArea()
                },
              }}
              pathOptions={{
                stroke: false,
                fillColor: '#000000',
                fillOpacity: 0.01,
              }}
            />
          )}
          <CircleMarker
            center={point}
            radius={canCloseArea ? FIRST_VERTEX_RADIUS : OTHER_VERTEX_RADIUS}
            eventHandlers={canCloseArea ? {
              click: (event) => {
                L.DomEvent.stopPropagation(event)
                onCloseArea()
              },
            } : undefined}
            pathOptions={{
              color: canCloseArea ? AREA_COLORS.firstVertex : AREA_COLORS.vertex,
              fillColor: canCloseArea ? AREA_COLORS.firstVertexFill : '#34d399',
              fillOpacity: 1,
              weight: canCloseArea ? 3 : 2,
            }}
          >
            {canCloseArea && (
              <Tooltip direction="top" offset={[0, -10]} opacity={1} permanent>
                <span className="text-[11px] font-bold text-amber-900">
                  {t('clickHereToCloseArea')}
                </span>
              </Tooltip>
            )}
          </CircleMarker>
        </Fragment>
      )
    })}
  </>
)

export default AoiDrawingLayer