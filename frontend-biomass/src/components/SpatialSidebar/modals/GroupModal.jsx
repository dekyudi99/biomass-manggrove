import { useState, useEffect } from 'react'
import { Modal, Input, Select, Button, message } from 'antd'
import { ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import layerGroupApi from '../../../api/LayerGroupApi'
import { useLanguage } from '../../../context/LanguageContext'

const GroupModal = ({ open, onClose, group, workspaces = [], layers = [] }) => {
  const { t } = useLanguage()
  const queryClient = useQueryClient()

  const [title, setTitle] = useState('')
  const [workspaceId, setWorkspaceId] = useState(null)
  const [selectedLayerIds, setSelectedLayerIds] = useState([])

  useEffect(() => {
    if (open) {
      if (group) {
        setTitle(group.title || group.name)
        setWorkspaceId(group.workspace_id)
        const memberIds = group.layers ? group.layers.map((l) => l.raw_id || l.id) : []
        setSelectedLayerIds(memberIds)
      } else {
        setTitle('')
        setWorkspaceId(workspaces[0]?.id || null)
        setSelectedLayerIds([])
      }
    }
  }, [open, group, workspaces])

  const createMutation = useMutation({
    mutationFn: (data) => layerGroupApi.create(data),
    onSuccess: (res) => {
      message.success(res.data?.detail || t('createGroup') + ' OK!')
      queryClient.invalidateQueries(['layerGroups'])
      onClose()
    },
    onError: (err) => {
      message.error(err.response?.data?.detail || 'Gagal membuat layer group')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => layerGroupApi.update({ id, data }),
    onSuccess: (res) => {
      message.success(res.data?.detail || t('editGroup') + ' OK!')
      queryClient.invalidateQueries(['layerGroups'])
      onClose()
    },
    onError: (err) => {
      message.error(err.response?.data?.detail || 'Gagal memperbarui layer group')
    },
  })

  const handleMoveOrder = (index, direction) => {
    const newArr = [...selectedLayerIds]
    const targetIdx = index + direction
    if (targetIdx < 0 || targetIdx >= newArr.length) return
    const temp = newArr[index]
    newArr[index] = newArr[targetIdx]
    newArr[targetIdx] = temp
    setSelectedLayerIds(newArr)
  }

  const handleSubmit = () => {
    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      message.warning(t('groupTitle') + ' wajib diisi.')
      return
    }
    if (selectedLayerIds.length === 0) {
      message.warning(t('selectMinOneLayer'))
      return
    }

    if (group) {
      updateMutation.mutate({
        id: group.id,
        data: {
          title: trimmedTitle,
          layer_ids: selectedLayerIds,
        },
      })
    } else {
      createMutation.mutate({
        name: trimmedTitle.toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 30),
        title: trimmedTitle,
        workspace_id: workspaceId,
        layer_ids: selectedLayerIds,
      })
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width="min(520px, 95vw)"
      destroyOnClose
      title={
        <span className="font-bold text-gray-800 text-sm">
          {group ? `✏️ ${t('editGroup')}` : `📁 ${t('createGroup')}`}
        </span>
      }
    >
      <div className="space-y-3.5 py-2 text-xs">
        <div>
          <span className="font-semibold text-gray-700 block mb-1">
            {t('groupTitle')} <span className="text-red-500">*</span>:
          </span>
          <Input
            placeholder={t('groupPlaceholder')}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-xs rounded-lg"
          />
        </div>

        {!group && (
          <div>
            <span className="font-semibold text-gray-700 block mb-1">
              {t('groupWorkspace')} <span className="text-red-500">*</span>:
            </span>
            <Select
              value={workspaceId}
              onChange={setWorkspaceId}
              className="w-full text-xs"
              options={workspaces.map((w) => ({
                value: w.id,
                label: `${w.name} (${w.ws_name})`,
              }))}
            />
          </div>
        )}

        <div>
          <span className="font-semibold text-gray-700 block mb-1">
            {t('selectLayersForGroup')}:
          </span>
          <p className="text-[11px] text-gray-400 mb-2">{t('groupOrderDesc')}</p>

          <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-xl p-2 space-y-1 bg-gray-50/50">
            {layers.map((l) => {
              const isChecked = selectedLayerIds.includes(l.id)
              const orderIndex = selectedLayerIds.indexOf(l.id)

              return (
                <div
                  key={l.id}
                  className={`flex items-center justify-between p-1.5 rounded-lg text-xs transition ${
                    isChecked ? 'bg-white border border-emerald-300 shadow-xs' : 'hover:bg-gray-100'
                  }`}
                >
                  <label className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedLayerIds([...selectedLayerIds, l.id])
                        } else {
                          setSelectedLayerIds(selectedLayerIds.filter((id) => id !== l.id))
                        }
                      }}
                      className="accent-emerald-600 rounded"
                    />
                    <span className="font-medium text-gray-700 truncate">{l.layer_name}</span>
                  </label>

                  {isChecked && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded-md">
                        #{orderIndex + 1}
                      </span>
                      <button
                        type="button"
                        disabled={orderIndex === 0}
                        onClick={() => handleMoveOrder(orderIndex, -1)}
                        className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-20 cursor-pointer"
                      >
                        <ArrowUpOutlined className="text-xs" />
                      </button>
                      <button
                        type="button"
                        disabled={orderIndex === selectedLayerIds.length - 1}
                        onClick={() => handleMoveOrder(orderIndex, 1)}
                        className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-20 cursor-pointer"
                      >
                        <ArrowDownOutlined className="text-xs" />
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div className="pt-2 border-t border-gray-100 flex justify-end gap-2">
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

export default GroupModal
