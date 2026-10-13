import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { AppText as Text, useTheme } from '../theme';

export default function LinearRatingSlider({ value, onChange, color = '#6C5CE7', label }) {
  const { theme } = useTheme();
  const selectedValue = Math.max(0, Math.min(5, value ?? 0));

  return (
    <View style={styles.wrapper}>
      <View style={styles.headerRow}>
        <Text style={[styles.label, { color }]}>{label}</Text>
        <Text style={[styles.value, { color: theme.text }]}>{selectedValue}/5</Text>
      </View>
      <View style={styles.starsRow}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity
            key={star}
            style={styles.starButton}
            onPress={() => onChange(star)}
            accessibilityRole="button"
            accessibilityLabel={`${star} out of 5 for ${label}`}
          >
            <Text style={[styles.star, { color }]}>{star <= selectedValue ? '\u2605' : '\u2606'}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 10 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  label: { fontSize: 16, fontWeight: '700' },
  value: { fontWeight: '600' },
  starsRow: { flexDirection: 'row', alignItems: 'center' },
  starButton: { paddingRight: 8, paddingVertical: 2 },
  star: { fontSize: 30, lineHeight: 34 },
});