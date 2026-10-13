import React, { createContext, useContext, useEffect, useState } from 'react';
import { StyleSheet, Text as NativeText, TextInput as NativeTextInput } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFonts } from 'expo-font';
import Quicksand_400Regular from '@expo-google-fonts/quicksand/400Regular/Quicksand_400Regular.ttf';
import Quicksand_500Medium from '@expo-google-fonts/quicksand/500Medium/Quicksand_500Medium.ttf';
import Quicksand_600SemiBold from '@expo-google-fonts/quicksand/600SemiBold/Quicksand_600SemiBold.ttf';
import Quicksand_700Bold from '@expo-google-fonts/quicksand/700Bold/Quicksand_700Bold.ttf';
import Nunito_400Regular from '@expo-google-fonts/nunito/400Regular/Nunito_400Regular.ttf';
import Nunito_500Medium from '@expo-google-fonts/nunito/500Medium/Nunito_500Medium.ttf';
import Nunito_600SemiBold from '@expo-google-fonts/nunito/600SemiBold/Nunito_600SemiBold.ttf';
import Nunito_700Bold from '@expo-google-fonts/nunito/700Bold/Nunito_700Bold.ttf';
import Baloo2_400Regular from '@expo-google-fonts/baloo-2/400Regular/Baloo2_400Regular.ttf';
import Baloo2_500Medium from '@expo-google-fonts/baloo-2/500Medium/Baloo2_500Medium.ttf';
import Baloo2_600SemiBold from '@expo-google-fonts/baloo-2/600SemiBold/Baloo2_600SemiBold.ttf';
import Baloo2_700Bold from '@expo-google-fonts/baloo-2/700Bold/Baloo2_700Bold.ttf';

const THEME_STORAGE_KEY = 'hwpl-theme';
const FONT_STORAGE_KEY = 'hwpl-font';

export const FONT_OPTIONS = {
  system: { key: 'system', label: 'Default', fontFamily: null },
  quicksand: {
    key: 'quicksand',
    label: 'Quicksand',
    fontFamily: 'Quicksand_400Regular',
    fontFamilies: {
      400: 'Quicksand_400Regular',
      500: 'Quicksand_500Medium',
      600: 'Quicksand_600SemiBold',
      700: 'Quicksand_700Bold',
    },
  },
  nunito: {
    key: 'nunito',
    label: 'Nunito',
    fontFamily: 'Nunito_400Regular',
    fontFamilies: {
      400: 'Nunito_400Regular',
      500: 'Nunito_500Medium',
      600: 'Nunito_600SemiBold',
      700: 'Nunito_700Bold',
    },
  },
  baloo2: {
    key: 'baloo2',
    label: 'Baloo 2',
    fontFamily: 'Baloo2_400Regular',
    fontFamilies: {
      400: 'Baloo2_400Regular',
      500: 'Baloo2_500Medium',
      600: 'Baloo2_600SemiBold',
      700: 'Baloo2_700Bold',
    },
  },
};

const FONT_ASSETS = {
  Quicksand_400Regular,
  Quicksand_500Medium,
  Quicksand_600SemiBold,
  Quicksand_700Bold,
  Nunito_400Regular,
  Nunito_500Medium,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Baloo2_400Regular,
  Baloo2_500Medium,
  Baloo2_600SemiBold,
  Baloo2_700Bold,
};

function getFontFamilyForWeight(fontKey, fontWeight = '400') {
  const option = FONT_OPTIONS[fontKey];
  if (!option?.fontFamilies) return option?.fontFamily ?? null;
  const normalizedWeight = fontWeight === 'bold' ? 700 : Number(fontWeight) || 400;
  const weight = normalizedWeight >= 700 ? 700 : normalizedWeight >= 600 ? 600 : normalizedWeight >= 500 ? 500 : 400;
  return option.fontFamilies[weight];
}

export function isFontKey(fontKey) {
  return Object.prototype.hasOwnProperty.call(FONT_OPTIONS, fontKey);
}

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
  fontKey: 'system',
  fontFamily: null,
  getFontFamily: () => null,
  setFontKey: () => {},
});

export function ThemeProvider({ children }) {
  const [themeKey, setThemeKeyState] = useState('dark');
  const [fontKey, setFontKeyState] = useState('system');
  const [fontsLoaded] = useFonts(FONT_ASSETS);

  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY).then((storedKey) => {
      if (storedKey && THEMES[storedKey]) setThemeKeyState(storedKey);
    });
    AsyncStorage.getItem(FONT_STORAGE_KEY).then((storedKey) => {
      if (isFontKey(storedKey)) setFontKeyState(storedKey);
    });
  }, []);

  const setThemeKey = async (nextKey) => {
    if (!THEMES[nextKey]) return;
    setThemeKeyState(nextKey);
    await AsyncStorage.setItem(THEME_STORAGE_KEY, nextKey);
  };

  const setFontKey = async (nextKey) => {
    if (!isFontKey(nextKey)) return;
    setFontKeyState(nextKey);
    await AsyncStorage.setItem(FONT_STORAGE_KEY, nextKey);
  };
  const getFontFamily = (fontWeight) =>
    fontsLoaded ? getFontFamilyForWeight(fontKey, fontWeight) : null;

  return (
    <ThemeContext.Provider
      value={{
        theme: THEMES[themeKey],
        themeKey,
        setThemeKey,
        fontKey,
        fontFamily: getFontFamily('400'),
        getFontFamily,
        setFontKey,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

export function AppText({ style, ...props }) {
  const { getFontFamily } = useTheme();
  const fontWeight = StyleSheet.flatten(style)?.fontWeight;
  const fontFamily = getFontFamily(fontWeight);
  return <NativeText {...props} style={[fontFamily ? { fontFamily } : null, style]} />;
}

export function AppTextInput({ style, ...props }) {
  const { getFontFamily } = useTheme();
  const fontWeight = StyleSheet.flatten(style)?.fontWeight;
  const fontFamily = getFontFamily(fontWeight);
  return <NativeTextInput {...props} style={[fontFamily ? { fontFamily } : null, style]} />;
}
