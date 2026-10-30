export const API_ENDPOINTS = {
  STATUS: '/api/status',
  STATION_INFO: '/api/station/info',
  STATION_QR: '/api/station/qr',
  UPLOAD: '/api/upload',
  JOBS: '/api/jobs',
  JOB_FILE: '/api/jobs/:id/file',
  PRINTERS: '/api/printers',
  CLIENT_SCHEDULED: '/api/client/scheduled',
  CLIENT_SCHEDULE: '/api/client/schedule',
} as const;

export const SOCKET_EVENTS = {
  NEW_JOB: 'new-job',
  JOB_UPDATED: 'job-updated',
  JOB_COMPLETED: 'job-completed',
  JOB_CANCELLED: 'job-cancelled',
  STATS: 'stats',
  ACTIVITY: 'activity',
  PRINTER_UPDATED: 'printer-updated',
  DEVICE_INFO: 'device-info',
  START_PRINT: 'start-print',
} as const;

export const STATUS_FLOW: Array<{ key: string; label: string; icon: string }> = [
  { key: 'uploading', label: 'Document Uploaded', icon: 'check' },
  { key: 'waiting', label: 'Waiting for Print', icon: 'clock' },
  { key: 'printing', label: 'Printing', icon: 'printer' },
  { key: 'completed', label: 'Completed', icon: 'check-circle' },
];

export const COLOR_MODES = [
  { value: 'color', label: 'Color' },
  { value: 'bw', label: 'Black & White' },
] as const;

export const DUPLEX_MODES = [
  { value: 'single', label: 'Single Sided' },
  { value: 'duplex', label: 'Double Sided' },
] as const;

export const PAPER_SIZES = [
  { value: 'A4', label: 'A4' },
  { value: 'Letter', label: 'Letter' },
  { value: 'Legal', label: 'Legal' },
] as const;

export const UPLOAD_SIZE_LIMIT = 100 * 1024 * 1024;

export const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.tif', '.txt', '.webp', '.heic'];
