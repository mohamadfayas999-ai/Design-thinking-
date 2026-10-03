import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { GraduationCap, ArrowLeft, Mail, Lock, Building2, ChevronRight, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { Hostel } from '../../types';
import { Card } from '../../components/common/Card';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import { PageTransition } from '../../components/common/PageTransition';
import { stepVariants } from '../../utils/animations';

const DEMO_STUDENTS: Record<string, { email: string; name: string; dept: string }> = {
  HABITAT: {
    email: 'student.one.2024.csd@rajalakshmi.edu.in',
    name: 'Student One',
    dept: 'CSD · 2024',
  },
  THANDALAM: {
    email: 'student.four.2024.ece@rajalakshmi.edu.in',
    name: 'Student Four',
    dept: 'ECE · 2024',
  },
  GIRLS: {
    email: 'student.seven.2024.csd@rajalakshmi.edu.in',
    name: 'Student Seven',
    dept: 'CSD · 2024',
  },
};

export const StudentLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const shouldReduceMotion = useReducedMotion();

  const [step, setStep] = useState<'hostel' | 'login'>('hostel');
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [selectedHostelId, setSelectedHostelId] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    async function fetchHostels() {
      try {
        const res = await api.getHostels();
        if (res.data) {
          setHostels(res.data);
          if (res.data.length > 0) {
            setSelectedHostelId(res.data[0].id);
          }
        }
      } catch (err: any) {
        setError('Failed to load hostel list from server.');
      }
    }
    fetchHostels();
  }, []);

  const selectedHostel = hostels.find((h) => h.id === selectedHostelId);

  const handleSelectHostel = (hostelId: string) => {
    setSelectedHostelId(hostelId);
    setError(null);
    setStep('login');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedHostelId) {
      setError('Please select your hostel');
      return;
    }

    setIsLoading(true);
    try {
      await login({
        email: email.trim(),
        password,
        role: 'STUDENT',
        hostelId: selectedHostelId,
      });
      navigate('/student/dashboard');
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PageTransition className="max-w-md mx-auto py-8">
      {/* Top-Left Back Button */}
      {step === 'hostel' ? (
        <button
          type="button"
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:text-water-700 hover:border-water-300 hover:bg-water-50/50 shadow-xs mb-6 transition-all focus:outline-none focus:ring-2 focus:ring-water-400"
        >
          <ArrowLeft className="w-4 h-4 text-water-600" />
          <span>Back to Portal Selection</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setStep('hostel')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:text-water-700 hover:border-water-300 hover:bg-water-50/50 shadow-xs mb-6 transition-all focus:outline-none focus:ring-2 focus:ring-water-400"
        >
          <ArrowLeft className="w-4 h-4 text-water-600" />
          <span>Back to Hostel Selection</span>
        </button>
      )}

      <AnimatePresence mode="wait">
        {/* STEP 1: Hostel Selection */}
        {step === 'hostel' && (
          <motion.div
            key="hostel-step"
            variants={shouldReduceMotion ? undefined : stepVariants}
            initial={shouldReduceMotion ? false : 'initial'}
            animate="animate"
            exit="exit"
          >
            <Card className="border-slate-200">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
                <div className="w-10 h-10 rounded-xl bg-water-50 text-water-600 flex items-center justify-center border border-water-200">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-slate-900">Select Your Hostel</h1>
                  <p className="text-xs text-slate-500">Rajalakshmi Engineering College</p>
                </div>
              </div>

              {error && <ErrorAlert message={error} className="mb-5" onDismiss={() => setError(null)} />}

              <p className="text-xs text-slate-600 mb-4">
                Laundry services and slots are allocated exclusively per hostel. Choose your assigned hostel to log in:
              </p>

              <div className="space-y-3">
                {hostels.map((hostel) => {
                  const isSelected = selectedHostelId === hostel.id;
                  return (
                    <button
                      key={hostel.id}
                      type="button"
                      onClick={() => handleSelectHostel(hostel.id)}
                      className={`w-full p-4 rounded-xl border text-left flex items-center justify-between transition-all group focus:outline-none focus:ring-2 focus:ring-water-400 ${
                        isSelected
                          ? 'border-water-500 bg-water-50/60 shadow-xs'
                          : 'border-slate-200 hover:border-water-300 hover:bg-slate-50/80'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 text-water-700 flex items-center justify-center font-bold text-xs group-hover:border-water-400 group-hover:text-water-600 transition-colors">
                          {hostel.code.slice(0, 3)}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 text-sm group-hover:text-water-700 transition-colors">
                            {hostel.name} Hostel
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {hostel.code === 'GIRLS' ? 'Girls Hostel Unit' : 'Boys Hostel Unit'} &middot; Dedicated Laundry
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-water-600 group-hover:translate-x-0.5 transition-all" />
                    </button>
                  );
                })}
              </div>
            </Card>
          </motion.div>
        )}

        {/* STEP 2: Student Login Credentials */}
        {step === 'login' && (
          <motion.div
            key="login-step"
            variants={shouldReduceMotion ? undefined : stepVariants}
            initial={shouldReduceMotion ? false : 'initial'}
            animate="animate"
            exit="exit"
          >
            <Card className="border-slate-200">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
                <div className="w-10 h-10 rounded-xl bg-water-50 text-water-600 flex items-center justify-center border border-water-200">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h1 className="text-lg font-bold text-slate-900">Student Portal Login</h1>
                  <p className="text-xs text-water-700 font-medium">
                    {selectedHostel?.name} Hostel
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setStep('hostel')}
                  className="text-xs text-water-600 hover:text-water-800 font-semibold underline underline-offset-2 focus:outline-none"
                >
                  Change
                </button>
              </div>

              {error && <ErrorAlert message={error} className="mb-5" onDismiss={() => setError(null)} />}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs">
                  <span className="text-slate-600">Assigned Hostel:</span>
                  <span className="font-bold text-slate-900 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    {selectedHostel?.name} Hostel
                  </span>
                </div>

                <Input
                  label="Student Email Address"
                  type="email"
                  required
                  placeholder="student.one.2024.csd@rajalakshmi.edu.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  icon={<Mail className="w-4 h-4" />}
                  helperText="Format: <name>.<initial>.<admissionyear>.<dept>@rajalakshmi.edu.in"
                />

                <Input
                  label="Password"
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  icon={<Lock className="w-4 h-4" />}
                />

                <div className="pt-2">
                  <Button type="submit" variant="primary" size="lg" className="w-full" isLoading={isLoading}>
                    Sign In to Student Dashboard
                  </Button>
                </div>
              </form>

              {/* Demo Credentials Quick-Fill helper — Hostel-scoped */}
              {selectedHostel && DEMO_STUDENTS[selectedHostel.code] && (
                <div className="mt-8 pt-5 border-t border-dashed border-slate-200">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2.5">
                    {selectedHostel.name} Student Demo Credentials:
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setEmail(DEMO_STUDENTS[selectedHostel.code].email);
                      setPassword('rec123');
                      setError(null);
                    }}
                    className="w-full text-left p-3 rounded-xl border border-slate-200 hover:border-water-300 hover:bg-water-50/50 text-xs text-slate-600 transition-colors focus:outline-none focus:ring-1 focus:ring-water-400 flex items-center justify-between"
                  >
                    <div>
                      <span className="font-bold text-slate-800 block text-xs">
                        {DEMO_STUDENTS[selectedHostel.code].name} ({selectedHostel.name})
                      </span>
                      <span className="text-[11px] text-slate-500 font-mono">
                        {DEMO_STUDENTS[selectedHostel.code].email}
                      </span>
                    </div>
                    <span className="text-[11px] font-semibold text-water-700 bg-water-50 px-2 py-1 rounded-md border border-water-100">
                      Auto-fill
                    </span>
                  </button>
                </div>
              )}
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </PageTransition>
  );
};
