import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import DocumentPicker from 'react-native-document-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList, SelectedFile } from '../types';
import { ALLOWED_EXTENSIONS, UPLOAD_SIZE_LIMIT } from '../constants';

type Props = NativeStackScreenProps<RootStackParamList, 'FileSelection'>;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export default function FileSelectionScreen({ navigation, route }: Props) {
  const { stationInfo } = route.params;
  const [file, setFile] = useState<SelectedFile | null>(null);
  const isPickingRef = useRef(false);

  const pickFile = async () => {
    if (isPickingRef.current) return;
    isPickingRef.current = true;
    try {
      const result = await DocumentPicker.pickSingle({
        type: [DocumentPicker.types.allFiles],
        copyTo: 'documentDirectory',
      });

      if (!result.uri) return;

      const fileName = result.name || 'document.pdf';
      const ext = '.' + fileName.split('.').pop()?.toLowerCase();
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        Alert.alert(
          'Unsupported File',
          `File type "${ext}" is not supported. Please select a PDF or other supported file.`,
        );
        return;
      }

      if (result.size && result.size > UPLOAD_SIZE_LIMIT) {
        Alert.alert(
          'File Too Large',
          'Maximum file size is 100MB. Please select a smaller file.',
        );
        return;
      }

      setFile({
        uri: result.uri,
        name: fileName,
        size: result.size || 0,
        type: result.type || 'application/pdf',
      });
    } catch (err: any) {
      if (!DocumentPicker.isCancel(err)) {
        Alert.alert('Error', 'Failed to pick file. Please try again.');
      }
    } finally {
      isPickingRef.current = false;
    }
  };

  const handleContinue = () => {
    if (!file) return;
    navigation.navigate('PrintOptions', {
      stationInfo,
      file,
      mode: 'instant',
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.stationBanner}>
        <Text style={styles.stationLabel}>Connected to</Text>
        <Text style={styles.stationId}>{stationInfo.stationId}</Text>
      </View>

      <View style={styles.content}>
        {!file ? (
          <TouchableOpacity style={styles.pickButton} onPress={pickFile}>
            <View style={styles.pickIcon}>
              <Text style={styles.pickIconText}>📄</Text>
            </View>
            <Text style={styles.pickTitle}>Select Document</Text>
            <Text style={styles.pickSubtitle}>
              Browse your device and select a PDF to print
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.fileCard}>
            <View style={styles.fileIcon}>
              <Text style={styles.fileIconText}>📄</Text>
            </View>
            <View style={styles.fileInfo}>
              <Text style={styles.fileName} numberOfLines={2}>
                {file.name}
              </Text>
              <Text style={styles.fileSize}>{formatFileSize(file.size)}</Text>
              <Text style={styles.fileType}>{file.type}</Text>
            </View>
            <TouchableOpacity style={styles.changeButton} onPress={pickFile}>
              <Text style={styles.changeButtonText}>CHANGE</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {file && (
        <TouchableOpacity style={styles.continueButton} onPress={handleContinue}>
          <Text style={styles.continueButtonText}>CONTINUE</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    padding: 20,
  },
  stationBanner: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 14,
    marginBottom: 24,
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
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  pickButton: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#334155',
    borderStyle: 'dashed',
  },
  pickIcon: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  pickIconText: {
    fontSize: 28,
  },
  pickTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f1f5f9',
    marginBottom: 8,
  },
  pickSubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
  },
  fileCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  fileIcon: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  fileIconText: {
    fontSize: 24,
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f1f5f9',
    marginBottom: 4,
  },
  fileSize: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 2,
  },
  fileType: {
    fontSize: 12,
    color: '#64748b',
    textTransform: 'uppercase',
  },
  changeButton: {
    backgroundColor: '#334155',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  changeButtonText: {
    color: '#f1f5f9',
    fontSize: 12,
    fontWeight: '600',
  },
  continueButton: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  continueButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});
