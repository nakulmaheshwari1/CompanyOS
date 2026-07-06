import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import api from '../api';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';

export const ResetPassword: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [passwordStrength, setPasswordStrength] = useState({ score: 0, label: '', color: '' });
  const navigate = useNavigate();

  // Load email from query parameters
  useEffect(() => {
    const qEmail = searchParams.get('email');
    if (qEmail) {
      setEmail(qEmail);
    }
  }, [searchParams]);

  // Check password strength
  useEffect(() => {
    if (!newPassword) {
      setPasswordStrength({ score: 0, label: '', color: '' });
      return;
    }

    let score = 0;
    if (newPassword.length >= 8) score += 1;
    if (/[A-Z]/.test(newPassword)) score += 1;
    if (/[0-9]/.test(newPassword)) score += 1;
    if (/[^A-Za-z0-9]/.test(newPassword)) score += 1;

    let label = '';
    let color = '';

    switch (score) {
      case 1:
        label = 'Weak';
        color = 'bg-status-danger';
        break;
      case 2:
      case 3:
        label = 'Medium';
        color = 'bg-status-warning';
        break;
      case 4:
        label = 'Strong';
        color = 'bg-status-success';
        break;
      default:
        label = 'Very Weak';
        color = 'bg-status-danger';
    }

    setPasswordStrength({ score, label, color });
  }, [newPassword]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !otp || !newPassword) return;

    if (passwordStrength.score < 2) {
      setError('Please choose a stronger password.');
      return;
    }

    setIsLoading(true);
    setError('');
    setMessage('');

    try {
      await api.post('/api/auth/reset-password', {
        email,
        otp,
        newPassword
      });

      setMessage('Password reset successful.');

      // Redirect to login after 2 seconds
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to reset password. Please verify the OTP.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-4">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#00E676]/5 blur-[120px] rounded-full pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <div className="bg-[#111111] border border-[rgba(255,255,255,0.08)] rounded-xl shadow-2xl p-8 relative overflow-hidden animate-glow-border">
          
          {/* Header */}
          <div className="mb-6">
            <Link
              to="/forgot-password"
              className="text-xs text-text-secondary hover:text-white flex items-center gap-1.5 mb-4 group transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
              Back to Request OTP
            </Link>
            <h1 className="text-xl font-bold font-sans tracking-tight text-white uppercase">
              Reset Password
            </h1>
            <p className="text-xs text-text-secondary mt-1">
              Enter the OTP sent to your email and your new password.
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-[#3D1414] border border-[#FF3D3D]/20 text-[#FF3D3D] text-xs font-semibold px-4 py-3 rounded-lg mb-6 leading-tight">
              {error}
            </div>
          )}

          {/* Success Message */}
          {message && (
            <div className="bg-[#1B4332] border border-[#00E676]/20 text-[#00E676] text-xs font-semibold px-4 py-3 rounded-lg mb-6 leading-tight">
              {message} Redirecting to login...
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email Address"
              type="email"
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading || !!message}
            />

            <Input
              label="OTP Code (6 digits)"
              type="text"
              maxLength={6}
              placeholder="123456"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              required
              disabled={isLoading || !!message}
              font-mono
            />

            <div>
              <Input
                label="New Password"
                type="password"
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                disabled={isLoading || !!message}
              />

              {/* Password complexity display */}
              {newPassword && (
                <div className="mt-1.5">
                  <div className="flex justify-between items-center text-[10px] uppercase font-bold text-text-secondary mb-1">
                    <span>Complexity</span>
                    <span className="text-white">{passwordStrength.label}</span>
                  </div>
                  <div className="h-1.5 bg-[#1C1C1C] rounded-full overflow-hidden flex gap-0.5">
                    {Array.from({ length: 4 }).map((_, idx) => (
                      <div
                        key={idx}
                        className={`h-full flex-1 transition-all duration-200 ${
                          idx < passwordStrength.score ? passwordStrength.color : 'bg-transparent'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            <Button
              type="submit"
              variant="primary"
              fullWidth
              disabled={isLoading || !!message}
              className="mt-6 py-3 font-semibold uppercase tracking-wider text-xs"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  Resetting Password...
                </span>
              ) : (
                'Reset Password'
              )}
            </Button>
          </form>

        </div>
      </motion.div>
    </div>
  );
};
