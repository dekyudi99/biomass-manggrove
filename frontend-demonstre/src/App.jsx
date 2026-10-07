import { App as AntdApp, ConfigProvider, theme as antdTheme } from 'antd'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'
import router from './routes/Routes.jsx'
import { LanguageProvider } from './context/LanguageContext'
import useTheme from './hooks/useTheme'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

const App = () => {
  const { isDark } = useTheme()

  return (
    <ConfigProvider
      theme={{
        algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        token: {
          colorPrimary: '#047857',
          colorBgBase: isDark ? '#0f172a' : '#ffffff',
          colorTextBase: isDark ? '#e2e8f0' : '#1e293b',
          borderRadius: 10,
        },
      }}
    >
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          <AntdApp>
            <RouterProvider router={router} />
          </AntdApp>
        </LanguageProvider>
      </QueryClientProvider>
    </ConfigProvider>
  )
}

export default App