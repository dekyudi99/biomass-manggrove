import { useState, useEffect } from 'react'
import { Modal, Input, Button, message } from 'antd'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import workspaceApi from '../../../api/WorkspaceApi'
import { useLanguage } from '../../../context/LanguageContext'

const WorkspaceModal = ({ open, onClose, workspace }) => {
  const { t } = useLanguage()
  const queryClient = useQueryClient()
  const [name, setName] = useState('')

  useEffect(() => {
    if (open) {
      setName(workspace ? workspace.name : '')
    }
  }, [open, workspace])

  const createMutation = useMutation({
    mutationFn: (data) => workspaceApi.create(data),
    onSuccess: (res) => {
      message.success(res.data?.detail || t('addWorkspace') + ' OK!')
      queryClient.invalidateQueries({ queryKey: ['workspaces'] })
      onClose()
    },
    onError: (err) => {
      message.error(err.response?.data?.detail || 'Gagal membuat workspace')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => workspaceApi.update({ id, data }),
    onSuccess: (res) => {
      message.success(res.data?.detail || t('editWorkspace') + ' OK!')
      queryClient.invalidateQueries({ queryKey: ['workspaces'] })
      onClose()
    },
    onError: (err) => {
      message.error(err.response?.data?.detail || 'Gagal memperbarui workspace')
    },
  })

  const handleSubmit = () => {
    const trimmed = name.trim()
    if (!trimmed) {
      message.warning(t('workspaceName') + ' tidak boleh kosong.')
      return
    }

    if (workspace) {
      updateMutation.mutate({ id: workspace.id, data: { name: trimmed } })
    } else {
      createMutation.mutate({ name: trimmed })
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width="min(420px, 95vw)"
      destroyOnClose
      title={
        <span className="font-bold text-gray-800 text-sm">
          {workspace ? `✏️ ${t('editWorkspace')}` : `➕ ${t('addWorkspace')}`}
        </span>
      }
    >
      <div className="space-y-3 py-2 text-xs">
        <div>
          <span className="font-semibold text-gray-700 block mb-1">
            {t('workspaceName')} <span className="text-red-500">*</span>:
          </span>
          <Input
            placeholder={t('workspacePlaceholder')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onPressEnter={handleSubmit}
            className="text-xs rounded-lg"
            autoFocus
          />
        </div>

        <div className="pt-2 flex justify-end gap-2 border-t border-gray-100">
          <Button size="small" onClick={onClose} disabled={isPending}>
            {t('cancel')}
          </Button>
          <Button
            size="small"
            type="primary"
            onClick={handleSubmit}
            loading={isPending}
            className="bg-emerald-600 hover:bg-emerald-700 border-none text-xs"
          >
            {t('save')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default WorkspaceModal
