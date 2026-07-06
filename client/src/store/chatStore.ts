import { create } from 'zustand';
import api from '../api';
import { socket } from '../socket';

export interface ChannelMember {
  channelId: string;
  userId: string;
  user: {
    id: string;
    name: string;
    avatarUrl: string | null;
    lastActiveAt: string | null;
    isActive: boolean;
  };
  lastReadAt: string | null;
}

export interface ChatMessage {
  id: string;
  channelId: string;
  senderId: string;
  content: string;
  attachments: string[];
  parentMessageId: string | null;
  createdAt: string;
  editedAt: string | null;
  sender: {
    id: string;
    name: string;
    avatarUrl: string | null;
  };
  replies?: ChatMessage[];
}

export interface ChatChannel {
  id: string;
  type: 'GLOBAL' | 'DM' | 'GROUP' | 'TASK';
  name: string | null;
  avatarUrl: string | null;
  createdBy: string | null;
  taskId: string | null;
  createdAt: string;
  members: ChannelMember[];
  task?: { id: string; title: string } | null;
  messages: ChatMessage[];
  unreadCount?: number;
}

interface ChatState {
  channels: ChatChannel[];
  activeChannel: ChatChannel | null;
  messages: ChatMessage[];
  nextCursor: string | null;
  typingUsers: Record<string, string[]>; // channelId -> names
  onlineUsers: Record<string, boolean>; // userId -> isOnline
  isLoading: boolean;
  messagesLoading: boolean;

  fetchChannels: () => Promise<void>;
  selectChannel: (channel: ChatChannel) => Promise<void>;
  fetchMessages: (channelId: string, loadMore?: boolean) => Promise<void>;
  sendMessage: (content: string, parentMessageId?: string | null, files?: File[]) => Promise<void>;
  addMessage: (message: ChatMessage) => void;
  createGroup: (name: string, members: string[]) => Promise<ChatChannel>;
  startDM: (partnerId: string) => Promise<ChatChannel>;
  setTyping: (channelId: string, userId: string, isTyping: boolean, userName: string) => void;
  setPresence: (userId: string, isOnline: boolean) => void;
  initPresence: (users: { id: string; lastActiveAt: string | null }[]) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  channels: [],
  activeChannel: null,
  messages: [],
  nextCursor: null,
  typingUsers: {},
  onlineUsers: {},
  isLoading: false,
  messagesLoading: false,

  fetchChannels: async () => {
    set({ isLoading: true });
    try {
      const { data } = await api.get('/api/channels');
      set({ channels: data, isLoading: false });
    } catch (err) {
      set({ isLoading: false });
    }
  },

  selectChannel: async (channel) => {
    const previous = get().activeChannel;
    
    // Manage socket rooms
    if (socket) {
      if (previous) {
        socket.emit('chat:leave-channel', { channelId: previous.id });
      }
      socket.emit('chat:join-channel', { channelId: channel.id });
    }

    set({
      activeChannel: channel,
      messages: [],
      nextCursor: null
    });

    await get().fetchMessages(channel.id);
  },

  fetchMessages: async (channelId, loadMore = false) => {
    set({ messagesLoading: true });
    try {
      const params: any = { limit: 50 };
      if (loadMore && get().nextCursor) {
        params.cursor = get().nextCursor;
      }

      const { data } = await api.get(`/api/channels/${channelId}/messages`, { params });
      
      set((state) => ({
        messages: loadMore ? [...data.messages, ...state.messages] : data.messages,
        nextCursor: data.nextCursor || null,
        messagesLoading: false
      }));
    } catch (err) {
      set({ messagesLoading: false });
    }
  },

  sendMessage: async (content, parentMessageId = null, files = []) => {
    const active = get().activeChannel;
    if (!active) return;

    try {
      let message: ChatMessage;

      if (files.length > 0) {
        const formData = new FormData();
        formData.append('content', content);
        if (parentMessageId) {
          formData.append('parentMessageId', parentMessageId);
        }
        files.forEach((file) => {
          formData.append('attachments', file);
        });

        const { data } = await api.post(`/api/channels/${active.id}/messages`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });
        message = data;
      } else {
        const { data } = await api.post(`/api/channels/${active.id}/messages`, {
          content,
          parentMessageId
        });
        message = data;
      }

      if (!socket || !socket.connected) {
        get().addMessage(message);
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      throw err;
    }
  },

  addMessage: (message) => {
    const active = get().activeChannel;
    
    // Check if message belongs to active channel
    if (active && message.channelId === active.id) {
      // Avoid duplication
      const exists = get().messages.some((m) => m.id === message.id);
      if (!exists) {
        set((state) => ({
          messages: [...state.messages, message]
        }));
      }
    }

    // Refresh last message on channel list
    set((state) => ({
      channels: state.channels.map((chan) => {
        if (chan.id === message.channelId) {
          return {
            ...chan,
            messages: [message],
            unreadCount: (active && active.id === message.channelId) ? 0 : (chan.unreadCount || 0) + 1
          };
        }
        return chan;
      })
    }));
  },

  createGroup: async (name, members) => {
    try {
      const { data } = await api.post('/api/channels', { name, members });
      set((state) => ({
        channels: [data, ...state.channels]
      }));
      return data;
    } catch (err) {
      throw err;
    }
  },

  startDM: async (partnerId) => {
    try {
      const { data } = await api.post('/api/channels/dm', { partnerId });
      
      // Check if already in channel list
      const exists = get().channels.some((c) => c.id === data.id);
      if (!exists) {
        set((state) => ({
          channels: [data, ...state.channels]
        }));
      }
      return data;
    } catch (err) {
      throw err;
    }
  },

  setTyping: (channelId, userId, isTyping, userName) => {
    set((state) => {
      const currentList = state.typingUsers[channelId] || [];
      let newList: string[];

      if (isTyping) {
        newList = currentList.includes(userName) ? currentList : [...currentList, userName];
      } else {
        newList = currentList.filter((name) => name !== userName);
      }

      return {
        typingUsers: {
          ...state.typingUsers,
          [channelId]: newList
        }
      };
    });
  },

  setPresence: (userId, isOnline) => {
    set((state) => ({
      onlineUsers: {
        ...state.onlineUsers,
        [userId]: isOnline
      }
    }));
  },

  initPresence: (users) => {
    const presenceMap: Record<string, boolean> = {};
    const fiveMinsAgo = Date.now() - 5 * 60 * 1000;
    
    users.forEach((u) => {
      const isRecent = u.lastActiveAt ? new Date(u.lastActiveAt).getTime() > fiveMinsAgo : false;
      presenceMap[u.id] = isRecent;
    });

    set({ onlineUsers: presenceMap });
  }
}));
