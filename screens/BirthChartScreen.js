import React, { memo, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, Alert, Platform, Modal, Pressable, FlatList } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { GetCountries } from 'react-country-state-city';
import { saveBirthChart, getBirthChart } from '../db/database';
import { computeNatalChart } from '../astrology/chart';
import { AppText as Text, AppTextInput as TextInput, useTheme } from '../theme';

function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
function toHHMM(date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
export default function BirthChartScreen({ onSaved }) {
  const { theme, themeKey } = useTheme();
  const [birthDate, setBirthDate] = useState(null);
  const [birthTime, setBirthTime] = useState(null);
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [countries, setCountries] = useState([]);
  const [locationPicker, setLocationPicker] = useState(null);
  const [locationSearch, setLocationSearch] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const deferredLocationSearch = useDeferredValue(locationSearch);
  const locationOptions = useMemo(() => {
    const search = deferredLocationSearch.trim().toLowerCase();
    const options = countries;
    if (!search) return options;
    return options.filter((item) => item.name.toLowerCase().includes(search));
  }, [countries, deferredLocationSearch]);

  const handleLocationSelect = (item) => {
    setSelectedCountry(item);
    setLocationPicker(null);
  };

  useEffect(() => {
    (async () => {
      const availableCountries = await GetCountries();
      setCountries(availableCountries);
      const existing = await getBirthChart();
      if (existing) {
        setBirthDate(new Date(existing.birth_date));
        if (existing.birth_time) {
          const [h, m] = existing.birth_time.split(':').map(Number);
          const t = new Date();
          t.setHours(h, m, 0, 0);
          setBirthTime(t);
        }
        const country = availableCountries.find((item) => item.name === existing.place_name?.split(',').pop()?.trim());
        setSelectedCountry(country || null);
      }
    })();
  }, []);

  const handleSave = async () => {
    if (!birthDate) {
      Alert.alert('Missing birth date', 'Please set your birth date.');
      return;
    }
    setSaving(true);
    try {
      if (birthTime && !selectedCountry) {
        Alert.alert('Missing birthplace', 'Select your birth country so the rising sign can be calculated.');
        return;
      }
      const latitude = selectedCountry ? Number(selectedCountry.latitude) : null;
      const longitude = selectedCountry ? Number(selectedCountry.longitude) : null;
      const placeName = selectedCountry ? selectedCountry.name : null;
      const { sunSign, moonSign, ascendantSign, placements } = computeNatalChart({
        birthDate, birthTime: birthTime ? toHHMM(birthTime) : null,
        latitude, longitude,
      });
      await saveBirthChart({
        birthDate: toISODate(birthDate),
        birthTime: birthTime ? toHHMM(birthTime) : null,
        latitude, longitude, placeName,
        sunSign, moonSign, ascendantSign, placements
      });
      onSaved?.();
    } catch (e) {
      Alert.alert('Error', 'Could not save birth chart: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]} contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
      <Text style={[styles.title, { color: theme.text }]}>Your birth chart</Text>
      <Text style={[styles.subtitle, { color: theme.muted }]}>
        Birth date is required. Birth time and birthplace are optional.
      </Text>

      <Text style={[styles.label, { color: theme.text }]}>Birth date</Text>
      <TouchableOpacity style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border }]} onPress={() => setShowDatePicker(true)}>
        <Text style={[birthDate ? styles.inputText : styles.placeholderText, { color: birthDate ? theme.text : theme.muted }]}>
          {birthDate ? toISODate(birthDate) : 'Select date'}
        </Text>
      </TouchableOpacity>

      <Text style={[styles.label, { color: theme.text }]}>Birth time (optional)</Text>
      <TouchableOpacity style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border }]} onPress={() => setShowTimePicker(true)}>
        <Text style={[birthTime ? styles.inputText : styles.placeholderText, { color: birthTime ? theme.text : theme.muted }]}>
          {birthTime ? toHHMM(birthTime) : 'Select time'}
        </Text>
      </TouchableOpacity>

      <Text style={[styles.label, { color: theme.text }]}>Birthplace (optional)</Text>
      <TouchableOpacity style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border }]} onPress={() => { setLocationPicker('country'); setLocationSearch(''); }}>
        <Text style={{ color: selectedCountry ? theme.text : theme.muted }}>{selectedCountry?.name || 'Select country'}</Text>
      </TouchableOpacity>
      <Text style={[styles.locationHint, { color: theme.muted }]}>Your country supplies the coordinates used to calculate the rising sign.</Text>

      <TouchableOpacity style={[styles.saveButton, { backgroundColor: theme.primaryButton }, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
        <Text style={[styles.saveButtonText, { color: theme.primaryButtonText }]}>{saving ? 'Saving...' : 'Save birth chart'}</Text>
      </TouchableOpacity>

      {showDatePicker && Platform.OS === 'android' && (
        <DateTimePicker value={birthDate || new Date(1995, 0, 1)} mode="date" display="default"
          maximumDate={new Date()} onChange={(e, d) => { setShowDatePicker(false); if (d) setBirthDate(d); }} />
      )}
      {showDatePicker && Platform.OS === 'ios' && (
        <Modal transparent animationType="fade" visible onRequestClose={() => setShowDatePicker(false)}>
          <Pressable style={[styles.backdrop, { backgroundColor: 'rgba(0,0,0,0.5)' }]} onPress={() => setShowDatePicker(false)}>
            <Pressable style={[styles.pickerCard, { backgroundColor: theme.surface }]} onPress={() => {}}>
              <DateTimePicker value={birthDate || new Date(1995, 0, 1)} mode="date" display="inline"
                themeVariant={themeKey === 'dark' ? 'dark' : 'light'} maximumDate={new Date()} onChange={(e, d) => { if (d) setBirthDate(d); }} />
              <TouchableOpacity style={[styles.doneButton, { backgroundColor: theme.primaryButton }]} onPress={() => setShowDatePicker(false)}>
                <Text style={[styles.doneButtonText, { color: theme.primaryButtonText }]}>Done</Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {showTimePicker && Platform.OS === 'android' && (
        <DateTimePicker value={birthTime || new Date()} mode="time" is24Hour display="default"
          themeVariant={themeKey === 'dark' ? 'dark' : 'light'}
          onChange={(e, d) => { setShowTimePicker(false); if (d) setBirthTime(d); }} />
      )}
      {showTimePicker && Platform.OS === 'ios' && (
        <Modal transparent animationType="fade" visible onRequestClose={() => setShowTimePicker(false)}>
          <Pressable style={[styles.backdrop, { backgroundColor: 'rgba(0,0,0,0.5)' }]} onPress={() => setShowTimePicker(false)}>
            <Pressable style={[styles.pickerCard, { backgroundColor: theme.surface }]} onPress={() => {}}>
              <DateTimePicker value={birthTime || new Date()} mode="time" is24Hour display="spinner"
                themeVariant={themeKey === 'dark' ? 'dark' : 'light'}
                onChange={(e, d) => { if (d) setBirthTime(d); }} />
              <TouchableOpacity style={[styles.doneButton, { backgroundColor: theme.primaryButton }]} onPress={() => setShowTimePicker(false)}>
                <Text style={[styles.doneButtonText, { color: theme.primaryButtonText }]}>Done</Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {locationPicker && (
        <Modal transparent animationType="fade" visible onRequestClose={() => setLocationPicker(null)}>
          <Pressable style={styles.backdrop} onPress={() => setLocationPicker(null)}>
            <Pressable style={[styles.locationPickerCard, { backgroundColor: theme.surface }]} onPress={() => {}}>
              <TextInput style={[styles.searchInput, { borderColor: theme.border, color: theme.text }]} placeholder={`Search ${locationPicker}`} placeholderTextColor={theme.muted}
                value={locationSearch} onChangeText={setLocationSearch} autoFocus />
              <FlatList
                style={styles.locationList}
                data={locationOptions}
                keyExtractor={(item) => `country-${item.id}`}
                keyboardShouldPersistTaps="handled"
                initialNumToRender={16}
                maxToRenderPerBatch={12}
                windowSize={5}
                removeClippedSubviews
                getItemLayout={(_, index) => ({ length: 45, offset: 45 * index, index })}
                ListEmptyComponent={(
                  <Text style={[styles.locationHint, { color: theme.muted }]}>
                    No matching locations.
                  </Text>
                )}
                renderItem={({ item }) => <LocationOption item={item} color={theme.text} borderColor={theme.border} onSelect={handleLocationSelect} />}
              />
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </ScrollView>
  );
}

const LocationOption = memo(function LocationOption({ item, color, borderColor, onSelect }) {
  return (
    <TouchableOpacity style={[styles.locationOption, { borderBottomColor: borderColor }]} onPress={() => onSelect(item)}>
      <Text style={{ color }}>{item.name}</Text>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { fontSize: 26, fontWeight: '700', marginBottom: 4 },
  subtitle: { fontSize: 13, marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 6, marginTop: 14 },
  input: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 12, justifyContent: 'center' },
  inputText: {},
  placeholderText: {},
  locationHint: { fontSize: 12, marginTop: 6 },
  searchInput: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8 },
  locationList: { flex: 1 },
  locationOption: { height: 45, justifyContent: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
  saveButton: { borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 24 },
  saveButtonText: { fontWeight: '700', fontSize: 16 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  pickerCard: { borderRadius: 16, padding: 12, width: '90%' },
  locationPickerCard: { borderRadius: 16, padding: 12, width: '90%', height: '75%', maxHeight: '75%' },
  doneButton: { borderRadius: 10, paddingVertical: 10, alignItems: 'center', marginTop: 8 },
  doneButtonText: { fontWeight: '700' },
});