import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Linking,
  Platform,
  ScrollView,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList, ParsedQR } from '../types';
import { getStationInfo } from '../services/api';
import { saveStation } from '../services/stationService';

type Props = NativeStackScreenProps<RootStackParamList, 'StationConnection'>;

type ConnectionStatus = 'checking' | 'connected' | 'failed';

interface StationDetails {
  stationId: string;
  ip: string;
  port: number;
  network: string;
  url: string;
  status: string;
  version: string;
}

export default function StationConnectionScreen({ navigation, route }: Props) {
  const { stationInfo } = route.params;
  const [status, setStatus] = useState<ConnectionStatus>('checking');
  const [details, setDetails] = useState<StationDetails | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  const verifyConnection = useCallback(async () => {
    const url = stationInfo.url || '';
    if (!url) {
      if (mountedRef.current) { setStatus('failed'); setErrorMessage('No station URL provided by QR code'); }
      return;
    }

    setStatus('checking');
    setErrorMessage('');

    try {
      const data = await getStationInfo(url);
      if (!mountedRef.current) return;

      const info: StationDetails = {
        stationId: data.stationId || 'Unknown',
        ip: data.ip || '',
        port: data.port || 0,
        network: data.network || '',
        url: data.url || url,
        status: data.status || 'unknown',
        version: data.version || '',
      };
      setDetails(info);
      setStatus('connected');
    } catch (err: any) {
      if (!mountedRef.current) return;
      setStatus('failed');
      setErrorMessage(err?.message || 'Could not reach Print Station at the provided URL');
    }
  }, [stationInfo.url]);

  useEffect(() => {
    verifyConnection();
  }, [verifyConnection]);

  const handleContinue = async () => {
    if (!details) return;
    const connectionInfo: ParsedQR = {
      stationId: details.stationId,
      ssid: details.network,
      ip: details.ip,
      url: details.url,
    };
    await saveStation(connectionInfo);
    navigation.replace('FileSelection', { stationInfo: connectionInfo });
  };

  const openWifiSettings = () => {
    if (Platform.OS === 'ios') {
      Linking.openURL('App-Prefs:WIFI');
    } else {
      Linking.openSettings();
    }
  };

  const statusColor = details?.status === 'online' ? '#22c55e' : '#f59e0b';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Connect to Print Station</Text>

        {details ? (
          <>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Station</Text>
              <Text style={styles.infoValue}>{details.stationId}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Network</Text>
              <Text style={styles.infoValue}>{details.network || 'Unknown'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>IP</Text>
              <Text style={styles.infoValue}>{details.ip}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Server</Text>
              <Text style={[styles.infoValue, styles.serverUrlText]} numberOfLines={1}>{details.url}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Status</Text>
              <View style={styles.statusBadgeRow}>
                <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                <Text style={[styles.infoValue, { color: statusColor }]}>
                  {details.status === 'online' ? 'Online' : details.status}
                </Text>
              </View>
            </View>
          </>
        ) : (
          <>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Station</Text>
              <Text style={styles.infoValue}>---</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Network</Text>
              <Text style={styles.infoValue}>---</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>IP</Text>
              <Text style={styles.infoValue}>---</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Server</Text>
              <Text style={styles.infoValue}>{stationInfo.url || '---'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Status</Text>
              <Text style={styles.infoValue}>---</Text>
            </View>
          </>
        )}

        <View style={styles.divider} />

        {status === 'checking' && (
          <View style={styles.statusContainer}>
            <ActivityIndicator size="large" color="#6366f1" />
            <Text style={styles.statusText}>Connecting to Print Station...</Text>
          </View>
        )}

        {status === 'connected' && (
          <View style={styles.statusContainer}>
            <View style={styles.successBadge}>
              <Text style={styles.successIcon}>✓</Text>
            </View>
            <Text style={styles.successText}>
              Connected to {details?.stationId || 'Print Station'}
            </Text>
          </View>
        )}

        {status === 'failed' && (
          <View style={styles.statusContainer}>
            <View style={styles.errorBadge}>
              <Text style={styles.errorIcon}>✕</Text>
            </View>
            <Text style={styles.errorTitle}>Connection Failed</Text>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        )}
      </View>

      {status === 'failed' && (
        <View style={styles.tipsCard}>
          <Text style={styles.tipsTitle}>Troubleshooting</Text>
          <Text style={styles.tipItem}>1. Ensure both devices are on the same Wi-Fi network</Text>
          <Text style={styles.tipItem}>2. Verify the Print Station server is running (click START SERVER on the PC)</Text>
          <Text style={styles.tipItem}>3. Check if Windows Firewall is blocking the connection</Text>
          <Text style={styles.tipItem}>4. Try scanning the QR code again from the Print Station dashboard</Text>
          <Text style={styles.tipItem}>5. If the PC IP changed, a new QR code is needed</Text>

          <TouchableOpacity style={styles.wifiButton} onPress={openWifiSettings}>
            <Text style={styles.wifiButtonText}>OPEN WI-FI SETTINGS</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.actions}>
        {status === 'failed' && (
          <TouchableOpacity style={styles.retryButton} onPress={verifyConnection}>
            <Text style={styles.retryButtonText}>CHECK CONNECTION</Text>
          </TouchableOpacity>
        )}

        {status === 'connected' && (
          <TouchableOpacity style={styles.continueButton} onPress={handleContinue}>
            <Text style={styles.continueButtonText}>CONTINUE TO FILE SELECTION</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.scanAgainButton}
          onPress={() => navigation.replace('QRScanner')}>
          <Text style={styles.scanAgainButtonText}>SCAN AGAIN</Text>
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
    justifyContent: 'center',
    flexGrow: 1,
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f1f5f9',
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 14,
    color: '#64748b',
  },
  infoValue: {
    fontSize: 14,
    color: '#e2e8f0',
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
    marginLeft: 16,
  },
  serverUrlText: {
    fontSize: 12,
  },
  statusBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  divider: {
    height: 1,
    backgroundColor: '#334155',
    marginVertical: 16,
  },
  statusContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  statusText: {
    color: '#94a3b8',
    fontSize: 15,
    marginTop: 12,
  },
  successBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#059669',
    justifyContent: 'center',
    alignItems: 'center',
  },
  successIcon: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '700',
  },
  successText: {
    color: '#22c55e',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 12,
  },
  errorBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#dc2626',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorIcon: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '700',
  },
  errorTitle: {
    color: '#f87171',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 12,
    textAlign: 'center',
  },
  errorText: {
    color: '#94a3b8',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 18,
    paddingHorizontal: 8,
  },
  tipsCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 20,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  tipsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f1f5f9',
    marginBottom: 12,
  },
  tipItem: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 6,
    lineHeight: 18,
  },
  wifiButton: {
    backgroundColor: '#334155',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  wifiButtonText: {
    color: '#f1f5f9',
    fontSize: 13,
    fontWeight: '600',
  },
  actions: {
    marginTop: 20,
    gap: 12,
  },
  continueButton: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  continueButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  retryButton: {
    backgroundColor: '#334155',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  retryButtonText: {
    color: '#f1f5f9',
    fontSize: 16,
    fontWeight: '700',
  },
  scanAgainButton: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#334155',
  },
  scanAgainButtonText: {
    color: '#94a3b8',
    fontSize: 15,
    fontWeight: '600',
  },
});