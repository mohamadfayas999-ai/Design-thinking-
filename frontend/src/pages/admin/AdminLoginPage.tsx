import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { ShieldCheck, ArrowLeft, Mail, Lock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/common/Card';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import { PageTransition } from '../../components/common/PageTransition';
import { loginCardVariants } from '../../utils/animations';

export const AdminLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const shouldReduceMotion = useReducedMotion();

  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    setIsLoading(true);
    try {
      await login({
        email: email.trim(),
        password,
        role: 'ADMIN',
      });
      navigate('/admin/dashboard');
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check admin credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const autofillDemoAdmin = () => {
    setEmail('admin@rajalakshmi.edu.in');
    setPassword('admin123');
    setError(null);
  };

  return (
    <PageTransition className="max-w-md mx-auto py-8">
      <button
        type="button"
        onClick={() => navigate('/')}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:text-water-700 hover:border-water-300 hover:bg-water-50/50 shadow-xs mb-6 transition-all focus:outline-none focus:ring-2 focus:ring-slate-400"
      >
        <ArrowLeft className="w-4 h-4 text-water-600" />
        <span>Back to Portal Selection</span>
      </button>

      <motion.div
        variants={shouldReduceMotion ? undefined : loginCardVariants}
        initial={shouldReduceMotion ? false : 'initial'}
        animate="animate"
      >
        <Card className="border-slate-200">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center border border-slate-200">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">Administrator Portal</h1>
              <p className="text-xs text-slate-500">Cross-Hostel Monitoring & Control</p>
            </div>
          </div>

          {error && <ErrorAlert message={error} className="mb-5" onDismiss={() => setError(null)} />}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Admin Email Address"
              type="email"
              required
              placeholder="admin@rajalakshmi.edu.in"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              icon={<Mail className="w-4 h-4" />}
            />

            <Input
              label="Admin Password"
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              icon={<Lock className="w-4 h-4" />}
            />

            <div className="pt-2">
              <Button type="submit" variant="primary" size="lg" className="w-full" isLoading={isLoading}>
                Sign In to Admin Dashboard
              </Button>
            </div>
          </form>

          {/* Demo Admin Quick-Fill helper */}
          <div className="mt-8 pt-5 border-t border-dashed border-slate-200">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2.5">
              Demo Admin Quick Fill:
            </p>
            <button
              type="button"
              onClick={autofillDemoAdmin}
              className="w-full text-left p-2.5 rounded-lg border border-slate-200 hover:border-slate-400 hover:bg-slate-50 text-[11px] text-slate-700 transition-colors flex items-center justify-between focus:outline-none focus:ring-1 focus:ring-slate-400"
            >
              <div>
                <span className="font-bold text-slate-900 block">System Administrator</span>
                <span>admin@rajalakshmi.edu.in</span>
              </div>
              <span className="text-[10px] font-semibold bg-slate-200 text-slate-700 px-2 py-0.5 rounded">
                Fill Admin
              </span>
            </button>
          </div>
        </Card>
      </motion.div>
    </PageTransition>
  );
};
