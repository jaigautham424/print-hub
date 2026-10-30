import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList, PrintJob } from '../types';
import { getJobs } from '../services/api';

type Props = NativeStackScreenProps<RootStackParamList, 'History'>;

const STATUS_COLORS: Record<string, string> = {
  uploading: '#3b82f6',
  processing: '#3b82f6',
  waiting: '#f59e0b',
  printing: '#8b5cf6',
  completed: '#22c55e',
  error: '#ef4444',
  cancelled: '#ef4444',
};

const STATUS_LABELS: Record<string, string> = {
  uploading: 'Uploading',
  processing: 'Processing',
  waiting: 'Queued',
  printing: 'Printing',
  completed: 'Completed',
  error: 'Failed',
  cancelled: 'Cancelled',
};

export default function HistoryScreen({ navigation, route }: Props) {
  const { stationInfo } = route.params;
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadJobs = useCallback(async () => {
    if (!stationInfo?.url) return;
    try {
      const data = await getJobs(stationInfo.url);
      setJobs(Array.isArray(data) ? data : []);
    } catch {
      setJobs([]);
    }
  }, [stationInfo?.url]);

  useEffect(() => {
    setLoading(true);
    loadJobs().finally(() => setLoading(false));
  }, [loadJobs]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadJobs();
    setRefreshing(false);
  };

  const formatDate = (dateStr: string): string => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const day = d.getDate();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    const h = d.getHours();
    const m = d.getMinutes().toString().padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 || 12;
    return `${day} ${month} ${year}, ${hour}:${m} ${ampm}`;
  };

  const formatFileSize = (bytes: number): string => {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const renderItem = ({ item }: { item: PrintJob }) => (
    <View style={styles.jobCard}>
      <View style={styles.jobHeader}>
        <Text style={styles.jobFileName} numberOfLines={1}>
          {item.original_name}
        </Text>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: (STATUS_COLORS[item.status] || '#64748b') + '20' },
          ]}>
          <Text
            style={[
              styles.statusText,
              { color: STATUS_COLORS[item.status] || '#64748b' },
            ]}>
            {STATUS_LABELS[item.status] || item.status}
          </Text>
        </View>
      </View>

      <View style={styles.jobDetails}>
        <View style={styles.jobDetail}>
          <Text style={styles.jobDetailLabel}>Date</Text>
          <Text style={styles.jobDetailValue}>{formatDate(item.upload_time)}</Text>
        </View>
        {item.total_pages > 0 && (
          <View style={styles.jobDetail}>
            <Text style={styles.jobDetailLabel}>Pages</Text>
            <Text style={styles.jobDetailValue}>{item.total_pages}</Text>
          </View>
        )}
        {item.copies > 0 && (
          <View style={styles.jobDetail}>
            <Text style={styles.jobDetailLabel}>Copies</Text>
            <Text style={styles.jobDetailValue}>{item.copies}</Text>
          </View>
        )}
        <View style={styles.jobDetail}>
          <Text style={styles.jobDetailLabel}>Color</Text>
          <Text style={styles.jobDetailValue}>
            {item.color_mode === 'color' ? 'Color' : 'B&W'}
          </Text>
        </View>
        {item.file_size > 0 && (
          <View style={styles.jobDetail}>
            <Text style={styles.jobDetailLabel}>Size</Text>
            <Text style={styles.jobDetailValue}>{formatFileSize(item.file_size)}</Text>
          </View>
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {!stationInfo?.url ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyTitle}>No Station Connected</Text>
          <Text style={styles.emptyText}>
            Connect to a Print Station to view your print jobs.
          </Text>
          <TouchableOpacity
            style={styles.scanButton}
            onPress={() => navigation.navigate('QRScanner')}>
            <Text style={styles.scanButtonText}>CONNECT TO STATION</Text>
          </TouchableOpacity>
        </View>
      ) : loading ? (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color="#6366f1" />
          <Text style={styles.emptyText}>Loading jobs...</Text>
        </View>
      ) : (
        <FlatList
          data={jobs}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#6366f1"
              colors={['#6366f1']}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📄</Text>
              <Text style={styles.emptyTitle}>No Print Jobs</Text>
              <Text style={styles.emptyText}>
                Your print jobs will appear here.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  list: {
    padding: 16,
    paddingBottom: 32,
  },
  jobCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  jobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  jobFileName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#f1f5f9',
    flex: 1,
    marginRight: 12,
  },
  statusBadge: {
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  jobDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  jobDetail: {
    minWidth: 60,
  },
  jobDetailLabel: {
    fontSize: 11,
    color: '#64748b',
    marginBottom: 2,
  },
  jobDetailValue: {
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f1f5f9',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  scanButton: {
    backgroundColor: '#6366f1',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  scanButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
});
