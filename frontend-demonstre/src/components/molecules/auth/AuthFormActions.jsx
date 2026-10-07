import { Button } from 'antd'

const AuthFormActions = ({ loading, label }) => (
  <Button htmlType="submit" type="primary" size="large" block loading={loading} className="mt-2 h-12 rounded-xl bg-emerald-700 font-semibold hover:bg-emerald-800">
    {label}
  </Button>
)

export default AuthFormActions