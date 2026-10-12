import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Foundation from '@expo/vector-icons/Foundation';
import AntDesign from '@expo/vector-icons/AntDesign';
import Feather from '@expo/vector-icons/Feather';
import { useTheme } from '../theme';

const TABS = [
  { key: 'reports', label: 'Dashboard', iconFamily: AntDesign, icon: 'dashboard' },
  { key: 'astro', label: 'Astro', iconFamily: AntDesign, icon: 'moon' },
  { key: 'items', label: 'Items', iconFamily: Foundation, icon: 'clipboard-notes' },
  { key: 'settings', label: 'Settings', iconFamily: Feather, icon: 'settings' },
];

export default function TabBar({ active, onChange }) {
  const { theme } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
      {TABS.map((tab) => {
        const isActive = active === tab.key;
        const Icon = tab.iconFamily;
        return (
          <TouchableOpacity key={tab.key} style={styles.tab} onPress={() => onChange(tab.key)}>
            <Icon name={tab.icon} size={24} color={isActive ? theme.text : theme.muted} />
            <Text style={[styles.label, { color: theme.muted }, isActive && { color: theme.text }]}>
              {tab.label}
            </Text>
            {isActive && <View style={[styles.indicator, { backgroundColor: theme.accent }]} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#1c1f26',
    borderTopWidth: 1,
    borderTopColor: '#2a2e38',
    paddingBottom: 20,
    paddingTop: 10,
  },
  tab: { flex: 1, alignItems: 'center' },
  label: { color: '#9aa0a6', fontSize: 12, fontWeight: '600' },
  indicator: {
    marginTop: 6,
    width: 20,
    height: 3,
    borderRadius: 2,
  },
});
