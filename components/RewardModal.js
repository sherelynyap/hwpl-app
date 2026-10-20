import React from 'react';
import { Modal, StyleSheet, TouchableOpacity, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { AppText as Text, useTheme } from '../theme';

export default function RewardModal({ rewards, onClose }) {
  const { theme } = useTheme();
  const visible = rewards.length > 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={[styles.overlay, { backgroundColor: theme.overlay }]}>
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={[styles.iconCircle, { backgroundColor: theme.background }]}>
            <MaterialIcons name="auto-awesome" size={34} color={theme.accent} />
          </View>
          <Text style={[styles.rewardText, { color: theme.text }]}>{rewards[0]}</Text>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: theme.primaryButton }]}
            onPress={onClose}
            accessibilityRole="button"
          >
            <Text style={[styles.buttonText, { color: theme.primaryButtonText }]}>Continue</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 360, borderWidth: 1, borderRadius: 22, padding: 22, alignItems: 'center' },
  iconCircle: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  rewardText: { fontSize: 20, lineHeight: 27, fontWeight: '700', textAlign: 'center', marginBottom: 20 },
  button: { width: '100%', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  buttonText: { fontSize: 16, fontWeight: '700' },
});
