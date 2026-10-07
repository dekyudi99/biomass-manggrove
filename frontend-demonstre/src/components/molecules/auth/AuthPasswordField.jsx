import { Input } from 'antd'

const AuthPasswordField = ({ label, name, autoComplete, help, placeholder = '*********' }) => (
  <label htmlFor={name} className="block space-y-1.5">
    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span>
    <Input.Password
      id={name}
      name={name}
      placeholder={placeholder}
      autoComplete={autoComplete}
      required
      minLength={10}
      maxLength={128}
      size="large"
      className="min-h-11 rounded-xl"
    />
    {help && <span className="block text-xs text-slate-500 dark:text-slate-400">{help}</span>}
  </label>
)

export default AuthPasswordField