import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, useWindowDimensions, Modal, TextInput, Alert } from 'react-native';
import { buildReport, getRatedDaysInMonth, getRatingsForDay, getTaggedNotesInRange, updateRatingsForDay } from '../db/database';
import { generateAISummary } from '../ai/summarize';
import RatingDial from '../components/RatingDial';
import LinearRatingSlider from '../components/LinearRatingSlider';
import { useTheme } from '../theme';
import MarkdownText from '../components/MarkdownText';
import Octicons from '@expo/vector-icons/Octicons';

const CATEGORY_META = {
  health: { label: 'Health', color: '#2ecc71' },
  work: { label: 'Work', color: '#3498db' },
  play: { label: 'Play', color: '#f1c40f' },
  love: { label: 'Love', color: '#e74c3c' },
};

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const getMonthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

const getDateKey = (date) => `${getMonthKey(date)}-${String(date.getDate()).padStart(2, '0')}`;

export default function ReportsScreen() {
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  const dialSize = Math.max(52, Math.min(82, Math.floor((width - 40) / 4) - 8));
  const [period, setPeriod] = useState('week'); // 'week' | 'month'
  const [report, setReport] = useState(null);
  const [aiSummary, setAiSummary] = useState(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [ratedDays, setRatedDays] = useState([]);
  const [loadingCalendar, setLoadingCalendar] = useState(true);
  const [selectedDate, setSelectedDate] = useState(null);
  const [dayScores, setDayScores] = useState(null);
  const [dayNote, setDayNote] = useState('');
  const [dayPage, setDayPage] = useState(1);
  const [loadingDay, setLoadingDay] = useState(false);
  const [savingDay, setSavingDay] = useState(false);

  const load = useCallback(async () => {
    const daysBack = period === 'week' ? 7 : 30;
    const data = await buildReport(daysBack);
    setReport(data);
    setAiSummary(null); // stale once the period changes
  }, [period]);

  useEffect(() => {
    load();
  }, [load]);

  const monthKey = getMonthKey(calendarMonth);
  const loadRatedDays = useCallback(async () => {
    setLoadingCalendar(true);
    try {
      setRatedDays(await getRatedDaysInMonth(monthKey));
    } finally {
      setLoadingCalendar(false);
    }
  }, [monthKey]);

  useEffect(() => {
    loadRatedDays();
  }, [loadRatedDays]);

  const calendarCells = [
    ...Array(calendarMonth.getDay()).fill(null),
    ...Array.from(
      { length: new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate() },
      (_, index) => index + 1
    ),
  ];
  const today = new Date();
  const isCurrentMonth = calendarMonth.getFullYear() === today.getFullYear()
    && calendarMonth.getMonth() === today.getMonth();

  const refresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([load(), loadRatedDays()]);
    } finally {
      setRefreshing(false);
    }
  };

  const handleGenerateSummary = async () => {
    if (!report) return;
    setLoadingAI(true);
    try {
      const until = new Date();
      const since = new Date(until);
      since.setDate(since.getDate() - (period === 'week' ? 7 : 30));
      const taggedNotes = await getTaggedNotesInRange(since.toISOString(), until.toISOString());
      const text = await generateAISummary(report, period, taggedNotes);
      setAiSummary(text);
    } catch (e) {
      setAiSummary('Could not generate a summary right now: ' + e.message);
    } finally {
      setLoadingAI(false);
    }
  };

  const handleSelectDay = async (dateKey) => {
    setSelectedDate(dateKey);
    setDayPage(1);
    setLoadingDay(true);
    try {
      const rows = await getRatingsForDay(dateKey);
      if (rows.length === 0) {
        setSelectedDate(null);
        return;
      }
      const scores = { health: 0, work: 0, play: 0, love: 0 };
      for (const row of [...rows].reverse()) {
        scores[row.category] = row.score;
      }
      setDayScores(scores);
      setDayNote(rows[0].note ?? '');
    } catch (error) {
      setSelectedDate(null);
      Alert.alert('Could not load rating', error.message);
    } finally {
      setLoadingDay(false);
    }
  };

  const handleSaveDay = async () => {
    if (!selectedDate || !dayScores) return;
    setSavingDay(true);
    try {
      await updateRatingsForDay(selectedDate, dayScores, dayNote.trim() || null);
      setSelectedDate(null);
      setDayScores(null);
      await Promise.all([load(), loadRatedDays()]);
    } catch (error) {
      Alert.alert('Could not save rating', error.message);
    } finally {
      setSavingDay(false);
    }
  };

  const ratedAverages = report
    ? Object.values(report).map((data) => data.average).filter((average) => average !== null)
    : [];
  const lowestAverage = ratedAverages.length > 0 ? Math.min(...ratedAverages) : null;

  return (
    <>
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.accent} />}
    >
      <View style={styles.titleRow}>
        <Text style={[styles.title, { color: theme.text }]}>Dashboard</Text>
        <TouchableOpacity
          style={[styles.aiButton, { backgroundColor: theme.primaryButton }]}
          onPress={handleGenerateSummary}
          disabled={loadingAI}
          accessibilityRole="button"
          accessibilityLabel="Generate AI summary"
        >
          {loadingAI ? (
            <ActivityIndicator color={theme.primaryButtonText} />
          ) : (
            <Octicons name="sparkles-fill" size={24} color={theme.primaryButtonText} />
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.toggleButton, { backgroundColor: theme.surface }, period === 'week' && { backgroundColor: theme.primaryButton }]}
          onPress={() => setPeriod('week')}
        >
          <Text style={[styles.toggleText, { color: theme.muted }, period === 'week' && { color: theme.primaryButtonText }]}>Weekly</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleButton, { backgroundColor: theme.surface }, period === 'month' && { backgroundColor: theme.primaryButton }]}
          onPress={() => setPeriod('month')}
        >
          <Text style={[styles.toggleText, { color: theme.muted }, period === 'month' && { color: theme.primaryButtonText }]}>Monthly</Text>
        </TouchableOpacity>
      </View>

      {report && (
        <View style={styles.dialGrid}>
          {Object.entries(report).map(([cat, data]) => {
            const meta = CATEGORY_META[cat];
            const isLowest = lowestAverage !== null && data.average === lowestAverage;
            return (
              <View
                key={cat}
                style={[
                  styles.dialItem,
                  lowestAverage !== null && !isLowest && styles.dimmedDial,
                ]}
              >
                <RatingDial
                  readOnly
                  size={dialSize}
                  compact
                  value={data.average ?? 0}
                  displayText={data.average !== null ? data.average.toFixed(1) : '\u2014'}
                  color={meta.color}
                  label={meta.label}
                  glow={isLowest}
                />
              </View>
            );
          })}
        </View>
      )}

      <View style={[styles.calendar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.calendarHeader}>
          <TouchableOpacity
            style={styles.monthArrow}
            onPress={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}
            accessibilityRole="button"
            accessibilityLabel="Previous month"
          >
            <Text style={[styles.monthArrowText, { color: theme.text }]}>{'\u2039'}</Text>
          </TouchableOpacity>
          <Text style={[styles.monthTitle, { color: theme.text }]}>
            {calendarMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
          </Text>
          <TouchableOpacity
            style={[styles.monthArrow, isCurrentMonth && styles.disabledArrow]}
            onPress={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}
            disabled={isCurrentMonth}
            accessibilityRole="button"
            accessibilityLabel="Next month"
          >
            <Text style={[styles.monthArrowText, { color: isCurrentMonth ? theme.muted : theme.text }]}>{'\u203a'}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.calendarGrid}>
          {WEEKDAYS.map((weekday) => (
            <Text key={weekday} style={[styles.weekday, { color: theme.muted }]}>{weekday}</Text>
          ))}
          {calendarCells.map((day, index) => {
            const dateKey = day ? getDateKey(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day)) : null;
            const wasRated = dateKey && ratedDays.includes(dateKey);
            const isToday = dateKey === getDateKey(today);
            return (
              <TouchableOpacity
                key={day ?? `empty-${index}`}
                style={styles.dayCell}
                onPress={() => wasRated && handleSelectDay(dateKey)}
                disabled={!wasRated || loadingDay}
                accessibilityRole={wasRated ? 'button' : undefined}
                accessibilityLabel={wasRated ? `Edit rating for ${dateKey}` : undefined}
              >
                {day ? (
                  <View
                    style={[
                      styles.dayNumber,
                      wasRated && { backgroundColor: theme.accent },
                      isToday && { borderColor: theme.primaryButton, borderWidth: 2 },
                    ]}
                    accessible
                    accessibilityLabel={`${calendarMonth.toLocaleDateString(undefined, { month: 'long' })} ${day}${wasRated ? ', rating saved' : ''}${isToday ? ', today' : ''}`}
                  >
                    <Text style={[styles.dayText, { color: wasRated ? '#293326' : theme.text }]}>{day}</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={styles.calendarLegend}>
          {loadingCalendar ? (
            <ActivityIndicator size="small" color={theme.accent} />
          ) : (
            <>
              <View style={[styles.legendSwatch, { backgroundColor: theme.accent }]} />
              <Text style={[styles.legendText, { color: theme.muted }]}>Daily rating saved</Text>
            </>
          )}
        </View>
      </View>

    </ScrollView>
    <Modal
      visible={Boolean(aiSummary)}
      transparent
      animationType="fade"
      onRequestClose={() => setAiSummary(null)}
    >
      <View style={styles.aiModalOverlay}>
        <View style={[styles.aiModal, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.aiModalHeader}>
            <Text style={[styles.aiCardTitle, { color: theme.accent }]}>AI reflection</Text>
            <TouchableOpacity
              style={styles.aiModalClose}
              onPress={() => setAiSummary(null)}
              accessibilityRole="button"
              accessibilityLabel="Close AI reflection"
            >
              <Octicons name="x" size={20} color={theme.text} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.aiModalBody} showsVerticalScrollIndicator>
            <MarkdownText>{aiSummary ?? ''}</MarkdownText>
          </ScrollView>
        </View>
      </View>
    </Modal>
    <Modal
      visible={Boolean(selectedDate)}
      transparent
      animationType="slide"
      onRequestClose={() => setSelectedDate(null)}
    >
      <View style={styles.dayModalOverlay}>
        <View style={[styles.dayModal, { backgroundColor: theme.background }]}>
          <View style={styles.dayModalHeader}>
            <Text style={[styles.dayModalTitle, { color: theme.text }]}>Edit rating</Text>
            <TouchableOpacity
              style={styles.dayModalClose}
              onPress={() => setSelectedDate(null)}
              disabled={savingDay}
              accessibilityRole="button"
              accessibilityLabel="Close rating editor"
            >
              <Octicons name="x" size={20} color={theme.text} />
            </TouchableOpacity>
          </View>
          <Text style={[styles.dayModalDate, { color: theme.muted }]}>
            {selectedDate ? new Date(`${selectedDate}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : ''}
          </Text>
          {loadingDay || !dayScores ? (
            <ActivityIndicator color={theme.accent} style={styles.dayLoading} />
          ) : (
            <ScrollView keyboardShouldPersistTaps="handled">
              {dayPage === 1 ? (
                <>
                  {Object.entries(CATEGORY_META).map(([category, meta]) => (
                    <LinearRatingSlider
                      key={category}
                      value={dayScores[category]}
                      onChange={(score) => setDayScores((previous) => ({ ...previous, [category]: score }))}
                      color={meta.color}
                      label={meta.label}
                    />
                  ))}
                  <TouchableOpacity
                    style={[styles.daySaveButton, styles.dayNextButton, { backgroundColor: theme.primaryButton }]}
                    onPress={() => setDayPage(2)}
                    accessibilityRole="button"
                  >
                    <Text style={[styles.daySaveText, { color: theme.primaryButtonText }]}>Next</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={[styles.dayPageSubtitle, { color: theme.muted }]}>Edit the optional note for this day.</Text>
                  <TextInput
                    style={[styles.dayNoteInput, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]}
                    value={dayNote}
                    onChangeText={setDayNote}
                    placeholderTextColor={theme.muted}
                    multiline
                  />
                  <View style={styles.dayButtonRow}>
                    <TouchableOpacity
                      style={[styles.dayBackButton, { borderColor: theme.border }]}
                      onPress={() => setDayPage(1)}
                      disabled={savingDay}
                      accessibilityRole="button"
                    >
                      <Text style={[styles.dayBackText, { color: theme.text }]}>Back</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.daySaveButton, styles.dayNextButton, { backgroundColor: theme.primaryButton }, savingDay && styles.daySaveDisabled]}
                      onPress={handleSaveDay}
                      disabled={savingDay}
                      accessibilityRole="button"
                    >
                      <Text style={[styles.daySaveText, { color: theme.primaryButtonText }]}>{savingDay ? 'Saving...' : 'Save changes'}</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111318' },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  title: { fontSize: 26, fontWeight: '700', color: '#fff' },
  calendar: { borderWidth: 1, borderRadius: 10, padding: 14, marginBottom: 20 },
  calendarHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  monthArrow: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  disabledArrow: { opacity: 0.45 },
  monthArrowText: { fontSize: 30, lineHeight: 32 },
  monthTitle: { fontSize: 17, fontWeight: '700' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  weekday: { width: '14.2857%', textAlign: 'center', fontSize: 12, fontWeight: '600', paddingBottom: 6 },
  dayCell: { width: '14.2857%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  dayNumber: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', borderColor: 'transparent' },
  dayText: { fontSize: 14, fontWeight: '600' },
  calendarLegend: { minHeight: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 8 },
  legendSwatch: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 12 },
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
  dialGrid: { flexDirection: 'row', flexWrap: 'nowrap' },
  dialItem: { width: '25%', alignItems: 'center', marginBottom: 20 },
  dimmedDial: { opacity: 0.45 },
  aiButton: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiButtonText: { fontWeight: '700', fontSize: 16 },
  aiModalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.55)', justifyContent: 'center', padding: 20 },
  aiModal: { maxHeight: '80%', borderWidth: 1, borderRadius: 10, padding: 16 },
  aiModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  aiModalClose: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  aiModalBody: { flexGrow: 0 },
  aiCardTitle: { fontWeight: '700', fontSize: 17 },
  dayModalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.55)', justifyContent: 'center', padding: 20 },
  dayModal: { maxHeight: '85%', borderRadius: 10, padding: 18 },
  dayModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dayModalTitle: { fontSize: 20, fontWeight: '700' },
  dayModalClose: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  dayModalDate: { fontSize: 14, marginBottom: 16 },
  dayLoading: { paddingVertical: 36 },
  dayPageTitle: { fontSize: 22, fontWeight: '700', marginBottom: 4 },
  dayPageSubtitle: { fontSize: 14, marginBottom: 12 },
  dayNoteInput: { minHeight: 100, borderWidth: 1, borderRadius: 8, padding: 12, textAlignVertical: 'top', marginTop: 4, marginBottom: 16 },
  dayButtonRow: { flexDirection: 'row', gap: 12 },
  dayBackButton: { flex: 1, borderWidth: 1, borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  dayBackText: { fontSize: 16, fontWeight: '700' },
  dayNextButton: { flex: 1 },
  daySaveButton: { borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginBottom: 8 },
  daySaveDisabled: { opacity: 0.6 },
  daySaveText: { fontSize: 16, fontWeight: '700' },
});
