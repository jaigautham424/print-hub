import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList, PrintJobStatus } from '../types';
import { connectSocket, onJobUpdated, onJobCompleted, onJobCancelled, removeSocketListeners, disconnectSocket, sendDeviceInfo } from '../services/socket';
import { STATUS_FLOW } from '../constants';

type Props = NativeStackScreenProps<RootStackParamList, 'PrintStatus'>;

const STATUS_INDEX: Record<string, number> = {
  uploading: 0,
  processing: 0,
  waiting: 1,
  printing: 2,
  completed: 3,
};

export default function PrintStatusScreen({ navigation, route }: Props) {
  const { stationInfo, jobId, file, mode, options } = route.params;
  const [currentStatus, setCurrentStatus] = useState<PrintJobStatus>('waiting');

  useEffect(() => {
    const stationUrl = stationInfo.url || '';
    if (!stationUrl) { return; }
    const socket = connectSocket(stationUrl);

    sendDeviceInfo({
      ip: '192.168.0.0',
      name: 'PrintHub Mobile',
      userAgent: 'ReactNative',
    });

    const handleJobUpdated = (data: any) => {
      if (data.id === jobId || data.jobId === jobId) {
        if (data.status) setCurrentStatus(data.status);
      }
    };

    const handleJobCompleted = (data: any) => {
      if (data.id === jobId || data.jobId === jobId) {
        setCurrentStatus('completed');
      }
    };

    const handleJobCancelled = (data: any) => {
      if (data.id === jobId || data.jobId === jobId) {
        setCurrentStatus('cancelled');
      }
    };

    onJobUpdated(handleJobUpdated);
    onJobCompleted(handleJobCompleted);
    onJobCancelled(handleJobCancelled);

    return () => {
      removeSocketListeners();
      disconnectSocket();
    };
  }, [stationInfo.url, jobId]);

  const activeIndex = STATUS_INDEX[currentStatus] ?? 1;

  const getStepState = (index: number): 'done' | 'active' | 'pending' => {
    if (index < activeIndex) return 'done';
    if (index === activeIndex) return 'active';
    return 'pending';
  };

  const goHome = () => {
    navigation.popToTop();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.header}>
        {currentStatus === 'completed' ? (
          <>
            <View style={styles.successBadge}>
              <Text style={styles.successIcon}>✓</Text>
            </View>
            <Text style={styles.successTitle}>
              Your document has been printed successfully.
            </Text>
          </>
        ) : currentStatus === 'error' || currentStatus === 'cancelled' ? (
          <>
            <View style={styles.errorBadge}>
              <Text style={styles.errorIcon}>✕</Text>
            </View>
            <Text style={styles.errorTitle}>
              Printing failed. Please contact the Print Station operator.
            </Text>
          </>
        ) : (
          <>
            <View style={styles.activeBadge}>
              <Text style={styles.activeIconText}>●</Text>
            </View>
            <Text style={styles.activeTitle}>Printing in progress...</Text>
          </>
        )}
      </View>

      <View style={styles.timelineCard}>
        {STATUS_FLOW.map((step, index) => {
          const state = getStepState(index);
          return (
            <View key={step.key} style={styles.timelineItem}>
              <View style={styles.timelineLeft}>
                <View
                  style={[
                    styles.timelineDot,
                    state === 'done' && styles.timelineDotDone,
                    state === 'active' && styles.timelineDotActive,
                  ]}>
                  {state === 'done' && <Text style={styles.checkMark}>✓</Text>}
                  {state === 'active' && <Text style={styles.activeDot}>●</Text>}
                </View>
                {index < STATUS_FLOW.length - 1 && (
                  <View
                    style={[
                      styles.timelineLine,
                      state === 'done' && styles.timelineLineDone,
                    ]}
                  />
                )}
              </View>
              <View style={styles.timelineContent}>
                <Text
                  style={[
                    styles.timelineLabel,
                    state === 'done' && styles.timelineLabelDone,
                    state === 'active' && styles.timelineLabelActive,
                  ]}>
                  {step.label}
                </Text>
              </View>
            </View>
          );
        })}
      </View>

      <View style={styles.detailsCard}>
        <Text style={styles.detailsTitle}>Job Details</Text>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>File</Text>
          <Text style={styles.detailValue} numberOfLines={1}>{file.name}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Job ID</Text>
          <Text style={styles.detailValue}>{jobId}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Station</Text>
          <Text style={styles.detailValue}>{stationInfo.stationId}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Mode</Text>
          <Text style={styles.detailValue}>{mode === 'instant' ? 'Instant' : 'Scheduled'}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Copies</Text>
          <Text style={styles.detailValue}>{options.copies}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Color</Text>
          <Text style={styles.detailValue}>{options.colorMode === 'color' ? 'Color' : 'B&W'}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Paper</Text>
          <Text style={styles.detailValue}>{options.paperSize}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Duplex</Text>
          <Text style={styles.detailValue}>{options.duplexMode === 'duplex' ? 'Double Sided' : 'Single Sided'}</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.homeButton} onPress={goHome}>
          <Text style={styles.homeButtonText}>BACK TO HOME</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.historyButton}
          onPress={() => navigation.navigate('History', { stationInfo })}>
          <Text style={styles.historyButtonText}>VIEW JOB HISTORY</Text>
        </TouchableOpacity>
      </View>
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
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  successBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#059669',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  successIcon: {
    color: '#ffffff',
    fontSize: 36,
    fontWeight: '700',
  },
  successTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#22c55e',
    textAlign: 'center',
    lineHeight: 24,
  },
  errorBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#dc2626',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  errorIcon: {
    color: '#ffffff',
    fontSize: 36,
    fontWeight: '700',
  },
  errorTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#f87171',
    textAlign: 'center',
    lineHeight: 24,
  },
  activeBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#1e1b4b',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#6366f1',
  },
  activeIconText: {
    color: '#6366f1',
    fontSize: 28,
  },
  activeTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#818cf8',
    textAlign: 'center',
  },
  timelineCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  timelineItem: {
    flexDirection: 'row',
    minHeight: 40,
  },
  timelineLeft: {
    alignItems: 'center',
    width: 32,
  },
  timelineDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timelineDotDone: {
    backgroundColor: '#059669',
  },
  timelineDotActive: {
    backgroundColor: '#6366f1',
  },
  checkMark: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  activeDot: {
    color: '#ffffff',
    fontSize: 10,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#334155',
    marginVertical: 4,
  },
  timelineLineDone: {
    backgroundColor: '#059669',
  },
  timelineContent: {
    flex: 1,
    paddingLeft: 12,
    justifyContent: 'center',
  },
  timelineLabel: {
    fontSize: 15,
    color: '#64748b',
    fontWeight: '500',
  },
  timelineLabelDone: {
    color: '#22c55e',
  },
  timelineLabelActive: {
    color: '#f1f5f9',
    fontWeight: '700',
  },
  detailsCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  detailsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  detailLabel: {
    fontSize: 14,
    color: '#64748b',
  },
  detailValue: {
    fontSize: 14,
    color: '#e2e8f0',
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
    marginLeft: 16,
  },
  actions: {
    gap: 12,
  },
  homeButton: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  homeButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  historyButton: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#334155',
  },
  historyButtonText: {
    color: '#94a3b8',
    fontSize: 15,
    fontWeight: '600',
  },
});
