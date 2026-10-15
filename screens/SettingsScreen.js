import React, { useEffect, useState } from 'react';
import { Alert, Modal, Platform, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
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
import {
  AppText as Text,
  AppTextInput as TextInput,
  FONT_OPTIONS,
  isFontKey,
  THEMES,
  useTheme,
} from '../theme';

const USER_NAME_STORAGE_KEY = 'hwpl-user-name';
const THEME_STORAGE_KEY = 'hwpl-theme';
const FONT_STORAGE_KEY = 'hwpl-font';

export default function SettingsScreen({ onReset }) {
  const { theme, themeKey, setThemeKey, fontKey, setFontKey } = useTheme();
  const [userName, setUserName] = useState('');
  const [resetting, setResetting] = useState(false);
  const [backupBusy, setBackupBusy] = useState(false);
  const [selectorType, setSelectorType] = useState(null);

  const closeSelector = () => setSelectorType(null);
  const selectOption = (key) => {
    if (selectorType === 'theme') setThemeKey(key);
    if (selectorType === 'font') setFontKey(key);
    closeSelector();
  };

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
      await writeLatestBackup({ userName: '', themeKey, fontKey });
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
      const uri = await writeLatestBackup({ userName, themeKey, fontKey });
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
        !THEMES[backup.preferences.themeKey] ||
        (backup.preferences.fontKey !== undefined && !isFontKey(backup.preferences.fontKey))
      ) {
        throw new Error('The backup file is missing valid profile preferences.');
      }
      const restoredFontKey = isFontKey(backup.preferences.fontKey) ? backup.preferences.fontKey : 'system';
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
                  [FONT_STORAGE_KEY, restoredFontKey],
                ]);
                setUserName(backup.preferences.userName);
                await setThemeKey(backup.preferences.themeKey);
                await setFontKey(restoredFontKey);
                await writeLatestBackup({ ...backup.preferences, fontKey: restoredFontKey });
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
        !THEMES[backup.preferences.themeKey] ||
        (backup.preferences.fontKey !== undefined && !isFontKey(backup.preferences.fontKey))
      ) {
        throw new Error('The automatic backup is missing valid profile preferences.');
      }
      const restoredFontKey = isFontKey(backup.preferences.fontKey) ? backup.preferences.fontKey : 'system';
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
                  [FONT_STORAGE_KEY, restoredFontKey],
                ]);
                setUserName(backup.preferences.userName);
                await setThemeKey(backup.preferences.themeKey);
                await setFontKey(restoredFontKey);
                await writeLatestBackup({ ...backup.preferences, fontKey: restoredFontKey });
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
      <View style={styles.nameRow}>
        <Text style={[styles.sectionTitle, styles.nameLabel, { color: theme.text }]}>I am</Text>
        <TextInput
          value={userName}
          onChangeText={handleNameChange}
          placeholder="Enter your name"
          placeholderTextColor={theme.muted}
          style={[styles.nameInput, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]}
          maxLength={40}
        />
      </View>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>App theme</Text>
      <TouchableOpacity
        style={[styles.selector, { backgroundColor: theme.surface, borderColor: theme.border }]}
        onPress={() => setSelectorType('theme')}
        accessibilityRole="button"
        accessibilityLabel={`App theme: ${THEMES[themeKey].label}`}
      >
        <View style={styles.selectorSwatches}>
          <View style={[styles.selectorSwatch, { backgroundColor: THEMES[themeKey].surface }]} />
          <View style={[styles.selectorSwatch, { backgroundColor: THEMES[themeKey].accent }]} />
        </View>
        <Text style={[styles.selectorText, { color: theme.text }]}>{THEMES[themeKey].label}</Text>
        <MaterialCommunityIcons name="chevron-down" size={22} color={theme.muted} />
      </TouchableOpacity>
      <Text style={[styles.sectionTitle, styles.selectorHeading, { color: theme.text }]}>App font</Text>
      <TouchableOpacity
        style={[styles.selector, styles.fontSelector, { backgroundColor: theme.surface, borderColor: theme.border }]}
        onPress={() => setSelectorType('font')}
        accessibilityRole="button"
        accessibilityLabel={`App font: ${FONT_OPTIONS[fontKey].label}`}
      >
        <Text
          numberOfLines={1}
          style={[
            styles.fontSample,
            { color: theme.text },
            FONT_OPTIONS[fontKey].fontFamily ? { fontFamily: FONT_OPTIONS[fontKey].fontFamily } : null,
          ]}
        >
          Aa
        </Text>
        <Text style={[styles.selectorText, { color: theme.text }]}>{FONT_OPTIONS[fontKey].label}</Text>
        <MaterialCommunityIcons name="chevron-down" size={22} color={theme.muted} />
      </TouchableOpacity>
      <Text style={[styles.sectionTitle, styles.backupHeading, { color: theme.text }]}>Data backup</Text>
      <Text style={[styles.backupSubtitle, { color: theme.muted }]}>
        Automatic backups are created weekly while the app is in use.
      </Text>
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
      <Modal
        visible={selectorType !== null}
        transparent
        animationType="fade"
        onRequestClose={closeSelector}
      >
        <View style={[styles.selectorBackdrop, { backgroundColor: theme.overlay }]}>
          <View style={[styles.selectorModal, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.selectorModalTitle, { color: theme.text }]}>
              {selectorType === 'theme' ? 'Choose a theme' : 'Choose a font'}
            </Text>
            {(selectorType === 'theme' ? Object.values(THEMES) : Object.values(FONT_OPTIONS)).map((option) => {
              const selected = option.key === (selectorType === 'theme' ? themeKey : fontKey);
              return (
                <TouchableOpacity
                  key={option.key}
                  style={[styles.selectorOption, selected && { backgroundColor: theme.background }]}
                  onPress={() => selectOption(option.key)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                >
                  {selectorType === 'theme' ? (
                    <View style={styles.selectorSwatches}>
                      <View style={[styles.selectorSwatch, { backgroundColor: option.surface }]} />
                      <View style={[styles.selectorSwatch, { backgroundColor: option.accent }]} />
                    </View>
                  ) : (
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.fontOptionSample,
                        { color: theme.text },
                        option.fontFamily ? { fontFamily: option.fontFamily } : null,
                      ]}
                    >
                      Aa
                    </Text>
                  )}
                  <Text style={[styles.selectorText, { color: theme.text }, selected && styles.selectedOptionText]}>
                    {option.label}
                  </Text>
                  {selected && <MaterialCommunityIcons name="check" size={20} color={theme.accent} />}
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              style={styles.selectorCancel}
              onPress={closeSelector}
              accessibilityRole="button"
            >
              <Text style={[styles.selectorCancelText, { color: theme.muted }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111318', padding: 20, paddingTop: 12 },
  content: { flexGrow: 1 },
  title: { color: '#fff', fontSize: 26, fontWeight: '700', marginBottom: 16 },
  subtitle: { color: '#9aa0a6', fontSize: 14, marginBottom: 28 },
  sectionTitle: { fontSize: 17, fontWeight: '700', marginBottom: 12 },
  backupHeading: { marginBottom: 6 },
  backupSubtitle: { fontSize: 13, lineHeight: 18, marginBottom: 12 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  nameLabel: { marginBottom: 28 },
  nameInput: { flex: 1, minWidth: 0, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, marginBottom: 28 },
  selectorHeading: { marginTop: 20 },
  selector: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  fontSelector: { marginBottom: 28 },
  selectorSwatches: { width: 40, flexDirection: 'row', alignItems: 'center', gap: 4 },
  selectorSwatch: { width: 16, height: 16, borderRadius: 8 },
  selectorText: { flex: 1, fontSize: 15, fontWeight: '600' },
  fontSample: { width: 40, flexShrink: 0, fontSize: 20, textAlign: 'center' },
  selectorBackdrop: { flex: 1, justifyContent: 'center', padding: 24 },
  selectorModal: { borderWidth: 1, borderRadius: 16, padding: 16, maxHeight: '85%' },
  selectorModalTitle: { fontSize: 19, fontWeight: '700', marginBottom: 10 },
  selectorOption: {
    minHeight: 48,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 10,
  },
  fontOptionSample: { width: 40, flexShrink: 0, textAlign: 'center', fontSize: 17 },
  selectedOptionText: { fontWeight: '700' },
  selectorCancel: { alignSelf: 'flex-end', paddingHorizontal: 10, paddingVertical: 12, marginTop: 4 },
  selectorCancelText: { fontSize: 14, fontWeight: '700' },
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
