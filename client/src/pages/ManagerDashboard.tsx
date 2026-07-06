import React, { useEffect, useState } from 'react';
import api from '../api';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Avatar } from '../components/ui/Avatar';
import { useChatStore, ChatChannel } from '../store/chatStore';
import { classNames, formatDate } from '../utils/format';
import { AlertTriangle, Clock, CheckCircle2, MessageSquare, ArrowRight, ShieldAlert, RefreshCw } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

interface TeamMemberAttendance {
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  department: string;
  attendance: {
    id?: string;
    clockIn: string | null;
    clockOut: string | null;
    status: 'PRESENT' | 'LATE' | 'HALF_DAY' | 'ABSENT' | 'ON_LEAVE';
    notes: string | null;
  };
}

export const ManagerDashboard: React.FC = () => {
  const { channels, fetchChannels, selectChannel } = useChatStore();
  const [teamAttendance, setTeamAttendance] = useState<TeamMemberAttendance[]>([]);
  const [teamTasks, setTeamTasks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [alerts, setAlerts] = useState<any[]>([]);
  const navigate = useNavigate();

  const loadData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch team attendance today
      const todayStr = new Date().toISOString().split('T')[0];
      const { data: attendanceData } = await api.get('/api/attendance/team', { params: { date: todayStr } });
      setTeamAttendance(attendanceData);

      // 2. Fetch team tasks
      const { data: tasksData } = await api.get('/api/tasks/team');
      setTeamTasks(tasksData);

      await fetchChannels();
      setIsLoading(false);
    } catch (err) {
      console.error(err);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Compute Alerts & Progress
  useEffect(() => {
    if (teamAttendance.length === 0 && teamTasks.length === 0) return;

    const computedAlerts: any[] = [];

    // Alert 1: Absent members today
    teamAttendance.forEach(member => {
      if (member.attendance.status === 'ABSENT') {
        computedAlerts.push({
          id: `absent-${member.userId}`,
          type: 'ABSENT',
          title: 'Member Absent Today',
          desc: `${member.name} has not clocked in yet.`,
          severity: 'HIGH'
        });
      } else if (member.attendance.status === 'LATE') {
        computedAlerts.push({
          id: `late-${member.userId}`,
          type: 'LATE',
          title: 'Member Late Today',
          desc: `${member.name} clocked in late at ${new Date(member.attendance.clockIn!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`,
          severity: 'LOW'
        });
      }
    });

    // Alert 2: Overdue tasks
    const now = new Date();
    teamTasks.forEach(task => {
      if (task.dueDate && new Date(task.dueDate) < now && task.status !== 'COMPLETED') {
        computedAlerts.push({
          id: `overdue-${task.id}`,
          type: 'OVERDUE',
          title: 'Task Overdue',
          desc: `"${task.title}" is overdue (due ${formatDate(task.dueDate)}).`,
          severity: 'CRITICAL',
          refId: task.id
        });
      } else if (task.status === 'BLOCKED') {
        computedAlerts.push({
          id: `blocked-${task.id}`,
          type: 'BLOCKED',
          title: 'Task Blocked',
          desc: `"${task.title}" has been flagged as blocked.`,
          severity: 'HIGH',
          refId: task.id
        });
      }
    });

    // Sort alerts by urgency (CRITICAL > HIGH > LOW)
    const severityOrder = { CRITICAL: 0, HIGH: 1, LOW: 2 };
    computedAlerts.sort((a, b) => severityOrder[a.severity as keyof typeof severityOrder] - severityOrder[b.severity as keyof typeof severityOrder]);

    setAlerts(computedAlerts);
  }, [teamAttendance, teamTasks]);

  // Calculate task completions per user
  const getUserTaskStats = (userId: string) => {
    const userTasks = teamTasks.filter(t => t.assignees.some((a: any) => a.userId === userId));
    const total = userTasks.length;
    const completed = userTasks.filter(t => t.status === 'COMPLETED').length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, percentage };
  };

  const getStatusDotColor = (status: string) => {
    switch (status) {
      case 'PRESENT': return 'bg-status-success';
      case 'LATE': return 'bg-status-warning';
      case 'HALF_DAY': return 'bg-[#FF3D3D]'; // Orange/Red mix or half day
      case 'ABSENT': return 'bg-status-danger';
      case 'ON_LEAVE': return 'bg-status-neutral';
      default: return 'bg-status-neutral';
    }
  };

  const getAlertSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return 'danger';
      case 'HIGH': return 'warning';
      default: return 'neutral';
    }
  };

  const handleGroupShortcut = async (channel: ChatChannel) => {
    await selectChannel(channel);
    navigate('/chat');
  };

  // Filter group channels
  const groupChannels = channels.filter(c => c.type === 'GROUP' || c.type === 'GLOBAL').slice(0, 4);

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-1">
      {/* Header */}
      <div className="flex justify-between items-center select-none">
        <div>
          <h2 className="text-xl font-bold font-sans tracking-tight text-white uppercase">
            Team management Board
          </h2>
          <p className="text-xs text-text-secondary">
            Overview of team tasks, live attendance, and project blockers.
          </p>
        </div>
        <button
          onClick={loadData}
          className="p-2 bg-[#161616] border border-[rgba(255,255,255,0.08)] text-text-secondary hover:text-white rounded-lg hover:border-border-accent transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT COLUMN: Team Attendance & Alerts */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Team Attendance Grid */}
          <Card hoverable={false}>
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-bold text-text-secondary uppercase tracking-widest">Today's Attendance Grid</span>
              <span className="text-[10px] text-text-muted font-mono">{teamAttendance.length} Members</span>
            </div>
            
            <div className="h-px bg-[rgba(255,255,255,0.08)] w-full mb-5" />

            {isLoading ? (
              <div className="flex justify-center py-12">
                <div className="w-6 h-6 border-2 border-[#00E676] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : teamAttendance.length === 0 ? (
              <div className="text-center py-12 text-xs text-text-secondary">
                No team members registered under your department.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {teamAttendance.map(member => (
                  <div
                    key={member.userId}
                    className="bg-[#1C1C1C] border border-[rgba(255,255,255,0.08)] rounded-xl p-3.5 flex items-center gap-3 relative hover:border-[rgba(0,230,118,0.25)] transition-colors"
                  >
                    <div className="relative">
                      <Avatar src={member.avatarUrl} name={member.name} size="md" />
                      <span className={classNames('absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-[#1C1C1C]', getStatusDotColor(member.attendance.status))} />
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-xs font-semibold text-white truncate">{member.name}</p>
                      <p className="text-[10px] text-text-secondary uppercase font-bold tracking-wider">{member.attendance.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Task Progress Panel */}
          <Card hoverable={false}>
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-bold text-text-secondary uppercase tracking-widest">Task Progress Grid</span>
              <span className="text-[10px] text-[#00E676] font-semibold uppercase">Performance</span>
            </div>

            <div className="h-px bg-[rgba(255,255,255,0.08)] w-full mb-5" />

            <div className="space-y-4">
              {teamAttendance.map(member => {
                const stats = getUserTaskStats(member.userId);
                return (
                  <div key={member.userId} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
                    <div className="flex items-center gap-2.5 min-w-[160px]">
                      <Avatar src={member.avatarUrl} name={member.name} size="xs" />
                      <span className="font-medium text-white">{member.name}</span>
                    </div>
                    
                    {/* Progress bar */}
                    <div className="flex-1 flex items-center gap-3">
                      <div className="h-2 bg-[#1C1C1C] rounded-full flex-1 overflow-hidden">
                        <div
                          className="h-full bg-[#00E676] rounded-full transition-all duration-300"
                          style={{ width: `${stats.percentage}%` }}
                        />
                      </div>
                      <span className="font-mono text-[11px] font-bold text-text-secondary min-w-[32px] text-right">
                        {stats.percentage}%
                      </span>
                    </div>

                    <div className="font-mono text-[10px] text-text-muted min-w-[70px] text-right">
                      {stats.completed}/{stats.total} Tasks
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

        </div>

        {/* RIGHT COLUMN: Urgent Alerts & Chats */}
        <div className="space-y-6">
          
          {/* Urgent Alerts Feed */}
          <Card hoverable={false} className="max-h-[380px] flex flex-col">
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-bold text-text-secondary uppercase tracking-widest">Urgency Alert Feed</span>
              <ShieldAlert className="w-4 h-4 text-status-danger" />
            </div>

            <div className="h-px bg-[rgba(255,255,255,0.08)] w-full mb-4 shrink-0" />

            <div className="flex-1 overflow-y-auto scrollbar-thin space-y-3 pr-1">
              {alerts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center text-text-muted">
                  <CheckCircle2 className="w-7 h-7 mb-2 text-status-success opacity-80" />
                  <p className="text-xs">All operations running smoothly.</p>
                </div>
              ) : (
                alerts.map(alert => (
                  <div
                    key={alert.id}
                    className="flex gap-2.5 bg-[#1C1C1C] border border-[rgba(255,255,255,0.08)] p-3 rounded-lg text-xs"
                  >
                    <AlertTriangle className={classNames('w-4 h-4 shrink-0 mt-0.5', alert.severity === 'CRITICAL' ? 'text-[#FF3D3D]' : 'text-[#FFB300]')} />
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span className="font-bold text-white leading-tight">{alert.title}</span>
                        <Badge variant={getAlertSeverityBadge(alert.severity)}>
                          {alert.severity}
                        </Badge>
                      </div>
                      <p className="text-text-secondary text-[11px] leading-relaxed">{alert.desc}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* Quick Chat Shortcuts */}
          <Card hoverable={false}>
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-bold text-text-secondary uppercase tracking-widest">Team Channels</span>
              <MessageSquare className="w-4 h-4 text-[#00E676]/80" />
            </div>

            <div className="h-px bg-[rgba(255,255,255,0.08)] w-full mb-4" />

            <div className="space-y-2">
              {groupChannels.length === 0 ? (
                <div className="text-center py-6 text-xs text-text-secondary">
                  No public/group channels active.
                </div>
              ) : (
                groupChannels.map(channel => (
                  <button
                    key={channel.id}
                    onClick={() => handleGroupShortcut(channel)}
                    className="w-full bg-[#1C1C1C] border border-[rgba(255,255,255,0.08)] hover:border-[#00E676] px-3.5 py-2.5 rounded-lg flex items-center justify-between text-xs text-left group transition-all"
                  >
                    <span className="font-semibold text-white group-hover:text-[#00E676] transition-colors truncate pr-2">
                      #{channel.name || 'Group Chat'}
                    </span>
                    <span className="text-[10px] text-text-muted flex items-center gap-0.5 font-bold uppercase tracking-wider">
                      Open <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  </button>
                ))
              )}
            </div>
          </Card>

        </div>

      </div>
    </div>
  );
};
export default ManagerDashboard;
