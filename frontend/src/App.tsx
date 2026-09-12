import { useEffect } from 'react';
import { Layout, ConfigProvider, theme as antdTheme, App as AntdApp } from 'antd';
import { ToastContainer } from 'react-toastify';
import { useTranslation } from 'react-i18next';
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
  const { theme, language, sidebarCollapsed, toggleSidebar, setSidebarCollapsed } = useAppStore();
  const { i18n } = useTranslation();

  // Load conversations on mount
  useLoadConversations();

  // Apply theme to the document. The class drives the CSS in App.css; the
  // color-scheme property gets native widgets and scrollbars to match.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.style.colorScheme = theme;
    document.body.style.backgroundColor = theme === 'dark' ? '#141414' : '#f0f2f5';
  }, [theme]);

  // Keep i18n and the document language in step with the stored preference,
  // including when it is restored from a previous session.
  useEffect(() => {
    if (i18n.language !== language) i18n.changeLanguage(language);
    document.documentElement.lang = language;
  }, [i18n, language]);

  return (
    <ErrorBoundary>
      <ConfigProvider
        theme={{
          algorithm: theme === 'dark' ? darkAlgorithm : defaultAlgorithm,
          token: {
            colorPrimary: '#1890ff',
            borderRadius: 8,
          },
        }}
      >
        <AntdApp>
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
        </AntdApp>
      </ConfigProvider>
    </ErrorBoundary>
  );
}

export default App;
