import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';
import { getBirthChart, getCachedMonthlyTheme, saveMonthlyTheme } from '../db/database';
import { computeCurrentTransits, computeMoonPhase, nextMoonQuarters, computeRetrogrades } from '../astrology/chart';
import { generateMonthlyTheme } from '../ai/monthlyTheme';
import { useTheme } from '../theme';
import BirthChartScreen from './BirthChartScreen';
import MarkdownText from '../components/MarkdownText';

const PLANET_LABELS_SHORT = {
  mercury: 'Mercury', venus: 'Venus', mars: 'Mars', jupiter: 'Jupiter', saturn: 'Saturn',
};
const PLANET_LABELS = {
  sun: 'Sun', moon: 'Moon', mercury: 'Mercury', venus: 'Venus',
  mars: 'Mars', jupiter: 'Jupiter', saturn: 'Saturn',
};

function monthKeyFor(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}
function monthLabelFor(date) {
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function moonCard(moonSign, theme) {
  return (
    <View style={[styles.todayCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Text style={[styles.todayLabel, { color: theme.muted }]}>Today's Moon</Text>
      <Text style={[styles.todaySign, { color: theme.accentText }]}>{moonSign}</Text>
    </View>
  );
}
export default function AstrologyScreen() {
  const { theme } = useTheme();
  const [chart, setChart] = useState(undefined); // undefined = loading, null = not set up
  const [editing, setEditing] = useState(false);
  const [activePage, setActivePage] = useState('sky');
  const [monthlyTheme, setMonthlyTheme] = useState(null);
  const [loadingTheme, setLoadingTheme] = useState(false);

  const now = new Date();
  const monthKey = monthKeyFor(now);
  const transits = computeCurrentTransits(now);
  const todayMoonSign = transits.moonSign;
  const moonPhase = computeMoonPhase(now);
  const moonQuarters = nextMoonQuarters(now);
  const retrogrades = computeRetrogrades(now).filter((r) => r.retrograde);

  const load = useCallback(async () => {
    const existing = await getBirthChart();
    setChart(existing || null);
    if (existing) {
      const cached = await getCachedMonthlyTheme(monthKey);
      setMonthlyTheme(cached?.theme_text ?? null);
    }
  }, [monthKey]);

  const placements = chart?.placements_json ? JSON.parse(chart.placements_json) : null;

  useEffect(() => { load(); }, [load]);

  const handleGenerate = async () => {
    if (!chart) return;
    setLoadingTheme(true);
    try {
      const text = await generateMonthlyTheme(
        { sunSign: chart.sun_sign, moonSign: chart.moon_sign, ascendantSign: chart.ascendant_sign },
        transits,
        monthLabelFor(now)
      );
      await saveMonthlyTheme(monthKey, text);
      setMonthlyTheme(text);
    } catch (e) {
      setMonthlyTheme('Could not generate a theme right now: ' + e.message);
    } finally {
      setLoadingTheme(false);
    }
  };

  if (chart === undefined) {
    return <View style={[styles.centered, { backgroundColor: theme.background }]}><ActivityIndicator color={theme.accent} /></View>;
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>Astrology</Text>
        <Text style={[styles.subtitle, { color: theme.muted }]}>{monthLabelFor(now)}</Text>
        <View style={[styles.pageTabs, { borderColor: theme.border }]}>
          <TouchableOpacity
            accessibilityRole="tab"
            accessibilityState={{ selected: activePage === 'sky' }}
            onPress={() => setActivePage('sky')}
            style={[styles.pageTab, activePage === 'sky' && { backgroundColor: theme.accent }]}
          >
            <Text style={[styles.pageTabText, { color: activePage === 'sky' ? theme.primaryButtonText : theme.muted }]}>Moon & transits</Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="tab"
            accessibilityState={{ selected: activePage === 'chart' }}
            onPress={() => setActivePage('chart')}
            style={[styles.pageTab, activePage === 'chart' && { backgroundColor: theme.accent }]}
          >
            <Text style={[styles.pageTabText, { color: activePage === 'chart' ? theme.primaryButtonText : theme.muted }]}>Birth chart</Text>
          </TouchableOpacity>
        </View>
      </View>

      {activePage === 'sky' ? (
        <ScrollView style={styles.pageContent} contentContainerStyle={styles.pagePadding}>
          <View style={[styles.skyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View
              accessible
              accessibilityLabel={`${moonPhase.phaseName}, ${Math.round(moonPhase.illumination * 100)} percent illuminated`}
              style={styles.moonPhaseLayout}
            >
              <View style={styles.moonPhaseCopy}>
                <Text numberOfLines={1} ellipsizeMode="tail" style={[styles.moonPhaseText, { color: theme.text }]}>
                  {moonPhase.phaseName}
                </Text>
                {moonQuarters.nextFullMoon && (
                  <Text style={[styles.skyDetail, { color: theme.muted }]}>
                    Next full moon: {moonQuarters.nextFullMoon.toLocaleDateString()}
                  </Text>
                )}
                {moonQuarters.nextNewMoon && (
                  <Text style={[styles.skyDetail, { color: theme.muted }]}>
                    Next new moon: {moonQuarters.nextNewMoon.toLocaleDateString()}
                  </Text>
                )}
              </View>
              <View style={styles.moonPhaseVisual}>
                <MoonPhaseVisual phaseAngle={moonPhase.phaseAngle} theme={theme} />
              </View>
            </View>
            {retrogrades.length > 0 ? (
              <Text style={[styles.retrogradeText, { color: theme.accentText }]}>
                Retrograde: {retrogrades.map((r) => PLANET_LABELS_SHORT[r.body]).join(', ')}
              </Text>
            ) : (
              <Text style={[styles.skyDetail, { color: theme.muted }]}>No planets currently retrograde</Text>
            )}
          </View>

          {moonCard(todayMoonSign, theme)}
          <Text style={[styles.sectionHeading, { color: theme.text }]}>This month's transits</Text>
          <View style={styles.signRow}>
            <SignBadge label="Sun" value={transits.sunSign} />
            <SignBadge label="Venus" value={transits.venusSign} />
            <SignBadge label="Mars" value={transits.marsSign} />
          </View>

        </ScrollView>
      ) : (
        !chart ? (
          <BirthChartScreen onSaved={load} />
        ) : (
          <ScrollView style={styles.pageContent} contentContainerStyle={styles.pagePadding}>
            <View style={styles.signRow}>
              <SignBadge label="Sun" value={chart.sun_sign} />
              <SignBadge label="Moon" value={chart.moon_sign} />
              <SignBadge label="Rising" value={chart.ascendant_sign} />
            </View>
            {placements && (
              <>
                <Text style={[styles.sectionHeading, { color: theme.text }]}>Full chart</Text>
                <View style={[styles.placementList, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  {placements.map((p) => (
                    <View key={p.body} style={styles.placementRow}>
                      <Text style={[styles.placementPlanet, { color: theme.muted }]}>{PLANET_LABELS[p.body] || p.body}</Text>
                      <Text style={[styles.placementSign, { color: theme.text }]}>{p.sign}</Text>
                      {p.house && <Text style={[styles.placementHouse, { color: theme.accentText }]}>House {p.house}</Text>}
                    </View>
                  ))}
                </View>
              </>
            )}
            <TouchableOpacity style={[styles.themeButton, { backgroundColor: theme.primaryButton }]} onPress={handleGenerate} disabled={loadingTheme}>
              {loadingTheme ? <ActivityIndicator color={theme.primaryButtonText} /> : (
                <Text style={[styles.themeButtonText, { color: theme.primaryButtonText }]}>
                  {monthlyTheme ? 'Regenerate this month\u2019s theme' : 'Generate this month\u2019s theme'}
                </Text>
              )}
            </TouchableOpacity>
            {monthlyTheme && (
              <View style={[styles.themeCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <MarkdownText>{monthlyTheme}</MarkdownText>
              </View>
            )}
            <TouchableOpacity onPress={() => setEditing(true)} style={styles.editLink}>
              <Text style={[styles.editLinkText, { color: theme.accentText }]}>Edit birth chart</Text>
            </TouchableOpacity>
          </ScrollView>
        )
      )}

      <Modal visible={editing && !!chart} transparent animationType="slide" onRequestClose={() => setEditing(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.editModal, { backgroundColor: theme.background }]}>
            <TouchableOpacity onPress={() => setEditing(false)} style={styles.modalClose} accessibilityLabel="Close birth chart editor">
              <Text style={[styles.modalCloseText, { color: theme.text }]}>Close</Text>
            </TouchableOpacity>
            <BirthChartScreen onSaved={() => { setEditing(false); load(); }} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

function MoonPhaseVisual({ phaseAngle, theme }) {
  const size = 58;
  const center = size / 2;
  const radius = 24;
  const normalizedPhase = ((phaseAngle % 360) + 360) % 360;
  const isWaning = normalizedPhase > 180;
  const halfPhase = isWaning ? 360 - normalizedPhase : normalizedPhase;
  const terminator = Math.cos((halfPhase * Math.PI) / 180);
  const terminatorRadius = Math.max(Math.abs(terminator) * radius, 0.01);
  const terminatorSweep = terminator >= 0 ? 1 : 0;
  const path = [
    `M ${center} ${center - radius}`,
    `A ${terminatorRadius} ${radius} 0 0 ${terminatorSweep} ${center} ${center + radius}`,
    `A ${radius} ${radius} 0 0 0 ${center} ${center - radius}`,
    'Z',
  ].join(' ');

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle cx={center} cy={center} r={radius} fill="#343943" />
      <G transform={isWaning ? `translate(${size} 0) scale(-1 1)` : undefined}>
        <Path d={path} fill="#f4e8c8" />
      </G>
      <Circle cx={center} cy={center} r={radius} fill="none" stroke="#858994" strokeWidth={1} />
    </Svg>
  );
}

function SignBadge({ label, value }) {
  const { theme } = useTheme();

  return (
    <View style={[styles.badge, { backgroundColor: theme.surface }]}>
      <Text style={[styles.badgeLabel, { color: theme.muted }]}>{label}</Text>
      <Text style={[styles.badgeValue, { color: theme.text }]}>{value || '\u2014'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 16 },
  pageContent: { flex: 1 },
  pagePadding: { padding: 20, paddingBottom: 60 },
  pageTabs: { flexDirection: 'row', borderWidth: 1, borderRadius: 10, padding: 3, marginBottom: 12 },
  pageTab: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 7 },
  pageTabText: { fontSize: 13, fontWeight: '600' },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  editModal: { height: '92%', borderTopLeftRadius: 18, borderTopRightRadius: 18, overflow: 'hidden', paddingTop: 8 },
  modalClose: { alignSelf: 'flex-end', paddingHorizontal: 20, paddingVertical: 10 },
  modalCloseText: { fontWeight: '600' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 26, fontWeight: '700' },
  subtitle: { fontSize: 14, marginBottom: 20 },
  sectionHeading: { fontSize: 16, fontWeight: '700', marginTop: 8, marginBottom: 10 },
  signRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  badge: { flex: 1, borderRadius: 12, padding: 12, alignItems: 'center' },
  badgeLabel: { fontSize: 12, marginBottom: 4 },
  badgeValue: { fontWeight: '700' },
  themeButton: { borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  themeButtonText: { fontWeight: '700', fontSize: 16 },
  themeCard: { borderWidth: 1, borderRadius: 12, padding: 16, marginTop: 16 },
  editLink: { marginTop: 20, alignItems: 'center' },
  editLinkText: { fontWeight: '600' },
  placementList: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 8 },
  placementRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  placementPlanet: { width: 80 },
  placementSign: { fontWeight: '600', flex: 1 },
  placementHouse: { fontSize: 12 },
  skyCard: { borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 20 },
  moonPhaseLayout: { paddingRight: 64 },
  moonPhaseCopy: { flex: 1 },
  moonPhaseVisual: { position: 'absolute', right: 0, top: 0 },
  moonPhaseText: { fontWeight: '700', fontSize: 16, marginBottom: 2 },
  skyDetail: { fontSize: 13, marginBottom: 2 },
  retrogradeText: { fontSize: 13, fontWeight: '600' },
  todayCard: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
  },
  todayLabel: { fontSize: 12, marginBottom: 4 },
  todaySign: { fontSize: 22, fontWeight: '800' },
});