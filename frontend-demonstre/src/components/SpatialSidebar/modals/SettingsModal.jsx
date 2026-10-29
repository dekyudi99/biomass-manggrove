import { useState } from 'react'
import { Modal, Select, Button, message } from 'antd'
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  LockOutlined,
  ReloadOutlined,
  LogoutOutlined,
} from '@ant-design/icons'
import axiosClient from '../../../api/AxiosClient'
import { useLanguage } from '../../../context/LanguageContext'
import ThemeToggle from '../../atoms/ThemeToggle/ThemeToggle'
import { getAuthCopy } from '../../../utils/authI18n'
import useAuth from '../../../hooks/useAuth'

const SettingsModal = ({ open, onClose, onOpenChangePassword }) => {
  const { language, setLanguage, t } = useLanguage()
  const authCopy = getAuthCopy(language)
  const { logout } = useAuth()
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      if (onClose) onClose()
      await logout()
    } catch (err) {
      console.warn('Logout error:', err)
    } finally {
      setIsLoggingOut(false)
    }
  }

  const [isChecking, setIsChecking] = useState(false)
  const [backendStatus, setBackendStatus] = useState(null)

  const checkConnection = async () => {
    setIsChecking(true)
    try {
      const res = await axiosClient.get('/health')
      if (res.data?.status === 'connected') {
        setBackendStatus({
          success: true,
          url: res.data?.geoserver_microservice_url,
          responseTimeMs: res.data?.response_time_ms,
        })
      } else {
        setBackendStatus({
          success: false,
          error: res.data?.error || t('backendNoResponse'),
        })
      }
    } catch (err) {
      setBackendStatus({
        success: false,
        error: err.response?.data?.detail || err.message || t('failedContactBackend'),
      })
    } finally {
      setIsChecking(false)
    }
  }

  return (
    <Modal
      className="settings-modal"
      open={open}
      afterOpenChange={(isOpen) => {
        if (isOpen) checkConnection()
      }}
      onCancel={onClose}
      footer={null}
      width="min(480px, 95vw)"
      destroyOnClose
      title={<span className="settings-modal-title text-sm font-bold text-gray-800 dark:text-slate-100">⚙️ {t('settingsTitle')}</span>}
    >
      <div className="space-y-4 py-2 text-xs">
        <div className="settings-theme-row flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-slate-700 dark:bg-slate-800">
          <span className="settings-theme-label font-semibold text-gray-700">{t('appearanceTheme')}</span>
          <ThemeToggle
            lightLabel={t('lightMode')}
            darkLabel={t('darkMode')}
            className="settings-theme-toggle min-h-9 rounded-lg px-2.5 text-xs"
          />
        </div>

        {/* Pilihan Bahasa */}
        <div className="settings-language-section p-3 bg-emerald-50/60 rounded-xl border border-emerald-200 dark:border-emerald-900 dark:bg-emerald-950/40">
          <span className="settings-language-label font-semibold text-emerald-900 block mb-1.5 dark:text-emerald-200">
            🌐 {t('langSelect')}:
          </span>
          <Select
            value={language}
            onChange={(val) => {
              setLanguage(val)
              message.success(t('save') + ' OK!')
            }}
            className="w-full text-xs"
            options={[
              { value: 'id', label: '🇮🇩 ' + t('langId') },
              { value: 'en', label: '🇬🇧 ' + t('langEn') },
              { value: 'th', label: '🇹🇭 ' + t('langTh') },
            ]}
          />
        </div>

        {/* Status koneksi dan waktu respons GeoServer Microservice. */}
        <div className="settings-status-section p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-2 dark:border-slate-700 dark:bg-slate-800">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-gray-700 dark:text-slate-200">
              🛰️ {t('backendStatusTitle')}
            </span>
            <Button
              size="small"
              icon={<ReloadOutlined spin={isChecking} />}
              onClick={checkConnection}
              className="text-xs text-gray-500 hover:text-emerald-700"
            >
              {t('checkStatus')}
            </Button>
          </div>

          <div
            className={`p-2.5 rounded-lg text-xs flex items-center gap-2 ${
              backendStatus?.success
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-amber-50 text-amber-900 border border-amber-200'
            }`}
          >
            {backendStatus?.success ? (
              <CheckCircleOutlined className="text-green-600 text-sm flex-shrink-0" />
            ) : (
              <CloseCircleOutlined className="text-amber-600 text-sm flex-shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <p className="font-semibold truncate">
                {backendStatus?.success
                  ? t('backendConnected')
                  : t('backendNotConnected')}
              </p>
              <p className="text-[10px] text-gray-500 font-mono truncate">
                {backendStatus?.success
                  ? `${t('geoserverMicroserviceEndpoint')} ${backendStatus.url}`
                  : backendStatus?.error || t('checkingConnection')}
              </p>
              {backendStatus?.success && Number.isFinite(backendStatus.responseTimeMs) && (
                <p className="text-[10px] text-gray-500 dark:text-slate-400">
                  {t('geoserverResponseTime').replace('{ms}', backendStatus.responseTimeMs)}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-2 flex justify-between items-center border-t border-gray-100 dark:border-slate-700">
          {import.meta.env.VITE_AUTH_LOCAL_ENABLED === 'true' ? (
            <Button
              icon={<LockOutlined />}
              onClick={onOpenChangePassword}
              className="min-h-9 rounded-lg border-emerald-700 bg-emerald-700 px-3 text-sm font-semibold text-white shadow-sm hover:border-emerald-800 hover:bg-emerald-800 hover:text-white"
            >
              {authCopy.changePassword}
            </Button>
          ) : <div />}
          <Button
            danger
            icon={<LogoutOutlined />}
            loading={isLoggingOut}
            onClick={handleLogout}
            className="min-h-9 rounded-lg px-3 text-sm font-semibold shadow-sm"
          >
            {authCopy.logout}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default SettingsModal
