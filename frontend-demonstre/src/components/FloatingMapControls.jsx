import React, { useState, useRef, useEffect } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import {
  PlusOutlined,
  MinusOutlined,
  AimOutlined,
  LoadingOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
} from '@ant-design/icons'
import { Tooltip, message } from 'antd'
import { useLanguage } from '../context/LanguageContext'

const FloatingMapControls = ({
  defaultCenter = [13.652913414797453, 100.49455240687257],
  userLocation,
  onToggleUserLocation,
  hasAoi = false,
  isAoiVisible = true,
  onToggleAoi,
}) => {
  const map = useMap()
  const { t } = useLanguage()
  const containerRef = useRef(null)
  const [isLocating, setIsLocating] = useState(false)

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

  const [compassRotation, setCompassRotation] = useState(0)
  const [isSpinning, setIsSpinning] = useState(false)

  const handleCompassClick = (e) => {
    e.stopPropagation()
    // Animasi putar jarum kompas dan pastikan orientasi Utara (North 0 deg)
    setIsSpinning(true)
    setCompassRotation((prev) => prev + 360)

    if (map.setBearing) {
      map.setBearing(0)
    } else {
      map.panBy([0, 0], { animate: true })
    }

    message.success({
      content: t('compassNorthAligned'),
      key: 'compass_north',
      duration: 2,
    })

    setTimeout(() => {
      setIsSpinning(false)
    }, 600)
  }

  const handleToggleLocation = (e) => {
    e.stopPropagation()

    // Jika lokasi saat ini sudah aktif di peta, klik lagi untuk menghilangkannya (Google Maps style)
    if (userLocation) {
      if (onToggleUserLocation) {
        onToggleUserLocation(null)
      }
      return
    }

    // Jika belum ada, minta koordinat GPS via navigator.geolocation
    if (!navigator.geolocation) {
      message.error(t('locationError'))
      return
    }

    setIsLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false)
        const coords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }
        if (onToggleUserLocation) {
          onToggleUserLocation(coords)
        }
        map.flyTo([coords.lat, coords.lng], Math.max(map.getZoom(), 16), {
          duration: 1.5,
        })
      },
      (err) => {
        setIsLocating(false)
        console.warn('Geolocation error:', err)
        if (err.code === 1) {
          message.warning(t('locationPermissionDenied'))
        } else {
          message.error(t('locationError'))
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    )
  }

  return (
    <div
      ref={containerRef}
      className="absolute bottom-8 right-3 sm:bottom-6 sm:right-6 z-[950] flex flex-col gap-1.5 sm:gap-2"
    >
      {/* Zoom In & Zoom Out */}
      <div className="flex flex-col rounded-2xl bg-white/95 backdrop-blur-md shadow-xl border border-gray-200/80 overflow-hidden">
        <Tooltip title={t('zoomIn') || 'Perbesar'} placement="left">
          <button
            onClick={handleZoomIn}
            className="w-9 h-9 sm:w-11 sm:h-11 flex items-center justify-center text-gray-700 hover:text-emerald-700 hover:bg-emerald-50 active:bg-emerald-100 transition cursor-pointer border-b border-gray-100"
            aria-label="Zoom In"
          >
            <PlusOutlined className="text-xs sm:text-sm font-bold" />
          </button>
        </Tooltip>

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

      {/* Tombol Lokasi Saya (Google Maps Style Toggle) */}
      <Tooltip
        title={userLocation ? t('hideMyLocation') : t('showMyLocation')}
        placement="left"
      >
        <button
          onClick={handleToggleLocation}
          className={`w-9 h-9 sm:w-11 sm:h-11 rounded-2xl backdrop-blur-md shadow-xl border flex items-center justify-center transition-all cursor-pointer ${
            userLocation
              ? 'bg-blue-50/95 text-blue-600 border-blue-400 ring-2 ring-blue-400/40 shadow-blue-500/20 active:bg-blue-100'
              : 'bg-white/95 text-gray-700 border-gray-200/80 hover:text-blue-600 hover:bg-blue-50 active:bg-blue-100'
          }`}
          aria-label={userLocation ? t('hideMyLocation') : t('showMyLocation')}
        >
          {isLocating ? (
            <LoadingOutlined className="text-sm sm:text-base font-bold text-blue-600" spin />
          ) : (
            <AimOutlined
              className={`text-sm sm:text-base font-bold transition-transform ${
                userLocation ? 'text-blue-600 scale-110' : 'text-gray-700'
              }`}
            />
          )}
        </button>
      </Tooltip>

      {/* Tombol Toggle Visibilitas AOI (Hide / Show AOI) */}
      {hasAoi && (
        <Tooltip title={isAoiVisible ? t('hideAoi') : t('showAoi')} placement="left">
          <button
            onClick={(e) => {
              e.stopPropagation()
              if (onToggleAoi) onToggleAoi()
            }}
            className={`w-9 h-9 sm:w-11 sm:h-11 rounded-2xl backdrop-blur-md shadow-xl border flex items-center justify-center transition-all cursor-pointer ${
              !isAoiVisible
                ? 'bg-amber-500/90 text-white border-amber-600 ring-2 ring-amber-400/40 shadow-amber-500/20 active:bg-amber-600'
                : 'bg-white/95 text-emerald-700 border-gray-200/80 hover:bg-emerald-50 active:bg-emerald-100'
            }`}
            aria-label={isAoiVisible ? t('hideAoi') : t('showAoi')}
          >
            {isAoiVisible ? (
              <EyeOutlined className="text-sm sm:text-base font-bold" />
            ) : (
              <EyeInvisibleOutlined className="text-sm sm:text-base font-bold text-white" />
            )}
          </button>
        </Tooltip>
      )}

      {/* Tombol Kompas Arah Utara (Google Maps / GIS Style) */}
      <Tooltip title={t('compassNorth')} placement="left">
        <button
          onClick={handleCompassClick}
          className="w-9 h-9 sm:w-11 sm:h-11 rounded-2xl bg-white/95 backdrop-blur-md shadow-xl border border-gray-200/80 flex items-center justify-center text-gray-700 hover:bg-slate-50 active:bg-slate-100 transition-all cursor-pointer group"
          aria-label={t('compassNorth')}
        >
          <div
            className="w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center transition-transform duration-500 ease-out"
            style={{ transform: `rotate(${compassRotation}deg)` }}
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5 sm:w-6 sm:h-6 drop-shadow-sm" fill="none">
              {/* Jarum Merah (Utara / North) */}
              <polygon points="12,2 15.5,12 12,9.5 8.5,12" fill="#ef4444" />
              {/* Jarum Abu-abu (Selatan / South) */}
              <polygon points="12,22 15.5,12 12,9.5 8.5,12" fill="#94a3b8" />
              {/* Titik Poros Kompas */}
              <circle cx="12" cy="12" r="1.5" fill="#1e293b" />
              {/* Huruf N kecil di puncak Utara */}
              <text x="12" y="1.2" textAnchor="middle" fontSize="4" fontWeight="bold" fill="#b91c1c" fontFamily="sans-serif">N</text>
            </svg>
          </div>
        </button>
      </Tooltip>
    </div>
  )
}

export default FloatingMapControls
