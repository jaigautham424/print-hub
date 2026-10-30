export interface StationInfo {
  stationId: string;
  ssid: string;
  ip: string;
  url: string;
}

export interface ParsedQR {
  stationId: string;
  ssid: string;
  ip: string;
  url?: string;
}

export interface StationStatus {
  stationId: string;
  ip: string;
  port: number;
  network: string;
  url: string;
  status: string;
  version: string;
}

export interface SelectedFile {
  uri: string;
  name: string;
  size: number;
  type: string;
}

export type PrintMode = 'instant' | 'scheduled';

export type ColorMode = 'color' | 'bw';

export type DuplexMode = 'single' | 'duplex';

export type PaperSize = 'A4' | 'Letter' | 'Legal';

export interface PrintOptions {
  copies: number;
  colorMode: ColorMode;
  duplexMode: DuplexMode;
  paperSize: PaperSize;
  scheduledTime?: string;
}

export type PrintJobStatus =
  | 'uploading'
  | 'processing'
  | 'waiting'
  | 'printing'
  | 'completed'
  | 'error'
  | 'cancelled';

export interface PrintJob {
  id: string;
  queue_number: number;
  device_id: string;
  printer_id: string;
  user_name: string;
  device_name: string;
  file_name: string;
  original_name: string;
  file_path: string;
  file_size: number;
  total_pages: number;
  copies: number;
  color_mode: string;
  duplex_mode: string;
  paper_size: string;
  priority: number;
  status: PrintJobStatus;
  upload_time: string;
  start_time?: string;
  finish_time?: string;
  error_message?: string;
}

export interface ScheduledJob {
  id: string;
  job_name: string;
  file_name: string;
  file_path: string;
  file_size: number;
  total_pages: number;
  copies: number;
  color_mode: string;
  duplex_mode: string;
  paper_size: string;
  printer_id: string;
  user_name: string;
  scheduled_time: string;
  status: string;
  created_at: string;
  notes: string;
}

export type RootStackParamList = {
  Welcome: undefined;
  QRScanner: undefined;
  StationConnection: { stationInfo: ParsedQR };
  FileSelection: { stationInfo: ParsedQR };
  PrintOptions: { stationInfo: ParsedQR; file: SelectedFile; mode: PrintMode };
  UploadProgress: {
    stationInfo: ParsedQR;
    file: SelectedFile;
    mode: PrintMode;
    options: PrintOptions;
  };
  PrintStatus: {
    stationInfo: ParsedQR;
    jobId: string;
    file: SelectedFile;
    mode: PrintMode;
    options: PrintOptions;
  };
  History: { stationInfo: ParsedQR };
};
