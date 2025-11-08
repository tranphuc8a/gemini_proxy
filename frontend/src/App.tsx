import { useEffect } from 'react';
import { Layout, ConfigProvider, theme as antdTheme } from 'antd';
import { ToastContainer } from 'react-toastify';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { AppHeader } from './components/AppHeader';
import { useAppStore } from './store/appStore';
import { useLoadConversations } from './hooks/useLoadConversations';
import 'react-toastify/dist/ReactToastify.css';
import './App.css';
import './i18n';

const { defaultAlgorithm, darkAlgorithm } = antdTheme;

function App() {
  const { theme, sidebarCollapsed, toggleSidebar, setSidebarCollapsed } = useAppStore();
  
  // Load conversations on mount
  useLoadConversations();

  // Apply theme to body
  useEffect(() => {
    document.body.style.backgroundColor = theme === 'dark' ? '#141414' : '#f0f2f5';
    // Add/remove dark class for CSS styling
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  return (
    <ErrorBoundary>
      <ConfigProvider
        theme={{
          algorithm: theme === 'dark' ? darkAlgorithm : defaultAlgorithm,
          token: {
            colorPrimary: '#1890ff',
          },
        }}
      >
        <Layout style={{ minHeight: '100vh' }}>
          <Sidebar collapsed={sidebarCollapsed} onCollapse={setSidebarCollapsed} />
          <Layout>
            <AppHeader sidebarCollapsed={sidebarCollapsed} onToggleSidebar={toggleSidebar} />
            <ChatArea />
          </Layout>
        </Layout>
        <ToastContainer
          position="top-right"
          autoClose={3000}
          hideProgressBar={false}
          newestOnTop
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme={theme === 'dark' ? 'dark' : 'light'}
        />
      </ConfigProvider>
    </ErrorBoundary>
  );
}

export default App;
