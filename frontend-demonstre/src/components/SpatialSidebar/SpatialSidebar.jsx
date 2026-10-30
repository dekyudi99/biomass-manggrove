import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Dropdown } from 'antd'
import {
  AppstoreOutlined,
  FolderOutlined,
  UploadOutlined,
  SettingOutlined,
  GlobalOutlined,
  CloseOutlined,
  UserOutlined,
  LogoutOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import layerApi from '../../api/LayerApi'
import { useLanguage } from '../../context/LanguageContext'
import useAuth from '../../hooks/useAuth'

import LayersTab from './tabs/LayersTab'
import GroupsTab from './tabs/GroupsTab'
import UploadTab from './tabs/UploadTab'

import LayerStyleModal from './modals/LayerStyleModal'
import SettingsModal from './modals/SettingsModal'
import { QUERY_KEYS } from '../../constants/queryKeys'

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
  const { language, setLanguage, t } = useLanguage()
  const navigate = useNavigate()

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

  const { data: layersData } = useQuery({
    queryKey: QUERY_KEYS.layers,
    queryFn: async () => {
      const res = await layerApi.list()
      return res.data?.data || []
    },
  })

  const layers = layersData || []

  const TABS = [
    { id: 'layers', label: t('tabLayers'), icon: <AppstoreOutlined /> },
    { id: 'groups', label: t('tabGroups'), icon: <FolderOutlined /> },
    { id: 'upload', label: t('tabUpload'), icon: <UploadOutlined /> },
  ]

  const languageMenuItems = [
    {
      key: 'id',
      label: (
        <div className="flex items-center gap-2 py-0.5">
          <span className="text-sm">🇮🇩</span>
          <span className="font-medium text-xs sm:text-sm">{t('langId')}</span>
        </div>
      ),
    },
    {
      key: 'en',
      label: (
        <div className="flex items-center gap-2 py-0.5">
          <span className="text-sm">🇬🇧</span>
          <span className="font-medium text-xs sm:text-sm">{t('langEn')}</span>
        </div>
      ),
    },
    {
      key: 'th',
      label: (
        <div className="flex items-center gap-2 py-0.5">
          <span className="text-sm">🇹🇭</span>
          <span className="font-medium text-xs sm:text-sm">{t('langTh')}</span>
        </div>
      ),
    },
  ]

  const { user, logout, portalUrl } = useAuth()

  const getInitials = (name) => {
    if (!name) return 'U'
    const parts = name.trim().split(/\s+/)
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    return name.slice(0, 2).toUpperCase()
  }

  const userMenuItems = [
    {
      key: 'account',
      icon: <UserOutlined />,
      label: 'Account',
      onClick: () => {
        window.location.href = `${portalUrl}/profile`
      },
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      danger: true,
      label: 'Sign out',
      onClick: () => {
        logout()
      },
    },
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
          <Dropdown
            menu={{
              items: languageMenuItems,
              selectedKeys: [language],
              onClick: ({ key }) => setLanguage(key),
            }}
            trigger={['click']}
            placement="bottomRight"
          >
            <button
              type="button"
              className="bg-white/95 backdrop-blur-md h-8 w-8 sm:h-9 sm:w-9 rounded-xl shadow-lg border border-gray-200/80 text-gray-600 hover:text-emerald-700 hover:bg-emerald-50 transition cursor-pointer flex items-center justify-center shrink-0"
              title={t('langSelect')}
              aria-label={t('langSelect')}
            >
              <GlobalOutlined className="text-sm sm:text-base" />
            </button>
          </Dropdown>

          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="bg-white/95 backdrop-blur-md h-8 w-8 sm:h-9 sm:w-9 rounded-xl shadow-lg border border-gray-200/80 text-gray-600 hover:text-emerald-700 hover:bg-emerald-50 transition cursor-pointer flex items-center justify-center shrink-0"
            title={t('settingsTitle')}
            aria-label={t('settingsTitle')}
          >
            <SettingOutlined className="text-sm sm:text-base" />
          </button>

          {user ? (
            <Dropdown
              menu={{
                items: userMenuItems,
              }}
              trigger={['click']}
              placement="bottomRight"
            >
              <button
                type="button"
                className="bg-white/95 backdrop-blur-md h-8 sm:h-9 px-2 sm:px-2.5 rounded-xl shadow-lg border border-gray-200/80 text-gray-700 hover:text-emerald-700 hover:bg-emerald-50 transition cursor-pointer flex items-center gap-1.5 shrink-0"
                title={user.name || user.email}
                aria-label="User Profile"
              >
                <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-emerald-600 text-white font-bold text-[10px] sm:text-[11px] flex items-center justify-center">
                  {getInitials(user.name || user.email)}
                </span>
                <span className="hidden md:inline text-xs font-semibold max-w-[100px] truncate text-slate-700">
                  {user.name || user.email}
                </span>
              </button>
            </Dropdown>
          ) : (
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="bg-white/95 backdrop-blur-md hover:bg-emerald-50 h-8 sm:h-9 px-2.5 sm:px-3 rounded-xl shadow-lg border border-emerald-300 text-emerald-700 font-semibold text-xs sm:text-sm transition cursor-pointer flex items-center gap-1.5 shrink-0"
              title={t('signIn') || 'Masuk'}
            >
              <UserOutlined className="text-xs sm:text-sm" />
              <span>{t('signIn') || 'Masuk'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={toggleOpen}
            className="bg-white/95 backdrop-blur-md h-8 sm:h-9 px-2.5 sm:px-3 rounded-xl shadow-lg border border-gray-200/80 text-gray-700 hover:text-emerald-700 hover:bg-emerald-50 transition-all flex items-center gap-1.5 sm:gap-2 font-medium text-xs sm:text-sm cursor-pointer shrink-0"
            title={t('spatialTitle')}
          >
            <AppstoreOutlined className="text-emerald-600 text-sm sm:text-base shrink-0" />
            <span className="hidden sm:inline truncate max-w-[120px] sm:max-w-none">{t('spatialTitle')}</span>
            <span className="inline sm:hidden text-xs font-semibold text-gray-700">GIS</span>
            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded-full leading-none shrink-0">
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

            {activeTab === 'groups' && (
              <GroupsTab
                visibleGroups={visibleGroups}
                onToggleGroup={onToggleGroup}
                onChangeGroupOpacity={onChangeGroupOpacity}
                onZoomToGroup={onZoomToGroup}
                layers={layers}
              />
            )}

            {activeTab === 'upload' && (
              <UploadTab
                onUploadSuccess={() => setActiveTab('layers')}
              />
            )}
          </div>
        )}
      </aside>

      {/* Unified Layer Style Modal (AstraGIS aligned: Vector & Raster) */}
      <LayerStyleModal
        key={`layer-style-${selectedLayerForStyle?.id || 'none'}`}
        layer={selectedLayerForStyle}
        open={isStyleModalOpen}
        onClose={() => {
          setIsStyleModalOpen(false)
          setSelectedLayerForStyle(null)
        }}
        onStyleApplied={(layerId, symbology) => {
          if (onStyleApplied) onStyleApplied(layerId, symbology)
        }}
      />

      {/* Modal Settings & Bahasa */}
      <SettingsModal
        open={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onOpenChangePassword={() => {
          setIsSettingsOpen(false)
          navigate('/account')
        }}
      />
    </>
  )
}

export default SpatialSidebar
