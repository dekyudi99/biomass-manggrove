import { useState } from 'react'
import { Switch, Slider, Button, Tooltip, Popconfirm, message } from 'antd'
import {
  ReloadOutlined,
  PlusOutlined,
  AimOutlined,
  EditOutlined,
  DeleteOutlined,
} from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import layerGroupApi from '../../../api/LayerGroupApi'
import { useLanguage } from '../../../context/LanguageContext'
import GroupModal from '../modals/GroupModal'

const GroupsTab = ({
  visibleGroups = [],
  onToggleGroup,
  onChangeGroupOpacity,
  onZoomToGroup,
  workspaces = [],
  layers = [],
}) => {
  const { t } = useLanguage()
  const queryClient = useQueryClient()

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedGroup, setSelectedGroup] = useState(null)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['layerGroups'],
    queryFn: async () => {
      const res = await layerGroupApi.list()
      return res.data?.data || []
    },
  })

  const groups = data || []

  const deleteMutation = useMutation({
    mutationFn: (id) => layerGroupApi.delete(id),
    onSuccess: (res, deletedId) => {
      message.success(res.data?.detail || t('deleteGroup') + ' OK!')
      queryClient.invalidateQueries(['layerGroups'])
      const active = visibleGroups.find((g) => g.id === deletedId)
      if (active && onToggleGroup) {
        onToggleGroup(active, false)
      }
    },
    onError: (err) => {
      message.error(err.response?.data?.detail || 'Gagal menghapus layer group')
    },
  })

  const handleOpenCreate = () => {
    setSelectedGroup(null)
    setIsModalOpen(true)
  }

  const handleOpenEdit = (grp) => {
    setSelectedGroup(grp)
    setIsModalOpen(true)
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="p-3 border-b border-gray-100 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-gray-700">
          {t('tabGroups')} ({groups.length})
        </span>
        <div className="flex items-center gap-1.5">
          <Tooltip title="Refresh">
            <Button
              size="small"
              icon={<ReloadOutlined spin={isLoading} />}
              onClick={() => refetch()}
              className="rounded-lg text-gray-500 hover:text-emerald-600"
            />
          </Tooltip>
          <Button
            size="small"
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleOpenCreate}
            className="bg-emerald-600 hover:bg-emerald-700 text-xs rounded-lg border-none"
          >
            {t('createGroup')}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {isLoading && groups.length === 0 ? (
          <div className="text-center py-8 text-xs text-gray-400">
            {t('loadingGroups')}
          </div>
        ) : groups.length === 0 ? (
          <div className="text-center py-8 text-xs text-gray-400">
            {t('noGroups')}
          </div>
        ) : (
          groups.map((grp) => {
            const isVisible = visibleGroups.some((vg) => vg.id === grp.id)
            const currentOpacity =
              visibleGroups.find((vg) => vg.id === grp.id)?.opacity ?? 0.85

            return (
              <div
                key={grp.id}
                className={`p-2.5 rounded-xl border transition text-xs ${
                  isVisible
                    ? 'bg-emerald-50/50 border-emerald-300 shadow-xs'
                    : 'bg-white border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Switch
                      size="small"
                      checked={isVisible}
                      onChange={(checked) => onToggleGroup(grp, checked)}
                      className={isVisible ? 'bg-emerald-600' : ''}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-gray-800 truncate leading-tight">
                        {grp.title || grp.name}
                      </p>
                      <p className="text-[10px] text-gray-400 truncate">
                        {grp.layers?.length || 0} Layer • {grp.workspace_name}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    {grp.bbox && (
                      <Tooltip title={t('zoomToLayer')}>
                        <button
                          onClick={() => onZoomToGroup(grp)}
                          className="p-1 text-gray-500 hover:text-emerald-700 hover:bg-gray-100 rounded-md cursor-pointer transition"
                        >
                          <AimOutlined className="text-sm" />
                        </button>
                      </Tooltip>
                    )}

                    <Tooltip title={t('editGroup')}>
                      <button
                        onClick={() => handleOpenEdit(grp)}
                        className="p-1 text-gray-500 hover:text-emerald-700 hover:bg-gray-100 rounded-md cursor-pointer transition"
                      >
                        <EditOutlined className="text-sm" />
                      </button>
                    </Tooltip>

                    <Popconfirm
                      title={t('confirmDeleteGroupTitle')}
                      description={t('confirmDeleteGroupDesc')}
                      onConfirm={() => deleteMutation.mutate(grp.id)}
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

                {/* Member layer pills */}
                {grp.layers && grp.layers.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {grp.layers.map((ml, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-md truncate max-w-[120px]"
                      >
                        {idx + 1}. {ml.name}
                      </span>
                    ))}
                  </div>
                )}

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
                      onChange={(val) => onChangeGroupOpacity(grp.id, val)}
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

      <GroupModal
        open={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setSelectedGroup(null)
        }}
        group={selectedGroup}
        workspaces={workspaces}
        layers={layers}
      />
    </div>
  )
}

export default GroupsTab
