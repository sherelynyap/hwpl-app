import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_STORAGE_KEY = 'hwpl-theme';

export const THEMES = {
  dark: {
    key: 'dark',
    label: 'Dark',
    background: '#111318',
    surface: '#1c1f26',
    overlay: 'rgba(0, 0, 0, 0.62)',
    border: '#2a2e38',
    text: '#ffffff',
    muted: '#9aa0a6',
    accent: '#6C5CE7',
    accentText: '#6C5CE7',
    danger: '#e74c3c',
    primaryButton: '#6C5CE7',
    primaryButtonText: '#ffffff',
    dangerButton: '#e74c3c',
    dangerButtonText: '#ffffff',
  },
  light: {
    key: 'light',
    label: 'Light',
    background: '#f4f5f7',
    surface: '#ffffff',
    overlay: 'rgba(23, 25, 31, 0.38)',
    border: '#d8dce3',
    text: '#17191f',
    muted: '#68707d',
    accent: '#5548c8',
    accentText: '#5548c8',
    danger: '#d64235',
    primaryButton: '#5548c8',
    primaryButtonText: '#ffffff',
    dangerButton: '#d64235',
    dangerButtonText: '#ffffff',
  },
  sage: {
    key: 'sage',
    label: 'Sage',
    background: '#F7F2EB',
    surface: '#fffaf4',
    overlay: 'rgba(41, 51, 38, 0.38)',
    border: '#d9d8c8',
    text: '#293326',
    muted: '#68705b',
    accent: '#8B9A6E',
    accentText: '#8B9A6E',
    danger: '#b84f43',
    primaryButton: '#8B9A6E',
    primaryButtonText: '#ffffff',
    dangerButton: '#b84f43',
    dangerButtonText: '#ffffff',
  },
  strawberryMatcha: {
    key: 'strawberryMatcha',
    label: 'Strawberry Matcha',
    background: '#9faa74',
    surface: '#d7dab3',
    overlay: 'rgba(41, 51, 38, 0.42)',
    border: '#7f895b',
    text: '#293326',
    muted: '#58624b',
    accent: '#f4c7d0',
    accentText: '#E75480',
    danger: '#b84f43',
    primaryButton: '#f4c7d0',
    primaryButtonText: '#402d32',
    dangerButton: '#b84f43',
    dangerButtonText: '#ffffff',
  },
  coral: {
    key: 'coral',
    label: 'Coral',
    background: '#5C4033',
    surface: '#704f40',
    overlay: 'rgba(0, 0, 0, 0.52)',
    border: '#9d7664',
    text: '#ffffff',
    muted: '#e8c9bc',
    accent: '#F08080',
    accentText: '#FFC0A8',
    danger: '#a83232',
    primaryButton: '#F08080',
    primaryButtonText: '#351f18',
    dangerButton: '#a83232',
    dangerButtonText: '#ffffff',
  },
};

const ThemeContext = createContext({
  theme: THEMES.dark,
  themeKey: 'dark',
  setThemeKey: () => {},
});

export function ThemeProvider({ children }) {
  const [themeKey, setThemeKeyState] = useState('dark');

  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY).then((storedKey) => {
      if (storedKey && THEMES[storedKey]) setThemeKeyState(storedKey);
    });
  }, []);

  const setThemeKey = async (nextKey) => {
    if (!THEMES[nextKey]) return;
    setThemeKeyState(nextKey);
    await AsyncStorage.setItem(THEME_STORAGE_KEY, nextKey);
  };

  return (
    <ThemeContext.Provider value={{ theme: THEMES[themeKey], themeKey, setThemeKey }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
