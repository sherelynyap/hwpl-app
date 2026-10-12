import * as FileSystem from 'expo-file-system/legacy';
import { createDatabaseBackup, validateDatabaseBackup } from './db/database';

const BACKUP_FILE_NAME = 'hwpl-latest-backup.json';
const BACKUP_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

function getBackupUri() {
  if (!FileSystem.documentDirectory) {
    throw new Error('The device file system is unavailable.');
  }
  return `${FileSystem.documentDirectory}${BACKUP_FILE_NAME}`;
}

export async function writeLatestBackup(preferences) {
  const backup = await createDatabaseBackup();
  backup.preferences = preferences;
  await FileSystem.writeAsStringAsync(getBackupUri(), JSON.stringify(backup, null, 2), {
    encoding: FileSystem.EncodingType.UTF8,
  });
  return getBackupUri();
}

export async function ensureWeeklyBackup(preferences) {
  const uri = getBackupUri();
  const info = await FileSystem.getInfoAsync(uri);
  const age = info.exists ? Date.now() - info.modificationTime * 1000 : null;
  if (info.exists && age >= 0 && age < BACKUP_INTERVAL_MS) return false;
  await writeLatestBackup(preferences);
  return true;
}

export async function readLatestBackup() {
  const backup = JSON.parse(await FileSystem.readAsStringAsync(getBackupUri()));
  validateDatabaseBackup(backup);
  return backup;
}