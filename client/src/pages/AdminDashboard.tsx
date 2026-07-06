import React, { useEffect, useState } from 'react';
import api from '../api';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Avatar } from '../components/ui/Avatar';
import { classNames } from '../utils/format';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { ShieldCheck, UserPlus, Users, ClipboardCheck, PlaySquare, Trash2, Shield, Settings, Plus, FolderKanban, RefreshCw, UserX, UserMinus } from 'lucide-react';
import { Modal } from '../components/ui/Modal';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'SUPER_ADMIN' | 'MANAGER' | 'HR' | 'EMPLOYEE';
  departmentId: string | null;
  isActive: boolean;
  avatarUrl: string | null;
  createdAt: string;
  department?: { id: string; name: string } | null;
}

interface Department {
  id: string;
  name: string;
  managerId: string | null;
  manager?: { id: string; name: string } | null;
  _count: { users: number };
}

export const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'Overview' | 'Users' | 'Departments'>('Overview');
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Stats
  const [stats, setStats] = useState({
    totalEmployees: 0,
    presentTodayPct: 0,
    openTasksCount: 0,
    completedTasksCount: 0
  });

  // Modal States
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);

  // New User Form State
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [userRole, setUserRole] = useState<'SUPER_ADMIN' | 'MANAGER' | 'HR' | 'EMPLOYEE'>('EMPLOYEE');
  const [userDept, setUserDept] = useState('');
  const [userFormError, setUserFormError] = useState('');
  const [createdCredentials, setCreatedCredentials] = useState<{ name: string; email: string; pass: string } | null>(null);

  // New Dept Form State
  const [deptName, setDeptName] = useState('');
  const [deptManager, setDeptManager] = useState('');
  const [deptFormError, setDeptFormError] = useState('');

  const loadData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch Users
      const { data: usersData } = await api.get('/api/users');
      setUsers(usersData);

      // 2. Fetch Departments
      const { data: deptsData } = await api.get('/api/departments');
      setDepartments(deptsData);

      // 3. Fetch Company Attendance Report
      const todayStr = new Date().toISOString().split('T')[0];
      const { data: attendanceReport } = await api.get('/api/attendance/report', { params: { date: todayStr } });
      const totalPresent = attendanceReport.filter((r: any) => r.attendance.status === 'PRESENT' || r.attendance.status === 'LATE').length;
      const presentPct = attendanceReport.length > 0 ? Math.round((totalPresent / attendanceReport.length) * 100) : 0;

      // 4. Fetch Tasks
      const { data: tasksData } = await api.get('/api/tasks/team');
      const openTasks = tasksData.filter((t: any) => t.status !== 'COMPLETED').length;
      
      // Completed this week
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const completedTasks = tasksData.filter((t: any) => t.status === 'COMPLETED' && t.completedAt && new Date(t.completedAt) >= sevenDaysAgo).length;

      setStats({
        totalEmployees: usersData.length,
        presentTodayPct: presentPct,
        openTasksCount: openTasks,
        completedTasksCount: completedTasks
      });

      setIsLoading(false);
    } catch (err) {
      console.error(err);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserFormError('');
    try {
      await api.post('/api/users', {
        name: userName,
        email: userEmail,
        password: userPassword,
        role: userRole,
        departmentId: userDept || undefined
      });

      // Save credentials for the success view
      setCreatedCredentials({ name: userName, email: userEmail, pass: userPassword });

      // Reset Form & reload
      setUserName('');
      setUserEmail('');
      setUserPassword('');
      setUserRole('EMPLOYEE');
      setUserDept('');
      loadData();
    } catch (err: any) {
      setUserFormError(err.response?.data?.message || 'Failed to create user.');
    }
  };

  const handleCreateDept = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeptFormError('');
    try {
      await api.post('/api/departments', {
        name: deptName,
        managerId: deptManager || undefined
      });

      setDeptName('');
      setDeptManager('');
      setIsDeptModalOpen(false);
      loadData();
    } catch (err: any) {
      setDeptFormError(err.response?.data?.message || 'Failed to create department.');
    }
  };

  const handleDeactivateUser = async (userId: string) => {
    if (!confirm('Are you sure you want to deactivate this user?')) return;
    try {
      await api.delete(`/api/users/${userId}`);
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const handlePermanentDeleteUser = async (userId: string) => {
    if (!confirm('WARNING: Are you sure you want to PERMANENTLY delete this user? All their comments, attendance, and message records will be deleted. This cannot be undone.')) return;
    try {
      await api.delete(`/api/users/${userId}/permanent`);
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  // Recharts department statistics
  const chartData = departments.map(d => ({
    name: d.name,
    Employees: d._count.users
  }));

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN': return 'danger';
      case 'MANAGER': return 'info';
      case 'HR': return 'warning';
      default: return 'neutral';
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-1">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 select-none">
        <div>
          <h2 className="text-xl font-bold font-sans tracking-tight text-white uppercase">
            Administration Console
          </h2>
          <p className="text-xs text-text-secondary">
            Manage corporate hierarchies, personnel provisioning, and telemetry statistics.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={loadData} variant="ghost" size="sm">
            <RefreshCw className="w-4 h-4 mr-1.5" />
            Refresh
          </Button>
          <Button onClick={() => setIsUserModalOpen(true)} variant="primary" size="sm">
            <UserPlus className="w-4 h-4 mr-1.5" />
            Add User
          </Button>
          <Button onClick={() => setIsDeptModalOpen(true)} variant="ghost" size="sm">
            <Plus className="w-4 h-4 mr-1.5" />
            Add Dept
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[rgba(255,255,255,0.08)] select-none">
        {(['Overview', 'Users', 'Departments'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={classNames(
              'px-6 py-3 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all',
              activeTab === tab
                ? 'border-[#00E676] text-[#00E676] bg-[#1B4332]/10'
                : 'border-transparent text-text-secondary hover:text-white hover:bg-[#161616]'
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab 1: Overview */}
      {activeTab === 'Overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card hoverable={false} className="p-4 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest block mb-1">Company Size</span>
                <span className="text-2xl font-bold font-mono text-white">{stats.totalEmployees}</span>
              </div>
              <Users className="w-8 h-8 text-white/20" />
            </Card>

            <Card hoverable={false} className="p-4 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest block mb-1">Present Today</span>
                <span className="text-2xl font-bold font-mono text-[#00E676]">{stats.presentTodayPct}%</span>
              </div>
              <ShieldCheck className="w-8 h-8 text-[#00E676]/20" />
            </Card>

            <Card hoverable={false} className="p-4 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest block mb-1">Active Tasks</span>
                <span className="text-2xl font-bold font-mono text-[#3D9EFF]">{stats.openTasksCount}</span>
              </div>
              <FolderKanban className="w-8 h-8 text-[#3D9EFF]/20" />
            </Card>

            <Card hoverable={false} className="p-4 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest block mb-1">Closed (7d)</span>
                <span className="text-2xl font-bold font-mono text-[#FFB300]">{stats.completedTasksCount}</span>
              </div>
              <ClipboardCheck className="w-8 h-8 text-[#FFB300]/20" />
            </Card>
          </div>

          <Card hoverable={false} className="p-5">
            <span className="text-xs font-bold text-text-secondary uppercase tracking-widest block mb-4">Department Resource Allocations</span>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis dataKey="name" stroke="#525252" fontSize={11} tickLine={false} />
                  <YAxis stroke="#525252" fontSize={11} tickLine={false} />
                  <Tooltip
                    cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                    contentStyle={{ background: '#111111', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', fontSize: '11px' }}
                  />
                  <Bar dataKey="Employees" fill="#00E676" radius={[4, 4, 0, 0]} maxBarSize={30} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      )}

      {/* Tab 2: Users List */}
      {activeTab === 'Users' && (
        <Card hoverable={false} className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#1C1C1C] border-b border-[rgba(255,255,255,0.08)] uppercase tracking-wider text-[10px] font-bold text-text-secondary">
                <tr>
                  <th className="px-6 py-4">User</th>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4">Department</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(255,255,255,0.08)]">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-[#161616]/50 transition-colors">
                    <td className="px-6 py-4 flex items-center gap-3">
                      <Avatar src={u.avatarUrl} name={u.name} size="xs" />
                      <span className="font-semibold text-white">{u.name}</span>
                    </td>
                    <td className="px-6 py-4 font-mono text-text-secondary">{u.email}</td>
                    <td className="px-6 py-4">
                      <Badge variant={getRoleBadgeVariant(u.role)}>
                        {u.role}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-text-secondary">{u.department?.name || 'N/A'}</td>
                    <td className="px-6 py-4">
                      <span className={classNames(
                        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider',
                        u.isActive ? 'bg-[#1B4332]/50 text-[#00E676]' : 'bg-[#3D1414]/50 text-[#FF3D3D]'
                      )}>
                        {u.isActive ? 'Active' : 'Deactivated'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right flex items-center justify-end gap-1.5">
                      {u.isActive && (
                        <button
                          onClick={() => handleDeactivateUser(u.id)}
                          className="text-[#FFB300] hover:text-[#FFA000] p-1.5 hover:bg-[#FFB300]/10 rounded-lg transition-all"
                          title="Deactivate Account"
                        >
                          <UserX className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handlePermanentDeleteUser(u.id)}
                        className="text-[#FF3D3D] hover:text-[#FF2222] p-1.5 hover:bg-[#3D1414]/30 rounded-lg transition-all"
                        title="Delete User Permanently"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Tab 3: Departments */}
      {activeTab === 'Departments' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {departments.map(dept => (
            <Card key={dept.id} hoverable={false} className="flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-2">
                  <h4 className="text-sm font-bold text-white uppercase tracking-wider">{dept.name}</h4>
                  <Badge variant="info">
                    {dept._count.users} Users
                  </Badge>
                </div>
                <div className="h-px bg-[rgba(255,255,255,0.08)] w-full my-3" />
                <div className="text-xs text-text-secondary flex flex-col gap-1 mt-2">
                  <span>Manager:</span>
                  <span className="text-white font-semibold flex items-center gap-1.5 mt-1">
                    <Shield className="w-3.5 h-3.5 text-[#00E676]" />
                    {dept.manager?.name || 'Unassigned'}
                  </span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create User Modal */}
      <Modal isOpen={isUserModalOpen} onClose={() => { setIsUserModalOpen(false); setCreatedCredentials(null); }} title="Create User Account">
        {createdCredentials ? (
          <div className="space-y-4 py-2 select-text">
            <div className="bg-[#1B4332]/30 border border-[#00E676]/20 text-[#00E676] text-xs font-semibold px-4 py-3 rounded-lg flex items-center gap-2">
              <span>Account successfully created! Copy these credentials to share with the new team member.</span>
            </div>
            
            <div className="bg-[#161616] border border-[rgba(255,255,255,0.08)] rounded-lg p-4 space-y-3 font-mono text-xs text-white">
              <div>
                <span className="text-text-secondary block text-[10px] uppercase font-bold tracking-wider mb-0.5">Name</span>
                <span className="font-semibold">{createdCredentials.name}</span>
              </div>
              <div>
                <span className="text-text-secondary block text-[10px] uppercase font-bold tracking-wider mb-0.5">Email</span>
                <span className="font-semibold">{createdCredentials.email}</span>
              </div>
              <div>
                <span className="text-text-secondary block text-[10px] uppercase font-bold tracking-wider mb-0.5">Password</span>
                <span className="font-semibold">{createdCredentials.pass}</span>
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <Button 
                type="button" 
                variant="ghost" 
                onClick={() => {
                  navigator.clipboard.writeText(
                    `Welcome to CompanyOS!\nName: ${createdCredentials.name}\nEmail: ${createdCredentials.email}\nPassword: ${createdCredentials.pass}`
                  );
                  alert('Credentials copied to clipboard!');
                }}
              >
                Copy to Clipboard
              </Button>
              <Button type="button" variant="primary" onClick={() => { setIsUserModalOpen(false); setCreatedCredentials(null); }}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleCreateUser} className="space-y-4">
            {userFormError && (
              <div className="bg-[#3D1414] border border-[#FF3D3D]/20 text-[#FF3D3D] text-xs font-semibold px-4 py-3 rounded-lg mb-4">
                {userFormError}
              </div>
            )}
            <Input label="Display Name" placeholder="e.g. Jane Doe" value={userName} onChange={(e) => setUserName(e.target.value)} required />
            <Input label="Email Address" type="email" placeholder="jane@company.com" value={userEmail} onChange={(e) => setUserEmail(e.target.value)} required />
            <Input label="Password" type="password" placeholder="••••••••" value={userPassword} onChange={(e) => setUserPassword(e.target.value)} required />
            
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">Role</label>
              <select
                value={userRole}
                onChange={(e) => setUserRole(e.target.value as any)}
                className="w-full px-3.5 py-2.5 bg-[#1C1C1C] border border-[rgba(255,255,255,0.08)] rounded-lg text-white focus:outline-none focus:border-[#00E676] text-sm"
              >
                <option value="EMPLOYEE">Employee</option>
                <option value="MANAGER">Manager</option>
                <option value="HR">HR Partner</option>
                <option value="SUPER_ADMIN">System Admin</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">Department Assignment</label>
              <select
                value={userDept}
                onChange={(e) => setUserDept(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#1C1C1C] border border-[rgba(255,255,255,0.08)] rounded-lg text-white focus:outline-none focus:border-[#00E676] text-sm"
              >
                <option value="">No Department</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <Button type="button" variant="ghost" onClick={() => setIsUserModalOpen(false)}>Cancel</Button>
              <Button type="submit" variant="primary">Create User</Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Create Department Modal */}
      <Modal isOpen={isDeptModalOpen} onClose={() => setIsDeptModalOpen(false)} title="Create Department">
        {deptFormError && (
          <div className="bg-[#3D1414] border border-[#FF3D3D]/20 text-[#FF3D3D] text-xs font-semibold px-4 py-3 rounded-lg mb-4">
            {deptFormError}
          </div>
        )}
        <form onSubmit={handleCreateDept} className="space-y-4">
          <Input label="Department Name" placeholder="e.g. Marketing" value={deptName} onChange={(e) => setDeptName(e.target.value)} required />
          
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">Manager Assignee</label>
            <select
              value={deptManager}
              onChange={(e) => setDeptManager(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#1C1C1C] border border-[rgba(255,255,255,0.08)] rounded-lg text-white focus:outline-none focus:border-[#00E676] text-sm"
            >
              <option value="">No Manager Assigned</option>
              {users.filter(u => u.role === 'MANAGER' || u.role === 'SUPER_ADMIN').map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 justify-end mt-6">
            <Button type="button" variant="ghost" onClick={() => setIsDeptModalOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary">Create Department</Button>
          </div>
        </form>
      </Modal>

    </div>
  );
};
export default AdminDashboard;
