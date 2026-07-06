import React, { useEffect, useState, useRef } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useNotificationStore } from '../../store/notificationStore';
import { Avatar } from '../ui/Avatar';
import { Badge } from '../ui/Badge';
import { Bell } from 'lucide-react';
import { NotificationsPanel } from './NotificationsPanel';

export const TopBar: React.FC = () => {
  const { user } = useAuthStore();
  const { unreadCount } = useNotificationStore();
  const [time, setTime] = useState<string>('');
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Live timer tick
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      setTime(`${hours}:${minutes}:${seconds}`);
    };
    
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Close notifications panel on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN': return 'Admin';
      case 'MANAGER': return 'Manager';
      case 'HR': return 'HR Partner';
      case 'EMPLOYEE': return 'Employee';
      default: return 'User';
    }
  };

  const getRoleVariant = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN': return 'danger';
      case 'MANAGER': return 'info';
      case 'HR': return 'warning';
      default: return 'neutral';
    }
  };

  return (
    <header className="h-16 border-b border-[rgba(255,255,255,0.08)] bg-[#111111] flex items-center justify-between px-6 select-none shrink-0 z-20">
      {/* Live clock display */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-text-muted font-semibold uppercase tracking-widest font-sans">System Time</span>
        <span className="text-sm font-mono font-bold text-[#00E676] bg-[#0A0A0A] border border-[rgba(255,255,255,0.08)] px-2.5 py-1 rounded-md tracking-wider">
          {time || '00:00:00'}
        </span>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-5">
        {/* Notifications Bell */}
        <div className="relative" ref={panelRef}>
          <button
            onClick={() => setIsNotifOpen(!isNotifOpen)}
            className="relative p-2 rounded-lg text-text-secondary hover:text-white transition-colors duration-150 hover:bg-[#1C1C1C]"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 block w-2.5 h-2.5 rounded-full bg-[#FF3D3D] ring-2 ring-[#111111] animate-pulse" />
            )}
          </button>
          
          {isNotifOpen && (
            <NotificationsPanel onClose={() => setIsNotifOpen(false)} />
          )}
        </div>

        {/* Divider */}
        <div className="h-6 w-px bg-[rgba(255,255,255,0.08)]" />

        {/* User profile details */}
        {user && (
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-semibold text-white leading-none mb-1">
                {user.name}
              </p>
              <Badge variant={getRoleVariant(user.role)}>
                {getRoleLabel(user.role)}
              </Badge>
            </div>
            <Avatar
              src={user.avatarUrl}
              name={user.name}
              size="sm"
              isOnline={true}
            />
          </div>
        )}
      </div>
    </header>
  );
};
