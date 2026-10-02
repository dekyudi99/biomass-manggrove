import { useState } from 'react'
import { Input, Switch, Slider, Button, Tooltip, Popconfirm, message } from 'antd'
import {
  ReloadOutlined,
  AimOutlined,
  BgColorsOutlined,
  DeleteOutlined,
  DownloadOutlined,
} from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import layerApi from '../../../api/LayerApi'
import { useLanguage } from '../../../context/LanguageContext'
import DownloadLayerModal from '../modals/DownloadLayerModal'

const LayersTab = ({
  visibleLayers = [],
  onToggleLayer,
  onChangeLayerOpacity,
  onZoomToLayer,
  onOpenStyleModal,
}) => {
  const { t } = useLanguage()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [downloadingLayer, setDownloadingLayer] = useState(null)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['layers'],
    queryFn: async () => {
      const res = await layerApi.list()
      return res.data?.data || []
    },
  })

  const layers = data || []

  const deleteMutation = useMutation({
    mutationFn: (id) => layerApi.delete(id),
    onSuccess: (res, deletedId) => {
      message.success(res.data?.detail || t('deleteLayer') + ' OK!')
      queryClient.invalidateQueries({ queryKey: ['layers'] })
      // Matikan dari peta jika sedang tampil
      const active = visibleLayers.find((l) => l.id === deletedId)
      if (active && onToggleLayer) {
        onToggleLayer(active, false)
      }
    },
    onError: (err) => {
      message.error(err.response?.data?.detail || 'Gagal menghapus layer')
    },
  })

  const filteredLayers = layers.filter((l) =>
    (l.layer_name || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Search & Refresh Bar */}
      <div className="p-3 border-b border-gray-100 flex items-center gap-2">
        <Input
          placeholder={t('searchLayer')}
          size="small"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          allowClear
          className="text-xs rounded-lg"
        />
        <Tooltip title={t('refresh')}>
          <Button
            size="small"
            icon={<ReloadOutlined spin={isLoading} />}
            onClick={() => refetch()}
            className="rounded-lg text-gray-500 hover:text-emerald-600"
          />
        </Tooltip>
      </div>

      {/* List Layer */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {isLoading && layers.length === 0 ? (
          <div className="text-center py-8 text-xs text-gray-400">
            {t('loadingLayers')}
          </div>
        ) : filteredLayers.length === 0 ? (
          <div className="text-center py-8 text-xs text-gray-400">
            {search ? t('noMatchingLayers') : t('noLayers')}
          </div>
        ) : (
          filteredLayers.map((layer) => {
            const isVisible = visibleLayers.some((vl) => vl.id === layer.id)
            const currentOpacity =
              visibleLayers.find((vl) => vl.id === layer.id)?.opacity ?? 0.85

            return (
              <div
                key={layer.id}
                className={`p-2.5 rounded-xl border transition text-xs ${
                  isVisible
                    ? 'bg-emerald-50/50 border-emerald-300 shadow-xs'
                    : 'bg-white border-gray-200 hover:border-gray-300'
                }`}
              >
                {/* Switch, Name, Action Buttons */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Switch
                      size="small"
                      checked={isVisible}
                      onChange={(checked) => onToggleLayer(layer, checked)}
                      className={isVisible ? 'bg-emerald-600' : ''}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-gray-800 truncate leading-tight">
                        {layer.layer_name}
                      </p>
                      <p className="text-[10px] text-gray-400 truncate flex items-center gap-1.5 mt-0.5">
                        <span className="truncate">{layer.workspace_display_name || layer.workspace_name}</span>
                        <span>•</span>
                        <span
                          className={`px-1.5 py-0.2 rounded text-[9px] font-medium ${
                            layer.layer_type === 'vector'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-blue-50 text-blue-700 border border-blue-200'
                          }`}
                        >
                          {layer.data_type || (layer.layer_type === 'vector' ? 'Vector' : 'Raster')}
                        </span>
                      </p>
                    </div>
                  </div>

                  {/* Buttons */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {layer.bbox && (
                      <Tooltip title={t('zoomToLayer')}>
                        <button
                          onClick={() => onZoomToLayer(layer)}
                          className="p-1 text-gray-500 hover:text-emerald-700 hover:bg-gray-100 rounded-md cursor-pointer transition"
                        >
                          <AimOutlined className="text-sm" />
                        </button>
                      </Tooltip>
                    )}

                    <Tooltip title={t('downloadLayer')}>
                      <button
                        onClick={() => setDownloadingLayer(layer)}
                        className="p-1 text-gray-500 hover:text-emerald-700 hover:bg-gray-100 rounded-md cursor-pointer transition"
                      >
                        <DownloadOutlined className="text-sm" />
                      </button>
                    </Tooltip>

                    {layer.layer_type !== 'vector' && (
                      <Tooltip title={t('editStyle')}>
                        <button
                          onClick={() => onOpenStyleModal(layer)}
                          className="p-1 text-gray-500 hover:text-emerald-700 hover:bg-gray-100 rounded-md cursor-pointer transition"
                        >
                          <BgColorsOutlined className="text-sm" />
                        </button>
                      </Tooltip>
                    )}

                    <Popconfirm
                      title={t('confirmDeleteLayerTitle')}
                      description={t('confirmDeleteLayerDesc')}
                      onConfirm={() => deleteMutation.mutate(layer.id)}
                      okText={t('delete')}
                      cancelText={t('cancel')}
                      okButtonProps={{ danger: true, size: 'small', loading: deleteMutation.isPending }}
                      cancelButtonProps={{ size: 'small' }}
                    >
                      <button className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md cursor-pointer transition">
                        <DeleteOutlined className="text-sm" />
                      </button>
                    </Popconfirm>
                  </div>
                </div>

                {/* Opacity Slider jika aktif */}
                {isVisible && (
                  <div className="mt-2 pt-2 border-t border-emerald-100 flex items-center gap-2">
                    <span className="text-[10px] text-emerald-800 font-medium">
                      {t('opacity')}:
                    </span>
                    <Slider
                      min={0.1}
                      max={1.0}
                      step={0.05}
                      value={currentOpacity}
                      onChange={(val) => onChangeLayerOpacity(layer.id, val)}
                      className="flex-1 m-0"
                    />
                    <span className="text-[10px] font-mono text-gray-500 w-8 text-right">
                      {Math.round(currentOpacity * 100)}%
                    </span>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Modal Download Layer */}
      <DownloadLayerModal
        open={!!downloadingLayer}
        layer={downloadingLayer}
        onClose={() => setDownloadingLayer(null)}
      />
    </div>
  )
}

export default LayersTab
