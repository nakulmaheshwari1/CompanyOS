import { io, Socket } from 'socket.io-client';

export let socket: Socket | null = null;

export const connectSocket = (token: string) => {
  if (socket?.connected) return socket;

  // Relative path is proxied in development; can configure env fallback
  const socketUrl = import.meta.env.VITE_SOCKET_URL || '';
  
  socket = io(socketUrl, {
    auth: { token },
    query: { token },
    transports: ['polling', 'websocket'],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000
  });

  socket.on('connect', () => {
    console.log('Socket.io connection established.');
  });

  socket.on('disconnect', () => {
    console.log('Socket.io connection closed.');
  });

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
