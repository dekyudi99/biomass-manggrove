import { useState, useEffect } from 'react'
import { Input, Select, Button, Progress, message } from 'antd'
import { UploadOutlined, InboxOutlined, CheckCircleOutlined, InfoCircleOutlined } from '@ant-design/icons'
import { useQueryClient } from '@tanstack/react-query'
import layerApi from '../../../api/LayerApi'
import { useLanguage } from '../../../context/LanguageContext'

const ACCEPTED_EXTENSIONS = ['.tif', '.tiff', '.geojson', '.json', '.zip', '.shp', '.gpkg', '.csv']

const getFormatInfo = (filename) => {
  if (!filename) return null
  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase()
  if (['.tif', '.tiff'].includes(ext)) {
    return { type: 'raster', label: 'GeoTIFF (Raster)', color: 'bg-blue-50 text-blue-700 border-blue-200' }
  }
  if (['.geojson', '.json'].includes(ext)) {
    return { type: 'vector', label: 'GeoJSON (Vector)', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
  }
  if (ext === '.zip') {
    return { type: 'vector', label: 'Shapefile ZIP (Vector)', color: 'bg-amber-50 text-amber-700 border-amber-200' }
  }
  if (ext === '.shp') {
    return { type: 'vector', label: 'Shapefile (Vector)', color: 'bg-amber-50 text-amber-700 border-amber-200' }
  }
  if (ext === '.gpkg') {
    return { type: 'vector', label: 'GeoPackage (Vector)', color: 'bg-purple-50 text-purple-700 border-purple-200' }
  }
  if (ext === '.csv') {
    return { type: 'vector', label: 'Delimited CSV (Vector)', color: 'bg-teal-50 text-teal-700 border-teal-200' }
  }
  return null
}

const UploadTab = ({ workspaces = [], onUploadSuccess }) => {
  const { t } = useLanguage()
  const queryClient = useQueryClient()

  const [file, setFile] = useState(null)
  const [layerName, setLayerName] = useState('')
  const [description, setDescription] = useState('')
  const [workspaceId, setWorkspaceId] = useState(null)
  const [progress, setProgress] = useState(0)
  const [isUploading, setIsUploading] = useState(false)

  useEffect(() => {
    if (workspaces.length > 0 && !workspaceId) {
      setWorkspaceId(workspaces[0].id)
    }
  }, [workspaces, workspaceId])

  const handleFileDrop = (e) => {
    e.preventDefault()
    const droppedFile = e.dataTransfer ? e.dataTransfer.files[0] : e.target.files[0]
    if (!droppedFile) return

    const ext = droppedFile.name.slice(droppedFile.name.lastIndexOf('.')).toLowerCase()
    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      message.error(t('onlyGeotiffSupported'))
      return
    }

    setFile(droppedFile)
    if (!layerName) {
      const baseName = droppedFile.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ')
      setLayerName(baseName)
    }
  }

  const handleUploadSubmit = async () => {
    if (!file) {
      message.warning(t('selectGeotiffFirst'))
      return
    }
    if (!layerName.trim()) {
      message.warning(t('layerName') + ' ' + (t('fieldRequired') || 'wajib diisi.'))
      return
    }
    if (!workspaceId) {
      message.warning(t('selectTargetWorkspace'))
      return
    }

    setIsUploading(true)
    setProgress(0)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('layer_name', layerName.trim())
      formData.append('description', description.trim())
      formData.append('workspace_id', String(workspaceId))

      const res = await layerApi.create(formData, (percent) => {
        setProgress(percent)
      })

      message.success(res.data?.detail || t('layerPublishedSuccess'))
      queryClient.invalidateQueries({ queryKey: ['layers'] })

      setFile(null)
      setLayerName('')
      setDescription('')
      setProgress(0)

      if (onUploadSuccess) onUploadSuccess()
    } catch (err) {
      console.error('Upload error:', err)
      message.error(err.response?.data?.detail || t('uploadFailed'))
    } finally {
      setIsUploading(false)
    }
  }

  const formatInfo = file ? getFormatInfo(file.name) : null

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs">
      {/* Dropzone */}
      <div>
        <span className="font-semibold text-gray-700 block mb-1">{t('uploadTitle')}:</span>
        <label
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleFileDrop}
          className={`border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center text-center cursor-pointer transition ${
            file
              ? 'border-emerald-500 bg-emerald-50/40'
              : 'border-gray-300 hover:border-emerald-400 bg-gray-50/60'
          }`}
        >
          <input
            type="file"
            accept=".tif,.tiff,.geojson,.json,.zip,.shp,.gpkg,.csv"
            onChange={handleFileDrop}
            className="hidden"
          />
          <InboxOutlined
            className={`text-2xl mb-1 ${file ? 'text-emerald-600' : 'text-gray-400'}`}
          />
          {file ? (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-emerald-800 truncate max-w-[240px]">
                {file.name}
              </p>
              <p className="text-[10px] text-gray-400">
                {(file.size / (1024 * 1024)).toFixed(2)} MB • {t('clickToChange')}
              </p>
              {formatInfo && (
                <div className="pt-0.5 flex items-center justify-center gap-1.5 flex-wrap">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${formatInfo.color}`}>
                    {formatInfo.label}
                  </span>
                  {formatInfo.type === 'vector' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
                      <CheckCircleOutlined className="text-[10px]" />
                      Auto-simplify
                    </span>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div>
              <p className="text-xs text-gray-600 font-medium">
                {t('uploadDragDrop')}{' '}
                <span className="text-emerald-600 font-semibold">{t('uploadBrowse')}</span>
              </p>
              <p className="text-[10px] text-gray-400 mt-1 max-w-[240px] leading-relaxed">
                {t('uploadHint')}
              </p>
            </div>
          )}
        </label>
      </div>

      {/* Vector Auto-simplify notice */}
      {formatInfo?.type === 'vector' && (
        <div className="p-2.5 rounded-lg bg-emerald-50/80 border border-emerald-200 flex items-start gap-2 text-[11px] text-emerald-800 leading-snug">
          <InfoCircleOutlined className="mt-0.5 text-emerald-600 flex-shrink-0" />
          <span>{t('autoSimplifyNotice')}</span>
        </div>
      )}

      {/* Nama Layer */}
      <div>
        <span className="font-semibold text-gray-700 block mb-1">
          {t('layerName')} <span className="text-red-500">*</span>:
        </span>
        <Input
          placeholder={t('layerNamePlaceholder')}
          value={layerName}
          onChange={(e) => setLayerName(e.target.value)}
          size="small"
          className="rounded-lg text-xs"
        />
      </div>

      {/* Workspace Selection */}
      <div>
        <span className="font-semibold text-gray-700 block mb-1">
          {t('targetWorkspace')} <span className="text-red-500">*</span>:
        </span>
        <Select
          value={workspaceId}
          onChange={setWorkspaceId}
          size="small"
          className="w-full text-xs"
          options={workspaces.map((w) => ({
            value: w.id,
            label: `${w.name} (${w.ws_name})`,
          }))}
        />
      </div>

      {/* Deskripsi */}
      <div>
        <span className="font-semibold text-gray-700 block mb-1">{t('description')}:</span>
        <Input.TextArea
          rows={2}
          placeholder={t('descPlaceholder')}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="rounded-lg text-xs"
        />
      </div>

      {/* Progress */}
      {isUploading && (
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] text-gray-500 font-medium">
            <span>{t('publishing')}</span>
            <span>{progress}%</span>
          </div>
          <Progress percent={progress} size="small" status="active" strokeColor="#059669" />
        </div>
      )}

      {/* Submit Button */}
      <Button
        type="primary"
        block
        icon={<UploadOutlined />}
        onClick={handleUploadSubmit}
        loading={isUploading}
        className="bg-emerald-600 hover:bg-emerald-700 border-none rounded-xl text-xs font-semibold h-9"
      >
        {isUploading ? t('publishing') : t('btnPublish')}
      </Button>
    </div>
  )
}

export default UploadTab
