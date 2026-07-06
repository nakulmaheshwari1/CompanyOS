import React, { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import api from '../api';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Avatar } from '../components/ui/Avatar';
import { User, Bell, Key, RefreshCw, Upload } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { user, checkAuth } = useAuthStore();

  // Profile Form States
  const [name, setName] = useState(user?.name || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [profileMsg, setProfileMsg] = useState('');
  const [profileError, setProfileError] = useState('');
  const [isProfileLoading, setIsProfileLoading] = useState(false);

  // Avatar Upload State
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [isAvatarLoading, setIsAvatarLoading] = useState(false);
  const [avatarMsg, setAvatarMsg] = useState('');

  // Notifications Form States
  const [notifInAppTask, setNotifInAppTask] = useState(true);
  const [notifInAppChat, setNotifInAppChat] = useState(true);
  const [notifEmailTask, setNotifEmailTask] = useState(false);
  const [notifEmailChat, setNotifEmailChat] = useState(false);
  const [notifMsg, setNotifMsg] = useState('');

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProfileLoading(true);
    setProfileMsg('');
    setProfileError('');
    try {
      await api.patch('/api/users/me', {
        name,
        currentPassword: currentPassword || undefined,
        newPassword: newPassword || undefined
      });

      setProfileMsg('Profile updated successfully.');
      setCurrentPassword('');
      setNewPassword('');
      // Reload profile
      await checkAuth();
    } catch (err: any) {
      setProfileError(err.response?.data?.message || 'Failed to update profile.');
    } finally {
      setIsProfileLoading(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    setIsAvatarLoading(true);
    setAvatarMsg('');
    try {
      const formData = new FormData();
      formData.append('avatar', file);

      await api.post('/api/users/me/avatar', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      setAvatarMsg('Avatar uploaded successfully.');
      await checkAuth();
    } catch (err) {
      setAvatarMsg('Upload failed.');
    } finally {
      setIsAvatarLoading(false);
    }
  };

  const handleNotificationsUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    setNotifMsg('Notification preferences saved.');
    setTimeout(() => setNotifMsg(''), 3000);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-1 text-left">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold font-sans tracking-tight text-white uppercase">
          Portal Settings
        </h2>
        <p className="text-xs text-text-secondary">
          Configure security credentials, notification matrices, and display preferences.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Side: Avatar Panel */}
        <div className="md:col-span-1 space-y-6">
          <Card hoverable={false} className="text-center p-6 flex flex-col items-center">
            <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest block mb-4">Profile Avatar</span>
            <Avatar src={user?.avatarUrl} name={user?.name || ''} size="xl" className="mb-4" />
            
            <h4 className="text-sm font-semibold text-white mb-0.5">{user?.name}</h4>
            <span className="text-xs text-text-secondary uppercase font-bold tracking-wider mb-6 block">
              {user?.role}
            </span>

            {avatarMsg && (
              <span className="block text-xs text-[#00E676] mb-3 font-medium">{avatarMsg}</span>
            )}

            <label className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 bg-[#1C1C1C] border border-[rgba(255,255,255,0.08)] hover:border-[#00E676] rounded-lg text-xs font-semibold text-white cursor-pointer transition-all">
              <Upload className="w-3.5 h-3.5 text-[#00E676]" />
              {isAvatarLoading ? 'Uploading...' : 'Upload Photo'}
              <input type="file" onChange={handleAvatarUpload} className="hidden" disabled={isAvatarLoading} />
            </label>
          </Card>
        </div>

        {/* Right Side: Settings Forms */}
        <div className="md:col-span-2 space-y-6">
          
          {/* Profile Form */}
          <Card hoverable={false}>
            <div className="flex items-center gap-2 mb-3">
              <User className="w-4 h-4 text-[#00E676]" />
              <span className="text-xs font-bold text-text-secondary uppercase tracking-widest">Personal Details</span>
            </div>
            
            <div className="h-px bg-[rgba(255,255,255,0.08)] w-full mb-5" />

            {profileMsg && (
              <div className="bg-[#1B4332] border border-[#00E676]/20 text-[#00E676] text-xs font-semibold px-4 py-3 rounded-lg mb-4">
                {profileMsg}
              </div>
            )}

            {profileError && (
              <div className="bg-[#3D1414] border border-[#FF3D3D]/20 text-[#FF3D3D] text-xs font-semibold px-4 py-3 rounded-lg mb-4">
                {profileError}
              </div>
            )}

            <form onSubmit={handleProfileUpdate} className="space-y-4">
              <Input label="Email Address (read-only)" type="email" value={user?.email || ''} readOnly className="opacity-60 cursor-not-allowed" />
              <Input label="Display Name" value={name} onChange={(e) => setName(e.target.value)} required />
              
              <div className="h-px bg-[rgba(255,255,255,0.08)] w-full my-6" />
              
              <div className="flex items-center gap-2 mb-3">
                <Key className="w-4 h-4 text-[#FF3D3D]" />
                <span className="text-xs font-bold text-text-secondary uppercase tracking-widest">Change Password</span>
              </div>

              <Input label="Current Password" type="password" placeholder="Enter current password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
              <Input label="New Password" type="password" placeholder="Enter new password (min 8 chars)" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />

              <div className="flex justify-end mt-6">
                <Button type="submit" variant="primary" disabled={isProfileLoading}>
                  {isProfileLoading ? 'Saving Settings...' : 'Save Settings'}
                </Button>
              </div>
            </form>
          </Card>

          {/* Notifications Form */}
          <Card hoverable={false}>
            <div className="flex items-center gap-2 mb-3">
              <Bell className="w-4 h-4 text-[#00E676]" />
              <span className="text-xs font-bold text-text-secondary uppercase tracking-widest">Notification Matrix</span>
            </div>

            <div className="h-px bg-[rgba(255,255,255,0.08)] w-full mb-5" />

            {notifMsg && (
              <div className="bg-[#1B4332] border border-[#00E676]/20 text-[#00E676] text-xs font-semibold px-4 py-3 rounded-lg mb-4">
                {notifMsg}
              </div>
            )}

            <form onSubmit={handleNotificationsUpdate} className="space-y-5 text-xs">
              <div className="space-y-3">
                <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider block">In-App Alerts</span>
                
                <label className="flex items-center gap-3 text-white cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={notifInAppTask}
                    onChange={(e) => setNotifInAppTask(e.target.checked)}
                    className="rounded border-[rgba(255,255,255,0.08)] text-[#00E676] focus:ring-0 focus:ring-offset-0 bg-[#1C1C1C]"
                  />
                  <span>Alert me when a task is updated or assigned to me</span>
                </label>

                <label className="flex items-center gap-3 text-white cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={notifInAppChat}
                    onChange={(e) => setNotifInAppChat(e.target.checked)}
                    className="rounded border-[rgba(255,255,255,0.08)] text-[#00E676] focus:ring-0 focus:ring-offset-0 bg-[#1C1C1C]"
                  />
                  <span>Alert me on @mentions in chat rooms</span>
                </label>
              </div>

              <div className="h-px bg-[rgba(255,255,255,0.08)] w-full" />

              <div className="space-y-3">
                <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider block">Email Notifications</span>

                <label className="flex items-center gap-3 text-white cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={notifEmailTask}
                    onChange={(e) => setNotifEmailTask(e.target.checked)}
                    className="rounded border-[rgba(255,255,255,0.08)] text-[#00E676] focus:ring-0 focus:ring-offset-0 bg-[#1C1C1C]"
                  />
                  <span>Send email digests for overdue task allocations</span>
                </label>

                <label className="flex items-center gap-3 text-white cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={notifEmailChat}
                    onChange={(e) => setNotifEmailChat(e.target.checked)}
                    className="rounded border-[rgba(255,255,255,0.08)] text-[#00E676] focus:ring-0 focus:ring-offset-0 bg-[#1C1C1C]"
                  />
                  <span>Send immediate email notifications on chat mentions</span>
                </label>
              </div>

              <div className="flex justify-end mt-6">
                <Button type="submit" variant="primary">
                  Save Preferences
                </Button>
              </div>
            </form>
          </Card>

        </div>
      </div>
    </div>
  );
};
export default SettingsPage;
