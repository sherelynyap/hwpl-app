import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Alert,
  Modal,
  Animated,
  PanResponder,
} from 'react-native';
import { addNote, getAllNotes, updateNote, deleteNote } from '../db/database';
import { useTheme } from '../theme';

const NOTE_CATEGORIES = [
  { key: 'health', label: 'Health', color: '#2ecc71' },
  { key: 'work', label: 'Work', color: '#3498db' },
  { key: 'play', label: 'Play', color: '#f1c40f' },
  { key: 'love', label: 'Love', color: '#e74c3c' },
];

export default function NotesScreen() {
  const { theme } = useTheme();
  const [notes, setNotes] = useState([]);
  const [formVisible, setFormVisible] = useState(false);
  const [editingNote, setEditingNote] = useState(null);

  const load = useCallback(async () => {
    const rows = await getAllNotes();
    setNotes(rows);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openNewNote = () => {
    setEditingNote(null);
    setFormVisible(true);
  };

  const openEditNote = (note) => {
    setEditingNote(note);
    setFormVisible(true);
  };

  const handleSave = async ({ content, category }) => {
    if (editingNote) {
      await updateNote(editingNote.id, content, category);
    } else {
      await addNote(content, category);
    }
    setFormVisible(false);
    setEditingNote(null);
    load();
  };

  const handleDelete = (note) => {
    Alert.alert('Delete note', 'Remove this note?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteNote(note.id);
          load();
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Notes</Text>
        <TouchableOpacity style={styles.addButton} onPress={openNewNote} accessibilityLabel="Add note">
          <Text style={styles.addIconText}>+</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.subtitle}>Quick capture — random ideas, half-thoughts, anything</Text>

      <FlatList
        data={notes}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ paddingTop: 10, paddingBottom: 40 }}
        renderItem={({ item }) => (
          <SwipeableNote onDelete={() => handleDelete(item)}>
            <View style={styles.noteCard}>
              <TouchableOpacity style={styles.noteMain} onPress={() => openEditNote(item)} onLongPress={() => handleDelete(item)}>
                <View style={styles.noteContent}>
                  {item.category ? <Text style={[styles.noteCategory, { color: NOTE_CATEGORIES.find((category) => category.key === item.category)?.color ?? theme.muted }]}>{item.category}</Text> : null}
                  <Text style={styles.noteText}>{item.content}</Text>
                  <Text style={[styles.noteDate, { color: theme.muted }]}>{formatDate(item.created_at)}</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={styles.editButton} onPress={() => openEditNote(item)}>
                <Text style={styles.editButtonText}>Edit</Text>
              </TouchableOpacity>
            </View>
          </SwipeableNote>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No notes yet.</Text>}
      />
      <NoteFormModal
        visible={formVisible}
        note={editingNote}
        onClose={() => {
          setFormVisible(false);
          setEditingNote(null);
        }}
        onSave={handleSave}
      />
    </View>
  );
}

function SwipeableNote({ children, onDelete }) {
  const translateX = useRef(new Animated.Value(0)).current;
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy),
      onPanResponderMove: (_, gestureState) => {
        translateX.setValue(Math.max(-90, Math.min(0, gestureState.dx)));
      },
      onPanResponderRelease: (_, gestureState) => {
        Animated.spring(translateX, {
          toValue: gestureState.dx < -45 ? -90 : 0,
          useNativeDriver: true,
          damping: 22,
          stiffness: 180,
          mass: 0.8,
        }).start();
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
          damping: 22,
          stiffness: 180,
          mass: 0.8,
        }).start();
      },
    })
  ).current;

  return (
    <View style={styles.swipeContainer}>
      <Animated.View
        style={[
          styles.deleteAction,
          {
            opacity: translateX.interpolate({
              inputRange: [-90, -45, 0],
              outputRange: [1, 0, 0],
              extrapolate: 'clamp',
            }),
          },
        ]}
      >
        <TouchableOpacity style={styles.deleteActionButton} onPress={onDelete}>
          <Text style={styles.deleteActionText}>Delete</Text>
        </TouchableOpacity>
      </Animated.View>
      <Animated.View style={[styles.swipeContent, { transform: [{ translateX }] }]} {...panResponder.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}

function NoteFormModal({ visible, note, onClose, onSave }) {
  const { theme } = useTheme();
  const [content, setContent] = useState('');
  const [category, setCategory] = useState(null);

  useEffect(() => {
    if (visible) {
      setContent(note?.content || '');
      setCategory(note?.category || null);
    }
  }, [note, visible]);

  const handleSubmit = () => {
    const trimmedContent = content.trim();
    if (trimmedContent) onSave({ content: trimmedContent, category });
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.formContainer}>
        <View style={styles.formHeader}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.formTitle}>{note ? 'Edit note' : 'New note'}</Text>
          <View style={styles.headerSpacer} />
        </View>
        <TextInput
          style={styles.formInput}
          placeholder="Write a note..."
          placeholderTextColor="#888"
          value={content}
          onChangeText={setContent}
          multiline
          autoFocus
          textAlignVertical="top"
        />
        <Text style={[styles.categoryLabel, { color: theme.muted }]}>Aspect</Text>
        <View style={styles.categoryRow}>
          {[{ key: null, label: 'None', color: theme.muted }, ...NOTE_CATEGORIES].map((item) => (
            <TouchableOpacity
              key={item.key ?? 'none'}
              style={[styles.categoryButton, { borderColor: item.color }, category === item.key && { backgroundColor: item.color }]}
              onPress={() => setCategory(item.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: category === item.key }}
              accessibilityLabel={`Tag note ${item.label}`}
            >
              <Text style={[styles.categoryButtonText, { color: category === item.key ? '#111318' : item.color }]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity
          style={[styles.saveButton, !content.trim() && styles.disabledButton]}
          onPress={handleSubmit}
          disabled={!content.trim()}
        >
          <Text style={styles.saveButtonText}>{note ? 'Save changes' : 'Save note'}</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

function formatDate(sqliteDate) {
  // SQLite datetime('now') gives 'YYYY-MM-DD HH:MM:SS' in UTC
  const date = new Date(sqliteDate.replace(' ', 'T') + 'Z');
  const pad = (value) => String(value).padStart(2, '0');
  return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111318', padding: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 26, lineHeight: 32, fontWeight: '700', color: '#fff' },
  subtitle: { fontSize: 13, color: '#9aa0a6', marginBottom: 16 },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#6C5CE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addIconText: { color: '#fff', fontSize: 24, lineHeight: 28, fontWeight: '500' },
  noteCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1c1f26', borderRadius: 10, padding: 12 },
  noteMain: { flex: 1 },
  noteContent: { flex: 1 },
  noteCategory: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize', marginBottom: 4 },
  editButton: { paddingHorizontal: 8, paddingVertical: 6 },
  editButtonText: { color: '#9aa0a6', fontWeight: '600' },
  swipeContainer: { marginBottom: 8, overflow: 'hidden', borderRadius: 10 },
  swipeContent: { width: '100%' },
  deleteAction: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: 90,
    backgroundColor: '#e74c3c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteActionButton: { padding: 12, alignItems: 'center', justifyContent: 'center' },
  deleteActionText: { color: '#fff', fontWeight: '700' },
  formContainer: { flex: 1, backgroundColor: '#111318', padding: 20, paddingTop: 60 },
  formHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 },
  formTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
  cancelText: { color: '#9aa0a6', fontSize: 16 },
  headerSpacer: { width: 58 },
  formInput: {
    backgroundColor: '#1c1f26',
    color: '#fff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 160,
  },
  categoryLabel: { fontSize: 13, fontWeight: '600', marginTop: 18, marginBottom: 8 },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryButton: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  categoryButtonText: { fontSize: 13, fontWeight: '700', textTransform: 'capitalize' },
  saveButton: {
    backgroundColor: '#6C5CE7',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  saveButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  disabledButton: { opacity: 0.5 },
  noteText: { color: '#fff', fontSize: 15 },
  noteDate: { fontSize: 11, marginTop: 6 },
  empty: { color: '#666', textAlign: 'center', marginTop: 40 },
});
