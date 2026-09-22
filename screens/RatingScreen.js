import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert } from 'react-native';
import { addRating } from '../db/database';
import LinearRatingSlider from '../components/LinearRatingSlider';

const CATEGORIES = [
  { key: 'health', label: 'Health', color: '#2ecc71' },
  { key: 'work', label: 'Work', color: '#3498db' },
  { key: 'play', label: 'Play', color: '#f1c40f' },
  { key: 'love', label: 'Love', color: '#e74c3c' },
];

export default function RatingScreen({ onSaved }) {
  const [scores, setScores] = useState({ health: 0, work: 0, play: 0, love: 0 });
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const setScore = (cat, val) => setScores((prev) => ({ ...prev, [cat]: val }));

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const c of CATEGORIES) {
        await addRating(c.key, scores[c.key], note || null);
      }
      setScores({ health: 0, work: 0, play: 0, love: 0 });
      setNote('');
      await onSaved?.();
    } catch (e) {
      Alert.alert('Error', 'Could not save ratings: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>How was today?</Text>
      <Text style={styles.subtitle}>Rate each area from 0 to 5</Text>

      {CATEGORIES.map((cat) => (
        <LinearRatingSlider
          key={cat.key}
          value={scores[cat.key]}
          onChange={(v) => setScore(cat.key, v)}
          color={cat.color}
          label={cat.label}
        />
      ))}

      <Text style={styles.label}>Optional note</Text>
      <TextInput
        style={styles.noteInput}
        placeholder="Anything that stood out today..."
        placeholderTextColor="#888"
        value={note}
        onChangeText={setNote}
        multiline
      />

      <TouchableOpacity
        style={[styles.saveButton, saving && { opacity: 0.6 }]}
        onPress={handleSave}
        disabled={saving}
      >
        <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111318', padding: 20, paddingTop: 28 },
  title: { fontSize: 26, fontWeight: '700', color: '#fff', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#9aa0a6', marginBottom: 12 },
  label: { fontSize: 16, fontWeight: '600', color: '#fff', marginBottom: 8 },
  noteInput: {
    backgroundColor: '#1c1f26',
    color: '#fff',
    borderRadius: 10,
    padding: 12,
    minHeight: 52,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  saveButton: {
    backgroundColor: '#6C5CE7',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
