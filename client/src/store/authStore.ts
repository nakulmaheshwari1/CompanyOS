import { create } from 'zustand';
import api, { setAccessToken } from '../api';
import { connectSocket, disconnectSocket } from '../socket';

export type UserRole = 'SUPER_ADMIN' | 'MANAGER' | 'HR' | 'EMPLOYEE';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl: string | null;
  departmentId: string | null;
}

interface AuthState {
  user: UserProfile | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  
  login: (email: string, password: string) => Promise<UserProfile>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<UserProfile | null>;
  clearError: () => void;
}

// Inactivity timer references
let inactivityTimeout: any = null;
const INACTIVITY_LIMIT_MS = 30 * 60 * 1000; // 30 minutes

function resetInactivityTimer(logoutFn: () => void) {
  if (inactivityTimeout) clearTimeout(inactivityTimeout);
  inactivityTimeout = setTimeout(() => {
    console.warn('User inactive for 30 minutes. Auto-logging out...');
    logoutFn();
  }, INACTIVITY_LIMIT_MS);
}

function initActivityListeners(logoutFn: () => void) {
  const reset = () => resetInactivityTimer(logoutFn);

  // Listen to common user activity events
  window.addEventListener('mousedown', reset);
  window.addEventListener('keydown', reset);
  window.addEventListener('mousemove', reset);
  window.addEventListener('scroll', reset);
  window.addEventListener('touchstart', reset);

  // Initial trigger
  reset();

  return () => {
    window.removeEventListener('mousedown', reset);
    window.removeEventListener('keydown', reset);
    window.removeEventListener('mousemove', reset);
    window.removeEventListener('scroll', reset);
    window.removeEventListener('touchstart', reset);
    if (inactivityTimeout) clearTimeout(inactivityTimeout);
  };
}

let removeListenersFn: (() => void) | null = null;

export const useAuthStore = create<AuthState>((set, get) => {
  // Listen to custom logout events (e.g. from axios interceptors)
  window.addEventListener('auth:logout', () => {
    get().logout();
  });

  return {
    user: null,
    accessToken: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,

    login: async (email, password) => {
      set({ isLoading: true, error: null });
      try {
        const { data } = await api.post('/api/auth/login', { email, password });
        const { accessToken, user } = data;

        setAccessToken(accessToken);
        connectSocket(accessToken);

        set({
          user,
          accessToken,
          isAuthenticated: true,
          isLoading: false
        });

        // Initialize 30min inactivity check
        if (removeListenersFn) removeListenersFn();
        removeListenersFn = initActivityListeners(() => get().logout());

        return user;
      } catch (err: any) {
        const message = err.response?.data?.message || 'Login failed. Please check your credentials.';
        set({ error: message, isLoading: false });
        throw new Error(message);
      }
    },

    logout: async () => {
      set({ isLoading: true });
      try {
        await api.post('/api/auth/logout').catch(() => {});
      } finally {
        setAccessToken('');
        disconnectSocket();
        
        if (removeListenersFn) {
          removeListenersFn();
          removeListenersFn = null;
        }

        set({
          user: null,
          accessToken: null,
          isAuthenticated: false,
          isLoading: false,
          error: null
        });
      }
    },

    checkAuth: async () => {
      set({ isLoading: true });
      try {
        // First try to refresh token (silent login)
        const { data: refreshData } = await api.post('/api/auth/refresh');
        const token = refreshData.accessToken;
        setAccessToken(token);
        connectSocket(token);

        // Fetch current user details
        const { data: userData } = await api.get('/api/users/me');
        
        set({
          user: userData,
          accessToken: token,
          isAuthenticated: true,
          isLoading: false
        });

        // Initialize inactivity listeners
        if (removeListenersFn) removeListenersFn();
        removeListenersFn = initActivityListeners(() => get().logout());

        return userData;
      } catch (err) {
        setAccessToken('');
        disconnectSocket();
        set({
          user: null,
          accessToken: null,
          isAuthenticated: false,
          isLoading: false
        });
        return null;
      }
    },

    clearError: () => set({ error: null })
  };
});
