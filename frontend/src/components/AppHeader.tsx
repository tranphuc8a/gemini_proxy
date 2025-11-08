import React from 'react';
import { Layout, Switch, Space, Typography, Dropdown } from 'antd';
import {
  BulbOutlined,
  BulbFilled,
  GlobalOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store/appStore';
import type { MenuProps } from 'antd';

const { Header: AntHeader } = Layout;
const { Text } = Typography;

interface AppHeaderProps {
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({ sidebarCollapsed, onToggleSidebar }) => {
  const { t, i18n } = useTranslation();
  const { theme, language, setTheme, setLanguage } = useAppStore();

  const handleThemeChange = (checked: boolean) => {
    const newTheme = checked ? 'dark' : 'light';
    setTheme(newTheme);
  };

  const handleLanguageChange = (lang: 'vi' | 'en') => {
    setLanguage(lang);
    i18n.changeLanguage(lang);
    localStorage.setItem('language', lang);
  };

  const languageMenuItems: MenuProps['items'] = [
    {
      key: 'vi',
      label: t('settings.vietnamese'),
      onClick: () => handleLanguageChange('vi'),
    },
    {
      key: 'en',
      label: t('settings.english'),
      onClick: () => handleLanguageChange('en'),
    },
  ];

  return (
    <AntHeader
      className="app-header"
      style={{
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: 'none',
      }}
    >
      <Space>
        {React.createElement(sidebarCollapsed ? MenuUnfoldOutlined : MenuFoldOutlined, {
          onClick: onToggleSidebar,
          style: { fontSize: '18px', cursor: 'pointer' },
        })}
        <Text
          strong
          style={{
            fontSize: '18px',
            color: theme === 'dark' ? '#fff' : '#000',
          }}
        >
          Gemini Chat
        </Text>
      </Space>

      <Space size="large">
        {/* Language Selector */}
        <Dropdown menu={{ items: languageMenuItems, selectedKeys: [language] }} trigger={['click']}>
          <Space style={{ cursor: 'pointer' }}>
            <GlobalOutlined style={{ fontSize: '16px', color: theme === 'dark' ? '#fff' : '#000' }} />
            <Text style={{ color: theme === 'dark' ? '#fff' : '#000' }}>
              {language.toUpperCase()}
            </Text>
          </Space>
        </Dropdown>

        {/* Theme Toggle */}
        <Space>
          {theme === 'light' ? <BulbOutlined /> : <BulbFilled />}
          <Switch
            checked={theme === 'dark'}
            onChange={handleThemeChange}
            checkedChildren={t('settings.dark')}
            unCheckedChildren={t('settings.light')}
          />
        </Space>
      </Space>
    </AntHeader>
  );
};
