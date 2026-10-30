import AsyncStorage from '@react-native-async-storage/async-storage';
import { ParsedQR } from '../types';

const STATION_KEY = '@printhub_station';

export async function saveStation(station: ParsedQR): Promise<void> {
  try {
    await AsyncStorage.setItem(STATION_KEY, JSON.stringify(station));
  } catch {
    // silently fail
  }
}

export async function getSavedStation(): Promise<ParsedQR | null> {
  try {
    const raw = await AsyncStorage.getItem(STATION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ParsedQR;
  } catch {
    return null;
  }
}

export async function clearSavedStation(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STATION_KEY);
  } catch {
    // silently fail
  }
}
