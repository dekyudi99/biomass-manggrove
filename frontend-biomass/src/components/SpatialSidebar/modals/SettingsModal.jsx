import { useState, useEffect } from 'react'
import { Modal, Select, Button, message } from 'antd'
import { CheckCircleOutlined, CloseCircleOutlined, ReloadOutlined } from '@ant-design/icons'
import axiosClient from '../../../api/AxiosClient'
import { useLanguage } from '../../../context/LanguageContext'

const SettingsModal = ({ open, onClose }) => {
  const { language, setLanguage, t } = useLanguage()

  const [isChecking, setIsChecking] = useState(false)
  const [backendStatus, setBackendStatus] = useState(null)

  const checkConnection = async () => {
    setIsChecking(true)
    try {
      const res = await axiosClient.get('/health')
      if (res.data?.status === 'connected') {
        setBackendStatus({ success: true, url: res.data?.astragis_url })
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

  useEffect(() => {
    if (open) {
      checkConnection()
    }
  }, [open])

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width="min(480px, 95vw)"
      destroyOnClose
      title={<span className="font-bold text-gray-800 text-sm">⚙️ {t('settingsTitle')}</span>}
    >
      <div className="space-y-4 py-2 text-xs">
        {/* Pilihan Bahasa */}
        <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200">
          <span className="font-semibold text-emerald-900 block mb-1.5">
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

        {/* Info Koneksi S2S Backend */}
        <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-gray-700">
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
                  ? `${t('s2sEndpoint')} ${backendStatus.url}`
                  : backendStatus?.error || t('checkingConnection')}
              </p>
            </div>
          </div>

          <p className="text-[10px] text-gray-400 italic">
            {t('s2sSecurityNote')}
          </p>
        </div>

        {/* Footer */}
        <div className="pt-2 flex justify-end items-center border-t border-gray-100">
          <Button
            size="small"
            type="primary"
            onClick={onClose}
            className="bg-emerald-600 hover:bg-emerald-700 border-none text-xs"
          >
            {t('close')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default SettingsModal
