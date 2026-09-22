import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { buildReport } from '../db/database';
import { generateAISummary } from '../ai/summarize';
import RatingDial from '../components/RatingDial';

const CATEGORY_META = {
  health: { label: 'Health', color: '#2ecc71' },
  work: { label: 'Work', color: '#3498db' },
  play: { label: 'Play', color: '#f1c40f' },
  love: { label: 'Love', color: '#e74c3c' },
};

export default function ReportsScreen() {
  const [period, setPeriod] = useState('week'); // 'week' | 'month'
  const [report, setReport] = useState(null);
  const [aiSummary, setAiSummary] = useState(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const daysBack = period === 'week' ? 7 : 30;
    const data = await buildReport(daysBack);
    setReport(data);
    setAiSummary(null); // stale once the period changes
  }, [period]);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  const handleGenerateSummary = async () => {
    if (!report) return;
    setLoadingAI(true);
    try {
      const text = await generateAISummary(report, period);
      setAiSummary(text);
    } catch (e) {
      setAiSummary('Could not generate a summary right now: ' + e.message);
    } finally {
      setLoadingAI(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#fff" />}
    >
      <Text style={styles.title}>Dashboard</Text>

      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.toggleButton, period === 'week' && styles.toggleButtonActive]}
          onPress={() => setPeriod('week')}
        >
          <Text style={[styles.toggleText, period === 'week' && styles.toggleTextActive]}>Weekly</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleButton, period === 'month' && styles.toggleButtonActive]}
          onPress={() => setPeriod('month')}
        >
          <Text style={[styles.toggleText, period === 'month' && styles.toggleTextActive]}>Monthly</Text>
        </TouchableOpacity>
      </View>

      {report && (
        <View style={styles.dialGrid}>
          {Object.entries(report).map(([cat, data]) => {
            const meta = CATEGORY_META[cat];
            return (
              <View key={cat} style={styles.dialItem}>
                <RatingDial
                  readOnly
                  size={110}
                  value={data.average ?? 0}
                  displayText={data.average !== null ? data.average.toFixed(1) : '\u2014'}
                  color={meta.color}
                  label={meta.label}
                />
                <Text style={styles.catCount}>
                  {data.count} entr{data.count === 1 ? 'y' : 'ies'}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      <TouchableOpacity style={styles.aiButton} onPress={handleGenerateSummary} disabled={loadingAI}>
        {loadingAI ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.aiButtonText}>Generate AI summary</Text>
        )}
      </TouchableOpacity>

      {aiSummary && (
        <View style={styles.aiCard}>
          <Text style={styles.aiCardTitle}>AI reflection</Text>
          <Text style={styles.aiCardText}>{aiSummary}</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111318' },
  title: { fontSize: 26, fontWeight: '700', color: '#fff', marginBottom: 16 },
  toggleRow: { flexDirection: 'row', marginBottom: 20, gap: 8 },
  toggleButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#1c1f26',
    alignItems: 'center',
  },
  toggleButtonActive: { backgroundColor: '#6C5CE7' },
  toggleText: { color: '#9aa0a6', fontWeight: '600' },
  toggleTextActive: { color: '#fff' },
  dialGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  dialItem: { width: '48%', alignItems: 'center', marginBottom: 20 },
  catCount: { color: '#666', fontSize: 12, marginTop: 4 },
  aiButton: {
    backgroundColor: '#6C5CE7',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  aiButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  aiCard: { backgroundColor: '#1c1f26', borderRadius: 12, padding: 16, marginTop: 16 },
  aiCardTitle: { color: '#6C5CE7', fontWeight: '700', marginBottom: 8 },
  aiCardText: { color: '#fff', lineHeight: 20 },
});
