import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  RootStackParamList,
  PrintMode,
  ColorMode,
  DuplexMode,
  PaperSize,
  PrintOptions,
} from '../types';
import { COLOR_MODES, DUPLEX_MODES, PAPER_SIZES } from '../constants';

type Props = NativeStackScreenProps<RootStackParamList, 'PrintOptions'>;

export default function PrintOptionsScreen({ navigation, route }: Props) {
  const params = route.params;
  const stationInfo = params?.stationInfo;
  const file = params?.file;
  const initialMode = params?.mode || 'instant';

  if (!stationInfo || !file) {
    return (
      <View style={styles.container}>
        <Text style={{ color: '#f87171', textAlign: 'center', marginTop: 40 }}>
          Missing required print options. Please go back and try again.
        </Text>
      </View>
    );
  }

  const [mode, setMode] = useState<PrintMode>(initialMode === 'scheduled' ? 'scheduled' : 'instant');
  const [copies, setCopies] = useState(1);
  const [colorMode, setColorMode] = useState<ColorMode>('bw');
  const [duplexMode, setDuplexMode] = useState<DuplexMode>('single');
  const [paperSize, setPaperSize] = useState<PaperSize>('A4');
  const [scheduledDate, setScheduledDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  const buildScheduledTime = (): string | undefined => {
    if (mode !== 'scheduled') return undefined;
    return scheduledDate.toISOString();
  };

  const handleContinue = () => {
    const options: PrintOptions = {
      copies,
      colorMode,
      duplexMode,
      paperSize,
      scheduledTime: buildScheduledTime(),
    };
    navigation.navigate('UploadProgress', {
      stationInfo,
      file,
      mode,
      options,
    });
  };

  const formatDate = (d: Date): string => {
    const day = d.getDate();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  };

  const formatTime = (d: Date): string => {
    let h = d.getHours();
    const m = d.getMinutes().toString().padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${m} ${ampm}`;
  };

  const adjustDate = (days: number) => {
    const d = new Date(scheduledDate);
    d.setDate(d.getDate() + days);
    setScheduledDate(d);
  };

  const adjustTime = (minutes: number) => {
    const d = new Date(scheduledDate);
    d.setMinutes(d.getMinutes() + minutes);
    setScheduledDate(d);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.stationBanner}>
        <Text style={styles.stationLabel}>Sending to</Text>
        <Text style={styles.stationId}>{stationInfo.stationId}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Print Mode</Text>
        <View style={styles.modeRow}>
          <TouchableOpacity
            style={[styles.modeButton, mode === 'instant' && styles.modeButtonActive]}
            onPress={() => setMode('instant')}>
            <Text style={[styles.modeButtonText, mode === 'instant' && styles.modeButtonTextActive]}>
              INSTANT
            </Text>
            <Text style={[styles.modeButtonDesc, mode === 'instant' && styles.modeButtonDescActive]}>
              Print as soon as possible
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modeButton, mode === 'scheduled' && styles.modeButtonActive]}
            onPress={() => setMode('scheduled')}>
            <Text style={[styles.modeButtonText, mode === 'scheduled' && styles.modeButtonTextActive]}>
              SCHEDULED
            </Text>
            <Text style={[styles.modeButtonDesc, mode === 'scheduled' && styles.modeButtonDescActive]}>
              Specify when required
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {mode === 'scheduled' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Required By</Text>
          <View style={styles.datetimeCard}>
            <View style={styles.dateRow}>
              <TouchableOpacity style={styles.dateArrow} onPress={() => adjustDate(-1)}>
                <Text style={styles.dateArrowText}>◀</Text>
              </TouchableOpacity>
              <View style={styles.dateInfo}>
                <Text style={styles.dateText}>{formatDate(scheduledDate)}</Text>
              </View>
              <TouchableOpacity style={styles.dateArrow} onPress={() => adjustDate(1)}>
                <Text style={styles.dateArrowText}>▶</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.timeRow}>
              <TouchableOpacity style={styles.dateArrow} onPress={() => adjustTime(-30)}>
                <Text style={styles.dateArrowText}>◀</Text>
              </TouchableOpacity>
              <View style={styles.dateInfo}>
                <Text style={styles.timeText}>{formatTime(scheduledDate)}</Text>
              </View>
              <TouchableOpacity style={styles.dateArrow} onPress={() => adjustTime(30)}>
                <Text style={styles.dateArrowText}>▶</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Copies</Text>
        <View style={styles.copiesRow}>
          <TouchableOpacity
            style={styles.copiesButton}
            onPress={() => setCopies(Math.max(1, copies - 1))}>
            <Text style={styles.copiesButtonText}>-</Text>
          </TouchableOpacity>
          <Text style={styles.copiesValue}>{copies}</Text>
          <TouchableOpacity
            style={styles.copiesButton}
            onPress={() => setCopies(Math.min(20, copies + 1))}>
            <Text style={styles.copiesButtonText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Color</Text>
        <View style={styles.optionRow}>
          {COLOR_MODES.map((cm) => (
            <TouchableOpacity
              key={cm.value}
              style={[styles.optionButton, colorMode === cm.value && styles.optionButtonActive]}
              onPress={() => setColorMode(cm.value as ColorMode)}>
              <View style={[styles.radio, colorMode === cm.value && styles.radioActive]} />
              <Text style={[styles.optionText, colorMode === cm.value && styles.optionTextActive]}>
                {cm.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Duplex</Text>
        <View style={styles.optionRow}>
          {DUPLEX_MODES.map((dm) => (
            <TouchableOpacity
              key={dm.value}
              style={[styles.optionButton, duplexMode === dm.value && styles.optionButtonActive]}
              onPress={() => setDuplexMode(dm.value as DuplexMode)}>
              <View style={[styles.radio, duplexMode === dm.value && styles.radioActive]} />
              <Text style={[styles.optionText, duplexMode === dm.value && styles.optionTextActive]}>
                {dm.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Paper Size</Text>
        <View style={styles.optionRow}>
          {PAPER_SIZES.map((ps) => (
            <TouchableOpacity
              key={ps.value}
              style={[styles.optionButton, paperSize === ps.value && styles.optionButtonActive]}
              onPress={() => setPaperSize(ps.value as PaperSize)}>
              <View style={[styles.radio, paperSize === ps.value && styles.radioActive]} />
              <Text style={[styles.optionText, paperSize === ps.value && styles.optionTextActive]}>
                {ps.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <TouchableOpacity style={styles.continueButton} onPress={handleContinue}>
        <Text style={styles.continueButtonText}>REVIEW & SEND</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  stationBanner: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 14,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#334155',
  },
  stationLabel: {
    fontSize: 13,
    color: '#64748b',
  },
  stationId: {
    fontSize: 14,
    fontWeight: '700',
    color: '#22c55e',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  modeButton: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#334155',
  },
  modeButtonActive: {
    borderColor: '#6366f1',
    backgroundColor: '#1e1b4b',
  },
  modeButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#94a3b8',
    marginBottom: 4,
  },
  modeButtonTextActive: {
    color: '#818cf8',
  },
  modeButtonDesc: {
    fontSize: 12,
    color: '#64748b',
  },
  modeButtonDescActive: {
    color: '#94a3b8',
  },
  datetimeCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateArrow: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateArrowText: {
    color: '#f1f5f9',
    fontSize: 16,
  },
  dateInfo: {
    alignItems: 'center',
  },
  dateText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#f1f5f9',
  },
  timeText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f1f5f9',
  },
  copiesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  copiesButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  copiesButtonText: {
    color: '#f1f5f9',
    fontSize: 22,
    fontWeight: '700',
  },
  copiesValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#f1f5f9',
    minWidth: 40,
    textAlign: 'center',
  },
  optionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  optionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#334155',
  },
  optionButtonActive: {
    borderColor: '#6366f1',
    backgroundColor: '#1e1b4b',
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#64748b',
    marginRight: 10,
  },
  radioActive: {
    borderColor: '#6366f1',
    backgroundColor: '#6366f1',
  },
  optionText: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '500',
  },
  optionTextActive: {
    color: '#f1f5f9',
    fontWeight: '600',
  },
  continueButton: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  continueButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});
