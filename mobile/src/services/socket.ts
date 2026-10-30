import { io, Socket } from 'socket.io-client';
import { SOCKET_EVENTS } from '../constants';

let socket: Socket | null = null;

export function connectSocket(stationUrl: string): Socket {
  if (socket) {
    socket.disconnect();
  }

  socket = io(stationUrl, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    timeout: 10000,
  });

  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function sendDeviceInfo(data: {
  ip: string;
  name: string;
  userAgent: string;
}): void {
  if (socket) {
    socket.emit(SOCKET_EVENTS.DEVICE_INFO, data);
  }
}

export function onJobUpdated(callback: (data: any) => void): void {
  if (socket) {
    socket.on(SOCKET_EVENTS.JOB_UPDATED, callback);
  }
}

export function onJobCompleted(callback: (data: any) => void): void {
  if (socket) {
    socket.on(SOCKET_EVENTS.JOB_COMPLETED, callback);
  }
}

export function onJobCancelled(callback: (data: any) => void): void {
  if (socket) {
    socket.on(SOCKET_EVENTS.JOB_CANCELLED, callback);
  }
}

export function onNewJob(callback: (data: any) => void): void {
  if (socket) {
    socket.on(SOCKET_EVENTS.NEW_JOB, callback);
  }
}

export function removeSocketListeners(): void {
  if (socket) {
    socket.off(SOCKET_EVENTS.JOB_UPDATED);
    socket.off(SOCKET_EVENTS.JOB_COMPLETED);
    socket.off(SOCKET_EVENTS.JOB_CANCELLED);
    socket.off(SOCKET_EVENTS.NEW_JOB);
  }
}
