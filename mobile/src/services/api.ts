import axios, { AxiosInstance } from 'axios';
import { API_ENDPOINTS } from '../constants';

let apiClient: AxiosInstance | null = null;

export function createApiClient(baseURL: string): AxiosInstance {
  apiClient = axios.create({
    baseURL,
    timeout: 30000,
    headers: { 'Content-Type': 'application/json' },
  });
  return apiClient;
}

export function getApiClient(): AxiosInstance | null {
  return apiClient;
}

export async function checkStationHealth(stationUrl: string): Promise<boolean> {
  try {
    const res = await axios.get(`${stationUrl}${API_ENDPOINTS.STATION_INFO}`, {
      timeout: 5000,
    });
    return res.data?.status === 'online';
  } catch {
    return false;
  }
}

export async function getStationInfo(stationUrl: string) {
  try {
    const res = await axios.get(`${stationUrl}${API_ENDPOINTS.STATION_INFO}`, {
      timeout: 5000,
    });
    return res.data;
  } catch (err: any) {
    let reason = 'Failed to get station info';
    if (err?.code === 'ERR_NETWORK' || err?.code === 'ECONNREFUSED') {
      reason = 'Server is offline or unreachable. Make sure the Print Station is running.';
    } else if (err?.code === 'ECONNABORTED' || err?.code === 'ETIMEDOUT') {
      reason = 'Connection timed out. The server might be on a different network.';
    } else if (err?.response) {
      const status = err.response.status;
      if (status === 404) reason = 'Station API not found. Check the server URL.';
      else if (status >= 500) reason = 'Server error. Try restarting the Print Station.';
      else reason = `Server responded with status ${status}.`;
    }
    throw new Error(reason);
  }
}

export async function getPrinters(stationUrl: string) {
  try {
    const res = await axios.get(`${stationUrl}${API_ENDPOINTS.PRINTERS}`, {
      timeout: 5000,
    });
    return res.data;
  } catch (err: any) {
    throw new Error(err?.message || 'Failed to get printers');
  }
}

export async function getJobs(stationUrl: string, status?: string) {
  try {
    const params = status ? { status } : {};
    const res = await axios.get(`${stationUrl}${API_ENDPOINTS.JOBS}`, {
      params,
      timeout: 5000,
    });
    return res.data;
  } catch (err: any) {
    throw new Error(err?.message || 'Failed to get jobs');
  }
}

export async function getScheduledJobs(stationUrl: string) {
  try {
    const res = await axios.get(`${stationUrl}${API_ENDPOINTS.CLIENT_SCHEDULED}`, {
      timeout: 5000,
    });
    return res.data;
  } catch (err: any) {
    throw new Error(err?.message || 'Failed to get scheduled jobs');
  }
}
