import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Shirt, ArrowLeft, Mail, Lock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { Hostel } from '../../types';
import { Card } from '../../components/common/Card';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { Button } from '../../components/common/Button';
import { ErrorAlert } from '../../components/common/ErrorAlert';

export const StaffLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [selectedHostelId, setSelectedHostelId] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isFetchingHostels, setIsFetchingHostels] = useState<boolean>(true);

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
      } finally {
        setIsFetchingHostels(false);
      }
    }
    fetchHostels();
  }, []);

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
        role: 'STAFF',
        hostelId: selectedHostelId,
      });
      navigate('/staff/dashboard');
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const autofillDemoStaff = (hostelCode: string, staffEmail: string) => {
    const target = hostels.find((h) => h.code === hostelCode);
    if (target) {
      setSelectedHostelId(target.id);
    }
    setEmail(staffEmail);
    setPassword('laundrystaff123');
    setError(null);
  };

  return (
    <div className="max-w-md mx-auto py-8">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-water-700 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Portal Selection</span>
      </Link>

      <Card className="border-slate-200">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-200">
            <Shirt className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Laundry Staff Portal</h1>
            <p className="text-xs text-slate-500">Hostel Laundry Intake & Operations</p>
          </div>
        </div>

        {error && <ErrorAlert message={error} className="mb-5" onDismiss={() => setError(null)} />}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Select
            label="Select Assigned Hostel"
            required
            value={selectedHostelId}
            disabled={isFetchingHostels}
            onChange={(e) => setSelectedHostelId(e.target.value)}
            options={hostels.map((h) => ({
              value: h.id,
              label: `${h.name} Hostel`,
            }))}
            helperText="Staff are assigned to one hostel."
          />

          <Input
            label="Staff Email Address"
            type="email"
            required
            placeholder="habitatstaff1@rajalakshmi.edu.in"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            icon={<Mail className="w-4 h-4" />}
            helperText="Format: <hostelname>staff1@rajalakshmi.edu.in"
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
              Sign In to Staff Dashboard
            </Button>
          </div>
        </form>

        {/* Demo Staff Quick-Fill helper */}
        <div className="mt-8 pt-5 border-t border-dashed border-slate-200">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2.5">
            Demo Staff Quick Fill:
          </p>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => autofillDemoStaff('HABITAT', 'habitatstaff1@rajalakshmi.edu.in')}
              className="text-left p-2 rounded-lg border border-slate-200 hover:border-amber-300 hover:bg-amber-50/50 text-[11px] text-slate-600 transition-colors"
            >
              <span className="font-bold text-slate-800 block">Habitat</span>
              <span>Staff 1</span>
            </button>
            <button
              type="button"
              onClick={() => autofillDemoStaff('THANDALAM', 'thandalamstaff1@rajalakshmi.edu.in')}
              className="text-left p-2 rounded-lg border border-slate-200 hover:border-amber-300 hover:bg-amber-50/50 text-[11px] text-slate-600 transition-colors"
            >
              <span className="font-bold text-slate-800 block">Thandalam</span>
              <span>Staff 1</span>
            </button>
            <button
              type="button"
              onClick={() => autofillDemoStaff('GIRLS', 'girlsstaff1@rajalakshmi.edu.in')}
              className="text-left p-2 rounded-lg border border-slate-200 hover:border-amber-300 hover:bg-amber-50/50 text-[11px] text-slate-600 transition-colors"
            >
              <span className="font-bold text-slate-800 block">Girls</span>
              <span>Staff 1</span>
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
};
