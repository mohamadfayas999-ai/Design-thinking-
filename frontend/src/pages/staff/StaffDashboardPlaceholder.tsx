import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Shirt, Layers, CheckCircle2, ShieldAlert } from 'lucide-react';

export const StaffDashboardPlaceholder: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-amber-900 via-amber-800 to-ocean-900 text-white p-6 sm:p-8 shadow-card">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <Badge variant="amber" size="sm">
            Laundry Staff Portal
          </Badge>
          <span className="text-xs text-amber-200">{user?.hostelName} Hostel</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
          {user?.name}
        </h1>
        <p className="text-xs sm:text-sm text-amber-100/90 mt-1.5 max-w-xl leading-relaxed">
          Operational console for laundry intake, storage location allocation, wash progress updates, and pickup handovers.
        </p>

        <div className="mt-6 flex flex-wrap gap-4 text-xs">
          <div className="px-3 py-1.5 rounded-lg bg-white/10 backdrop-blur-sm border border-white/10">
            <span className="text-amber-200 block text-[10px] uppercase font-semibold">Staff ID</span>
            <span className="font-bold text-white">{user?.staffId}</span>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-white/10 backdrop-blur-sm border border-white/10">
            <span className="text-amber-200 block text-[10px] uppercase font-semibold">Assigned Unit</span>
            <span className="font-bold text-white">{user?.hostelName} Laundry Room</span>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-white/10 backdrop-blur-sm border border-white/10">
            <span className="text-amber-200 block text-[10px] uppercase font-semibold">Access Scope</span>
            <span className="font-bold text-white">Hostel Scoped (No Cross-Hostel Access)</span>
          </div>
        </div>
      </div>

      {/* Internal Staff Storage & Architecture status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-slate-200">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 mb-4">
            <Layers className="w-5 h-5 text-amber-600" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">Physical Storage Configuration</h3>
              <p className="text-[11px] text-slate-500">Internal Rack & Shelf Architecture</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-800">
                <span>Racks 1 to 3</span>
                <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  Ready (12 Shelves)
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Each rack has 4 physical shelves allocated exclusively for {user?.hostelName} student clothes batches.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-amber-50/70 border border-amber-200/60 text-[11px] text-amber-900 flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                <strong>Internal Staff Information:</strong> Rack and shelf locations remain strictly confidential and are not visible to students.
              </p>
            </div>
          </div>
        </Card>

        <Card className="border-slate-200">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 mb-4">
            <Shirt className="w-5 h-5 text-amber-600" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">Staff Intake Workflow</h3>
              <p className="text-[11px] text-slate-500">Upcoming in Phase 3</p>
            </div>
          </div>

          <ul className="space-y-2.5 text-xs text-slate-600">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>View daily booking queue for {user?.hostelName}</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>Receive clothes & confirm 20-clothes count</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>Allocate internal rack & shelf number</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>Advance status: IN PROGRESS to COMPLETED</span>
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
};
