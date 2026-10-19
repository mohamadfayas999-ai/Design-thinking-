import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ShieldCheck, ArrowLeft, Mail, Lock, Building2, Home, ChevronRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/common/Card';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import { PageTransition } from '../../components/common/PageTransition';
import { loginCardVariants, stepVariants } from '../../utils/animations';

type AdminDomain = 'SELECT' | 'REC' | 'PG';

export const AdminLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const shouldReduceMotion = useReducedMotion();

  const [adminDomain, setAdminDomain] = useState<AdminDomain>('SELECT');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleSelectDomain = (domain: 'REC' | 'PG') => {
    setAdminDomain(domain);
    setError(null);
    setEmail('');
    setPassword('');
  };

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
      setError(err.message || 'Login failed. Please check administrator credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PageTransition className="max-w-md mx-auto py-8">
      {/* Back button */}
      {adminDomain === 'SELECT' ? (
        <button
          type="button"
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:text-water-700 hover:border-water-300 hover:bg-water-50/50 shadow-xs mb-6 transition-all focus:outline-none focus:ring-2 focus:ring-slate-400"
        >
          <ArrowLeft className="w-4 h-4 text-water-600" />
          <span>Back to Portal Selection</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => {
            setAdminDomain('SELECT');
            setError(null);
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:text-water-700 hover:border-water-300 hover:bg-water-50/50 shadow-xs mb-6 transition-all focus:outline-none focus:ring-2 focus:ring-slate-400"
        >
          <ArrowLeft className="w-4 h-4 text-water-600" />
          <span>Back to Administrator Selection</span>
        </button>
      )}

      <AnimatePresence mode="wait">
        {/* DOMAIN SELECTION */}
        {adminDomain === 'SELECT' && (
          <motion.div
            key="domain-select"
            variants={shouldReduceMotion ? undefined : stepVariants}
            initial={shouldReduceMotion ? false : 'initial'}
            animate="animate"
            exit="exit"
          >
            <Card className="border-slate-200">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
                <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center border border-slate-200">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-slate-900">Administrator Portal</h1>
                  <p className="text-xs text-slate-500">Select administrative domain</p>
                </div>
              </div>

              <p className="text-xs text-slate-600 mb-5">
                WASHWISE separates administrative environments. Select your designated operational portal:
              </p>

              <div className="space-y-3">
                {/* Option 1: REC Admin */}
                <button
                  type="button"
                  onClick={() => handleSelectDomain('REC')}
                  className="w-full text-left p-4 rounded-xl border border-slate-200 hover:border-water-400 hover:bg-water-50/40 transition-all flex items-center justify-between group focus:outline-none focus:ring-2 focus:ring-water-500 shadow-xs"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center border border-sky-200">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-slate-900 group-hover:text-water-900">
                        Rajalakshmi Engineering College Admin
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Campus Hostels: Girls, Thandalam, Habitat
                      </p>
                      <span className="inline-block mt-1 text-[10px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200">
                        COLLEGE Environment
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-water-600 transition-colors" />
                </button>

                {/* Option 2: PG Hostel Admin */}
                <button
                  type="button"
                  onClick={() => handleSelectDomain('PG')}
                  className="w-full text-left p-4 rounded-xl border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/40 transition-all flex items-center justify-between group focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center border border-emerald-200">
                      <Home className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-slate-900 group-hover:text-emerald-900">
                        PG Hostel Admin
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Co-Living Facilities: Oak, Maple, Pine, Cedar
                      </p>
                      <span className="inline-block mt-1 text-[10px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                        PG_SHARED Environment
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-emerald-600 transition-colors" />
                </button>
              </div>
            </Card>
          </motion.div>
        )}

        {/* REC ADMIN LOGIN FORM */}
        {adminDomain === 'REC' && (
          <motion.div
            key="rec-login"
            variants={shouldReduceMotion ? undefined : loginCardVariants}
            initial={shouldReduceMotion ? false : 'initial'}
            animate="animate"
            exit="exit"
          >
            <Card className="border-slate-200">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
                <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-800 flex items-center justify-center border border-sky-200">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-slate-900">Rajalakshmi Engineering College</h1>
                  <p className="text-xs text-slate-500">College Laundry Administrator Portal</p>
                </div>
              </div>

              {error && <ErrorAlert message={error} className="mb-5" onDismiss={() => setError(null)} />}

              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  label="REC Admin Email Address"
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
                    Sign In to REC Admin Dashboard
                  </Button>
                </div>
              </form>

              {/* Administrator sign-in guidance */}
              <div className="mt-8 pt-5 border-t border-dashed border-slate-200">
                <p className="text-xs text-slate-500 text-center">
                  Sign in using your assigned administrator credentials.
                </p>
              </div>
            </Card>
          </motion.div>
        )}

        {/* PG ADMIN LOGIN FORM */}
        {adminDomain === 'PG' && (
          <motion.div
            key="pg-login"
            variants={shouldReduceMotion ? undefined : loginCardVariants}
            initial={shouldReduceMotion ? false : 'initial'}
            animate="animate"
            exit="exit"
          >
            <Card className="border-slate-200">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center border border-emerald-200">
                  <Home className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-slate-900">PG Hostel Administrator</h1>
                  <p className="text-xs text-slate-500">PG Co-Living Operations & Control</p>
                </div>
              </div>

              {error && <ErrorAlert message={error} className="mb-5" onDismiss={() => setError(null)} />}

              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  label="PG Admin Email Address"
                  type="email"
                  required
                  placeholder="admin@pgsharedliving.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  icon={<Mail className="w-4 h-4" />}
                />

                <Input
                  label="PG Admin Password"
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  icon={<Lock className="w-4 h-4" />}
                />

                <div className="pt-2">
                  <Button type="submit" variant="primary" size="lg" className="w-full" isLoading={isLoading}>
                    Sign In to PG Admin Dashboard
                  </Button>
                </div>
              </form>

              {/* Administrator sign-in guidance */}
              <div className="mt-8 pt-5 border-t border-dashed border-slate-200">
                <p className="text-xs text-slate-500 text-center">
                  Sign in using your assigned administrator credentials.
                </p>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </PageTransition>
  );
};
