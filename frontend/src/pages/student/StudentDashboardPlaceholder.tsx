import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { QrCode, Calendar, Clock, Shirt, Sparkles, AlertCircle } from 'lucide-react';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';

export const StudentDashboardPlaceholder: React.FC = () => {
  const { user } = useAuth();
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [isLoadingQr, setIsLoadingQr] = useState<boolean>(true);

  useEffect(() => {
    async function loadQr() {
      try {
        const res = await api.getStudentQrToken();
        if (res.qrToken) {
          setQrToken(res.qrToken);
        }
      } catch (err) {
        console.error('Failed to load permanent QR token', err);
      } finally {
        setIsLoadingQr(false);
      }
    }
    loadQr();
  }, []);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-water-900 via-water-800 to-ocean-900 text-white p-6 sm:p-8 shadow-card relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <Badge variant="cyan" size="sm">
              Student Dashboard
            </Badge>
            <span className="text-xs text-water-200">
              {user?.hostelName} Hostel
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Welcome, {user?.name || 'Student'}!
          </h1>
          <p className="text-xs sm:text-sm text-water-100/90 mt-1.5 max-w-xl leading-relaxed">
            Rajalakshmi Engineering College campus laundry system. Your permanent digital ID and quotas are ready.
          </p>

          <div className="mt-6 flex flex-wrap gap-4 text-xs">
            <div className="px-3 py-1.5 rounded-lg bg-white/10 backdrop-blur-sm border border-white/10">
              <span className="text-water-200 block text-[10px] uppercase font-semibold">Student ID</span>
              <span className="font-bold text-white">{user?.studentId}</span>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-white/10 backdrop-blur-sm border border-white/10">
              <span className="text-water-200 block text-[10px] uppercase font-semibold">Department</span>
              <span className="font-bold text-white">{user?.department} ({user?.admissionYear})</span>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-white/10 backdrop-blur-sm border border-white/10">
              <span className="text-water-200 block text-[10px] uppercase font-semibold">Hostel Quota</span>
              <span className="font-bold text-white">4 Bookings / Month</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Permanent Digital QR Identity */}
        <Card className="lg:col-span-1 border-slate-200 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100 mb-4">
              <div className="w-8 h-8 rounded-lg bg-water-50 text-water-600 flex items-center justify-center">
                <QrCode className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Permanent Student QR</h3>
                <p className="text-[11px] text-slate-500">Digital ID for College Laundry</p>
              </div>
            </div>

            <div className="flex flex-col items-center justify-center p-6 bg-slate-50 rounded-xl border border-slate-200/80 my-2 text-center">
              {isLoadingQr ? (
                <LoadingSpinner size="sm" text="Retrieving digital token..." />
              ) : qrToken ? (
                <>
                  <div className="p-3 bg-white rounded-xl shadow-subtle border border-slate-200">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(
                        qrToken
                      )}`}
                      alt="Student Permanent QR"
                      className="w-36 h-36 rounded"
                    />
                  </div>
                  <span className="mt-3 font-mono text-[10px] text-slate-500 break-all px-2">
                    {qrToken}
                  </span>
                  <p className="text-[11px] text-slate-600 font-semibold mt-1">
                    {user?.studentId} - {user?.name}
                  </p>
                </>
              ) : (
                <p className="text-xs text-red-500">Could not retrieve digital QR.</p>
              )}
            </div>

            <div className="p-3 rounded-lg bg-water-50/70 border border-water-200/60 text-[11px] text-water-900 flex items-start gap-2 mt-4">
              <AlertCircle className="w-4 h-4 text-water-600 flex-shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                This QR code permanently identifies you in the laundry system. Staff will manage bookings directly on the portal without requiring laptop camera scanning.
              </p>
            </div>
          </div>
        </Card>

        {/* Right Columns: Rules & Roadmap */}
        <div className="lg:col-span-2 space-y-6">
          {/* Rules Card */}
          <Card className="border-slate-200">
            <h3 className="text-sm font-bold text-slate-900 mb-4 pb-2 border-b border-slate-100 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-water-600" />
              Laundry Rules & Limits
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-slate-200 bg-white">
                <div className="flex items-center gap-2 text-water-700 font-bold text-sm mb-1">
                  <Shirt className="w-4 h-4" />
                  <span>Max 20 Clothes</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Only 2 categories accepted: <strong>T-shirt/Shirt</strong> and <strong>Pants/Track</strong>. Total must not exceed 20.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-white">
                <div className="flex items-center gap-2 text-water-700 font-bold text-sm mb-1">
                  <Calendar className="w-4 h-4" />
                  <span>4 Runs Monthly</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Each student can book laundry slots up to 4 times per calendar month. Usage refreshes on the 1st of every month.
                </p>
              </div>
            </div>
          </Card>

          {/* Phase 1 Status Banner */}
          <div className="p-5 rounded-xl border border-dashed border-water-300 bg-water-50/50 flex items-start gap-3">
            <Clock className="w-5 h-5 text-water-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-water-900 uppercase tracking-wide">
                Phase 1 Architecture Initialized
              </h4>
              <p className="text-xs text-water-800/90 mt-1 leading-relaxed">
                Your student profile, opaque QR identity, hostel scoping, and database relations are securely established. In Phase 2, interactive slot selection and real-time clothes counter will be enabled.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
