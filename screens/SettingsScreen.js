import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { resetDatabase } from '../db/database';

export default function SettingsScreen({ onReset }) {
  const [resetting, setResetting] = useState(false);

  const confirmReset = () => {
    Alert.alert(
      'Reset local data?',
      'This permanently deletes all ratings, items, and notes stored on this phone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset everything', style: 'destructive', onPress: handleReset },
      ]
    );
  };

  const handleReset = async () => {
    setResetting(true);
    try {
      await resetDatabase();
      onReset();
    } catch (error) {
      Alert.alert('Reset failed', error.message);
    } finally {
      setResetting(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      <Text style={styles.title}>Settings</Text>
      <Text style={styles.subtitle}>Manage data stored locally on this phone.</Text>
      <TouchableOpacity
        style={[styles.resetButton, resetting && styles.disabledButton]}
        onPress={confirmReset}
        disabled={resetting}
      >
        <Text style={styles.resetButtonText}>{resetting ? 'Resetting...' : 'Reset local database'}</Text>
      </TouchableOpacity>
      <Text style={styles.warning}>This removes all ratings, outstanding items, and notes.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111318', padding: 20 },
  content: { flexGrow: 1 },
  title: { color: '#fff', fontSize: 26, fontWeight: '700', marginBottom: 4 },
  subtitle: { color: '#9aa0a6', fontSize: 14, marginBottom: 28 },
  resetButton: {
    backgroundColor: '#e74c3c',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  resetButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  warning: { color: '#9aa0a6', fontSize: 12, lineHeight: 18, marginTop: 10 },
  disabledButton: { opacity: 0.5 },
});
