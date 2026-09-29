import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Users, AlertTriangle, Layers, Activity } from 'lucide-react';

export const AdminDashboardPlaceholder: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-ocean-900 to-water-950 text-white p-6 sm:p-8 shadow-card">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <Badge variant="slate" size="sm">
            Administrator Portal
          </Badge>
          <span className="text-xs text-slate-300">All Hostels Scope</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
          Campus Laundry Administration
        </h1>
        <p className="text-xs sm:text-sm text-slate-300 mt-1.5 max-w-xl leading-relaxed">
          High-level oversight of all 3 campus hostels: monitoring student allocations, staff operations, complaint reviews, and audit logs.
        </p>

        <div className="mt-6 flex flex-wrap gap-4 text-xs">
          <div className="px-3 py-1.5 rounded-lg bg-white/10 backdrop-blur-sm border border-white/10">
            <span className="text-slate-400 block text-[10px] uppercase font-semibold">Account</span>
            <span className="font-bold text-white">{user?.email}</span>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-white/10 backdrop-blur-sm border border-white/10">
            <span className="text-slate-400 block text-[10px] uppercase font-semibold">Campus Coverage</span>
            <span className="font-bold text-white">Habitat, Thandalam, Girls</span>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-white/10 backdrop-blur-sm border border-white/10">
            <span className="text-slate-400 block text-[10px] uppercase font-semibold">System Status</span>
            <span className="font-bold text-emerald-400">Database & Models Healthy</span>
          </div>
        </div>
      </div>

      {/* 3 Hostels Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-bold text-slate-900">Habitat Hostel</h3>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-water-50 text-water-700 border border-water-200">
              Boys
            </span>
          </div>
          <div className="space-y-2 text-xs text-slate-600">
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span>Demo Students</span>
              <span className="font-bold text-slate-800">3 Registered</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span>Assigned Staff</span>
              <span className="font-bold text-slate-800">1 Account</span>
            </div>
            <div className="flex justify-between py-1">
              <span>Storage Racks</span>
              <span className="font-bold text-slate-800">3 Racks (12 Shelves)</span>
            </div>
          </div>
        </Card>

        <Card className="border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-bold text-slate-900">Thandalam Hostel</h3>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-water-50 text-water-700 border border-water-200">
              Boys
            </span>
          </div>
          <div className="space-y-2 text-xs text-slate-600">
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span>Demo Students</span>
              <span className="font-bold text-slate-800">3 Registered</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span>Assigned Staff</span>
              <span className="font-bold text-slate-800">1 Account</span>
            </div>
            <div className="flex justify-between py-1">
              <span>Storage Racks</span>
              <span className="font-bold text-slate-800">3 Racks (12 Shelves)</span>
            </div>
          </div>
        </Card>

        <Card className="border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-bold text-slate-900">Girls Hostel</h3>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-water-50 text-water-700 border border-water-200">
              Girls
            </span>
          </div>
          <div className="space-y-2 text-xs text-slate-600">
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span>Demo Students</span>
              <span className="font-bold text-slate-800">3 Registered</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span>Assigned Staff</span>
              <span className="font-bold text-slate-800">1 Account</span>
            </div>
            <div className="flex justify-between py-1">
              <span>Storage Racks</span>
              <span className="font-bold text-slate-800">3 Racks (12 Shelves)</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Admin Modules Roadmap */}
      <Card className="border-slate-200">
        <h3 className="text-sm font-bold text-slate-900 mb-3 pb-2 border-b border-slate-100 flex items-center gap-2">
          <Activity className="w-4 h-4 text-water-600" />
          Cross-Hostel Administration Modules
        </h3>
        <p className="text-xs text-slate-600 leading-relaxed mb-4">
          In Phase 4 and Phase 5, the Admin Dashboard will feature live complaint resolution (UNDER REVIEW to RESOLVED), slot capacity utilization heatmaps, and hostel usage analytics.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <span className="font-medium text-slate-700">Complaint Review Panel</span>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center gap-2.5">
            <Layers className="w-4 h-4 text-water-600" />
            <span className="font-medium text-slate-700">Daily Slot Load Monitor</span>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center gap-2.5">
            <Users className="w-4 h-4 text-emerald-600" />
            <span className="font-medium text-slate-700">Student Quota Audit</span>
          </div>
        </div>
      </Card>
    </div>
  );
};
