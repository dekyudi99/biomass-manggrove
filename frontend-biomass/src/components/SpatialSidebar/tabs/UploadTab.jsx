import { useState, useEffect } from 'react'
import { Input, Select, Button, Progress, message } from 'antd'
import { UploadOutlined, InboxOutlined } from '@ant-design/icons'
import { useQueryClient } from '@tanstack/react-query'
import layerApi from '../../../api/LayerApi'
import { useLanguage } from '../../../context/LanguageContext'

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
    if (!['.tif', '.tiff'].includes(ext)) {
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
          <input type="file" accept=".tif,.tiff" onChange={handleFileDrop} className="hidden" />
          <InboxOutlined
            className={`text-2xl mb-1 ${file ? 'text-emerald-600' : 'text-gray-400'}`}
          />
          {file ? (
            <div>
              <p className="text-xs font-semibold text-emerald-800 truncate max-w-[240px]">
                {file.name}
              </p>
              <p className="text-[10px] text-gray-400">
                {(file.size / (1024 * 1024)).toFixed(2)} MB • {t('clickToChange')}
              </p>
            </div>
          ) : (
            <div>
              <p className="text-xs text-gray-600 font-medium">
                {t('uploadDragDrop')}{' '}
                <span className="text-emerald-600 font-semibold">{t('uploadBrowse')}</span>
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">{t('uploadHint')}</p>
            </div>
          )}
        </label>
      </div>

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
