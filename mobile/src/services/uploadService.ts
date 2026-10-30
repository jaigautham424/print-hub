import axios from 'axios';
import { SelectedFile, PrintOptions, PrintMode } from '../types';
import { API_ENDPOINTS } from '../constants';

export async function uploadFile(
  stationUrl: string,
  file: SelectedFile,
  options: PrintOptions,
  mode: PrintMode,
  deviceName: string,
  userName: string,
  onProgress?: (progress: number) => void,
): Promise<{ jobId: string; status: string; token?: string }> {
  if (!stationUrl) throw new Error('Station URL is required');

  const formData = new FormData();

  formData.append('file', {
    uri: file.uri,
    name: file.name,
    type: file.type || 'application/pdf',
  } as any);

  formData.append('device_name', deviceName);
  formData.append('user_name', userName);
  formData.append('copies', String(options.copies));
  formData.append('color_mode', options.colorMode);
  formData.append('duplex_mode', options.duplexMode);
  formData.append('paper_size', options.paperSize);

  if (mode === 'scheduled' && options.scheduledTime) {
    formData.append('scheduled_time', options.scheduledTime);
  }

  try {
    const res = await axios.post(`${stationUrl}${API_ENDPOINTS.UPLOAD}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
      onUploadProgress: (event) => {
        if (event.total && onProgress) {
          onProgress(Math.round((event.loaded * 100) / event.total));
        }
      },
    });
    return res.data;
  } catch (err: any) {
    throw new Error(err?.response?.data?.message || err?.message || 'Upload failed');
  }
}

export async function uploadScheduledFile(
  stationUrl: string,
  file: SelectedFile,
  options: PrintOptions,
  deviceName: string,
  userName: string,
  onProgress?: (progress: number) => void,
): Promise<{ id: string; message: string; token?: string }> {
  if (!stationUrl) throw new Error('Station URL is required');

  const formData = new FormData();

  formData.append('file', {
    uri: file.uri,
    name: file.name,
    type: file.type || 'application/pdf',
  } as any);

  formData.append('job_name', file.name);
  formData.append('device_name', deviceName);
  formData.append('user_name', userName);
  formData.append('copies', String(options.copies));
  formData.append('color_mode', options.colorMode);
  formData.append('duplex_mode', options.duplexMode);
  formData.append('paper_size', options.paperSize);

  if (options.scheduledTime) {
    formData.append('scheduled_time', options.scheduledTime);
  }

  try {
    const res = await axios.post(`${stationUrl}${API_ENDPOINTS.CLIENT_SCHEDULE}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
      onUploadProgress: (event) => {
        if (event.total && onProgress) {
          onProgress(Math.round((event.loaded * 100) / event.total));
        }
      },
    });
    return res.data;
  } catch (err: any) {
    throw new Error(err?.response?.data?.message || err?.message || 'Upload failed');
  }
}
