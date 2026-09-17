import React, { useState } from 'react'
import { Modal, Radio, Select, Button, message, Tag } from 'antd'
import {
  DownloadOutlined,
  FileImageOutlined,
  GlobalOutlined,
  CheckCircleOutlined,
  FormatPainterOutlined,
} from '@ant-design/icons'
import layerApi from '../../../api/LayerApi'
import { useLanguage } from '../../../context/LanguageContext'

const DownloadLayerModal = ({ open, layer, onClose }) => {
  const { t } = useLanguage()

  const [format, setFormat] = useState('tiff')
  const [styled, setStyled] = useState(true)
  const [resolution, setResolution] = useState('original')
  const [isDownloading, setIsDownloading] = useState(false)

  if (!layer) return null

  const handleDownload = async () => {
    setIsDownloading(true)
    const hideMsg = message.loading(t('downloading'), 0)

    try {
      const params = {
        format,
        styled,
      }

      if (resolution === '1024') {
        params.width = 1024
        params.height = 1024
      } else if (resolution === '2048') {
        params.width = 2048
        params.height = 2048
      } else if (resolution === '4096') {
        params.width = 4096
        params.height = 4096
      }

      const response = await layerApi.download(layer.id, params)

      // Ambil nama file dari header Content-Disposition jika ada
      let filename = `${(layer.layer_name || 'layer').replace(/[^a-zA-Z0-9_-]/g, '_')}_${
        styled ? 'styled' : 'raw'
      }.${format === 'png' ? 'png' : 'tif'}`

      const disposition = response.headers?.['content-disposition']
      if (disposition && disposition.includes('filename=')) {
        const matches = disposition.match(/filename="?([^"]+)"?/)
        if (matches && matches[1]) {
          filename = matches[1]
        }
      }

      // Buat blob URL dan download otomatis
      const blob = new Blob([response.data], {
        type: response.headers?.['content-type'] || 'application/octet-stream',
      })
      const downloadUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.setAttribute('download', filename)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(downloadUrl)

      hideMsg()
      message.success(t('downloadSuccess'))
      onClose()
    } catch (err) {
      hideMsg()
      console.error('Download error:', err)
      const errDetail =
        err.response?.data?.detail || err.message || t('downloadFailed')
      message.error(`${t('downloadFailed')}: ${errDetail}`)
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <Modal
      open={open}
      title={
        <div className="flex items-center gap-2 text-emerald-800 font-semibold">
          <DownloadOutlined className="text-emerald-600 text-lg" />
          <span>{t('downloadLayer')}</span>
        </div>
      }
      onCancel={onClose}
      footer={null}
      destroyOnClose
      width={480}
    >
      <div className="space-y-4 py-2">
        {/* Layer Info Header */}
        <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl">
          <p className="text-xs font-semibold text-gray-800 truncate">
            {layer.layer_name}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <Tag color="emerald" className="text-[10px]">
              {layer.workspace_display_name || layer.workspace_name}
            </Tag>
            {layer.epsg && (
              <Tag color="blue" className="text-[10px]">
                EPSG:{layer.epsg}
              </Tag>
            )}
            <span className="text-[11px] text-gray-500">
              {layer.data_type || 'GeoTIFF'}
            </span>
          </div>
        </div>

        {/* 1. Format Berkas */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-2">
            {t('downloadFormat')}
          </label>
          <div className="grid grid-cols-2 gap-3">
            {/* GeoTIFF Option */}
            <div
              onClick={() => setFormat('tiff')}
              className={`p-3 rounded-xl border-2 cursor-pointer transition flex flex-col justify-between ${
                format === 'tiff'
                  ? 'border-emerald-600 bg-emerald-50/40 text-emerald-900 shadow-xs'
                  : 'border-gray-200 hover:border-gray-300 bg-white text-gray-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-bold text-sm flex items-center gap-1.5">
                  <GlobalOutlined className="text-emerald-600" />
                  GeoTIFF (.tif)
                </span>
                {format === 'tiff' && (
                  <CheckCircleOutlined className="text-emerald-600" />
                )}
              </div>
              <p className="text-[11px] text-gray-500 leading-tight">
                Raster georeferensi standar untuk SIG (QGIS, ArcGIS).
              </p>
            </div>

            {/* PNG Option */}
            <div
              onClick={() => setFormat('png')}
              className={`p-3 rounded-xl border-2 cursor-pointer transition flex flex-col justify-between ${
                format === 'png'
                  ? 'border-emerald-600 bg-emerald-50/40 text-emerald-900 shadow-xs'
                  : 'border-gray-200 hover:border-gray-300 bg-white text-gray-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-bold text-sm flex items-center gap-1.5">
                  <FileImageOutlined className="text-emerald-600" />
                  PNG (.png)
                </span>
                {format === 'png' && (
                  <CheckCircleOutlined className="text-emerald-600" />
                )}
              </div>
              <p className="text-[11px] text-gray-500 leading-tight">
                Citra visual transparan untuk laporan dan web.
              </p>
            </div>
          </div>
        </div>

        {/* 2. Pilihan Style */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-2">
            {t('downloadStyleOption')}
          </label>
          <div className="space-y-2">
            <div
              onClick={() => setStyled(true)}
              className={`p-2.5 rounded-lg border cursor-pointer transition flex items-start gap-2.5 ${
                styled
                  ? 'border-emerald-500 bg-emerald-50/50 text-emerald-900'
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}
            >
              <Radio checked={styled} className="mt-0.5" />
              <div className="text-xs">
                <div className="font-semibold text-gray-800 flex items-center gap-1.5">
                  <FormatPainterOutlined className="text-emerald-600" />
                  {t('styleOptionStyled')}
                </div>
                <p className="text-gray-500 text-[11px] mt-0.5">
                  {t('styleOptionStyledDesc')}
                </p>
              </div>
            </div>

            <div
              onClick={() => setStyled(false)}
              className={`p-2.5 rounded-lg border cursor-pointer transition flex items-start gap-2.5 ${
                !styled
                  ? 'border-emerald-500 bg-emerald-50/50 text-emerald-900'
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}
            >
              <Radio checked={!styled} className="mt-0.5" />
              <div className="text-xs">
                <div className="font-semibold text-gray-800 flex items-center gap-1.5">
                  <GlobalOutlined className="text-emerald-600" />
                  {t('styleOptionRaw')}
                </div>
                <p className="text-gray-500 text-[11px] mt-0.5">
                  {t('styleOptionRawDesc')}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Resolusi Gambar */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">
            {t('resolutionQuality')}
          </label>
          <Select
            value={resolution}
            onChange={setResolution}
            className="w-full"
            options={[
              {
                value: 'original',
                label: `${t('resOriginal')} (${layer.width || 1024} × ${
                  layer.height || 1024
                } px)`,
              },
              {
                value: '1024',
                label: t('resStandard'),
              },
              {
                value: '2048',
                label: t('resHigh'),
              },
              {
                value: '4096',
                label: t('resUltra'),
              },
            ]}
          />
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
          <Button onClick={onClose} disabled={isDownloading}>
            {t('cancel')}
          </Button>
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            loading={isDownloading}
            onClick={handleDownload}
            className="bg-emerald-600 hover:bg-emerald-700 border-none shadow-xs"
          >
            {t('btnDownload')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default DownloadLayerModal
