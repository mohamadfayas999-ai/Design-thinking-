import React from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, Shirt, ShieldCheck, ArrowRight, Droplets, Clock, CheckCircle2, Building2 } from 'lucide-react';
import { Card } from '../components/common/Card';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="w-full">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-8 pb-14 text-center max-w-4xl mx-auto">
        {/* Subtle Water Glow Accent */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-water-200/30 rounded-full blur-3xl pointer-events-none -z-10" />

        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-water-50 border border-water-200 text-water-700 text-xs font-semibold mb-6">
          <Droplets className="w-3.5 h-3.5 text-water-600" />
          <span>Rajalakshmi Engineering College Hostels</span>
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-slate-900 tracking-tight leading-tight">
          WASHWISE
        </h1>

        <p className="mt-3 text-lg sm:text-xl font-medium text-water-700">
          Smart & Intelligent Campus Laundry Management
        </p>

        <p className="mt-4 text-sm sm:text-base text-slate-600 max-w-2xl mx-auto leading-relaxed">
          A dedicated portal for hostel students, laundry staff, and college administration to schedule slots, monitor real-time washing status, and verify clothes with complete transparency.
        </p>
      </section>

      {/* Primary Role Choice Cards (Exactly 3 choices: Student, Laundry Staff, Admin) */}
      <section className="max-w-5xl mx-auto">
        <div className="text-center mb-6">
          <h2 className="text-xs uppercase tracking-widest font-bold text-slate-500">
            Select Your Portal to Continue
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Choice 1: Student */}
          <Card
            hoverEffect
            className="flex flex-col justify-between border-slate-200/80 hover:border-water-400 group cursor-pointer"
            onClick={() => navigate('/student/login')}
          >
            <div>
              <div className="w-12 h-12 rounded-xl bg-water-50 text-water-600 border border-water-100 flex items-center justify-center mb-5 group-hover:bg-water-600 group-hover:text-white transition-colors duration-200">
                <GraduationCap className="w-6 h-6" />
              </div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xl font-bold text-slate-900 group-hover:text-water-700 transition-colors">
                  Student
                </h3>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-water-50 text-water-700 border border-water-200">
                  Hostel Access
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed mb-6">
                Select your hostel, sign in with your student ID, book laundry slots, and track processing till pickup.
              </p>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-water-700 group-hover:text-water-800">
              <span>Enter Student Portal</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </Card>

          {/* Choice 2: Laundry Staff */}
          <Card
            hoverEffect
            className="flex flex-col justify-between border-slate-200/80 hover:border-water-400 group cursor-pointer"
            onClick={() => navigate('/staff/login')}
          >
            <div>
              <div className="w-12 h-12 rounded-xl bg-water-50 text-water-600 border border-water-100 flex items-center justify-center mb-5 group-hover:bg-water-600 group-hover:text-white transition-colors duration-200">
                <Shirt className="w-6 h-6" />
              </div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xl font-bold text-slate-900 group-hover:text-water-700 transition-colors">
                  Laundry Staff
                </h3>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                  Operations
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed mb-6">
                Manage hostel laundry intake, assign rack and shelf locations, update washing status, and handle student returns.
              </p>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-water-700 group-hover:text-water-800">
              <span>Enter Staff Portal</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </Card>

          {/* Choice 3: Admin */}
          <Card
            hoverEffect
            className="flex flex-col justify-between border-slate-200/80 hover:border-water-400 group cursor-pointer"
            onClick={() => navigate('/admin/login')}
          >
            <div>
              <div className="w-12 h-12 rounded-xl bg-water-50 text-water-600 border border-water-100 flex items-center justify-center mb-5 group-hover:bg-water-600 group-hover:text-white transition-colors duration-200">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xl font-bold text-slate-900 group-hover:text-water-700 transition-colors">
                  Admin
                </h3>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                  College Wide
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed mb-6">
                Centralized monitoring across all three hostels, review booking capacity, resolve student complaints, and audit records.
              </p>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-water-700 group-hover:text-water-800">
              <span>Enter Admin Portal</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </Card>
        </div>
      </section>

      {/* Key System Highlights */}
      <section className="mt-16 max-w-5xl mx-auto border-t border-slate-200/80 pt-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-white border border-slate-200/80 flex items-start gap-3">
            <Building2 className="w-5 h-5 text-water-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-slate-900">3 Campus Hostels</h4>
              <p className="text-xs text-slate-500 mt-0.5">Habitat, Thandalam, and Girls hostels with dedicated queues.</p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white border border-slate-200/80 flex items-start gap-3">
            <Shirt className="w-5 h-5 text-water-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-slate-900">20-Clothes Limit</h4>
              <p className="text-xs text-slate-500 mt-0.5">T-shirt/Shirt and Pants/Track with automatic limit validation.</p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white border border-slate-200/80 flex items-start gap-3">
            <Clock className="w-5 h-5 text-water-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-slate-900">4 Runs Monthly</h4>
              <p className="text-xs text-slate-500 mt-0.5">Fair campus quota tracking with monthly usage monitoring.</p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white border border-slate-200/80 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-water-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-slate-900">Verify & Complaint</h4>
              <p className="text-xs text-slate-500 mt-0.5">Two-way verification at collection with admin resolution flow.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
