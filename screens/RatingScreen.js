import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { addRating } from '../db/database';
import LinearRatingSlider from '../components/LinearRatingSlider';
import { AppText as Text, AppTextInput as TextInput, useTheme } from '../theme';

const CATEGORIES = [
  { key: 'health', label: 'Health', color: '#2ecc71' },
  { key: 'work', label: 'Work', color: '#3498db' },
  { key: 'play', label: 'Play', color: '#f1c40f' },
  { key: 'love', label: 'Love', color: '#e74c3c' },
];

export default function RatingScreen({ onSaved, onContentHeightChange }) {
  const { theme } = useTheme();
  const [scores, setScores] = useState({ health: 0, work: 0, play: 0, love: 0 });
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);

  const setScore = (cat, val) => setScores((prev) => ({ ...prev, [cat]: val }));

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const c of CATEGORIES) {
        await addRating(c.key, scores[c.key], note || null);
      }
      setScores({ health: 0, work: 0, play: 0, love: 0 });
      setNote('');
      setPage(1);
      await onSaved?.();
    } catch (e) {
      Alert.alert('Error', 'Could not save ratings: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: theme.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={(_, contentHeight) => onContentHeightChange?.(contentHeight)}
        >
          {page === 1 ? (
            <>
              <Text style={[styles.title, { color: theme.text }]}>How was today?</Text>
              <Text style={[styles.subtitle, { color: theme.muted }]}>Rate each area from 0 to 5</Text>

              {CATEGORIES.map((cat) => (
                <LinearRatingSlider
                  key={cat.key}
                  value={scores[cat.key]}
                  onChange={(v) => setScore(cat.key, v)}
                  color={cat.color}
                  label={cat.label}
                />
              ))}

              <TouchableOpacity
                style={[styles.saveButton, styles.nextPageButton, { backgroundColor: theme.primaryButton }]}
                onPress={() => setPage(2)}
              >
                <Text style={[styles.saveButtonText, { color: theme.primaryButtonText }]}>Next</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={[styles.title, { color: theme.text }]}>Anything else?</Text>
              <Text style={[styles.subtitle, { color: theme.muted }]}>Add an optional note about today.</Text>

              <TextInput
                style={[styles.noteInput, { backgroundColor: theme.surface, color: theme.text }]}
                placeholder="Anything that stood out today..."
                placeholderTextColor="#888"
                value={note}
                onChangeText={setNote}
                multiline
              />

              <View style={styles.buttonRow}>
                <TouchableOpacity style={[styles.backButton, { borderColor: theme.border }]} onPress={() => setPage(1)}>
                  <Text style={[styles.backButtonText, { color: theme.text }]}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveButton, styles.nextButton, { backgroundColor: theme.primaryButton }, saving && { opacity: 0.6 }]}
                  onPress={handleSave}
                  disabled={saving}
                >
                  <Text style={[styles.saveButtonText, { color: theme.primaryButtonText }]}>{saving ? 'Saving...' : 'Save'}</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingTop: 28 },
  title: { fontSize: 26, fontWeight: '700', marginBottom: 4 },
  subtitle: { fontSize: 14, marginBottom: 12 },
  noteInput: {
    borderRadius: 10,
    padding: 12,
    minHeight: 52,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  saveButton: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  nextPageButton: { marginTop: 10 },
  saveButtonText: { fontWeight: '700', fontSize: 16 },
  buttonRow: { flexDirection: 'row', gap: 12 },
  backButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#3a3f4a',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  backButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  nextButton: { flex: 1 },
});
