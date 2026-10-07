import { Slider } from 'antd'

const OPACITY_MIN = 0.1
const OPACITY_MAX = 1
const OPACITY_STEP = 0.05

const OpacityControl = ({ value, onChange, label }) => (
  <div className="mt-2 flex items-center gap-2 border-t border-emerald-100 pt-2">
    <span className="text-[10px] font-medium text-emerald-800">{label}:</span>
    <Slider
      min={OPACITY_MIN}
      max={OPACITY_MAX}
      step={OPACITY_STEP}
      value={value}
      onChange={onChange}
      className="m-0 flex-1"
    />
    <span className="w-8 text-right font-mono text-[10px] text-gray-500">
      {Math.round(value * 100)}%
    </span>
  </div>
)

export default OpacityControl