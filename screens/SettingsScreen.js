import React, { useEffect, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { readLatestBackup, writeLatestBackup } from '../backup';
import {
  resetDatabase,
  restoreDatabaseBackup,
  validateDatabaseBackup,
} from '../db/database';
import { THEMES, useTheme } from '../theme';

const USER_NAME_STORAGE_KEY = 'hwpl-user-name';
const THEME_STORAGE_KEY = 'hwpl-theme';

export default function SettingsScreen({ onReset }) {
  const { theme, themeKey, setThemeKey } = useTheme();
  const [userName, setUserName] = useState('');
  const [resetting, setResetting] = useState(false);
  const [backupBusy, setBackupBusy] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(USER_NAME_STORAGE_KEY).then((storedName) => {
      if (storedName) setUserName(storedName);
    });
  }, []);

  const handleNameChange = (nextName) => {
    setUserName(nextName);
    AsyncStorage.setItem(USER_NAME_STORAGE_KEY, nextName.trim());
  };

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
      await AsyncStorage.removeItem(USER_NAME_STORAGE_KEY);
      setUserName('');
      await writeLatestBackup({ userName: '', themeKey });
      onReset();
    } catch (error) {
      Alert.alert('Reset failed', error.message);
    } finally {
      setResetting(false);
    }
  };

  const handleExportBackup = async () => {
    setBackupBusy(true);
    try {
      const uri = await writeLatestBackup({ userName, themeKey });
      if (Platform.OS === 'android') {
        const permission = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (!permission.granted) return;

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const exportUri = await FileSystem.StorageAccessFramework.createFileAsync(
          permission.directoryUri,
          `hwpl-backup-${timestamp}`,
          'application/json'
        );
        const contents = await FileSystem.readAsStringAsync(uri);
        await FileSystem.StorageAccessFramework.writeAsStringAsync(exportUri, contents);
        Alert.alert('Backup saved', 'Your backup file was saved to the selected folder.');
        return;
      }
      if (!(await Sharing.isAvailableAsync())) {
        throw new Error('Sharing files is not available on this device.');
      }
      await Sharing.shareAsync(uri, {
        mimeType: 'application/json',
        dialogTitle: 'Export HWPL backup',
        UTI: 'public.json',
      });
    } catch (error) {
      Alert.alert('Backup export failed', error.message);
    } finally {
      setBackupBusy(false);
    }
  };

  const handleImportBackup = async () => {
    setBackupBusy(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;

      const backup = JSON.parse(await FileSystem.readAsStringAsync(result.assets[0].uri));
      validateDatabaseBackup(backup);
      if (
        !backup.preferences ||
        typeof backup.preferences.userName !== 'string' ||
        typeof backup.preferences.themeKey !== 'string' ||
        !THEMES[backup.preferences.themeKey]
      ) {
        throw new Error('The backup file is missing valid profile preferences.');
      }
      setBackupBusy(false);
      Alert.alert(
        'Replace local data?',
        'Importing this backup will replace all ratings, items, notes, birth chart details, and saved themes on this phone.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Import backup',
            style: 'destructive',
            onPress: async () => {
              setBackupBusy(true);
              try {
                await restoreDatabaseBackup(backup);
                await AsyncStorage.multiSet([
                  [USER_NAME_STORAGE_KEY, backup.preferences.userName],
                  [THEME_STORAGE_KEY, backup.preferences.themeKey],
                ]);
                setUserName(backup.preferences.userName);
                await setThemeKey(backup.preferences.themeKey);
                await writeLatestBackup(backup.preferences);
                Alert.alert('Backup imported', 'Your local data has been restored.');
              } catch (error) {
                Alert.alert('Backup import failed', error.message);
              } finally {
                setBackupBusy(false);
              }
            },
          },
        ]
      );
    } catch (error) {
      Alert.alert('Backup import failed', error.message);
    } finally {
      setBackupBusy(false);
    }
  };

  const handleRestoreLatestBackup = async () => {
    setBackupBusy(true);
    try {
      const backup = await readLatestBackup();
      if (
        !backup.preferences ||
        typeof backup.preferences.userName !== 'string' ||
        typeof backup.preferences.themeKey !== 'string' ||
        !THEMES[backup.preferences.themeKey]
      ) {
        throw new Error('The automatic backup is missing valid profile preferences.');
      }
      setBackupBusy(false);
      Alert.alert(
        'Restore latest backup?',
        'This will replace all current local data with the latest automatic backup.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Restore backup',
            style: 'destructive',
            onPress: async () => {
              setBackupBusy(true);
              try {
                await restoreDatabaseBackup(backup);
                await AsyncStorage.multiSet([
                  [USER_NAME_STORAGE_KEY, backup.preferences.userName],
                  [THEME_STORAGE_KEY, backup.preferences.themeKey],
                ]);
                setUserName(backup.preferences.userName);
                await setThemeKey(backup.preferences.themeKey);
                await writeLatestBackup(backup.preferences);
                Alert.alert('Backup restored', 'Your latest automatic backup has been restored.');
              } catch (error) {
                Alert.alert('Backup restore failed', error.message);
              } finally {
                setBackupBusy(false);
              }
            },
          },
        ]
      );
    } catch (error) {
      Alert.alert('Backup restore failed', error.message);
    } finally {
      setBackupBusy(false);
    }
  };

  const showRestoreOptions = () => {
    Alert.alert('Restore backup', 'Choose which backup to restore.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Latest automatic backup', onPress: handleRestoreLatestBackup },
      { text: 'Choose a backup file', onPress: handleImportBackup },
    ]);
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.title, { color: theme.text }]}>Settings</Text>
      <Text style={[styles.subtitle, { color: theme.muted }]}>Manage data stored locally on this phone.</Text>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>Your name</Text>
      <TextInput
        value={userName}
        onChangeText={handleNameChange}
        placeholder="Enter your name"
        placeholderTextColor={theme.muted}
        style={[styles.nameInput, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]}
        maxLength={40}
      />
      <Text style={[styles.sectionTitle, { color: theme.text }]}>App theme</Text>
      <View style={styles.themeGrid}>
        {Object.values(THEMES).map((option) => {
          const selected = option.key === themeKey;
          return (
            <TouchableOpacity
              key={option.key}
              style={[
                styles.themeOption,
                { backgroundColor: option.surface, borderColor: selected ? option.accent : theme.border },
                selected && styles.selectedTheme,
              ]}
              onPress={() => setThemeKey(option.key)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`${option.label} theme`}
            >
              <View style={[styles.swatch, { backgroundColor: option.accent }]} />
              <Text style={[styles.themeLabel, { color: option.text }]}>{option.label}</Text>
              {selected && <Text style={[styles.selectedText, { color: option.accent }]}>Selected</Text>}
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>Data backup</Text>
      <View style={styles.backupActions}>
        <TouchableOpacity
          style={[styles.backupButton, { backgroundColor: theme.primaryButton }, backupBusy && styles.disabledButton]}
          onPress={handleExportBackup}
          disabled={backupBusy}
          accessibilityRole="button"
        >
          <View style={styles.backupButtonContent}>
            <MaterialCommunityIcons name="database-export" size={20} color={theme.primaryButtonText} />
            <Text style={[styles.backupButtonText, { color: theme.primaryButtonText }]}>Backup</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.backupButton, { backgroundColor: theme.surface, borderColor: theme.border }, backupBusy && styles.disabledButton]}
          onPress={showRestoreOptions}
          disabled={backupBusy}
          accessibilityRole="button"
        >
          <View style={styles.backupButtonContent}>
            <MaterialCommunityIcons name="restore" size={20} color={theme.text} />
            <Text style={[styles.backupButtonText, { color: theme.text }]}>Restore</Text>
          </View>
        </TouchableOpacity>
      </View>
      
      <TouchableOpacity
        style={[styles.resetButton, { backgroundColor: theme.dangerButton }, resetting && styles.disabledButton]}
        onPress={confirmReset}
        disabled={resetting}
      >
        <Text style={[styles.resetButtonText, { color: theme.dangerButtonText }]}>{resetting ? 'Resetting...' : 'Reset local database'}</Text>
      </TouchableOpacity>
      <Text style={[styles.warning, { color: theme.muted }]}>This removes all ratings, outstanding items, and notes.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111318', padding: 20 },
  content: { flexGrow: 1 },
  title: { color: '#fff', fontSize: 26, fontWeight: '700', marginBottom: 4 },
  subtitle: { color: '#9aa0a6', fontSize: 14, marginBottom: 28 },
  sectionTitle: { fontSize: 17, fontWeight: '700', marginBottom: 12 },
  nameInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, marginBottom: 28 },
  themeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 28 },
  themeOption: {
    width: '48%',
    minHeight: 86,
    borderWidth: 2,
    borderRadius: 12,
    padding: 12,
  },
  selectedTheme: { borderWidth: 3 },
  swatch: { width: 24, height: 24, borderRadius: 12, marginBottom: 8 },
  themeLabel: { fontSize: 14, fontWeight: '700' },
  selectedText: { fontSize: 11, fontWeight: '600', marginTop: 3 },
  backupActions: { flexDirection: 'row', gap: 10, marginBottom: 28 },
  backupButton: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  backupButtonText: { fontSize: 14, fontWeight: '700', textAlign: 'center' },
  backupButtonContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  backupNote: { fontSize: 12, lineHeight: 18, marginTop: 8, marginBottom: 24 },
  resetButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  resetButtonText: { fontSize: 16, fontWeight: '700' },
  warning: { color: '#9aa0a6', fontSize: 12, lineHeight: 18, marginTop: 10 },
  disabledButton: { opacity: 0.5 },
});
