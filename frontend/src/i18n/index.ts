import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import vi from './vi';
import en from './en';
import { readPersistedLanguage } from '../store/appStore';

// The language lives in the settings store; read it from there rather than from
// a second localStorage key that could drift out of sync with the menu.
i18n.use(initReactI18next).init({
  resources: {
    vi,
    en,
  },
  lng: readPersistedLanguage(),
  fallbackLng: 'vi',
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
