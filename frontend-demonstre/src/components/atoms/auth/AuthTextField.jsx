import { Input } from 'antd'

const AuthTextField = ({ label, name, type = 'text', placeholder, autoComplete, inputMode, maxLength, defaultValue, onChange }) => (
  <label htmlFor={name} className="block space-y-1.5">
    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span>
    <Input
      id={name}
      name={name}
      type={type}
      placeholder={placeholder || (type === 'password' ? '*********' : undefined)}
      autoComplete={autoComplete}
      inputMode={inputMode}
      maxLength={maxLength}
      defaultValue={defaultValue}
      onChange={onChange}
      required
      size="large"
      className="min-h-11 rounded-xl"
    />
  </label>
)

export default AuthTextField