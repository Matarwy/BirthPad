import WebApp from '@twa-dev/sdk';
import type { TelegramUser } from '../types';

export interface TelegramSession {
  user?: TelegramUser;
  initData: string;
  colorScheme: string;
  isTelegram: boolean;
}

export const initTelegram = (): TelegramSession => {
  try {
    WebApp.ready();
    WebApp.expand();
    return {
      user: WebApp.initDataUnsafe?.user,
      initData: WebApp.initData,
      colorScheme: WebApp.colorScheme,
      isTelegram: true,
    };
  } catch {
    return {
      user: undefined,
      initData: 'dev-init-data',
      colorScheme: 'dark',
      isTelegram: false,
    };
  }
};

export const bindThemeSync = (onTheme: (theme: string) => void) => {
  const handler = () => onTheme(WebApp.colorScheme);
  WebApp.onEvent('themeChanged', handler);
  return () => {
    WebApp.offEvent('themeChanged', handler);
  };
};
