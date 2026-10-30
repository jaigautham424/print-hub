import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { uploadFile, uploadScheduledFile } from '../services/uploadService';

type Props = NativeStackScreenProps<RootStackParamList, 'UploadProgress'>;

export default function UploadProgressScreen({ navigation, route }: Props) {
  const { stationInfo, file, mode, options } = route.params;
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<'uploading' | 'processing' | 'done' | 'error'>('uploading');
  const [jobId, setJobId] = useState<string>('');
  const [token, setToken] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState('');
  const isUploadingRef = useRef(false);

  const doUpload = async () => {
    if (isUploadingRef.current) return;
    isUploadingRef.current = true;
    try {
      setPhase('uploading');
      setProgress(0);
      setErrorMsg('');
      const url = stationInfo.url || '';
      if (!url) { setPhase('error'); setErrorMsg('Station URL not available'); isUploadingRef.current = false; return; }
      let res: any;
      if (mode === 'scheduled') {
        res = await uploadScheduledFile(
          url,
          file,
          options,
          'PrintHub Mobile',
          'Guest',
          (p) => setProgress(p),
        );
      } else {
        res = await uploadFile(
          url,
          file,
          options,
          mode,
          'PrintHub Mobile',
          'Guest',
          (p) => setProgress(p),
        );
      }
      const id = res.jobId || res.id;
      setJobId(id);
      if (res.token) setToken(res.token);
      setPhase('processing');

      const timer = setTimeout(() => {
        navigation.replace('PrintStatus', {
          stationInfo,
          jobId: id,
          file,
          mode,
          options,
        });
      }, 1200);
      isUploadingRef.current = false;
    } catch (err: any) {
      setPhase('error');
      setErrorMsg(err?.message || 'Upload failed. Please try again.');
      isUploadingRef.current = false;
    }
  };

  useEffect(() => {
    doUpload();
    return () => { isUploadingRef.current = false; };
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        {phase === 'uploading' && (
          <>
            <ActivityIndicator size="large" color="#6366f1" />
            <Text style={styles.title}>Uploading document...</Text>
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${progress}%` }]} />
              </View>
              <Text style={styles.progressText}>{progress}%</Text>
            </View>
            <Text style={styles.fileName}>{file.name}</Text>
          </>
        )}

        {phase === 'processing' && (
          <>
            <View style={styles.successBadge}>
              <Text style={styles.successIcon}>✓</Text>
            </View>
            <Text style={styles.title}>Document sent successfully</Text>
            {token ? (
              <View style={styles.tokenContainer}>
                <Text style={styles.tokenLabel}>Your Pickup Code</Text>
                <Text style={styles.tokenValue}>{token}</Text>
              </View>
            ) : null}
            <View style={styles.detailsCard}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Job ID</Text>
                <Text style={styles.detailValue}>{jobId}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Station</Text>
                <Text style={styles.detailValue}>{stationInfo.stationId}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Status</Text>
                <Text style={[styles.detailValue, styles.statusWaiting]}>WAITING</Text>
              </View>
            </View>
          </>
        )}

        {phase === 'error' && (
          <>
            <View style={styles.errorBadge}>
              <Text style={styles.errorIcon}>✕</Text>
            </View>
            <Text style={styles.errorTitle}>Upload Failed</Text>
            <Text style={styles.errorText}>{errorMsg}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={doUpload}>
              <Text style={styles.retryButtonText}>TRY AGAIN</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f1f5f9',
    marginTop: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  progressContainer: {
    width: '100%',
    marginBottom: 16,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#334155',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#6366f1',
    borderRadius: 4,
  },
  progressText: {
    color: '#94a3b8',
    fontSize: 14,
    textAlign: 'center',
  },
  fileName: {
    color: '#64748b',
    fontSize: 14,
  },
  successBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#059669',
    justifyContent: 'center',
    alignItems: 'center',
  },
  successIcon: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: '700',
  },
  detailsCard: {
    width: '100%',
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 16,
    marginTop: 4,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detailLabel: {
    color: '#64748b',
    fontSize: 14,
  },
  detailValue: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '600',
  },
  statusWaiting: {
    color: '#f59e0b',
  },
  errorBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#dc2626',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorIcon: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: '700',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f87171',
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#6366f1',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 8,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  tokenContainer: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
    width: '100%',
  },
  tokenLabel: {
    fontSize: 12,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  tokenValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#f59e0b',
    letterSpacing: 4,
  },
});
