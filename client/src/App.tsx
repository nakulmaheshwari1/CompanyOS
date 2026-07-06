import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { useNotificationStore } from './store/notificationStore';
import { useChatStore } from './store/chatStore';
import { socket } from './socket';

// Layout & Pages
import { MainLayout } from './components/layout/MainLayout';
import { Login } from './pages/Login';
import { ForgotPassword } from './pages/ForgotPassword';
import { ResetPassword } from './pages/ResetPassword';
import { Dashboard } from './pages/Dashboard';
import { TasksPage } from './pages/TasksPage';
import { ChatPage } from './pages/ChatPage';
import { SettingsPage } from './pages/SettingsPage';
import { ManagerDashboard } from './pages/ManagerDashboard';
import { AdminDashboard } from './pages/AdminDashboard';

// Role Guard Component
interface RoleGuardProps {
  allowedRoles: ('SUPER_ADMIN' | 'MANAGER' | 'HR' | 'EMPLOYEE')[];
  children: React.ReactNode;
}

const RoleGuard: React.FC<RoleGuardProps> = ({ allowedRoles, children }) => {
  const { user } = useAuthStore();
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

const App: React.FC = () => {
  const { checkAuth, isAuthenticated, user } = useAuthStore();
  const { addNotification, fetchNotifications } = useNotificationStore();
  const { fetchChannels } = useChatStore();

  useEffect(() => {
    checkAuth();
  }, []);

  // Set up global Socket.io notifications listener once authenticated
  useEffect(() => {
    const currentSocket = socket;
    if (!isAuthenticated || !currentSocket) return;

    // Fetch initial notifications
    fetchNotifications(1, 'All');
    fetchChannels();

    const handleNewNotification = (notif: any) => {
      addNotification(notif);
      
      // Play a subtle high-tech notification tone
      try {
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-700.wav');
        audio.volume = 0.2;
        audio.play();
      } catch (err) {
        // Fallback if browser blocks autoplay
      }
    };

    currentSocket.on('notification:new', handleNewNotification);

    return () => {
      currentSocket.off('notification:new', handleNewNotification);
    };
  }, [isAuthenticated]);

  return (
    <BrowserRouter>
      <Routes>
        {/* Auth routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Protected App routes */}
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="tasks" element={<TasksPage />} />
          <Route path="chat" element={<ChatPage />} />
          <Route path="settings" element={<SettingsPage />} />
          
          {/* Manager Specific */}
          <Route
            path="manager/dashboard"
            element={
              <RoleGuard allowedRoles={['SUPER_ADMIN', 'MANAGER']}>
                <ManagerDashboard />
              </RoleGuard>
            }
          />
          
          {/* Admin Specific */}
          <Route
            path="admin/dashboard"
            element={
              <RoleGuard allowedRoles={['SUPER_ADMIN']}>
                <AdminDashboard />
              </RoleGuard>
            }
          />
        </Route>

        {/* Catch-all Redirect */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
