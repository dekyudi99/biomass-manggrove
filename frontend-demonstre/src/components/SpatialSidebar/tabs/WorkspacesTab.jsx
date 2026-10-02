import { useState } from 'react'
import { Button, Tooltip, Popconfirm, message } from 'antd'
import {
  ReloadOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  FolderOpenOutlined,
} from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import workspaceApi from '../../../api/WorkspaceApi'
import { useLanguage } from '../../../context/LanguageContext'
import WorkspaceModal from '../modals/WorkspaceModal'

const WorkspacesTab = () => {
  const { t } = useLanguage()
  const queryClient = useQueryClient()

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedWorkspace, setSelectedWorkspace] = useState(null)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['workspaces'],
    queryFn: async () => {
      const res = await workspaceApi.getAll()
      return res.data?.data || []
    },
  })

  const workspaces = data || []

  const deleteMutation = useMutation({
    mutationFn: (id) => workspaceApi.delete(id),
    onSuccess: (res) => {
      message.success(res.data?.detail || t('deleteWorkspace') + ' OK!')
      queryClient.invalidateQueries({ queryKey: ['workspaces'] })
      queryClient.invalidateQueries({ queryKey: ['layers'] })
      queryClient.invalidateQueries({ queryKey: ['layerGroups'] })
    },
    onError: (err) => {
      message.error(err.response?.data?.detail || 'Gagal menghapus workspace')
    },
  })

  const handleOpenCreate = () => {
    setSelectedWorkspace(null)
    setIsModalOpen(true)
  }

  const handleOpenEdit = (ws) => {
    setSelectedWorkspace(ws)
    setIsModalOpen(true)
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header bar: Count & Add Button */}
      <div className="p-3 border-b border-gray-100 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-gray-700">
            {t('tabWorkspaces')} ({workspaces.length})
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <Tooltip title={t('refresh')}>
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
            {t('addWorkspace')}
          </Button>
        </div>
      </div>

      {/* List Workspaces */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {isLoading && workspaces.length === 0 ? (
          <div className="text-center py-8 text-xs text-gray-400">
            {t('loadingWorkspaces')}
          </div>
        ) : workspaces.length === 0 ? (
          <div className="text-center py-8 text-xs text-gray-400">
            {t('noWorkspaces')}
          </div>
        ) : (
          workspaces.map((ws) => (
            <div
              key={ws.id}
              className="p-3 bg-white rounded-xl border border-gray-200 hover:border-emerald-300 transition text-xs shadow-2xs"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center flex-shrink-0">
                    <FolderOpenOutlined className="text-base" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-800 truncate leading-tight">
                      {ws.name}
                    </p>
                    <p className="text-[10px] text-gray-400 font-mono truncate">
                      GeoServer: {ws.ws_name}
                    </p>
                  </div>
                </div>

                {/* Edit & Delete Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Tooltip title={t('editWorkspace')}>
                    <button
                      onClick={() => handleOpenEdit(ws)}
                      className="p-1.5 text-gray-500 hover:text-emerald-700 hover:bg-gray-100 rounded-md cursor-pointer transition"
                    >
                      <EditOutlined className="text-sm" />
                    </button>
                  </Tooltip>

                  <Popconfirm
                    title={t('confirmDeleteWorkspaceTitle')}
                    description={t('confirmDeleteWorkspaceDesc')}
                    onConfirm={() => deleteMutation.mutate(ws.id)}
                    okText={t('delete')}
                    cancelText={t('cancel')}
                    okButtonProps={{ danger: true, size: 'small', loading: deleteMutation.isPending }}
                    cancelButtonProps={{ size: 'small' }}
                  >
                    <button className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md cursor-pointer transition">
                      <DeleteOutlined className="text-sm" />
                    </button>
                  </Popconfirm>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal Add / Edit Workspace */}
      <WorkspaceModal
        open={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setSelectedWorkspace(null)
        }}
        workspace={selectedWorkspace}
      />
    </div>
  )
}

export default WorkspacesTab
