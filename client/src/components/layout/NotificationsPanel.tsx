import React, { useEffect, useState } from 'react';
import { useNotificationStore, AppNotification } from '../../store/notificationStore';
import { useUIStore } from '../../store/uiStore';
import { useNavigate } from 'react-router-dom';
import { formatDate } from '../../utils/format';
import { Check, Bell, BellOff, ArrowRight } from 'lucide-react';
import { classNames } from '../../utils/format';
import { Button } from '../ui/Button';

interface NotificationsPanelProps {
  onClose: () => void;
}

export const NotificationsPanel: React.FC<NotificationsPanelProps> = ({ onClose }) => {
  const { notifications, fetchNotifications, markRead, markAllRead, isLoading } = useNotificationStore();
  const { setSelectedTaskId } = useUIStore();
  const [filter, setFilter] = useState<'All' | 'Unread' | 'Task' | 'Chat' | 'Attendance'>('All');
  const navigate = useNavigate();

  useEffect(() => {
    fetchNotifications(1, filter);
  }, [filter]);

  const handleNotificationClick = async (notif: AppNotification) => {
    // Mark as read
    if (!notif.isRead) {
      await markRead(notif.id);
    }
    
    // Close panel
    onClose();

    // Navigate to resource
    if (notif.type.startsWith('TASK') && notif.referenceId) {
      setSelectedTaskId(notif.referenceId);
      navigate('/tasks');
    } else if (notif.type === 'CHAT_MENTION' && notif.referenceId) {
      navigate('/chat');
    } else if (notif.type === 'ATTENDANCE_ALERT') {
      navigate('/dashboard');
    }
  };

  const filterTabs: ('All' | 'Unread' | 'Task' | 'Chat' | 'Attendance')[] = ['All', 'Unread', 'Task', 'Chat', 'Attendance'];

  return (
    <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-[#111111] border border-[rgba(255,255,255,0.08)] rounded-xl shadow-2xl z-50 flex flex-col max-h-[500px]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(255,255,255,0.08)]">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-[#00E676]" />
          <span className="text-xs font-semibold uppercase tracking-wider text-white">Alerts</span>
        </div>
        <button
          onClick={markAllRead}
          className="text-xs text-[#00E676] hover:text-[#00C853] font-medium flex items-center gap-1 transition-colors"
        >
          <Check className="w-3.5 h-3.5" />
          Mark all read
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-2 border-b border-[rgba(255,255,255,0.08)] overflow-x-auto scrollbar-thin shrink-0">
        {filterTabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={classNames(
              'px-2.5 py-1 text-xs rounded-md transition-all font-medium whitespace-nowrap',
              filter === tab
                ? 'bg-[#1B4332] text-[#00E676] border border-[rgba(0,230,118,0.2)]'
                : 'text-text-secondary hover:text-white hover:bg-[#161616]'
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-5 h-5 border-2 border-[#00E676] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <BellOff className="w-8 h-8 text-text-muted mb-2 animate-pulse" />
            <p className="text-xs text-text-secondary">No notifications found.</p>
          </div>
        ) : (
          notifications.map((notif) => (
            <div
              key={notif.id}
              onClick={() => handleNotificationClick(notif)}
              className={classNames(
                'flex flex-col p-3 rounded-lg border text-left cursor-pointer transition-all duration-150 relative overflow-hidden group',
                notif.isRead
                  ? 'bg-transparent border-transparent hover:bg-[#161616]'
                  : 'bg-[#1B4332]/10 border-[rgba(0,230,118,0.08)] hover:bg-[#1B4332]/15 hover:border-[rgba(0,230,118,0.2)]'
              )}
            >
              {/* Unread marker bar */}
              {!notif.isRead && (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#00E676]" />
              )}
              
              <div className="flex justify-between items-start gap-2 mb-1">
                <span className={classNames(
                  'text-xs font-semibold leading-tight text-white group-hover:text-[#00E676] transition-colors',
                  !notif.isRead && 'font-bold'
                )}>
                  {notif.title}
                </span>
                <span className="text-[10px] text-text-muted shrink-0 font-mono">
                  {formatDate(notif.createdAt)}
                </span>
              </div>
              <p className="text-xs text-text-secondary mb-1 leading-normal">
                {notif.body}
              </p>
              {notif.referenceId && (
                <span className="text-[10px] text-[#00E676] flex items-center gap-1 font-medium mt-1">
                  View resource <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
