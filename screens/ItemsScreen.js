import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Platform,
  Modal,
  Pressable,
  TextInput,
  Animated,
  PanResponder,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import {
  addItem,
  getOpenItems,
  setItemStatus,
  updateItem,
  deleteItem,
  addNote,
  getActiveNotes,
  updateNote,
  deleteNote,
  setNoteArchived,
} from '../db/database';
import { useTheme } from '../theme';
import CompletedItemsScreen from './CompletedItemsScreen';
import ArchivedNotesScreen from './ArchivedNotesScreen';

function toISODateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getDaysUntilDeadline(deadline) {
  const [year, month, day] = deadline.split('-').map(Number);
  const deadlineDay = Date.UTC(year, month - 1, day);
  const today = new Date();
  const todayDay = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((deadlineDay - todayDay) / 86400000);
}

function getDeadlineColor(deadline, theme) {
  const daysUntilDeadline = getDaysUntilDeadline(deadline);
  const darkSurface = theme.key === 'dark' || theme.key === 'coral';

  if (daysUntilDeadline <= 3) return theme.danger;
  if (daysUntilDeadline <= 7) return darkSurface ? '#ffab70' : '#b45309';
  if (daysUntilDeadline <= 14) return darkSurface ? '#f2cf62' : '#806000';
  return theme.muted;
}

function getDeadlineLabel(deadline) {
  const daysUntilDeadline = getDaysUntilDeadline(deadline);

  if (daysUntilDeadline < 0) return 'Overdue';
  if (daysUntilDeadline === 0) return 'Due today';
  if (daysUntilDeadline === 1) return 'Due tmr';
  if (daysUntilDeadline <= 7) return 'Due this week';
  if (daysUntilDeadline <= 14) return 'Due next week';
  return `Due ${deadline}`;
}

function getTagIcon(tagKey, color = '#fff', size) {
  switch (tagKey) {
    case 'health':
      return <MaterialIcons name="health-and-safety" size={size} color={color} />;
    case 'work':
      return <MaterialIcons name="work" size={size} color={color} />;
    case 'play':
      return <MaterialCommunityIcons name="party-popper" size={size} color={color} />;
    case 'love':
      return <FontAwesome name="heart" size={size} color={color} />;
    default:
      return null;
  }
}

function getNoteTags(categoryValue) {
  if (!categoryValue) return [];
  return String(categoryValue)
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

// This screen is remounted each time its tab becomes active (see App.js,
// which gives every screen a `key` tied to the active tab), so a plain
// mount-time load is enough to keep the list fresh without React Navigation.
export default function ItemsScreen() {
  const { theme } = useTheme();
  const [items, setItems] = useState([]);
  const [notes, setNotes] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showCompletedItems, setShowCompletedItems] = useState(false);
  const [showArchivedNotes, setShowArchivedNotes] = useState(false);
  const [itemFormVisible, setItemFormVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [noteFormVisible, setNoteFormVisible] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [selectionType, setSelectionType] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const longPressedId = useRef(null);

  const load = useCallback(async () => {
    const [itemRows, noteRows] = await Promise.all([getOpenItems(), getActiveNotes()]);
    setItems(itemRows);
    setNotes(noteRows);
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  };

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

  const handleSaveNote = async ({ content, category }) => {
    if (editingNote) {
      await updateNote(editingNote.id, content, category);
    } else {
      await addNote(content, category);
    }
    setNoteFormVisible(false);
    setEditingNote(null);
    load();
  };

  const toggleDone = async (item) => {
    const nextStatus = item.status === 'open' ? 'done' : 'open';
    await setItemStatus(item.id, nextStatus);
    setItems((currentItems) =>
      currentItems.map((currentItem) =>
        currentItem.id === item.id ? { ...currentItem, status: nextStatus } : currentItem
      )
    );
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

  const clearSelection = () => {
    setSelectionType(null);
    setSelectedIds([]);
  };

  const startSelection = (type, id) => {
    longPressedId.current = { type, id };
    setSelectionType(type);
    setSelectedIds([id]);
  };

  const handleSelectablePress = (type, id, onRegularPress) => {
    if (longPressedId.current?.type === type && longPressedId.current.id === id) {
      longPressedId.current = null;
      return;
    }
    if (selectionType === type) {
      setSelectedIds((currentIds) =>
        currentIds.includes(id) ? currentIds.filter((selectedId) => selectedId !== id) : [...currentIds, id]
      );
      return;
    }
    if (!selectionType) onRegularPress();
  };

  const confirmDeleteSelected = () => {
    if (!selectionType || selectedIds.length === 0) return;
    const isItemSelection = selectionType === 'items';
    const selectedCount = selectedIds.length;
    Alert.alert(
      `Delete ${selectedCount} ${isItemSelection ? 'item' : 'note'}${selectedCount === 1 ? '' : 's'}?`,
      'This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const deleteRecord = isItemSelection ? deleteItem : deleteNote;
            await Promise.all(selectedIds.map((id) => deleteRecord(id)));
            if (isItemSelection) {
              setItems((currentItems) => currentItems.filter((item) => !selectedIds.includes(item.id)));
            } else {
              setNotes((currentNotes) => currentNotes.filter((note) => !selectedIds.includes(note.id)));
            }
            clearSelection();
          },
        },
      ]
    );
  };

  const archiveSelectedNotes = async () => {
    if (selectionType !== 'notes' || selectedIds.length === 0) return;
    await Promise.all(selectedIds.map((id) => setNoteArchived(id, true)));
    setNotes((currentNotes) => currentNotes.filter((note) => !selectedIds.includes(note.id)));
    clearSelection();
  };

  if (showCompletedItems) {
    return <CompletedItemsScreen onBack={() => setShowCompletedItems(false)} />;
  }
  if (showArchivedNotes) {
    return <ArchivedNotesScreen onBack={() => setShowArchivedNotes(false)} />;
  }

  const sections = [
    {
      key: 'items',
      title: 'Outstanding items',
      data: items,
    },
    { key: 'notes', title: 'Notes', data: notes },
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}> 
      <SectionList
        sections={sections}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.accent}
            colors={[theme.accent]}
          />
        }
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <View style={[styles.sectionHeader, section.key === 'notes' && styles.notesSectionHeader]}>
            <Text style={[styles.title, { color: theme.text }]}>{section.title}</Text>
            <View style={styles.headerActions}>
              {selectionType === section.key ? (
                <>
                  {selectionType === 'notes' && (
                    <TouchableOpacity
                      style={[styles.addButton, { backgroundColor: theme.surface }, !selectedIds.length && styles.disabledButton]}
                      onPress={archiveSelectedNotes}
                      disabled={!selectedIds.length}
                      accessibilityRole="button"
                      accessibilityLabel="Archive selected notes"
                    >
                      <MaterialCommunityIcons name="archive-arrow-down-outline" size={21} color={theme.text} />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[styles.addButton, { backgroundColor: theme.dangerButton }, !selectedIds.length && styles.disabledButton]}
                    onPress={confirmDeleteSelected}
                    disabled={!selectedIds.length}
                    accessibilityRole="button"
                    accessibilityLabel="Delete selected"
                  >
                    <MaterialCommunityIcons name="delete-outline" size={21} color={theme.dangerButtonText} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.addButton, { backgroundColor: theme.surface }]}
                    onPress={clearSelection}
                    accessibilityRole="button"
                    accessibilityLabel="Cancel selection"
                  >
                    <MaterialCommunityIcons name="close" size={21} color={theme.text} />
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  {section.key === 'items' && (
                    <TouchableOpacity
                      style={[styles.addButton, { backgroundColor: theme.surface }]}
                      onPress={() => setShowCompletedItems(true)}
                      accessibilityRole="button"
                      accessibilityLabel="Show completed item history"
                    >
                      <MaterialCommunityIcons name="history" size={21} color={theme.text} />
                    </TouchableOpacity>
                  )}
                  {section.key === 'notes' && (
                    <TouchableOpacity
                      style={[styles.addButton, { backgroundColor: theme.surface }]}
                      onPress={() => setShowArchivedNotes(true)}
                      accessibilityRole="button"
                      accessibilityLabel="Show archived notes"
                    >
                      <MaterialCommunityIcons name="archive-outline" size={21} color={theme.text} />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[styles.addButton, { backgroundColor: theme.primaryButton }]}
                    onPress={section.key === 'items' ? openNewItem : openNewNote}
                    accessibilityLabel={`Add ${section.key === 'items' ? 'item' : 'note'}`}
                  >
                    <Text style={[styles.addIconText, { color: theme.primaryButtonText }]}>+</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        )}
        renderItem={({ item, section }) =>
          section.key === 'items' ? (
            <SwipeableItem onDelete={() => handleDelete(item)}>
              <View style={[styles.row, { backgroundColor: theme.surface }, selectionType === 'items' && selectedIds.includes(item.id) && { borderColor: theme.accent, borderWidth: 1 }]}> 
                <TouchableOpacity
                  style={styles.itemMain}
                  onPress={() => handleSelectablePress('items', item.id, () => toggleDone(item))}
                  onLongPress={() => startSelection('items', item.id)}
                  delayLongPress={350}
                >
                  <View style={[styles.checkbox, selectionType === 'items' && { borderColor: theme.accent, backgroundColor: selectedIds.includes(item.id) ? theme.accent : 'transparent' }]}>
                    {selectionType === 'items' ? (
                      selectedIds.includes(item.id) && <MaterialCommunityIcons name="check" size={15} color={theme.primaryButtonText} />
                    ) : item.status === 'done' ? (
                      <Text style={styles.checkmark}>{'\u2713'}</Text>
                    ) : null}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.itemTitle,
                        { color: theme.text },
                        item.status === 'done' && { textDecorationLine: 'line-through', color: '#666' },
                      ]}
                    >
                      {item.title}
                    </Text>
                    {item.deadline ? <Text style={[styles.itemDeadline, { color: getDeadlineColor(item.deadline, theme) }]}>{getDeadlineLabel(item.deadline)}</Text> : null}
                  </View>
                </TouchableOpacity>
                {selectionType !== 'items' && (
                  <TouchableOpacity style={styles.editButton} onPress={() => openEditItem(item)}>
                    <Text style={[styles.editButtonText, { color: theme.muted }]}>Edit</Text>
                  </TouchableOpacity>
                )}
              </View>
            </SwipeableItem>
          ) : (
            <SwipeableItem onDelete={() => handleDeleteNote(item)}>
              <View style={[styles.noteCard, { backgroundColor: theme.surface }, selectionType === 'notes' && selectedIds.includes(item.id) && { borderColor: theme.accent, borderWidth: 1 }]}> 
                {selectionType === 'notes' && (
                  <View style={[styles.checkbox, styles.noteSelectionCheckbox, { borderColor: theme.accent, backgroundColor: selectedIds.includes(item.id) ? theme.accent : 'transparent' }]}> 
                    {selectedIds.includes(item.id) && <MaterialCommunityIcons name="check" size={15} color={theme.primaryButtonText} />}
                  </View>
                )}
                <TouchableOpacity
                  style={styles.noteMain}
                  onPress={() => handleSelectablePress('notes', item.id, () => openEditNote(item))}
                  onLongPress={() => startSelection('notes', item.id)}
                  delayLongPress={350}
                >
                  <Text style={[styles.noteText, { color: theme.text }]} numberOfLines={2}>{item.content}</Text>
                  <Text style={styles.noteDate}>{formatDate(item.created_at)}</Text>
                </TouchableOpacity>
                {getNoteTags(item.category).length > 0 && (
                  <View style={styles.noteTagsRight}>
                    {getNoteTags(item.category).map((tagKey) => {
                      const tagColor = ({ health: '#2ecc71', work: '#3498db', play: '#f1c40f', love: '#e74c3c' })[tagKey] ?? theme.muted;
                      return (
                        <View key={`${item.id}-${tagKey}`} style={[styles.noteTag, { backgroundColor: `${tagColor}33` }]}>
                          {getTagIcon(tagKey, tagColor, 20)}
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            </SwipeableItem>
          )
        }
        renderSectionFooter={({ section }) =>
          section.data.length === 0 ? (
            <Text style={[styles.empty, { color: theme.muted }]}>{section.key === 'items' ? 'Nothing here yet.' : 'No notes yet.'}</Text>
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
  const { theme } = useTheme();
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
            backgroundColor: theme.dangerButton,
            opacity: translateX.interpolate({
              inputRange: [-90, -45, 0],
              outputRange: [1, 0, 0],
              extrapolate: 'clamp',
            }),
          },
        ]}
      >
        <TouchableOpacity style={styles.deleteActionButton} onPress={onDelete}>
        <Text style={[styles.deleteActionText, { color: theme.dangerButtonText }]}>Delete</Text>
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
  const [selectedTags, setSelectedTags] = useState([]);

  useEffect(() => {
    if (visible) {
      setContent(note?.content || '');
      setSelectedTags(getNoteTags(note?.category));
    }
  }, [note, visible]);

  const handleSubmit = () => {
    const trimmedContent = content.trim();
    if (trimmedContent) onSave({ content: trimmedContent, category: selectedTags });
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.formKeyboardAvoiding}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        enabled
      >
        <ScrollView
          contentContainerStyle={styles.formScrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.formContainer, { backgroundColor: theme.background }]}> 
            <View style={styles.formHeader}>
              <TouchableOpacity onPress={onClose}>
                <Text style={[styles.cancelText, { color: theme.muted }]}>Cancel</Text>
              </TouchableOpacity>
              <Text style={[styles.formTitle, { color: theme.text }]}>{note ? 'Edit note' : 'New note'}</Text>
              <TouchableOpacity
                style={[styles.saveIconButton, { backgroundColor: theme.accent }, !content.trim() && styles.disabledButton]}
                onPress={handleSubmit}
                disabled={!content.trim()}
                accessibilityRole="button"
                accessibilityLabel={note ? 'Save changes' : 'Save note'}
                accessibilityState={{ disabled: !content.trim() }}
              >
                <MaterialCommunityIcons name="check" size={24} color={theme.primaryButtonText} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.formInput, { backgroundColor: theme.surface, color: theme.text }]}
              placeholder="Write a note..."
              placeholderTextColor="#888"
              value={content}
              onChangeText={setContent}
              multiline
              autoFocus
              textAlignVertical="top"
              scrollEnabled
            />
            <Text style={[styles.categoryLabel, { color: theme.muted }]}>Tags</Text>
            <View style={styles.categoryRow}>
              {[
                { key: 'none', label: 'None', color: theme.muted },
                { key: 'health', label: 'Health', color: '#2ecc71' },
                { key: 'work', label: 'Work', color: '#3498db' },
                { key: 'play', label: 'Play', color: '#f1c40f' },
                { key: 'love', label: 'Love', color: '#e74c3c' },
              ].map((item) => {
                const isSelected = item.key === 'none' ? selectedTags.length === 0 : selectedTags.includes(item.key);

                return (
                  <TouchableOpacity
                    key={item.key ?? 'none'}
                    style={[styles.categoryButton, { borderColor: item.color }, isSelected && { backgroundColor: item.color }]}
                    onPress={() => {
                      if (item.key === 'none') {
                        setSelectedTags([]);
                        return;
                      }

                      setSelectedTags((currentTags) =>
                        currentTags.includes(item.key)
                          ? currentTags.filter((tagKey) => tagKey !== item.key)
                          : [...currentTags, item.key]
                      );
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={item.key === 'none' ? 'Clear note tags' : `Tag note ${item.label}`}
                  >
                    {item.key === 'none' ? (
                      <Text style={[styles.categoryButtonText, { color: isSelected ? theme.background : item.color }]}>{item.label}</Text>
                    ) : (
                      getTagIcon(item.key, isSelected ? theme.background : item.color, 24)
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function ItemFormModal({ visible, item, onClose, onSave }) {
  const { theme } = useTheme();
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
      <View style={[styles.formContainer, { backgroundColor: theme.background }]}> 
        <View style={styles.formHeader}>
          <TouchableOpacity onPress={onClose}>
            <Text style={[styles.cancelText, { color: theme.muted }]}>Cancel</Text>
          </TouchableOpacity>
          <Text style={[styles.formTitle, { color: theme.text }]}>{item ? 'Edit item' : 'New item'}</Text>
          <View style={styles.headerSpacer} />
        </View>
        <Text style={[styles.formLabel, { color: theme.text }]}>Item</Text>
        <TextInput
          style={[styles.input, { backgroundColor: theme.surface, color: theme.text }]}
          placeholder="What needs doing?"
          placeholderTextColor="#888"
          value={title}
          onChangeText={setTitle}
          autoFocus={!item}
        />
        <Text style={[styles.formLabel, { color: theme.text }]}>Deadline</Text>
        <View style={styles.deadlineRow}>
          <TouchableOpacity style={[styles.input, styles.dateButton, { backgroundColor: theme.surface }]} onPress={() => setShowPicker(true)}>
            <Text style={deadlineDate ? [styles.dateButtonText, { color: theme.text }] : styles.dateButtonPlaceholder}>
              {deadlineDate ? toISODateString(deadlineDate) : 'No deadline'}
            </Text>
          </TouchableOpacity>
          {deadlineDate && (
            <TouchableOpacity onPress={() => setDeadlineDate(null)} style={styles.clearButton}>
              <Text style={styles.clearButtonText}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity style={[styles.saveButton, { backgroundColor: theme.primaryButton }, !title.trim() && styles.disabledButton]} onPress={handleSubmit} disabled={!title.trim()}>
          <Text style={[styles.addButtonText, { color: theme.primaryButtonText }]}>{item ? 'Save changes' : 'Create item'}</Text>
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
                <TouchableOpacity style={[styles.pickerDoneButton, { backgroundColor: theme.primaryButton }]} onPress={() => setShowPicker(false)}>
                  <Text style={[styles.pickerDoneText, { color: theme.primaryButtonText }]}>Done</Text>
                </TouchableOpacity>
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
  const pad = (value) => String(value).padStart(2, '0');
  return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111318', padding: 20 },
  listContent: { paddingBottom: 40 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, marginTop: 4 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
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
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    height: 32,
    width: 32,
  },
  addButtonText: { fontWeight: '700' },
  addIconText: { fontSize: 24, lineHeight: 28, fontWeight: '500' },
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteActionButton: { alignItems: 'center', justifyContent: 'center', padding: 12 },
  deleteActionText: { fontWeight: '700' },
  itemMain: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  noteCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1c1f26', borderRadius: 10, padding: 12 },
  noteMain: { flex: 1 },
  noteTagsRight: { flexDirection: 'row', alignItems: 'center', marginLeft: 8, gap: 6 },
  noteTag: {
    width: 38,
    height: 38,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  noteText: { color: '#fff', fontSize: 15 },
  noteDate: { color: '#666', fontSize: 11, marginTop: 6 },
  editButton: { paddingHorizontal: 8, paddingVertical: 6 },
  noteArchiveButton: { padding: 6 },
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
  noteSelectionCheckbox: { marginLeft: 0 },
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
  formKeyboardAvoiding: { flex: 1 },
  formScrollContent: { flexGrow: 1 },
  formContainer: { flex: 1, backgroundColor: '#111318', padding: 20, paddingTop: 60 },
  formHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 },
  formTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
  cancelText: { color: '#9aa0a6', fontSize: 16 },
  saveIconButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  formLabel: { color: '#fff', fontSize: 15, fontWeight: '600', marginBottom: 8, marginTop: 12 },
  formInput: {
    backgroundColor: '#1c1f26',
    color: '#fff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    height: 220,
  },
  categoryLabel: { fontSize: 13, fontWeight: '600', marginTop: 18, marginBottom: 8 },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryButton: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minWidth: 42,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryButtonText: { fontSize: 13, fontWeight: '700', textTransform: 'capitalize' },
  saveButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 28,
  },
  disabledButton: { opacity: 0.5 },
  saveButtonText: { fontWeight: '700', fontSize: 16 },
  pickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  pickerCard: { backgroundColor: '#fff', borderRadius: 14, padding: 8 },
  pickerDoneButton: { borderRadius: 10, paddingVertical: 10, alignItems: 'center', marginTop: 8 },
  pickerDoneText: { fontWeight: '700' },
});
