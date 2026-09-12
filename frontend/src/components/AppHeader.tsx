import React from 'react';
import { Layout, Space, Typography, Dropdown, Button, Tooltip } from 'antd';
import {
  BulbOutlined,
  BulbFilled,
  GlobalOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useAppStore, type Language } from '../store/appStore';
import type { MenuProps } from 'antd';

const { Header: AntHeader } = Layout;
const { Text } = Typography;

interface AppHeaderProps {
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({ sidebarCollapsed, onToggleSidebar }) => {
  const { t, i18n } = useTranslation();
  const { theme, language, toggleTheme, setLanguage } = useAppStore();

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang);
    i18n.changeLanguage(lang);
  };

  const languageMenuItems: MenuProps['items'] = [
    { key: 'vi', label: t('settings.vietnamese'), onClick: () => handleLanguageChange('vi') },
    { key: 'en', label: t('settings.english'), onClick: () => handleLanguageChange('en') },
  ];

  return (
    <AntHeader className="app-header">
      <Space>
        <Button
          type="text"
          className="app-header-btn"
          onClick={onToggleSidebar}
          icon={sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          aria-label={t('sidebar.toggle')}
          aria-expanded={!sidebarCollapsed}
        />
        <Text strong className="app-header-title">
          Gemini Chat
        </Text>
      </Space>

      <Space size="middle">
        <Dropdown menu={{ items: languageMenuItems, selectedKeys: [language] }} trigger={['click']}>
          <Button type="text" className="app-header-btn" aria-label={t('settings.language')}>
            <Space size={4}>
              <GlobalOutlined />
              <span>{language.toUpperCase()}</span>
            </Space>
          </Button>
        </Dropdown>

        <Tooltip title={theme === 'dark' ? t('settings.light') : t('settings.dark')}>
          <Button
            type="text"
            className="app-header-btn"
            onClick={toggleTheme}
            icon={theme === 'dark' ? <BulbFilled /> : <BulbOutlined />}
            aria-label={t('settings.theme')}
            aria-pressed={theme === 'dark'}
          />
        </Tooltip>
      </Space>
    </AntHeader>
  );
};
