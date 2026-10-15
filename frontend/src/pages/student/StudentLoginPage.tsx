import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  GraduationCap,
  ArrowLeft,
  Mail,
  Lock,
  Building2,
  ChevronRight,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { Hostel } from '../../types';
import { Card } from '../../components/common/Card';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import { PageTransition } from '../../components/common/PageTransition';
import { stepVariants } from '../../utils/animations';

// REC Demo Student quick-fill reference
const REC_DEMO_STUDENTS: Record<string, { email: string; name: string; dept: string }> = {
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

// PG 4 Demo Users with visible credentials as required
interface PgDemoUser {
  id: string;
  label: string;
  email: string;
  passwordPlain: string;
  facilityCode: string;
  facilityName: string;
  room: string;
}

const PG_DEMO_USERS: PgDemoUser[] = [
  {
    id: 'user1',
    label: 'User 1',
    email: 'user1@gmail.com',
    passwordPlain: 'user1',
    facilityCode: 'OAK_HOUSE',
    facilityName: 'Oak House',
    room: 'Unit A · Room 101',
  },
  {
    id: 'user2',
    label: 'User 2',
    email: 'user2@gmail.com',
    passwordPlain: 'user2',
    facilityCode: 'MAPLE_VILLA',
    facilityName: 'Maple Villa',
    room: 'Unit B · Room 204',
  },
  {
    id: 'user3',
    label: 'User 3',
    email: 'user3@gmail.com',
    passwordPlain: 'user3',
    facilityCode: 'PINE_RESIDENCE',
    facilityName: 'Pine Residence',
    room: 'Unit C · Room 302',
  },
  {
    id: 'user4',
    label: 'User 4',
    email: 'user4@gmail.com',
    passwordPlain: 'user4',
    facilityCode: 'CEDAR_SUITES',
    facilityName: 'Cedar Suites',
    room: 'Unit D · Room 405',
  },
];

export const StudentLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { login } = useAuth();
  const shouldReduceMotion = useReducedMotion();

  // Determine initial portal based on query param: 'rec' | 'pg'
  const initialPortal = searchParams.get('portal') === 'pg' ? 'pg' : 'rec';
  const [portal, setPortal] = useState<'rec' | 'pg'>(initialPortal);

  // REC flow steps: 'hostel' -> 'login'
  const [recStep, setRecStep] = useState<'hostel' | 'login'>('hostel');

  // PG selected demo user
  const [selectedPgUserId, setSelectedPgUserId] = useState<string>('user1');

  // Shared state
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [selectedHostelId, setSelectedHostelId] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Sync portal state when URL search params change
  useEffect(() => {
    const p = searchParams.get('portal') === 'pg' ? 'pg' : 'rec';
    setPortal(p);
  }, [searchParams]);

  // Fetch all hostels from server once
  useEffect(() => {
    async function fetchHostels() {
      try {
        const res = await api.getHostels();
        if (res.data) {
          setHostels(res.data);
        }
      } catch (err: any) {
        setError('Failed to load facility list from server.');
      }
    }
    fetchHostels();
  }, []);

  // Filter hostels for REC (ONLY Girls, Thandalam, Habitat)
  const recHostels = hostels.filter(
    (h) =>
      h.environment === 'COLLEGE' ||
      ['GIRLS', 'THANDALAM', 'HABITAT'].includes(h.code.toUpperCase())
  );

  // Set default REC hostel if none selected
  useEffect(() => {
    if (portal === 'rec' && recHostels.length > 0 && !selectedHostelId) {
      setSelectedHostelId(recHostels[0].id);
    }
  }, [portal, recHostels, selectedHostelId]);

  // Pre-fill form when PG portal or selected PG user changes
  useEffect(() => {
    if (portal === 'pg') {
      const activeUser = PG_DEMO_USERS.find((u) => u.id === selectedPgUserId) || PG_DEMO_USERS[0];
      setEmail(activeUser.email);
      setPassword(activeUser.passwordPlain);
      setError(null);

      // Find matching facility ID for this user
      const matchedFacility = hostels.find(
        (h) => h.code.toUpperCase() === activeUser.facilityCode.toUpperCase()
      );
      if (matchedFacility) {
        setSelectedHostelId(matchedFacility.id);
      }
    }
  }, [portal, selectedPgUserId, hostels]);

  const selectedHostel = hostels.find((h) => h.id === selectedHostelId);
  const activePgUser = PG_DEMO_USERS.find((u) => u.id === selectedPgUserId) || PG_DEMO_USERS[0];

  // Handler to switch portals
  const handleSwitchPortal = (target: 'rec' | 'pg') => {
    setPortal(target);
    setSearchParams({ portal: target });
    setError(null);
    if (target === 'rec') {
      setRecStep('hostel');
      setEmail('');
      setPassword('');
      if (recHostels.length > 0) {
        setSelectedHostelId(recHostels[0].id);
      }
    } else {
      setSelectedPgUserId('user1');
    }
  };

  // REC hostel selection
  const handleSelectRecHostel = (hostelId: string) => {
    setSelectedHostelId(hostelId);
    setError(null);
    setRecStep('login');
  };

  // PG user selection card click
  const handleSelectPgUser = (user: PgDemoUser) => {
    setSelectedPgUserId(user.id);
    setEmail(user.email);
    setPassword(user.passwordPlain);
    setError(null);

    const matchedFacility = hostels.find(
      (h) => h.code.toUpperCase() === user.facilityCode.toUpperCase()
    );
    if (matchedFacility) {
      setSelectedHostelId(matchedFacility.id);
    }
  };

  // Handle Login Submit (always sends credentials to server to verify)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    let effectiveHostelId = selectedHostelId;
    if (portal === 'pg' && !effectiveHostelId) {
      const matched = hostels.find(
        (h) => h.code.toUpperCase() === activePgUser.facilityCode.toUpperCase()
      );
      if (matched) effectiveHostelId = matched.id;
    }

    if (!effectiveHostelId) {
      setError('Please select a facility/hostel before signing in.');
      return;
    }

    setIsLoading(true);
    try {
      await login({
        email: email.trim(),
        password,
        role: 'STUDENT',
        hostelId: effectiveHostelId,
      });
      navigate('/student/dashboard');
    } catch (err: any) {
      setError(err.message || 'Login failed. Please verify your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PageTransition className="max-w-xl mx-auto py-8">
      {/* Top Navigation Row: Back button & Portal Toggle */}
      <div className="flex items-center justify-between gap-3 mb-6">
        <button
          type="button"
          onClick={() => {
            if (portal === 'rec' && recStep === 'login') {
              setRecStep('hostel');
            } else {
              navigate('/');
            }
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:text-water-700 hover:border-water-300 hover:bg-water-50/50 shadow-xs transition-all focus:outline-none focus:ring-2 focus:ring-water-400"
        >
          <ArrowLeft className="w-4 h-4 text-water-600" />
          <span>
            {portal === 'rec' && recStep === 'login'
              ? 'Back to Hostel Selection'
              : 'Back to Main Menu'}
          </span>
        </button>

        {/* Portal Switch Tabs */}
        <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200/80 text-xs font-semibold">
          <button
            type="button"
            onClick={() => handleSwitchPortal('rec')}
            className={`px-3 py-1.5 rounded-md transition-all ${
              portal === 'rec'
                ? 'bg-white text-water-800 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            REC Hostels
          </button>
          <button
            type="button"
            onClick={() => handleSwitchPortal('pg')}
            className={`px-3 py-1.5 rounded-md transition-all ${
              portal === 'pg'
                ? 'bg-white text-cyan-800 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            PG Hostel
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {/* ============================================================== */}
        {/* FLOW 1: RAJALAKSHMI ENGINEERING COLLEGE (REC) HOSTELS          */}
        {/* ============================================================== */}
        {portal === 'rec' && recStep === 'hostel' && (
          <motion.div
            key="rec-hostel-step"
            variants={shouldReduceMotion ? undefined : stepVariants}
            initial={shouldReduceMotion ? false : 'initial'}
            animate="animate"
            exit="exit"
          >
            <Card className="border-slate-200 shadow-sm">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
                <div className="w-10 h-10 rounded-xl bg-water-50 text-water-600 flex items-center justify-center border border-water-200">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-slate-900">
                    Rajalakshmi Engineering College
                  </h1>
                  <p className="text-xs text-slate-500">
                    Select Your Assigned Campus Hostel
                  </p>
                </div>
              </div>

              {error && (
                <ErrorAlert message={error} className="mb-5" onDismiss={() => setError(null)} />
              )}

              <p className="text-xs text-slate-600 mb-4">
                Laundry slots and processing are scoped per campus hostel. Choose your hostel to continue:
              </p>

              {/* Show ONLY the three REC hostels: Girls, Thandalam, Habitat */}
              <div className="space-y-3">
                {recHostels.map((hostel) => {
                  const isSelected = selectedHostelId === hostel.id;
                  const isGirls = hostel.code.toUpperCase() === 'GIRLS';
                  return (
                    <button
                      key={hostel.id}
                      type="button"
                      onClick={() => handleSelectRecHostel(hostel.id)}
                      className={`w-full p-4 rounded-xl border text-left flex items-center justify-between transition-all group focus:outline-none focus:ring-2 focus:ring-water-400 ${
                        isSelected
                          ? 'border-water-500 bg-water-50/60 shadow-xs'
                          : 'border-slate-200 hover:border-water-300 hover:bg-slate-50/80'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 text-water-700 flex items-center justify-center font-bold text-xs group-hover:border-water-400 group-hover:text-water-600 transition-colors">
                          {hostel.code.slice(0, 3)}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 text-sm group-hover:text-water-700 transition-colors">
                            {hostel.name} Hostel
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {isGirls ? 'Girls Hostel Unit' : 'Boys Hostel Unit'} &middot; Dedicated Laundry Queue
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

        {/* REC Step 2: Login Form */}
        {portal === 'rec' && recStep === 'login' && (
          <motion.div
            key="rec-login-step"
            variants={shouldReduceMotion ? undefined : stepVariants}
            initial={shouldReduceMotion ? false : 'initial'}
            animate="animate"
            exit="exit"
          >
            <Card className="border-slate-200 shadow-sm">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
                <div className="w-10 h-10 rounded-xl bg-water-50 text-water-600 flex items-center justify-center border border-water-200">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h1 className="text-lg font-bold text-slate-900">REC Student Portal Login</h1>
                  <p className="text-xs text-water-700 font-medium">
                    {selectedHostel?.name} Hostel
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setRecStep('hostel')}
                  className="text-xs text-water-600 hover:text-water-800 font-semibold underline underline-offset-2 focus:outline-none"
                >
                  Change Hostel
                </button>
              </div>

              {error && (
                <ErrorAlert message={error} className="mb-5" onDismiss={() => setError(null)} />
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs">
                  <span className="text-slate-600">Assigned Unit:</span>
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
                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    className="w-full"
                    isLoading={isLoading}
                  >
                    Sign In to REC Student Dashboard
                  </Button>
                </div>
              </form>

              {/* REC Demo Credentials Quick-Fill helper */}
              {selectedHostel && REC_DEMO_STUDENTS[selectedHostel.code] && (
                <div className="mt-8 pt-5 border-t border-dashed border-slate-200">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2.5">
                    {selectedHostel.name} Student Demo Credentials:
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setEmail(REC_DEMO_STUDENTS[selectedHostel.code].email);
                      setPassword('rec123');
                      setError(null);
                    }}
                    className="w-full text-left p-3 rounded-xl border border-slate-200 hover:border-water-300 hover:bg-water-50/50 text-xs text-slate-600 transition-colors focus:outline-none focus:ring-1 focus:ring-water-400 flex items-center justify-between"
                  >
                    <div>
                      <span className="font-bold text-slate-800 block text-xs">
                        {REC_DEMO_STUDENTS[selectedHostel.code].name} ({selectedHostel.name})
                      </span>
                      <span className="text-[11px] text-slate-500 font-mono">
                        {REC_DEMO_STUDENTS[selectedHostel.code].email}
                      </span>
                    </div>
                    <span className="text-[11px] font-semibold text-water-700 bg-water-50 px-2 py-1 rounded-md border border-water-100">
                      Auto-fill (rec123)
                    </span>
                  </button>
                </div>
              )}
            </Card>
          </motion.div>
        )}

        {/* ============================================================== */}
        {/* FLOW 2: PG HOSTEL (FOUR SELECTABLE USER CARDS + VISIBLE CREDS) */}
        {/* ============================================================== */}
        {portal === 'pg' && (
          <motion.div
            key="pg-portal-step"
            variants={shouldReduceMotion ? undefined : stepVariants}
            initial={shouldReduceMotion ? false : 'initial'}
            animate="animate"
            exit="exit"
          >
            <Card className="border-slate-200 shadow-sm">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
                <div className="w-10 h-10 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center border border-cyan-200">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-slate-900">PG Hostel Resident Portal</h1>
                  <p className="text-xs text-slate-500">
                    Shared Living Laundry Management &amp; Demo Residents
                  </p>
                </div>
              </div>

              {error && (
                <ErrorAlert message={error} className="mb-5" onDismiss={() => setError(null)} />
              )}

              {/* 1. Four Selectable User Cards */}
              <div className="mb-4">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5">
                  Select Demo User:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {PG_DEMO_USERS.map((user) => {
                    const isSelected = selectedPgUserId === user.id;
                    return (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => handleSelectPgUser(user)}
                        className={`p-3 rounded-xl border text-center transition-all focus:outline-none focus:ring-2 focus:ring-cyan-400 ${
                          isSelected
                            ? 'border-cyan-500 bg-gradient-to-b from-cyan-50/90 to-water-50/70 shadow-xs ring-1 ring-cyan-400'
                            : 'border-slate-200 hover:border-cyan-300 hover:bg-slate-50/80 bg-white'
                        }`}
                      >
                        <div className="w-8 h-8 mx-auto rounded-full bg-cyan-100/80 text-cyan-800 flex items-center justify-center font-bold text-xs mb-1.5">
                          {user.label.replace('User ', 'U')}
                        </div>
                        <div className="text-xs font-bold text-slate-900">{user.label}</div>
                        <div className="text-[10px] text-cyan-700 font-medium truncate">
                          {user.facilityName}
                        </div>
                        {isSelected && (
                          <div className="mt-1 flex items-center justify-center text-[10px] text-cyan-700 font-semibold gap-0.5">
                            <CheckCircle2 className="w-3 h-3 text-cyan-600" />
                            <span>Active</span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Visible Credentials Documentation Block (Required) */}
              <div className="mb-6 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 mb-2">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-600" />
                  <span>PG Demo Credentials:</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                  {PG_DEMO_USERS.map((u) => (
                    <div
                      key={u.id}
                      onClick={() => handleSelectPgUser(u)}
                      className={`p-2 rounded-lg border cursor-pointer transition-all ${
                        selectedPgUserId === u.id
                          ? 'border-cyan-400 bg-cyan-50/80 font-bold text-cyan-900'
                          : 'border-slate-200/80 bg-white text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px] mb-0.5">
                        <span className="font-sans font-bold text-slate-900">{u.label}</span>
                        <span className="text-[10px] text-slate-500 font-sans">
                          {u.facilityName}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-600 truncate">
                        <span className="font-semibold text-slate-500 font-sans">Email: </span>
                        {u.email}
                      </div>
                      <div className="text-[11px] text-slate-600">
                        <span className="font-semibold text-slate-500 font-sans">Password: </span>
                        <span className="bg-slate-100 px-1 py-0.5 rounded text-cyan-700 font-bold">
                          {u.passwordPlain}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 3. Functional Login Form */}
              <form onSubmit={handleSubmit} className="space-y-4 pt-2 border-t border-slate-100">
                <div className="p-3 bg-cyan-50/60 border border-cyan-200/80 rounded-lg flex items-center justify-between text-xs">
                  <span className="text-slate-600">PG Facility Association:</span>
                  <span className="font-bold text-cyan-900 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-cyan-600" />
                    {activePgUser.facilityName} ({activePgUser.room})
                  </span>
                </div>

                <Input
                  label="Resident Email Address"
                  type="email"
                  required
                  placeholder="user1@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  icon={<Mail className="w-4 h-4" />}
                  helperText={`Selected account: ${activePgUser.label} (${activePgUser.facilityName})`}
                />

                <Input
                  label="Password"
                  type="password"
                  required
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  icon={<Lock className="w-4 h-4" />}
                  helperText="Backend verifies password against encrypted database record."
                />

                <div className="pt-2">
                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    className="w-full bg-gradient-to-r from-cyan-600 to-water-600 hover:from-cyan-700 hover:to-water-700"
                    isLoading={isLoading}
                  >
                    Sign In as {activePgUser.label} ({activePgUser.facilityName})
                  </Button>
                </div>
              </form>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </PageTransition>
  );
};
