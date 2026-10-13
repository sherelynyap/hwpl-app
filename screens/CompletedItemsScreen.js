import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, TouchableOpacity, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { getCompletedItems } from '../db/database';
import { AppText as Text, useTheme } from '../theme';

export default function CompletedItemsScreen({ onBack }) {
  const { theme } = useTheme();
  const [items, setItems] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setItems(await getCompletedItems());
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

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Back to outstanding items"
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text }]}>Completed items</Text>
      </View>
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={items.length === 0 ? styles.emptyContent : styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.accent}
            colors={[theme.accent]}
          />
        }
        ListEmptyComponent={<Text style={[styles.empty, { color: theme.muted }]}>No completed items yet.</Text>}
        renderItem={({ item }) => (
          <View style={[styles.row, { backgroundColor: theme.surface }]}>
            <MaterialCommunityIcons name="check-circle" size={22} color={theme.accent} />
            <View style={styles.itemContent}>
              <Text style={[styles.itemTitle, { color: theme.text }]}>{item.title}</Text>
              {item.deadline ? <Text style={[styles.itemDeadline, { color: theme.muted }]}>Due {item.deadline}</Text> : null}
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111318', padding: 20 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, marginTop: 4 },
  backButton: { width: 40, height: 40, alignItems: 'flex-start', justifyContent: 'center', marginRight: 8 },
  title: { fontSize: 26, lineHeight: 32, fontWeight: '700' },
  listContent: { paddingBottom: 40 },
  emptyContent: { flexGrow: 1 },
  empty: { textAlign: 'center', marginTop: 40 },
  row: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, padding: 12, marginBottom: 8 },
  itemContent: { flex: 1, marginLeft: 12 },
  itemTitle: { fontSize: 15, fontWeight: '600' },
  itemDeadline: { fontSize: 12, marginTop: 2 },
});