import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';

export const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsLoading(true);
    setError('');
    setMessage('');

    try {
      await api.post('/api/auth/forgot-password', { email });
      setMessage('An OTP code has been sent to your email.');
      
      // Auto-redirect to reset password after 2 seconds
      setTimeout(() => {
        navigate(`/reset-password?email=${encodeURIComponent(email)}`);
      }, 2000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to request reset. Try again.');
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
              to="/login"
              className="text-xs text-text-secondary hover:text-white flex items-center gap-1.5 mb-4 group transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
              Back to Sign In
            </Link>
            <h1 className="text-xl font-bold font-sans tracking-tight text-white uppercase">
              Forgot Password
            </h1>
            <p className="text-xs text-text-secondary mt-1">
              Enter your email to receive a password reset OTP code.
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
              {message} Redirecting to reset screen...
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
              autoFocus
            />

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
                  Sending OTP...
                </span>
              ) : (
                'Request OTP'
              )}
            </Button>
          </form>

        </div>
      </motion.div>
    </div>
  );
};
