import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TouchableOpacity,
  Alert,
  Platform,
  Modal,
  Pressable,
  TextInput,
  Animated,
  PanResponder,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  addItem,
  getAllItems,
  setItemStatus,
  updateItem,
  deleteItem,
  addNote,
  getAllNotes,
  updateNote,
  deleteNote,
} from '../db/database';

function toISODateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// This screen is remounted each time its tab becomes active (see App.js,
// which gives every screen a `key` tied to the active tab), so a plain
// mount-time load is enough to keep the list fresh without React Navigation.
export default function ItemsScreen() {
  const [items, setItems] = useState([]);
  const [notes, setNotes] = useState([]);
  const [itemFormVisible, setItemFormVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [noteFormVisible, setNoteFormVisible] = useState(false);
  const [editingNote, setEditingNote] = useState(null);

  const load = useCallback(async () => {
    const [itemRows, noteRows] = await Promise.all([getAllItems(), getAllNotes()]);
    setItems(itemRows);
    setNotes(noteRows);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openNewItem = () => {
    setEditingItem(null);
    setItemFormVisible(true);
  };

  const openEditItem = (item) => {
    setEditingItem(item);
    setItemFormVisible(true);
  };

  const handleSave = async ({ title, deadline }) => {
    if (editingItem) {
      await updateItem(editingItem.id, title, null, deadline);
    } else {
      await addItem(title, null, deadline);
    }
    setItemFormVisible(false);
    setEditingItem(null);
    load();
  };

  const openNewNote = () => {
    setEditingNote(null);
    setNoteFormVisible(true);
  };

  const openEditNote = (note) => {
    setEditingNote(note);
    setNoteFormVisible(true);
  };

  const handleSaveNote = async (content) => {
    if (editingNote) {
      await updateNote(editingNote.id, content);
    } else {
      await addNote(content);
    }
    setNoteFormVisible(false);
    setEditingNote(null);
    load();
  };

  const toggleDone = async (item) => {
    await setItemStatus(item.id, item.status === 'open' ? 'done' : 'open');
    load();
  };

  const handleDelete = (item) => {
    Alert.alert('Delete item', `Remove "${item.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteItem(item.id);
          load();
        },
      },
    ]);
  };

  const handleDeleteNote = (note) => {
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

  const sections = [
    { key: 'items', title: 'Outstanding items', data: items },
    { key: 'notes', title: 'Notes', data: notes },
  ];

  return (
    <View style={styles.container}>
      <SectionList
        sections={sections}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        contentContainerStyle={styles.listContent}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <View style={[styles.sectionHeader, section.key === 'notes' && styles.notesSectionHeader]}>
            <Text style={styles.title}>{section.title}</Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={section.key === 'items' ? openNewItem : openNewNote}
              accessibilityLabel={`Add ${section.key === 'items' ? 'item' : 'note'}`}
            >
              <Text style={styles.addIconText}>+</Text>
            </TouchableOpacity>
          </View>
        )}
        renderItem={({ item, section }) =>
          section.key === 'items' ? (
            <SwipeableItem onDelete={() => handleDelete(item)}>
              <View style={styles.row}>
                <TouchableOpacity style={styles.itemMain} onPress={() => toggleDone(item)} onLongPress={() => handleDelete(item)}>
                  <View style={styles.checkbox}>
                    {item.status === 'done' && <Text style={styles.checkmark}>{'\u2713'}</Text>}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.itemTitle,
                        item.status === 'done' && { textDecorationLine: 'line-through', color: '#666' },
                      ]}
                    >
                      {item.title}
                    </Text>
                    {item.deadline ? <Text style={styles.itemDeadline}>Due {item.deadline}</Text> : null}
                  </View>
                </TouchableOpacity>
                <TouchableOpacity style={styles.editButton} onPress={() => openEditItem(item)}>
                  <Text style={styles.editButtonText}>Edit</Text>
                </TouchableOpacity>
              </View>
            </SwipeableItem>
          ) : (
            <SwipeableItem onDelete={() => handleDeleteNote(item)}>
              <View style={styles.noteCard}>
                <TouchableOpacity style={styles.noteMain} onPress={() => openEditNote(item)} onLongPress={() => handleDeleteNote(item)}>
                  <Text style={styles.noteText}>{item.content}</Text>
                  <Text style={styles.noteDate}>{formatDate(item.created_at)}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.editButton} onPress={() => openEditNote(item)}>
                  <Text style={styles.editButtonText}>Edit</Text>
                </TouchableOpacity>
              </View>
            </SwipeableItem>
          )
        }
        renderSectionFooter={({ section }) =>
          section.data.length === 0 ? (
            <Text style={styles.empty}>{section.key === 'items' ? 'Nothing here yet.' : 'No notes yet.'}</Text>
          ) : null
        }
      />
      <ItemFormModal
        visible={itemFormVisible}
        item={editingItem}
        onClose={() => {
          setItemFormVisible(false);
          setEditingItem(null);
        }}
        onSave={handleSave}
      />
      <NoteFormModal
        visible={noteFormVisible}
        note={editingNote}
        onClose={() => {
          setNoteFormVisible(false);
          setEditingNote(null);
        }}
        onSave={handleSaveNote}
      />
    </View>
  );
}

function SwipeableItem({ children, onDelete }) {
  const translateX = useRef(new Animated.Value(0)).current;
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy),
      onPanResponderMove: (_, gestureState) => {
        translateX.setValue(Math.max(-90, Math.min(0, gestureState.dx)));
      },
      onPanResponderRelease: (_, gestureState) => {
        const target = gestureState.dx < -45 ? -90 : 0;
        Animated.spring(translateX, {
          toValue: target,
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
  const [content, setContent] = useState('');

  useEffect(() => {
    if (visible) setContent(note?.content || '');
  }, [note, visible]);

  const handleSubmit = () => {
    const trimmedContent = content.trim();
    if (trimmedContent) onSave(trimmedContent);
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

function ItemFormModal({ visible, item, onClose, onSave }) {
  const [title, setTitle] = useState('');
  const [deadlineDate, setDeadlineDate] = useState(null);
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setTitle(item?.title || '');
    setDeadlineDate(item?.deadline ? new Date(`${item.deadline}T00:00:00`) : null);
    setShowPicker(false);
  }, [item, visible]);

  const handlePickerChange = (event, selectedDate) => {
    setShowPicker(Platform.OS === 'ios');
    if (selectedDate) setDeadlineDate(selectedDate);
  };

  const handleSubmit = () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;
    onSave({
      title: trimmedTitle,
      deadline: deadlineDate ? toISODateString(deadlineDate) : null,
    });
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.formContainer}>
        <View style={styles.formHeader}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.formTitle}>{item ? 'Edit item' : 'New item'}</Text>
          <View style={styles.headerSpacer} />
        </View>
        <Text style={styles.formLabel}>Item</Text>
        <TextInput
          style={styles.input}
          placeholder="What needs doing?"
          placeholderTextColor="#888"
          value={title}
          onChangeText={setTitle}
          autoFocus={!item}
        />
        <Text style={styles.formLabel}>Deadline</Text>
        <View style={styles.deadlineRow}>
          <TouchableOpacity style={[styles.input, styles.dateButton]} onPress={() => setShowPicker(true)}>
            <Text style={deadlineDate ? styles.dateButtonText : styles.dateButtonPlaceholder}>
              {deadlineDate ? toISODateString(deadlineDate) : 'No deadline'}
            </Text>
          </TouchableOpacity>
          {deadlineDate && (
            <TouchableOpacity onPress={() => setDeadlineDate(null)} style={styles.clearButton}>
              <Text style={styles.clearButtonText}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity style={[styles.saveButton, !title.trim() && styles.disabledButton]} onPress={handleSubmit} disabled={!title.trim()}>
          <Text style={styles.addButtonText}>{item ? 'Save changes' : 'Create item'}</Text>
        </TouchableOpacity>

        {showPicker && Platform.OS === 'ios' ? (
          <Modal transparent animationType="fade" visible onRequestClose={() => setShowPicker(false)}>
            <Pressable style={styles.pickerBackdrop} onPress={() => setShowPicker(false)}>
              <Pressable style={styles.pickerCard} onPress={(event) => event.stopPropagation()}>
                <DateTimePicker
                  value={deadlineDate || new Date()}
                  mode="date"
                  display="inline"
                  themeVariant="light"
                  minimumDate={new Date()}
                  onChange={handlePickerChange}
                />
              </Pressable>
            </Pressable>
          </Modal>
        ) : showPicker ? (
          <DateTimePicker
            value={deadlineDate || new Date()}
            mode="date"
            display="default"
            minimumDate={new Date()}
            onChange={handlePickerChange}
          />
        ) : null}
      </View>
    </Modal>
  );
}

function formatDate(sqliteDate) {
  const date = new Date(sqliteDate.replace(' ', 'T') + 'Z');
  return date.toLocaleString();
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111318', padding: 20 },
  listContent: { paddingBottom: 40 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, marginTop: 4 },
  notesSectionHeader: { marginTop: 24 },
  title: { fontSize: 26, lineHeight: 32, fontWeight: '700', color: '#fff' },
  input: {
    backgroundColor: '#1c1f26',
    color: '#fff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  addButton: {
    backgroundColor: '#6C5CE7',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    height: 32,
    width: 32,
  },
  addButtonText: { color: '#fff', fontWeight: '700' },
  addIconText: { color: '#fff', fontSize: 24, lineHeight: 28, fontWeight: '500' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1c1f26',
    borderRadius: 10,
    padding: 12,
    marginBottom: 0,
  },
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
  deleteActionButton: { alignItems: 'center', justifyContent: 'center', padding: 12 },
  deleteActionText: { color: '#fff', fontWeight: '700' },
  itemMain: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  noteCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1c1f26', borderRadius: 10, padding: 12 },
  noteMain: { flex: 1 },
  noteText: { color: '#fff', fontSize: 15 },
  noteDate: { color: '#666', fontSize: 11, marginTop: 6 },
  editButton: { paddingHorizontal: 8, paddingVertical: 6 },
  editButtonText: { color: '#9aa0a6', fontWeight: '600' },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#666',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: { color: '#2ecc71', fontWeight: '700' },
  itemTitle: { color: '#fff', fontSize: 15, fontWeight: '600' },
  itemDeadline: { color: '#9aa0a6', fontSize: 12, marginTop: 2 },
  empty: { color: '#666', textAlign: 'center', marginTop: 40 },
  dateButton: { justifyContent: 'center' },
  deadlineRow: { flexDirection: 'row', alignItems: 'center' },
  dateButtonText: { color: '#fff' },
  dateButtonPlaceholder: { color: '#888' },
  clearButton: { paddingHorizontal: 10, justifyContent: 'center' },
  clearButtonText: { color: '#e74c3c', fontWeight: '600' },
  formContainer: { flex: 1, backgroundColor: '#111318', padding: 20, paddingTop: 60 },
  formHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 },
  formTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
  cancelText: { color: '#9aa0a6', fontSize: 16 },
  headerSpacer: { width: 58 },
  formLabel: { color: '#fff', fontSize: 15, fontWeight: '600', marginBottom: 8, marginTop: 12 },
  formInput: {
    backgroundColor: '#1c1f26',
    color: '#fff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 160,
  },
  saveButton: {
    backgroundColor: '#6C5CE7',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 28,
  },
  disabledButton: { opacity: 0.5 },
  saveButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  pickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  pickerCard: { backgroundColor: '#fff', borderRadius: 14, padding: 8 },
});
