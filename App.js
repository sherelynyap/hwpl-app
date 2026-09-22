import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Modal, TouchableOpacity, Text } from 'react-native';
import * as Notifications from 'expo-notifications';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { getDb, getTodayRatings } from './db/database';
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
import SettingsScreen from './screens/SettingsScreen';

export default function App() {
  const [ready, setReady] = useState(false);
  const [activeTab, setActiveTab] = useState('reports');
  const [ratingPromptVisible, setRatingPromptVisible] = useState(false);
  const [shouldPromptRating, setShouldPromptRating] = useState(false);

  useEffect(() => {
    (async () => {
      await getDb(); // creates tables on first run
      const todayRatings = await getTodayRatings();
      const needsRating = todayRatings.length === 0;
      setShouldPromptRating(needsRating);
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
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      if (response.notification.request.identifier === 'daily-hwpl-rating') {
        setRatingPromptVisible(true);
      }
    });

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!ready || !shouldPromptRating) return undefined;
    const timer = setTimeout(() => setRatingPromptVisible(true), 3000);
    return () => clearTimeout(timer);
  }, [ready, shouldPromptRating]);

  if (!ready) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#6C5CE7" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar style="light" />
        {/* Giving each screen a `key` tied to the active tab remounts it on
            every switch, so its data reloads without needing React
            Navigation's focus-effect hooks. */}
        <View style={{ flex: 1 }}>
          {activeTab === 'rating' && <RatingScreen key="rating" />}
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
          visible={ratingPromptVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setRatingPromptVisible(false)}
        >
          <View style={styles.ratingModalBackdrop}>
            <View style={styles.ratingModalCard}>
              <TouchableOpacity
                style={styles.ratingModalClose}
                onPress={() => setRatingPromptVisible(false)}
                accessibilityLabel="Close daily rating"
              >
                <Text style={styles.ratingModalCloseText}>x</Text>
              </TouchableOpacity>
              <RatingScreen
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
  ratingModalCard: {
    width: '100%',
    height: '75%',
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
    backgroundColor: '#2a2e38',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingModalCloseText: { color: '#fff', fontSize: 18, fontWeight: '700' },
});
