import { Modal, Input } from 'antd'
import { BookmarkPlusIcon } from '../atoms/StyleIcons'

const SaveCustomRampModal = ({
  open,
  onCancel,
  onSave,
  classes,
  rampName,
  setRampName,
}) => {
  return (
    <Modal
      title={
        <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
          <BookmarkPlusIcon className="w-4 h-4 text-teal-600" />
          Simpan Color Ramp Custom
        </div>
      }
      open={open}
      onCancel={onCancel}
      onOk={onSave}
      okText="Simpan"
      cancelText="Batal"
      okButtonProps={{ className: 'bg-teal-600 hover:bg-teal-500' }}
      centered
      width={420}
    >
      <div className="py-2 space-y-3">
        <p className="text-xs text-slate-500">
          Warna-warna dari susunan kelas saat ini ({classes.length} warna) akan disimpan ke daftar Color Ramp Anda:
        </p>

        {/* Preview Warna yang akan disimpan */}
        <div className="flex h-3.5 w-full rounded-md overflow-hidden shadow-inner border border-slate-200">
          {classes.map((c, i) => (
            <div key={i} style={{ backgroundColor: c.color, flex: 1 }} />
          ))}
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Nama Color Ramp:
          </label>
          <Input
            placeholder="Contoh: Gradasi Bahaya Banjir..."
            value={rampName}
            onChange={(e) => setRampName(e.target.value)}
            onPressEnter={onSave}
            maxLength={40}
            autoFocus
          />
        </div>
      </div>
    </Modal>
  )
}

export default SaveCustomRampModal
