import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, TouchableOpacity, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { getArchivedNotes, setNoteArchived } from '../db/database';
import { AppText as Text, useTheme } from '../theme';

export default function ArchivedNotesScreen({ onBack }) {
  const { theme } = useTheme();
  const [notes, setNotes] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setNotes(await getArchivedNotes());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  const handleRestore = async (note) => {
    await setNoteArchived(note.id, false);
    setNotes((currentNotes) => currentNotes.filter((currentNote) => currentNote.id !== note.id));
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Back to notes"
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text }]}>Archived notes</Text>
      </View>
      <FlatList
        data={notes}
        keyExtractor={(note) => String(note.id)}
        contentContainerStyle={notes.length === 0 ? styles.emptyContent : styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.accent}
            colors={[theme.accent]}
          />
        }
        ListEmptyComponent={<Text style={[styles.empty, { color: theme.muted }]}>No archived notes yet.</Text>}
        renderItem={({ item }) => (
          <View style={[styles.noteRow, { backgroundColor: theme.surface }]}>
            <View style={styles.noteContent}>
              <Text style={[styles.noteText, { color: theme.text }]} numberOfLines={2}>{item.content}</Text>
              <Text style={[styles.noteDate, { color: theme.muted }]}>{formatDate(item.created_at)}</Text>
            </View>
            <TouchableOpacity
              style={styles.restoreButton}
              onPress={() => handleRestore(item)}
              accessibilityRole="button"
              accessibilityLabel="Restore note"
            >
              <MaterialCommunityIcons name="archive-arrow-up-outline" size={21} color={theme.muted} />
            </TouchableOpacity>
          </View>
        )}
      />
    </View>
  );
}

function formatDate(sqliteDate) {
  const date = new Date(sqliteDate.replace(' ', 'T') + 'Z');
  const pad = (value) => String(value).padStart(2, '0');
  return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111318', padding: 20 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, marginTop: 4 },
  backButton: { width: 40, height: 40, alignItems: 'flex-start', justifyContent: 'center', marginRight: 8 },
  title: { fontSize: 26, lineHeight: 32, fontWeight: '700' },
  listContent: { paddingBottom: 40 },
  emptyContent: { flexGrow: 1 },
  empty: { textAlign: 'center', marginTop: 40 },
  noteRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, padding: 12, marginBottom: 8 },
  noteContent: { flex: 1 },
  noteText: { fontSize: 15 },
  noteDate: { fontSize: 11, marginTop: 6 },
  restoreButton: { padding: 8 },
});