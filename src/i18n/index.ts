import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { ptBR } from './locales/pt-BR';
import { enUS } from './locales/en-US';

export const LANGS = ['pt-BR', 'en-US'] as const;
export type Lang = (typeof LANGS)[number];

const STORAGE_KEY = 'arden-lang';

function initialLang(): Lang {
  if (typeof localStorage !== 'undefined') {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'pt-BR' || stored === 'en-US') return stored;
  }
  return 'pt-BR';
}

void i18n.use(initReactI18next).init({
  resources: {
    'pt-BR': ptBR,
    'en-US': enUS,
  },
  lng: initialLang(),
  fallbackLng: 'pt-BR',
  interpolation: { escapeValue: false },
});

export function setLang(lang: Lang): void {
  void i18n.changeLanguage(lang);
  if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, lang);
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
}

export default i18n;
