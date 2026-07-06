import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import { useChatStore } from '../../store/chatStore';
import { useNotificationStore } from '../../store/notificationStore';
import { classNames } from '../../utils/format';
import {
  LayoutDashboard,
  CheckSquare,
  MessageSquare,
  Settings,
  Shield,
  Users,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ClipboardList
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { user, logout } = useAuthStore();
  const { sidebarCollapsed, toggleSidebar } = useUIStore();
  const { channels } = useChatStore();
  const { unreadCount: notifUnread } = useNotificationStore();
  const navigate = useNavigate();

  // Sum all unread channel counts
  const chatUnread = channels.reduce((sum, c) => sum + (c.unreadCount || 0), 0);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navLinks = [
    {
      to: '/dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard
    },
    {
      to: '/tasks',
      label: 'Tasks',
      icon: CheckSquare
    },
    {
      to: '/chat',
      label: 'Chat',
      icon: MessageSquare,
      badge: chatUnread > 0 ? chatUnread : undefined
    },
    {
      to: '/settings',
      label: 'Settings',
      icon: Settings
    }
  ];

  // Add role-specific navigation
  if (user?.role === 'SUPER_ADMIN') {
    navLinks.splice(3, 0, {
      to: '/admin/dashboard',
      label: 'Admin Panel',
      icon: Shield
    });
  } else if (user?.role === 'MANAGER') {
    navLinks.splice(3, 0, {
      to: '/manager/dashboard',
      label: 'Team Board',
      icon: Users
    });
  } else if (user?.role === 'HR') {
    navLinks.splice(3, 0, {
      to: '/hr/dashboard',
      label: 'HR Panel',
      icon: ClipboardList
    });
  }

  return (
    <aside
      className={classNames(
        'bg-[#111111] border-r border-[rgba(255,255,255,0.08)] flex flex-col h-screen transition-all duration-150 shrink-0 select-none z-30',
        sidebarCollapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Brand logo header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-[rgba(255,255,255,0.08)]">
        {!sidebarCollapsed && (
          <div className="flex items-center gap-1.5 font-bold text-white text-base font-sans tracking-tight">
            <span>Company</span>
            <span className="text-[#00E676] flex items-center">
              OS<span className="w-1.5 h-1.5 rounded-full bg-[#00E676] ml-0.5 inline-block" />
            </span>
          </div>
        )}
        {sidebarCollapsed && (
          <div className="font-bold text-xl text-[#00E676] w-full text-center">
            C🟢
          </div>
        )}
        <button
          onClick={toggleSidebar}
          className="hidden md:flex text-text-secondary hover:text-white transition-colors duration-150 hover:bg-[#1C1C1C] p-1.5 rounded-lg"
        >
          {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Nav List */}
      <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto scrollbar-thin">
        {navLinks.map((link) => {
          const Icon = link.icon;
          return (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                classNames(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 relative group',
                  isActive
                    ? 'bg-[#1B4332]/50 text-[#00E676] border-l-2 border-[#00E676] font-medium'
                    : 'text-text-secondary hover:text-white hover:bg-[#161616]'
                )
              }
            >
              <Icon className="w-5 h-5 shrink-0" />
              {!sidebarCollapsed && <span className="truncate">{link.label}</span>}

              {/* Unread Badge indicator */}
              {link.badge !== undefined && (
                <span
                  className={classNames(
                    'bg-[#FF3D3D] text-white text-[10px] font-bold rounded-full flex items-center justify-center shrink-0 min-w-5 h-5 px-1.5',
                    sidebarCollapsed ? 'absolute -top-1 -right-1' : 'ml-auto'
                  )}
                >
                  {link.badge}
                </span>
              )}

              {/* Hover Tooltip for collapsed sidebar */}
              {sidebarCollapsed && (
                <div className="absolute left-16 scale-0 group-hover:scale-100 transition-all origin-left duration-100 bg-[#161616] text-white text-xs font-semibold px-2.5 py-1.5 rounded-md border border-[rgba(255,255,255,0.08)] whitespace-nowrap shadow-xl z-50">
                  {link.label}
                </div>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* User profile footer */}
      <div className="p-3 border-t border-[rgba(255,255,255,0.08)]">
        <button
          onClick={handleLogout}
          className={classNames(
            'flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-[#FF3D3D] hover:bg-[#3D1414]/30 hover:text-[#FF3D3D] transition-all duration-150',
            sidebarCollapsed ? 'justify-center' : ''
          )}
        >
          <LogOut className="w-5 h-5 shrink-0" />
          {!sidebarCollapsed && <span>Log Out</span>}
        </button>
      </div>
    </aside>
  );
};
