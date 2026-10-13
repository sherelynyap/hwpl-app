import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Modal,
  TouchableOpacity,
  Alert,
  Platform,
  AppState,
  Dimensions,
  Animated,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as NavigationBar from 'expo-navigation-bar';

import { getDb, getTodayRatings } from './db/database';
import { ensureWeeklyBackup } from './backup';
import {
  registerForNotificationsAsync,
  scheduleDailyRatingReminder,
  cancelDailyRatingReminder,
  scheduleMidweekReminder,
} from './notifications';

import TabBar from './components/TabBar';
import RatingScreen from './screens/RatingScreen';
import ItemsScreen from './screens/ItemsScreen';
import ReportsScreen from './screens/ReportsScreen';
import AstrologyScreen from './screens/AstrologyScreen';
import SettingsScreen from './screens/SettingsScreen';
import {
  AppText as Text,
  AppTextInput as TextInput,
  isFontKey,
  THEMES,
  ThemeProvider,
  useTheme,
} from './theme';

const USER_NAME_STORAGE_KEY = 'hwpl-user-name';

function AppContent() {
  const { theme, themeKey, getFontFamily } = useTheme();
  const welcomeWave = React.useRef(new Animated.Value(0)).current;
  const [ready, setReady] = useState(false);
  const [activeTab, setActiveTab] = useState('reports');
  const [ratingPromptVisible, setRatingPromptVisible] = useState(false);
  const [shouldPromptRating, setShouldPromptRating] = useState(false);
  const [welcomeVisible, setWelcomeVisible] = useState(false);
  const [usernamePromptVisible, setUsernamePromptVisible] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [userName, setUserName] = useState('');
  const [ratingModalHeight, setRatingModalHeight] = useState('75%');

  const handleSaveUserName = async () => {
    const trimmedName = nameInput.trim();
    if (!trimmedName) return;

    try {
      await AsyncStorage.setItem(USER_NAME_STORAGE_KEY, trimmedName);
      setUserName(trimmedName);
      setUsernamePromptVisible(false);
    } catch (error) {
      Alert.alert('Could not save your name', error.message);
    }
  };

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    NavigationBar.setVisibilityAsync('hidden').catch(() => {});
  }, []);

  useEffect(() => {
    (async () => {
      await getDb(); // creates tables on first run
      const todayRatings = await getTodayRatings();
      const needsRating = todayRatings.length === 0;
      setShouldPromptRating(needsRating);
      const [storedNameEntry, storedThemeEntry, storedFontEntry] = await AsyncStorage.multiGet([
        USER_NAME_STORAGE_KEY,
        'hwpl-theme',
        'hwpl-font',
      ]);
      const storedName = storedNameEntry[1];
      const storedTheme = storedThemeEntry[1];
      const storedFont = storedFontEntry[1];
      if (storedName?.trim()) setUserName(storedName.trim());
      else setUsernamePromptVisible(true);
      try {
        await ensureWeeklyBackup({
          userName: storedName?.trim() ?? '',
          themeKey: THEMES[storedTheme] ? storedTheme : 'dark',
          fontKey: isFontKey(storedFont) ? storedFont : 'system',
        });
      } catch (error) {
        console.warn('Automatic backup failed:', error.message);
      }
      const lastResponse = await Notifications.getLastNotificationResponseAsync();
      const openedFromRatingReminder =
        lastResponse?.notification?.request?.identifier === 'daily-hwpl-rating';
      if (openedFromRatingReminder && needsRating) {
        setRatingPromptVisible(true);
      }
      const granted = await registerForNotificationsAsync();
      if (granted) {
        if (needsRating) {
          await scheduleDailyRatingReminder(18, 0); // 6pm daily HWPL prompt
        } else {
          await cancelDailyRatingReminder();
        }
        await scheduleMidweekReminder(9, 0); // Wednesday 9am outstanding-items check
      }
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    if (!ready) return undefined;
    const checkBackup = async () => {
      try {
        const [storedName, storedTheme, storedFont] = await AsyncStorage.multiGet([
          USER_NAME_STORAGE_KEY,
          'hwpl-theme',
          'hwpl-font',
        ]);
        await ensureWeeklyBackup({
          userName: storedName[1]?.trim() ?? '',
          themeKey: THEMES[storedTheme[1]] ? storedTheme[1] : 'dark',
          fontKey: isFontKey(storedFont[1]) ? storedFont[1] : 'system',
        });
      } catch (error) {
        console.warn('Automatic backup failed:', error.message);
      }
    };
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkBackup();
    });
    const interval = setInterval(checkBackup, 60 * 60 * 1000);
    return () => {
      subscription.remove();
      clearInterval(interval);
    };
  }, [ready]);

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      if (response.notification.request.identifier === 'daily-hwpl-rating') {
        setRatingPromptVisible(true);
      }
    });

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!ready || usernamePromptVisible) return undefined;
    setWelcomeVisible(true);
    welcomeWave.setValue(0);
    Animated.sequence([
      Animated.timing(welcomeWave, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.timing(welcomeWave, { toValue: -1, duration: 180, useNativeDriver: true }),
      Animated.timing(welcomeWave, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start();
    const timer = setTimeout(() => {
      setWelcomeVisible(false);
      if (shouldPromptRating) setRatingPromptVisible(true);
    }, 3000);
    return () => {
      clearTimeout(timer);
      welcomeWave.stopAnimation();
    };
  }, [ready, shouldPromptRating, usernamePromptVisible, welcomeWave]);

  if (!ready) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
        <StatusBar hidden style={themeKey === 'dark' ? 'light' : 'dark'} />
        {/* Giving each screen a `key` tied to the active tab remounts it on
            every switch, so its data reloads without needing React
            Navigation's focus-effect hooks. */}
        <View style={{ flex: 1 }}>
          {activeTab === 'rating' && <RatingScreen key="rating" />}
          {activeTab === 'astro' && <AstrologyScreen key="astro" />}
          {activeTab === 'items' && <ItemsScreen key="items" />}
          {activeTab === 'reports' && <ReportsScreen key="reports" />}
          {activeTab === 'settings' && (
            <SettingsScreen
              key="settings"
              onReset={async () => {
                setActiveTab('reports');
                setRatingPromptVisible(true);
                await scheduleDailyRatingReminder(18, 0);
              }}
            />
          )}
        </View>
        <TabBar active={activeTab} onChange={setActiveTab} />
        <Modal
          visible={usernamePromptVisible}
          transparent
          animationType="fade"
          onRequestClose={() => null}
        >
          <View style={[styles.welcomeModalBackdrop, { backgroundColor: theme.overlay }]}>
            <View style={[styles.namePromptCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.namePromptTitle, { color: theme.text }]}>Welcome</Text>
              <Text style={[styles.namePromptSubtitle, { color: theme.muted }]}>What should we call you?</Text>
              <TextInput
                value={nameInput}
                onChangeText={setNameInput}
                placeholder="Your name"
                placeholderTextColor={theme.muted}
                style={[styles.namePromptInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
                autoFocus
                autoCapitalize="words"
                maxLength={40}
                returnKeyType="done"
                onSubmitEditing={handleSaveUserName}
                accessibilityLabel="Your name"
              />
              <TouchableOpacity
                style={[styles.namePromptButton, { backgroundColor: theme.primaryButton }, !nameInput.trim() && styles.disabledButton]}
                onPress={handleSaveUserName}
                disabled={!nameInput.trim()}
                accessibilityRole="button"
              >
                <Text style={[styles.namePromptButtonText, { color: theme.primaryButtonText }]}>Continue</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
        <Modal visible={welcomeVisible} transparent animationType="fade">
          <View style={[styles.welcomeModalBackdrop, { backgroundColor: theme.overlay }]}>
            <View
              style={[
                styles.welcomeModalCard,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.border,
                },
              ]}
            >
              <Animated.Text
                style={[
                  styles.welcomeText,
                  { color: theme.text, fontFamily: getFontFamily('700') },
                  {
                    transform: [
                      { translateX: welcomeWave.interpolate({ inputRange: [-1, 1], outputRange: [-8, 8] }) },
                      { rotate: welcomeWave.interpolate({ inputRange: [-1, 1], outputRange: ['-2deg', '2deg'] }) },
                    ],
                  },
                ]}
              >
                Welcome {userName}
              </Animated.Text>
            </View>
          </View>
        </Modal>
        <Modal
          visible={ratingPromptVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setRatingPromptVisible(false)}
        >
          <View style={styles.ratingModalBackdrop}>
            <View style={[styles.ratingModalCard, { height: ratingModalHeight, backgroundColor: theme.background }]}> 
              <TouchableOpacity
                style={styles.ratingModalClose}
                onPress={() => setRatingPromptVisible(false)}
                accessibilityLabel="Close daily rating"
              >
                <Text style={styles.ratingModalCloseText}>x</Text>
              </TouchableOpacity>
              <RatingScreen
                onContentHeightChange={(contentHeight) => {
                  const maxHeight = Dimensions.get('window').height * 0.75;
                  setRatingModalHeight(Math.min(contentHeight, maxHeight));
                }}
                onSaved={async () => {
                  await cancelDailyRatingReminder();
                  setRatingPromptVisible(false);
                }}
              />
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111318' },
  loading: { flex: 1, backgroundColor: '#111318', alignItems: 'center', justifyContent: 'center' },
  ratingModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  welcomeModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  welcomeModalCard: {
    minWidth: 220,
    maxWidth: '90%',
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 28,
    paddingVertical: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 8,
  },
  namePromptCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 18,
    borderWidth: 1,
    padding: 24,
  },
  namePromptTitle: { fontSize: 22, fontWeight: '700', marginBottom: 6 },
  namePromptSubtitle: { fontSize: 15, marginBottom: 18 },
  namePromptInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 16, marginBottom: 16 },
  namePromptButton: { borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  namePromptButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  disabledButton: { opacity: 0.5 },
  welcomeText: { fontSize: 22, fontWeight: '700' },
  ratingModalCard: {
    width: '100%',
    backgroundColor: '#111318',
    borderRadius: 18,
    overflow: 'hidden',
  },
  ratingModalClose: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 1,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingModalCloseText: { color: '#fff', fontSize: 18, fontWeight: '700' },
});
