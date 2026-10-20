import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, View, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, useWindowDimensions, Modal, Alert } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { buildReport, drawCharacter, getCharacterProgress, getRatedDaysInMonth, getRatingsForDay, getTaggedNotesInRange, recordHistoricalRatingProgress, setActiveCharacter, updateRatingsForDay } from '../db/database';
import { generateAISummary } from '../ai/summarize';
import RatingDial from '../components/RatingDial';
import LinearRatingSlider from '../components/LinearRatingSlider';
import { AppText as Text, AppTextInput as TextInput, useTheme } from '../theme';
import MarkdownText from '../components/MarkdownText';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Octicons from '@expo/vector-icons/Octicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CHARACTERS, GACHA_CHARACTERS } from '../characters';
import RewardModal from '../components/RewardModal';

const CATEGORY_META = {
  health: { label: 'Health', color: '#2ecc71' },
  work: { label: 'Work', color: '#3498db' },
  play: { label: 'Play', color: '#f1c40f' },
  love: { label: 'Love', color: '#e74c3c' },
};

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const getMonthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

const getDateKey = (date) => `${getMonthKey(date)}-${String(date.getDate()).padStart(2, '0')}`;

function DashboardAvatar({ size, sceneWidth, playScore, healthScore, isSleeping, characterId }) {
  const [frame, setFrame] = useState(0);
  const [walkingLeft, setWalkingLeft] = useState(false);
  const bob = useRef(new Animated.Value(0)).current;
  const isSick = !isSleeping && typeof healthScore === 'number' && healthScore < 3;
  const isSitting = !isSleeping && !isSick && typeof playScore === 'number' && playScore <= 3;
  const isWalking = !isSleeping && !isSick && typeof playScore === 'number' && playScore >= 4
    && typeof healthScore === 'number' && healthScore >= 4;
  const isSingleFrame = isSleeping || isSick;
  const character = CHARACTERS.find((entry) => entry.id === characterId) ?? CHARACTERS[0];
  const maxTravel = Math.max(0, (sceneWidth - size) / 2 - 12);
  const horizontalPosition = useRef(new Animated.Value(-maxTravel)).current;
  const walkingAnimation = useRef(null);
  const spriteSource = isSleeping
    ? character.sprites.sleeping
    : isSick
      ? character.sprites.sick
      : isSitting
        ? character.sprites.sitting
        : isWalking
          ? character.sprites.walking
          : character.sprites.idle;
  const accessibilityLabel = isSleeping
    ? 'Sleeping pixel-art companion'
    : isSick
      ? 'Sick pixel-art companion'
      : isSitting
        ? 'Sitting pixel-art companion'
        : isWalking
          ? 'Walking pixel-art companion'
          : 'Animated pixel-art companion';

  useEffect(() => {
    const frameCount = isSingleFrame ? 1 : isSitting ? 2 : isWalking ? 9 : 8;
    const interval = setInterval(
      () => setFrame((current) => (current + 1) % frameCount),
      isSitting ? 4000 : isWalking ? 360 : 140
    );
    return () => clearInterval(interval);
  }, [isSingleFrame, isSitting, isWalking]);

  useEffect(() => {
    if (!isWalking || maxTravel === 0) {
      horizontalPosition.setValue(0);
      setWalkingLeft(false);
      return undefined;
    }

    let cancelled = false;
    const animateTo = (destination, facesLeft) => {
      setWalkingLeft(facesLeft);
      const animation = Animated.timing(horizontalPosition, {
        toValue: destination,
        duration: 5000,
        useNativeDriver: true,
      });
      walkingAnimation.current = animation;
      animation.start(({ finished }) => {
        if (finished && !cancelled) {
          const nextDestination = destination === maxTravel ? -maxTravel : maxTravel;
          animateTo(nextDestination, nextDestination < destination);
        }
      });
    };

    horizontalPosition.setValue(-maxTravel);
    animateTo(maxTravel, false);
    return () => {
      cancelled = true;
      walkingAnimation.current?.stop();
    };
  }, [horizontalPosition, isWalking, maxTravel]);

  useEffect(() => {
    if (!isWalking) {
      bob.stopAnimation();
      bob.setValue(0);
      return undefined;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: -3, duration: 650, useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 650, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [bob, isWalking]);

  return (
    <View style={{ width: sceneWidth, height: size * 25 / 24 }} accessible accessibilityLabel={accessibilityLabel}>
      <Animated.View
        style={{
          position: 'absolute',
          left: isWalking ? (sceneWidth - size) / 2 : (sceneWidth - size) / 2 - 90,
          width: size,
          height: size * 25 / 24,
          transform: [{ translateX: horizontalPosition }],
        }}
      >
        <Animated.View
          style={[
            styles.avatarViewport,
            {
              width: size,
              height: size * 25 / 24,
              transform: [{ scaleX: isWalking && walkingLeft ? -1 : 1 }],
            },
          ]}
        >
          <Animated.Image
            source={spriteSource}
            resizeMode="stretch"
            style={[styles.avatarSprite, { width: size * (isSingleFrame ? 1 : 9), height: size * 25 / 24, left: -(frame % (isSingleFrame ? 1 : isWalking ? 9 : 8)) * size, transform: [{ translateY: isWalking ? bob : 0 }] }]}
          />
        </Animated.View>
        {isSleeping && (
          <ExpoImage
            source={require('../assets/sleeping-zzz.png')}
            contentFit="contain"
            autoplay
            style={{
              position: 'absolute',
              top: -size * -0.1,
              right: -size * -0.1,
              width: size * 0.7,
              height: size * 0.52,
            }}
            pointerEvents="none"
          />
        )}
      </Animated.View>
    </View>
  );
}

export default function ReportsScreen({ characterProgressVersion }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const dialSize = Math.max(52, Math.min(82, Math.floor((width - 40) / 4) - 8));
  const avatarSize = Math.min(144, (width - 40) / 2);
  const avatarHeight = avatarSize * 25 / 24;
  const sceneHeight = Math.max(avatarHeight + dialSize * 2 + 24, height - insets.top - 264);
  const [period, setPeriod] = useState('week'); // 'week' | 'month'
  const [report, setReport] = useState(null);
  const [localHour, setLocalHour] = useState(() => new Date().getHours());
  const [aiSummary, setAiSummary] = useState(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [ratedDays, setRatedDays] = useState([]);
  const [loadingCalendar, setLoadingCalendar] = useState(true);
  const [selectedDate, setSelectedDate] = useState(null);
  const [dayScores, setDayScores] = useState(null);
  const [dayNote, setDayNote] = useState('');
  const [dayPage, setDayPage] = useState(1);
  const [loadingDay, setLoadingDay] = useState(false);
  const [savingDay, setSavingDay] = useState(false);
  const [characterProgress, setCharacterProgress] = useState(null);
  const [charactersVisible, setCharactersVisible] = useState(false);
  const [drawingCharacter, setDrawingCharacter] = useState(false);
  const [rewardMessages, setRewardMessages] = useState([]);
  const [gachaRevealCharacter, setGachaRevealCharacter] = useState(null);
  const [gachaAnimating, setGachaAnimating] = useState(false);
  const [gachaFlash, setGachaFlash] = useState(false);
  const fallingStarX = useRef(new Animated.Value(180)).current;
  const fallingStarY = useRef(new Animated.Value(-260)).current;
  const gachaFlashOpacity = useRef(new Animated.Value(0)).current;
  const gachaFlashScale = useRef(new Animated.Value(0.15)).current;

  const load = useCallback(async () => {
    const daysBack = period === 'week' ? 7 : 30;
    const data = await buildReport(daysBack);
    setReport(data);
    setAiSummary(null); // stale once the period changes
  }, [period]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    getCharacterProgress()
      .then(setCharacterProgress)
      .catch((error) => Alert.alert('Could not load characters', error.message));
  }, [characterProgressVersion]);

  useEffect(() => {
    const interval = setInterval(() => setLocalHour(new Date().getHours()), 60000);
    return () => clearInterval(interval);
  }, []);

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
      const scores = { health: 0, work: 0, play: 0, love: 0 };
      for (const row of [...rows].reverse()) {
        scores[row.category] = row.score;
      }
      setDayScores(scores);
      setDayNote(rows[0]?.note ?? '');
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
      const reward = await recordHistoricalRatingProgress();
      setCharacterProgress(reward.progress);
      const messages = [];
      if (reward.unlockedCharacters.includes('leafhead')) messages.push('Leafhead is now yours!');
      if (reward.earnedGachaPull) messages.push('You earned a gacha pull for logging another 7 days!');
      setSelectedDate(null);
      setDayScores(null);
      await Promise.all([load(), loadRatedDays()]);
      if (messages.length > 0) setRewardMessages(messages);
    } catch (error) {
      Alert.alert('Could not save rating', error.message);
    } finally {
      setSavingDay(false);
    }
  };

  const handleSelectCharacter = async (characterId) => {
    try {
      setCharacterProgress(await setActiveCharacter(characterId));
    } catch (error) {
      Alert.alert('Could not change character', error.message);
    }
  };

  const handleDrawCharacter = async () => {
    setDrawingCharacter(true);
    try {
      const result = await drawCharacter(GACHA_CHARACTERS);
      setCharacterProgress(result.progress);
      setGachaRevealCharacter(result.character);
      setGachaAnimating(true);
      setGachaFlash(false);
      fallingStarX.setValue(210);
      fallingStarY.setValue(-220);
      gachaFlashOpacity.setValue(0);
      gachaFlashScale.setValue(0.15);
      Animated.parallel([
        Animated.timing(fallingStarX, {
          toValue: 0,
          duration: 850,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(fallingStarY, {
          toValue: 0,
          duration: 850,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (!finished) return;
        setGachaFlash(true);
        Animated.sequence([
          Animated.delay(80),
          Animated.parallel([
            Animated.timing(gachaFlashOpacity, {
              toValue: 0.95,
              duration: 100,
              useNativeDriver: true,
            }),
            Animated.timing(gachaFlashScale, {
              toValue: 5,
              duration: 240,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(gachaFlashOpacity, {
              toValue: 0,
              duration: 320,
              useNativeDriver: true,
            }),
            Animated.timing(gachaFlashScale, {
              toValue: 7,
              duration: 320,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
          ]),
        ]).start(({ finished: flashFinished }) => {
          if (flashFinished) {
            setGachaFlash(false);
            setGachaAnimating(false);
          }
        });
      });
    } catch (error) {
      Alert.alert('Could not draw a character', error.message);
    } finally {
      setDrawingCharacter(false);
    }
  };

  const closeRewardModal = () => setRewardMessages([]);

  const ratedAverages = report
    ? Object.values(report).map((data) => data.average).filter((average) => average !== null)
    : [];
  const lowestAverage = ratedAverages.length > 0 ? Math.min(...ratedAverages) : null;
  const isSleepingTime = localHour >= 23 || localHour < 6;
  const isNightTime = localHour >= 20 || localHour < 4;
  const isSunriseTime = localHour === 6;
  const isSunsetTime = localHour === 18;

  return (
    <>
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.accent} />}
    >
      <View style={styles.titleRow}>
        <Text style={[styles.title, { color: theme.text }]}>Dashboard</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.aiButton, { backgroundColor: theme.primaryButton }]}
            onPress={() => setCalendarVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Open calendar"
          >
            <MaterialIcons name="calendar-month" size={24} color={theme.primaryButtonText} />
          </TouchableOpacity>
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
          <TouchableOpacity
            style={[styles.aiButton, { backgroundColor: theme.primaryButton }]}
            onPress={() => setCharactersVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Open character collection"
          >
            <MaterialIcons name="face" size={24} color={theme.primaryButtonText} />
          </TouchableOpacity>
        </View>
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
          {['health', 'work', 'play', 'love'].map((cat) => {
            const data = report[cat];
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
      <View style={[styles.avatarContainer, { height: sceneHeight - dialSize }]}>
        <Image
          source={isNightTime
            ? require('../assets/night/night-bg.png')
            : isSunriseTime
              ? require('../assets/sunrise/sunrise-bg.png')
              : isSunsetTime
                ? require('../assets/sunset/sunset-bg.png')
                : require('../assets/day/day-bg.png')}
          resizeMode="stretch"
          style={styles.sceneBackdrop}
          pointerEvents="none"
        />
        <ExpoImage
          source={isNightTime
            ? require('../assets/night/night-clouds-moving.png')
            : isSunriseTime
              ? require('../assets/sunrise/sunrise-clouds-moving.png')
              : isSunsetTime
                ? require('../assets/sunset/sunset-clouds-moving.png')
                : require('../assets/day/day-clouds-moving.png')}
          contentFit="fill"
          autoplay
          style={[styles.sceneBackdrop, { zIndex: 1 }]}
          pointerEvents="none"
        />
        <View style={[styles.avatarPosition, { top: (sceneHeight - dialSize - avatarHeight) / 2 + 80, zIndex: 2 }]}>
          <DashboardAvatar
            size={avatarSize}
            sceneWidth={width}
            playScore={report?.play.average}
            healthScore={report?.health.average}
            isSleeping={isSleepingTime}
            characterId={characterProgress?.active_character ?? 'basic'}
          />
        </View>
      </View>

    </ScrollView>
    <Modal
      visible={calendarVisible}
      transparent
      animationType="slide"
      onRequestClose={() => setCalendarVisible(false)}
    >
      <View style={styles.calendarModalOverlay}>
        <View style={[styles.calendarModal, { backgroundColor: theme.background, borderColor: theme.border }]}>
          <View style={styles.calendarModalHeader}>
            <Text style={[styles.dayModalTitle, { color: theme.text }]}>Calendar</Text>
            <TouchableOpacity
              style={styles.dayModalClose}
              onPress={() => setCalendarVisible(false)}
              accessibilityRole="button"
              accessibilityLabel="Close calendar"
            >
              <Octicons name="x" size={20} color={theme.text} />
            </TouchableOpacity>
          </View>
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
                const canEditDay = dateKey && dateKey <= getDateKey(today);
                const isToday = dateKey === getDateKey(today);
                return (
                  <TouchableOpacity
                    key={day ?? `empty-${index}`}
                    style={styles.dayCell}
                    onPress={() => {
                      if (canEditDay) {
                        setCalendarVisible(false);
                        handleSelectDay(dateKey);
                      }
                    }}
                    disabled={!canEditDay || loadingDay}
                    accessibilityRole={canEditDay ? 'button' : undefined}
                    accessibilityLabel={canEditDay ? `${wasRated ? 'Edit rating' : 'Add missed rating'} for ${dateKey}` : undefined}
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
                  <Text style={[styles.legendText, { color: theme.muted }]}>Saved · tap any past date to add or edit</Text>
                </>
              )}
            </View>
          </View>
        </View>
      </View>
    </Modal>
    <Modal
      visible={Boolean(aiSummary)}
      transparent
      animationType="fade"
      onRequestClose={() => setAiSummary(null)}
    >
      <View style={styles.aiModalOverlay}>
        <View style={[styles.aiModal, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.aiModalHeader}>
            <Text style={[styles.aiCardTitle, { color: theme.accentText }]}>AI reflection</Text>
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
      visible={charactersVisible}
      transparent
      animationType="slide"
      onRequestClose={() => setCharactersVisible(false)}
    >
      <View style={styles.charactersOverlay}>
        <View style={[styles.charactersModal, { backgroundColor: theme.background, borderColor: theme.border }]}>
          <View style={styles.charactersHeader}>
            <Text style={[styles.dayModalTitle, { color: theme.text }]}>Characters</Text>
            <TouchableOpacity
              style={styles.dayModalClose}
              onPress={() => setCharactersVisible(false)}
              accessibilityRole="button"
              accessibilityLabel="Close character collection"
            >
              <Octicons name="x" size={20} color={theme.text} />
            </TouchableOpacity>
          </View>
          {characterProgress && (
            <>
              <Text style={[styles.charactersSummary, { color: theme.muted }]}>
                {characterProgress.owned_characters.length} / {CHARACTERS.length} unlocked · {characterProgress.rating_days} days rated
              </Text>
              <TouchableOpacity
                style={[
                  styles.gachaButton,
                  { backgroundColor: theme.primaryButton },
                  (characterProgress.gacha_pulls < 1 || GACHA_CHARACTERS.every((character) => characterProgress.owned_characters.includes(character.id))) && styles.gachaButtonDisabled,
                ]}
                onPress={handleDrawCharacter}
                disabled={
                  drawingCharacter
                  || characterProgress.gacha_pulls < 1
                  || GACHA_CHARACTERS.every((character) => characterProgress.owned_characters.includes(character.id))
                }
                accessibilityRole="button"
              >
                <MaterialIcons name="casino" size={22} color={theme.primaryButtonText} />
                <Text style={[styles.gachaButtonText, { color: theme.primaryButtonText }]}>
                  {drawingCharacter ? 'Drawing...' : `Pull a character (${characterProgress.gacha_pulls})`}
                </Text>
              </TouchableOpacity>
              <Text style={[styles.collectionHint, { color: theme.muted }]}>
                Log ratings on any 3 days to unlock Leafhead. Every 7 days rated earns a pull.
              </Text>
              <ScrollView contentContainerStyle={styles.characterGrid}>
                {characterProgress.owned_characters
                  .map((characterId) => CHARACTERS.find((character) => character.id === characterId))
                  .filter(Boolean)
                  .map((character) => {
                  const selected = characterProgress.active_character === character.id;
                  return (
                    <TouchableOpacity
                      key={character.id}
                      style={[
                        styles.characterCard,
                        { backgroundColor: theme.surface, borderColor: selected ? theme.accent : theme.border },
                      ]}
                      onPress={() => handleSelectCharacter(character.id)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      accessibilityLabel={character.name}
                    >
                      <View style={styles.characterPreview}>
                        <Image
                          source={character.sprites.idle}
                          resizeMode="stretch"
                          style={styles.characterPreviewSprite}
                        />
                      </View>
                      <Text style={[styles.characterName, { color: theme.text }]}>{character.name}</Text>
                      {selected && <MaterialIcons name="check-circle" size={18} color={theme.accent} />}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </>
          )}
          {(gachaAnimating || gachaRevealCharacter) && (
            <View style={styles.gachaRevealOverlay}>
              {gachaAnimating && !gachaFlash ? (
                <Animated.View
                  style={[
                    styles.fallingStar,
                    {
                      transform: [
                        { translateX: fallingStarX },
                        { translateY: fallingStarY },
                      ],
                    },
                  ]}
                >
                  <View style={styles.starTrail}>
                    <View style={[styles.starTrailLine, styles.starTrailGlow]} />
                    <View style={[styles.starTrailLine, styles.starTrailMid]} />
                    <View style={[styles.starTrailLine, styles.starTrailCore]} />
                  </View>
                  <MaterialIcons name="star" size={48} color="#ffe36e" />
                  <MaterialIcons name="auto-awesome" size={24} color="#fff5bd" style={styles.starSparkle} />
                </Animated.View>
              ) : gachaAnimating ? (
                <>
                  <Animated.View
                    pointerEvents="none"
                    style={[styles.gachaWhiteFlash, { opacity: gachaFlashOpacity }]}
                  />
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      styles.gachaFlashBurst,
                      {
                        opacity: gachaFlashOpacity,
                        transform: [{ scale: gachaFlashScale }],
                      },
                    ]}
                  />
                </>
              ) : (
                <View style={[styles.gachaRevealCard, { backgroundColor: theme.surface, borderColor: theme.accent }]}>
                  <MaterialIcons name="auto-awesome" size={28} color={theme.accent} />
                  <Text style={[styles.gachaRevealTitle, { color: theme.text }]}>A new character!</Text>
                  <View style={styles.gachaRevealPreview}>
                    <Image
                      source={gachaRevealCharacter.sprites.idle}
                      resizeMode="stretch"
                      style={styles.gachaRevealSprite}
                    />
                  </View>
                  <Text style={[styles.gachaRevealName, { color: theme.text }]}>{gachaRevealCharacter.name}</Text>
                  <TouchableOpacity
                    style={[styles.gachaRevealButton, { backgroundColor: theme.primaryButton }]}
                    onPress={() => setGachaRevealCharacter(null)}
                    accessibilityRole="button"
                  >
                    <Text style={[styles.gachaButtonText, { color: theme.primaryButtonText }]}>Awesome!</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </View>
      </View>
    </Modal>
    <RewardModal rewards={rewardMessages} onClose={closeRewardModal} />
    <Modal
      visible={Boolean(selectedDate)}
      transparent
      animationType="slide"
      onRequestClose={() => setSelectedDate(null)}
    >
      <View style={styles.dayModalOverlay}>
        <View style={[styles.dayModal, { backgroundColor: theme.background }]}>
          <View style={styles.dayModalHeader}>
            <Text style={[styles.dayModalTitle, { color: theme.text }]}>
              {selectedDate && ratedDays.includes(selectedDate) ? 'Edit rating' : 'Add missed rating'}
            </Text>
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
                  <Text style={[styles.dayPageSubtitle, { color: theme.muted }]}>Add or edit the optional note for this day.</Text>
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
                      <Text style={[styles.daySaveText, { color: theme.primaryButtonText }]}>
                        {savingDay ? 'Saving...' : selectedDate && ratedDays.includes(selectedDate) ? 'Save changes' : 'Save rating'}
                      </Text>
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
  headerActions: { flexDirection: 'row', gap: 8 },
  avatarContainer: { position: 'relative', width: '100%', alignItems: 'center', marginTop: 0, marginBottom: 20, overflow: 'hidden'},
  sceneBackdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, width: '100%', height: '100%', zIndex: 0 },
  avatarPosition: { position: 'absolute', alignSelf: 'center', zIndex: 1 },
  avatarViewport: { overflow: 'hidden' },
  avatarSprite: { position: 'absolute', top: 0 },
  dialGrid: { zIndex: 2, flexDirection: 'row', width: '100%' },
  dialItem: { flex: 1, alignItems: 'center' },
  calendar: { borderWidth: 1, borderRadius: 10, padding: 14, marginBottom: 20 },
  calendarModalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.55)', justifyContent: 'center', padding: 20 },
  calendarModal: { borderWidth: 1, borderRadius: 10, padding: 18 },
  calendarModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
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
  charactersOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.55)', justifyContent: 'center', padding: 20 },
  charactersModal: { maxHeight: '88%', borderWidth: 1, borderRadius: 16, padding: 18 },
  charactersHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  charactersSummary: { fontSize: 13, marginBottom: 10 },
  gachaButton: { minHeight: 46, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 12 },
  gachaButtonDisabled: { opacity: 0.5 },
  gachaButtonText: { fontSize: 15, fontWeight: '700' },
  collectionHint: { fontSize: 12, lineHeight: 17, marginTop: 8, marginBottom: 10 },
  characterGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start', gap: 8, paddingBottom: 12 },
  characterCard: { width: '31.5%', minHeight: 116, borderWidth: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center', padding: 6 },
  characterPreview: { width: 58, height: 61, overflow: 'hidden' },
  characterPreviewSprite: { position: 'absolute', top: 0, left: 0, width: 58 * 9, height: 58 * 25 / 24 },
  characterName: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
  gachaRevealOverlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 20, elevation: 20, backgroundColor: 'rgba(0, 0, 0, 0.72)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  gachaWhiteFlash: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: '#fff' },
  gachaFlashBurst: { position: 'absolute', width: 100, height: 100, borderRadius: 50, backgroundColor: '#fff' },
  fallingStar: { position: 'absolute', top: '50%', alignItems: 'center', justifyContent: 'center', shadowColor: '#ffe36e', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 18, elevation: 12 },
  starTrail: { position: 'absolute', left: 2, top: -32, width: 150, height: 6, transform: [{ rotate: '-45deg' }], alignItems: 'flex-end', justifyContent: 'center' },
  starTrailLine: { position: 'absolute', right: 0, borderRadius: 4 },
  starTrailGlow: { width: 150, height: 10, backgroundColor: 'rgba(255, 218, 93, 0.16)' },
  starTrailMid: { width: 118, height: 5, backgroundColor: 'rgba(255, 228, 128, 0.42)' },
  starTrailCore: { width: 82, height: 2, backgroundColor: 'rgba(255, 255, 224, 0.9)' },
  starSparkle: { position: 'absolute', right: -9, top: -8 },
  gachaRevealCard: { width: '82%', maxWidth: 300, borderWidth: 1, borderRadius: 20, alignItems: 'center', padding: 22 },
  gachaRevealTitle: { fontSize: 22, fontWeight: '700', marginTop: 8 },
  gachaRevealPreview: { width: 80, height: 84, overflow: 'hidden', marginTop: 12 },
  gachaRevealSprite: { position: 'absolute', top: 0, left: 0, width: 80 * 9, height: 80 * 25 / 24 },
  gachaRevealName: { fontSize: 18, fontWeight: '700', marginTop: 2, marginBottom: 16 },
  gachaRevealButton: { width: '100%', minHeight: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
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
  dayBackButton: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayBackText: { fontSize: 16, lineHeight: 20, fontWeight: '700', includeFontPadding: false },
  dayNextButton: { flex: 1 },
  daySaveButton: { height: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  daySaveDisabled: { opacity: 0.6 },
  daySaveText: { fontSize: 16, lineHeight: 20, fontWeight: '700', includeFontPadding: false },
});
