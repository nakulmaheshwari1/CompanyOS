import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { motion } from 'framer-motion';

export const Login: React.FC = () => {
  const { login, isAuthenticated, error, clearError } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState({ score: 0, label: '', color: '' });
  const navigate = useNavigate();

  // Clear errors when navigating to this page
  useEffect(() => {
    clearError();
  }, []);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  // Check password strength
  useEffect(() => {
    if (!password) {
      setPasswordStrength({ score: 0, label: '', color: '' });
      return;
    }

    let score = 0;
    if (password.length >= 8) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;

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
  }, [password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setIsLoading(true);
    try {
      const user = await login(email, password);
      // Role-based redirects after successful login
      if (user.role === 'SUPER_ADMIN') {
        navigate('/admin/dashboard');
      } else if (user.role === 'MANAGER') {
        navigate('/manager/dashboard');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      // Handled by store error state
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-4">
      {/* Subtle animated background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#00E676]/5 blur-[120px] rounded-full pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        {/* Pulsing Border Wrapper */}
        <div className="bg-[#111111] border border-[rgba(255,255,255,0.08)] rounded-xl shadow-2xl p-8 relative overflow-hidden animate-glow-border">
          
          {/* Brand Wordmark */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold font-sans tracking-tight text-white inline-flex items-center gap-1 justify-center">
              Company<span className="text-[#00E676] flex items-center">OS<span className="w-1.5 h-1.5 rounded-full bg-[#00E676] ml-0.5" /></span>
            </h1>
            <p className="text-xs text-text-secondary mt-1">
              Internal Workforce Portal
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-[#3D1414] border border-[#FF3D3D]/20 text-[#FF3D3D] text-xs font-semibold px-4 py-3 rounded-lg mb-6 leading-tight">
              {error}
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
              autoFocus
            />

            <div>
              <Input
                label="Password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              {/* Password strength meter */}
              {password && (
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
              disabled={isLoading}
              className="mt-6 py-3 font-semibold uppercase tracking-wider text-xs"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  Verifying Session...
                </span>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>

          {/* Footnotes */}
          <div className="mt-6 text-center">
            <Link
              to="/forgot-password"
              className="text-xs text-[#00E676] hover:text-[#00C853] transition-colors font-medium hover:underline"
            >
              Forgot Password?
            </Link>
          </div>

        </div>
      </motion.div>
    </div>
  );
};
