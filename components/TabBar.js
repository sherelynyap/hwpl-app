import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

const TABS = [
  { key: 'reports', label: 'Dashboard' },
  { key: 'items', label: 'Items' },
  { key: 'settings', label: 'Settings' },
];

export default function TabBar({ active, onChange }) {
  return (
    <View style={styles.container}>
      {TABS.map((tab) => {
        const isActive = active === tab.key;
        return (
          <TouchableOpacity key={tab.key} style={styles.tab} onPress={() => onChange(tab.key)}>
            <Text style={[styles.label, isActive && styles.labelActive]}>{tab.label}</Text>
            {isActive && <View style={styles.indicator} />}
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
  labelActive: { color: '#fff' },
  indicator: {
    marginTop: 6,
    width: 20,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#6C5CE7',
  },
});
