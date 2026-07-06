import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { useTaskStore } from '../store/taskStore';
import api from '../api';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { formatTime, formatDuration, classNames, formatDate } from '../utils/format';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { Play, Square, AlertCircle, Calendar, PlaySquare, Award, Clock, ArrowRight, MessageSquare, Plus, RefreshCw } from 'lucide-react';
import { useUIStore } from '../store/uiStore';
import { useNavigate } from 'react-router-dom';

interface AttendanceRecord {
  id: string;
  date: string;
  clockIn: string | null;
  clockOut: string | null;
  status: 'PRESENT' | 'LATE' | 'HALF_DAY' | 'ABSENT' | 'ON_LEAVE';
  notes: string | null;
  hoursWorked?: number;
  clockInCount?: number;
}

export const Dashboard: React.FC = () => {
  const { user } = useAuthStore();
  const { tasks, fetchTasks } = useTaskStore();
  const { setCreateTaskModalOpen } = useUIStore();
  const navigate = useNavigate();

  // Attendance states
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [weeklyHistory, setWeeklyHistory] = useState<any[]>([]);
  const [elapsedTime, setElapsedTime] = useState<string>('00:00:00');
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);

  // Stats calculation
  const [stats, setStats] = useState({
    overdue: 0,
    dueToday: 0,
    inProgress: 0,
    completedThisWeek: 0
  });

  const loadDashboardData = async () => {
    try {
      setAttendanceLoading(true);
      // 1. Fetch today's attendance state
      const todayStr = new Date().toISOString().split('T')[0];
      const { data: records } = await api.get('/api/attendance/me', {
        params: {
          startDate: todayStr,
          endDate: todayStr
        }
      });
      const rawRecord = records[0];
      if (rawRecord && rawRecord.clockOut === undefined) {
        rawRecord.clockOut = null;
      }
      setTodayRecord(rawRecord || null);

      // 2. Fetch last 7 days history
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
      const { data: history } = await api.get('/api/attendance/me', {
        params: {
          startDate: sevenDaysAgo.toISOString().split('T')[0],
          endDate: todayStr
        }
      });

      // Format for Recharts
      const chartData = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dayStr = d.toISOString().split('T')[0];
        const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });

        const record = (history as AttendanceRecord[]).find(r => r.date.startsWith(dayStr));
        let hours = 0;
        if (record) {
          if (record.clockIn && !record.clockOut) {
            // Currently clocked in (running session)
            const sessionHours = (new Date().getTime() - new Date(record.clockIn).getTime()) / (1000 * 60 * 60);
            hours = (record.hoursWorked || 0) + sessionHours;
          } else {
            // Clocked out or absent. Fall back to calculating difference for backward compatibility with seeded data.
            if (record.hoursWorked) {
              hours = record.hoursWorked;
            } else if (record.clockIn && record.clockOut) {
              hours = (new Date(record.clockOut).getTime() - new Date(record.clockIn).getTime()) / (1000 * 60 * 60);
            } else {
              hours = record.hoursWorked || 0;
            }
          }
        }

        chartData.push({
          day: dayName,
          hours: parseFloat(hours.toFixed(2)),
          status: record ? record.status : 'ABSENT'
        });
      }
      setWeeklyHistory(chartData);
      setAttendanceLoading(false);
    } catch (err) {
      setAttendanceLoading(false);
      console.error('Failed to load attendance info:', err);
    }
  };

  // Fetch recent activities
  const loadActivities = async () => {
    try {
      setActivitiesLoading(true);
      // Fetch notifications as user activity logs
      const { data: notifData } = await api.get('/api/notifications', { params: { limit: 10 } });
      setRecentActivities(notifData.notifications || []);
      setActivitiesLoading(false);
    } catch (err) {
      setActivitiesLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks('All', 'dueDate');
    loadDashboardData();
    loadActivities();
  }, []);

  // Update tasks stats
  useEffect(() => {
    if (!tasks) return;
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    const overdue = tasks.filter(t => t.dueDate && new Date(t.dueDate) < now && t.status !== 'COMPLETED').length;
    const dueToday = tasks.filter(t => t.dueDate && t.dueDate.startsWith(todayStr) && t.status !== 'COMPLETED').length;
    const inProgress = tasks.filter(t => t.status === 'IN_PROGRESS').length;
    
    // Completed this week (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const completedThisWeek = tasks.filter(t => t.status === 'COMPLETED' && t.completedAt && new Date(t.completedAt) >= sevenDaysAgo).length;

    setStats({ overdue, dueToday, inProgress, completedThisWeek });
  }, [tasks]);

  // Live timer for working session
  useEffect(() => {
    let interval: any = null;

    if (todayRecord && todayRecord.clockIn) {
      const calculateElapsed = () => {
        const start = new Date(todayRecord.clockIn!).getTime();
        const diffMs = todayRecord.clockOut ? 0 : (Date.now() - start);
        const totalMs = (todayRecord.hoursWorked || 0) * 3600 * 1000 + diffMs;

        const secs = Math.floor((totalMs / 1000) % 60);
        const mins = Math.floor((totalMs / (1000 * 60)) % 60);
        const hrs = Math.floor(totalMs / (1000 * 60 * 60));

        const hrsStr = String(hrs).padStart(2, '0');
        const minsStr = String(mins).padStart(2, '0');
        const secsStr = String(secs).padStart(2, '0');

        setElapsedTime(`${hrsStr}:${minsStr}:${secsStr}`);
      };

      calculateElapsed();
      if (!todayRecord.clockOut) {
        interval = setInterval(calculateElapsed, 1000);
      }
    } else {
      setElapsedTime('00:00:00');
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [todayRecord]);

  // Clock-in handler
  const handleClockIn = async () => {
    setAttendanceLoading(true);
    try {
      const { data } = await api.post('/api/attendance/clock-in');
      setTodayRecord(data.record);
      loadDashboardData();
      loadActivities();
    } catch (err) {
      console.error(err);
    } finally {
      setAttendanceLoading(false);
    }
  };

  // Clock-out handler
  const handleClockOut = async () => {
    setAttendanceLoading(true);
    try {
      const { data } = await api.post('/api/attendance/clock-out');
      setTodayRecord(data.record);
      loadDashboardData();
      loadActivities();
    } catch (err) {
      console.error(err);
    } finally {
      setAttendanceLoading(false);
    }
  };

  const getClockStatus = () => {
    if (!todayRecord) return { label: 'Not Clocked In', color: 'text-text-muted', desc: 'Ready to start' };
    if (todayRecord.clockIn && !todayRecord.clockOut) {
      return { label: 'Active Session', color: 'text-[#00E676]', desc: 'Working' };
    }
    return { label: 'Done for the Day', color: 'text-[#3D9EFF]', desc: 'Clocked out' };
  };

  const clockStatus = getClockStatus();

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-1">
      {/* Welcome header */}
      <div className="flex justify-between items-center select-none">
        <div>
          <h2 className="text-xl font-bold font-sans tracking-tight text-white uppercase">
            Workforce Dashboard
          </h2>
          <p className="text-xs text-text-secondary">
            Welcome back, {user?.name}. Here is your status for today.
          </p>
        </div>
        <button
          onClick={() => { loadDashboardData(); loadActivities(); fetchTasks('All', 'dueDate'); }}
          className="p-2 bg-[#161616] border border-[rgba(255,255,255,0.08)] text-text-secondary hover:text-white rounded-lg hover:border-border-accent transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* SECTION A — Attendance Widget */}
        <Card active={todayRecord && todayRecord.clockIn && !todayRecord.clockOut ? true : false} className="lg:col-span-1 flex flex-col justify-between">
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold text-text-secondary uppercase tracking-widest">Attendance</span>
              <Badge variant={todayRecord?.status === 'PRESENT' ? 'success' : todayRecord?.status === 'LATE' ? 'warning' : todayRecord?.status === 'HALF_DAY' ? 'info' : 'neutral'}>
                {todayRecord ? todayRecord.status : 'ABSENT'}
              </Badge>
            </div>
            <div className="h-px bg-[rgba(255,255,255,0.08)] w-full my-3" />
          </div>

          <div className="flex flex-col items-center justify-center py-6 text-center">
            {/* Morphing clock button */}
            {todayRecord && todayRecord.clockIn && !todayRecord.clockOut ? (
              <button
                onClick={handleClockOut}
                disabled={attendanceLoading}
                className="w-32 h-32 rounded-full border-4 border-status-danger bg-[#3D1414]/40 hover:bg-[#3D1414]/60 transition-all duration-150 flex flex-col items-center justify-center group shadow-[0_0_15px_rgba(255,61,61,0.2)] animate-pulse-ring"
              >
                <Square className="w-8 h-8 text-[#FF3D3D] mb-1 group-hover:scale-105 transition-transform" />
                <span className="text-[10px] font-bold text-white uppercase tracking-widest">Clock Out</span>
              </button>
            ) : (
              <button
                onClick={handleClockIn}
                disabled={attendanceLoading}
                className="w-32 h-32 rounded-full border-4 flex flex-col items-center justify-center group transition-all duration-150 border-[#00E676] bg-[#1B4332]/20 hover:bg-[#1B4332]/40 shadow-[0_0_15px_rgba(0,230,118,0.25)] animate-pulse-ring"
              >
                <Play className="w-8 h-8 mb-1 group-hover:scale-105 transition-transform text-[#00E676]" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-white">Clock In</span>
              </button>
            )}

            {/* Timers & Labels */}
            <div className="mt-6 space-y-1">
              <span className={classNames('text-2xl font-mono font-bold tracking-widest block', clockStatus.color)}>
                {elapsedTime}
              </span>
              <span className="text-xs text-text-secondary">
                {clockStatus.label} • {clockStatus.desc}
              </span>
            </div>
          </div>

          {/* Today Summary Times */}
          <div className="mt-4 bg-[#1C1C1C] border border-[rgba(255,255,255,0.08)] rounded-lg p-3 grid grid-cols-3 text-center text-xs gap-1">
            <div className="border-r border-[rgba(255,255,255,0.08)]">
              <span className="text-[10px] uppercase font-bold text-text-secondary block mb-1">Clock In</span>
              <span className="font-mono text-white font-semibold">
                {todayRecord?.clockIn ? formatTime(todayRecord.clockIn) : '--:--:--'}
              </span>
            </div>
            <div className="border-r border-[rgba(255,255,255,0.08)]">
              <span className="text-[10px] uppercase font-bold text-text-secondary block mb-1">Clock Out</span>
              <span className="font-mono text-white font-semibold">
                {todayRecord?.clockOut ? formatTime(todayRecord.clockOut) : '--:--:--'}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-text-secondary block mb-1">Punches</span>
              <span className="font-mono text-white font-semibold">
                {todayRecord?.clockInCount || 0}
              </span>
            </div>
          </div>

          {/* Mini Bar Chart */}
          <div className="mt-6 h-36">
            <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest block mb-2">Weekly Activity (Hours Worked)</span>
            <ResponsiveContainer width="100%" height="90%">
              <BarChart data={weeklyHistory} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                <XAxis dataKey="day" stroke="#525252" fontSize={10} tickLine={false} />
                <YAxis stroke="#525252" fontSize={10} tickLine={false} />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                  contentStyle={{ background: '#111111', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', fontSize: '11px' }}
                />
                <Bar dataKey="hours" fill="#00E676" radius={[4, 4, 0, 0]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* SECTION B — Task Summary (Stat cards) */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-4">
            
            <Card hoverable={false} className="border-l-4 border-status-danger p-4 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest block mb-1">Overdue Tasks</span>
                <span className="text-2xl font-bold font-mono text-[#FF3D3D]">{stats.overdue}</span>
              </div>
              <AlertCircle className="w-8 h-8 text-[#FF3D3D]/30" />
            </Card>

            <Card hoverable={false} className="border-l-4 border-status-warning p-4 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest block mb-1">Due Today</span>
                <span className="text-2xl font-bold font-mono text-[#FFB300]">{stats.dueToday}</span>
              </div>
              <Calendar className="w-8 h-8 text-[#FFB300]/30" />
            </Card>

            <Card hoverable={false} className="border-l-4 border-status-info p-4 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest block mb-1">In Progress</span>
                <span className="text-2xl font-bold font-mono text-[#3D9EFF]">{stats.inProgress}</span>
              </div>
              <Clock className="w-8 h-8 text-[#3D9EFF]/30" />
            </Card>

            <Card hoverable={false} className="border-l-4 border-status-success p-4 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest block mb-1">Completed (7d)</span>
                <span className="text-2xl font-bold font-mono text-[#00E676]">{stats.completedThisWeek}</span>
              </div>
              <Award className="w-8 h-8 text-[#00E676]/30" />
            </Card>

          </div>

          {/* SECTION C — Recent Activity Feed */}
          <Card hoverable={false} className="flex-1 flex flex-col justify-between max-h-[350px]">
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-bold text-text-secondary uppercase tracking-widest">Recent Activity</span>
              <span className="text-[10px] text-text-muted uppercase font-semibold">Latest updates</span>
            </div>
            
            <div className="h-px bg-[rgba(255,255,255,0.08)] w-full mb-3" />

            <div className="flex-1 overflow-y-auto scrollbar-thin space-y-3.5 pr-2">
              {activitiesLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-5 h-5 border-2 border-[#00E676] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : recentActivities.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center text-text-muted">
                  <Clock className="w-8 h-8 mb-2 opacity-50" />
                  <p className="text-xs">No recent actions recorded.</p>
                </div>
              ) : (
                recentActivities.map((act) => (
                  <div key={act.id} className="flex gap-3 text-xs leading-relaxed">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#00E676] mt-1.5 shrink-0" />
                    <div className="flex-1">
                      <p className="text-white font-medium">{act.title}</p>
                      <p className="text-text-secondary text-[11px]">{act.body}</p>
                      <span className="text-[10px] text-text-muted font-mono block mt-0.5">{formatDate(act.createdAt)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

        </div>
      </div>

      {/* Quick Actions Floating Bar */}
      <div className="fixed bottom-6 right-6 flex items-center gap-3 z-40 bg-[#111111]/85 border border-[rgba(255,255,255,0.08)] p-2 rounded-xl backdrop-blur-md shadow-2xl">
        <Button
          onClick={() => setCreateTaskModalOpen(true)}
          variant="primary"
          size="sm"
          className="flex items-center gap-1.5 uppercase font-bold text-[10px] tracking-wider py-2"
        >
          <Plus className="w-3.5 h-3.5" />
          Task
        </Button>
        <Button
          onClick={() => navigate('/chat')}
          variant="ghost"
          size="sm"
          className="flex items-center gap-1.5 uppercase font-bold text-[10px] tracking-wider py-2"
        >
          <MessageSquare className="w-3.5 h-3.5" />
          Chat
        </Button>
        {todayRecord && todayRecord.clockIn && !todayRecord.clockOut ? (
          <Button
            onClick={handleClockOut}
            variant="danger"
            size="sm"
            className="flex items-center gap-1.5 uppercase font-bold text-[10px] tracking-wider py-2"
          >
            <Square className="w-3.5 h-3.5" />
            Clock Out
          </Button>
        ) : (
          <Button
            onClick={handleClockIn}
            variant="primary"
            size="sm"
            className="flex items-center gap-1.5 uppercase font-bold text-[10px] tracking-wider py-2"
          >
            <Play className="w-3.5 h-3.5" />
            Clock In
          </Button>
        )}
      </div>
    </div>
  );
};
export default Dashboard;
