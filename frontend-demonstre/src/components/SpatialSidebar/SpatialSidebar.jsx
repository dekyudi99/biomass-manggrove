import { useState } from 'react'
import {
  AppstoreOutlined,
  FolderOpenOutlined,
  FolderOutlined,
  UploadOutlined,
  SettingOutlined,
  CloseOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import workspaceApi from '../../api/WorkspaceApi'
import layerApi from '../../api/LayerApi'
import { useLanguage } from '../../context/LanguageContext'

import LayersTab from './tabs/LayersTab'
import WorkspacesTab from './tabs/WorkspacesTab'
import GroupsTab from './tabs/GroupsTab'
import UploadTab from './tabs/UploadTab'

import LayerStyleModal from './modals/LayerStyleModal'
import SettingsModal from './modals/SettingsModal'

const SpatialSidebar = ({
  visibleLayers = [],
  onToggleLayer,
  onChangeLayerOpacity,
  onZoomToLayer,
  visibleGroups = [],
  onToggleGroup,
  onChangeGroupOpacity,
  onZoomToGroup,
  onStyleApplied,
  isOpen: propIsOpen,
  onToggle: propOnToggle,
  otherSidebarOpen = false,
}) => {
  const { t } = useLanguage()

  const [localIsOpen, setLocalIsOpen] = useState(false)
  const isControlled = typeof propIsOpen === 'boolean'
  const isOpen = isControlled ? propIsOpen : localIsOpen

  const toggleOpen = () => {
    if (isControlled && propOnToggle) {
      propOnToggle(!isOpen)
    } else {
      setLocalIsOpen((prev) => !prev)
    }
  }

  const [activeTab, setActiveTab] = useState('layers')

  // Modals state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [selectedLayerForStyle, setSelectedLayerForStyle] = useState(null)
  const [isStyleModalOpen, setIsStyleModalOpen] = useState(false)

  // Fetch workspaces & layers for dropdowns/modals
  const { data: workspacesData } = useQuery({
    queryKey: ['workspaces'],
    queryFn: async () => {
      const res = await workspaceApi.getAll()
      return res.data?.data || []
    },
  })

  const { data: layersData } = useQuery({
    queryKey: ['layers'],
    queryFn: async () => {
      const res = await layerApi.list()
      return res.data?.data || []
    },
  })

  const workspaces = workspacesData || []
  const layers = layersData || []

  const TABS = [
    { id: 'layers', label: t('tabLayers'), icon: <AppstoreOutlined /> },
    { id: 'workspaces', label: t('tabWorkspaces'), icon: <FolderOpenOutlined /> },
    { id: 'groups', label: t('tabGroups'), icon: <FolderOutlined /> },
    { id: 'upload', label: t('tabUpload'), icon: <UploadOutlined /> },
  ]

  const handleOpenStyleModal = (layer) => {
    setSelectedLayerForStyle(layer)
    setIsStyleModalOpen(true)
  }

  return (
    <>
      <aside className="absolute top-3 right-3 sm:top-4 sm:right-4 z-[1000] flex flex-col items-end gap-2 pointer-events-none max-w-[calc(100vw-1.5rem)]">
        {/* Tombol Header (sembunyi di mobile jika sidebar kiri terbuka) */}
        <div className={`pointer-events-auto flex items-center gap-1.5 sm:gap-2 ${otherSidebarOpen ? 'hidden lg:flex' : 'flex'}`}>
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="bg-white/95 backdrop-blur-md p-2 sm:p-2.5 rounded-xl shadow-lg border border-gray-200/80 text-gray-600 hover:text-emerald-700 hover:bg-emerald-50 transition cursor-pointer"
            title={t('settingsTitle')}
          >
            <SettingOutlined className="text-sm sm:text-base" />
          </button>

          <button
            onClick={toggleOpen}
            className="bg-white/95 backdrop-blur-md px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl shadow-lg border border-gray-200/80 text-gray-700 hover:text-emerald-700 hover:bg-emerald-50 transition-all flex items-center gap-1.5 sm:gap-2 font-medium text-xs sm:text-sm cursor-pointer"
            title={t('spatialTitle')}
          >
            <AppstoreOutlined className="text-emerald-600 text-sm sm:text-base" />
            <span className="hidden sm:inline truncate max-w-[120px] sm:max-w-none">{t('spatialTitle')}</span>
            <span className="inline sm:hidden text-xs font-semibold text-gray-700">GIS</span>
            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded-full">
              {layers.length}
            </span>
          </button>
        </div>

        {/* Panel Card Utama */}
        {isOpen && (
          <div className="pointer-events-auto w-[calc(100vw-1.5rem)] sm:w-96 max-w-sm max-h-[calc(100dvh-5.5rem)] bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-gray-200/80 flex flex-col overflow-hidden text-gray-800 transition-all overscroll-contain">
            {/* Header Tabs Navigation */}
            <div className="flex items-center border-b border-gray-100 bg-gray-50/70 p-1.5 gap-1">
              <div className="flex flex-1 items-center gap-1 overflow-x-auto">
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 min-w-[56px] py-1.5 px-1.5 rounded-xl text-[11px] sm:text-xs font-semibold flex items-center justify-center gap-1 transition cursor-pointer ${
                      activeTab === tab.id
                        ? 'bg-white text-emerald-700 shadow-xs border border-gray-200/80'
                        : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100/60'
                    }`}
                  >
                    {tab.icon}
                    <span className="truncate">{tab.label}</span>
                  </button>
                ))}
              </div>
              <button
                onClick={toggleOpen}
                className="lg:hidden p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-200/60 rounded-lg transition cursor-pointer shrink-0"
                title="Close"
                aria-label="Close"
              >
                <CloseOutlined className="text-xs" />
              </button>
            </div>

            {/* Tab Contents */}
            {activeTab === 'layers' && (
              <LayersTab
                visibleLayers={visibleLayers}
                onToggleLayer={onToggleLayer}
                onChangeLayerOpacity={onChangeLayerOpacity}
                onZoomToLayer={onZoomToLayer}
                onOpenStyleModal={handleOpenStyleModal}
              />
            )}

            {activeTab === 'workspaces' && <WorkspacesTab />}

            {activeTab === 'groups' && (
              <GroupsTab
                visibleGroups={visibleGroups}
                onToggleGroup={onToggleGroup}
                onChangeGroupOpacity={onChangeGroupOpacity}
                onZoomToGroup={onZoomToGroup}
                workspaces={workspaces}
                layers={layers}
              />
            )}

            {activeTab === 'upload' && (
              <UploadTab
                workspaces={workspaces}
                onUploadSuccess={() => setActiveTab('layers')}
              />
            )}
          </div>
        )}
      </aside>

      {/* Modal Edit Style SLD */}
      <LayerStyleModal
        layer={selectedLayerForStyle}
        open={isStyleModalOpen}
        onClose={() => {
          setIsStyleModalOpen(false)
          setSelectedLayerForStyle(null)
        }}
        onStyleApplied={(layerId) => {
          if (onStyleApplied) onStyleApplied(layerId)
        }}
      />

      {/* Modal Settings & Bahasa */}
      <SettingsModal open={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </>
  )
}

export default SpatialSidebar
