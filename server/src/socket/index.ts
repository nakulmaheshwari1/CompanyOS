import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import prisma from '../prisma/client';

interface SocketUser {
  userId: string;
  email: string;
  role: string;
}

// Maps userId -> set of socketIds
export const onlineUsers = new Map<string, Set<string>>();

export function setupSocketIO(server: HttpServer): Server {
  const io = new Server(server, {
    cors: {
      origin: [config.clientUrl, 'http://localhost:5173'],
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true
    },
    transports: ['polling', 'websocket'],
    allowUpgrades: true,
    pingTimeout: 60000,
    pingInterval: 25000
  });

  // Socket middleware for auth
  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;

    if (!token) {
      return next(new Error('Authentication error: Token missing'));
    }

    try {
      const decoded = jwt.verify(token as string, config.jwtAccessSecret) as SocketUser;
      socket.data.user = decoded;
      return next();
    } catch (err) {
      return next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', async (socket: Socket) => {
    const user = socket.data.user as SocketUser;
    const userId = user.userId;

    // Track online user
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
      
      // Update DB presence
      await prisma.user.update({
        where: { id: userId },
        data: { lastActiveAt: new Date() }
      }).catch(err => console.error('Error updating presence in DB:', err));

      // Broadcast presence change
      io.emit('user:presence', { userId, isOnline: true });
    }

    onlineUsers.get(userId)!.add(socket.id);
    
    // Join personal user room for targeted notifications
    socket.join(`user:${userId}`);

    // Join task rooms for task alerts
    const userTasks = await prisma.taskAssignee.findMany({
      where: { userId }
    });
    userTasks.forEach(ut => {
      socket.join(`task:${ut.taskId}`);
    });

    console.log(`Socket connected: ${socket.id} (User: ${userId})`);

    // Handle channel joining (for chat messages)
    socket.on('chat:join-channel', ({ channelId }) => {
      socket.join(`channel:${channelId}`);
      console.log(`Socket ${socket.id} joined channel: ${channelId}`);
    });

    socket.on('chat:leave-channel', ({ channelId }) => {
      socket.leave(`channel:${channelId}`);
      console.log(`Socket ${socket.id} left channel: ${channelId}`);
    });

    // Handle typing indicator
    socket.on('chat:typing-start', ({ channelId }) => {
      socket.to(`channel:${channelId}`).emit('chat:typing', {
        userId,
        channelId,
        isTyping: true
      });
    });

    socket.on('chat:typing-stop', ({ channelId }) => {
      socket.to(`channel:${channelId}`).emit('chat:typing', {
        userId,
        channelId,
        isTyping: false
      });
    });

    // Handle reaction
    socket.on('chat:react', ({ messageId, reaction, channelId }) => {
      // Broadcast to other users in channel
      io.to(`channel:${channelId}`).emit('chat:reaction', {
        messageId,
        reaction,
        userId
      });
    });

    // Handle presence heartbeat (every 30s)
    socket.on('user:ping', async () => {
      await prisma.user.update({
        where: { id: userId },
        data: { lastActiveAt: new Date() }
      }).catch(err => console.error('Presence ping DB update failed:', err));
    });

    // Handle disconnect
    socket.on('disconnect', async () => {
      const userConnections = onlineUsers.get(userId);
      if (userConnections) {
        userConnections.delete(socket.id);
        
        if (userConnections.size === 0) {
          onlineUsers.delete(userId);
          
          // Update DB lastActiveAt
          await prisma.user.update({
            where: { id: userId },
            data: { lastActiveAt: new Date() }
          }).catch(err => console.error('Presence disconnect DB update failed:', err));

          // Broadcast user went offline
          io.emit('user:presence', { userId, isOnline: false });
        }
      }
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });

  return io;
}
