import React, { useRef, useEffect } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import { PlusOutlined, MinusOutlined, AimOutlined } from '@ant-design/icons'
import { Tooltip } from 'antd'
import { useLanguage } from '../context/LanguageContext'

const FloatingMapControls = ({ defaultCenter = [13.652913414797453, 100.49455240687257] }) => {
  const map = useMap()
  const { t } = useLanguage()
  const containerRef = useRef(null)

  useEffect(() => {
    if (containerRef.current) {
      L.DomEvent.disableClickPropagation(containerRef.current)
      L.DomEvent.disableScrollPropagation(containerRef.current)
    }
  }, [])

  const handleZoomIn = (e) => {
    e.stopPropagation()
    map.zoomIn()
  }

  const handleZoomOut = (e) => {
    e.stopPropagation()
    map.zoomOut()
  }

  const handleRecenter = (e) => {
    e.stopPropagation()
    map.flyTo(defaultCenter, 10, { duration: 1.2 })
  }

  return (
    <div
      ref={containerRef}
      className="absolute bottom-3 right-3 sm:bottom-6 sm:right-6 z-[950] flex flex-col gap-1.5 sm:gap-2"
    >
      <div className="flex flex-col rounded-2xl bg-white/95 backdrop-blur-md shadow-xl border border-gray-200/80 overflow-hidden">
        {/* Zoom In */}
        <Tooltip title={t('zoomIn') || 'Perbesar'} placement="left">
          <button
            onClick={handleZoomIn}
            className="w-9 h-9 sm:w-11 sm:h-11 flex items-center justify-center text-gray-700 hover:text-emerald-700 hover:bg-emerald-50 active:bg-emerald-100 transition cursor-pointer border-b border-gray-100"
            aria-label="Zoom In"
          >
            <PlusOutlined className="text-xs sm:text-sm font-bold" />
          </button>
        </Tooltip>

        {/* Zoom Out */}
        <Tooltip title={t('zoomOut') || 'Perkecil'} placement="left">
          <button
            onClick={handleZoomOut}
            className="w-9 h-9 sm:w-11 sm:h-11 flex items-center justify-center text-gray-700 hover:text-emerald-700 hover:bg-emerald-50 active:bg-emerald-100 transition cursor-pointer"
            aria-label="Zoom Out"
          >
            <MinusOutlined className="text-xs sm:text-sm font-bold" />
          </button>
        </Tooltip>
      </div>

      {/* Recenter button */}
      <Tooltip title={t('recenterMap') || 'Pusatkan Peta'} placement="left">
        <button
          onClick={handleRecenter}
          className="w-9 h-9 sm:w-11 sm:h-11 rounded-2xl bg-white/95 backdrop-blur-md shadow-xl border border-gray-200/80 flex items-center justify-center text-gray-700 hover:text-emerald-700 hover:bg-emerald-50 active:bg-emerald-100 transition cursor-pointer"
          aria-label="Recenter Map"
        >
          <AimOutlined className="text-sm sm:text-base font-bold text-emerald-600" />
        </button>
      </Tooltip>
    </div>
  )
}

export default FloatingMapControls
