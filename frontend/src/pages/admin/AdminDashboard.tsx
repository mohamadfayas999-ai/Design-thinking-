import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import {
  AdminSummaryMetrics,
  AdminHostelSummary,
  AdminDemandInsights,
  AdminOrder,
  AdminComplaint,
  AdminStorageLocation,
  AdminTodaySlot,
  AdminStudent,
  AdminStaff,
  AdminAuditLog,
} from '../../types';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import {
  Activity,
  Users,
  Shirt,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
  LogOut,
  Search,
  Calendar,
  Package,
  Building,
  Sparkles,
  ShieldAlert,
  SlidersHorizontal,
  TrendingUp,
  Warehouse,
  History,
} from 'lucide-react';

type AdminTab = 'overview' | 'orders' | 'complaints' | 'storage' | 'directory' | 'audit';

export const AdminDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Active state
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [selectedHostel, setSelectedHostel] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Tab Data States
  const [summaryData, setSummaryData] = useState<{
    summary: AdminSummaryMetrics;
    hostels: AdminHostelSummary[];
    insights: AdminDemandInsights;
  } | null>(null);

  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('ALL');
  const [orderDateRange, setOrderDateRange] = useState<string>('ALL');
  const [orderSearch, setOrderSearch] = useState<string>('');
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null);

  const [complaints, setComplaints] = useState<AdminComplaint[]>([]);
  const [complaintStatusFilter, setComplaintStatusFilter] = useState<string>('ALL');
  const [selectedComplaint, setSelectedComplaint] = useState<AdminComplaint | null>(null);
  const [isResolving, setIsResolving] = useState<boolean>(false);
  const [resolveSuccessMsg, setResolveSuccessMsg] = useState<string | null>(null);

  const [storageData, setStorageData] = useState<{
    stats: { total: number; occupied: number; available: number; utilizationPercent: number };
    storage: AdminStorageLocation[];
  } | null>(null);

  const [todaySlots, setTodaySlots] = useState<AdminTodaySlot[]>([]);
  const [todayDateStr, setTodayDateStr] = useState<string>('');

  const [students, setStudents] = useState<AdminStudent[]>([]);
  const [studentSearch, setStudentSearch] = useState<string>('');
  const [staffList, setStaffList] = useState<AdminStaff[]>([]);

  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);

  // ── Fetchers ──────────────────────────────────────────────────────────────

  const fetchOverview = useCallback(async () => {
    try {
      const res = await api.getAdminSummary(selectedHostel);
      if (res.success) {
        setSummaryData({
          summary: res.summary,
          hostels: res.hostels,
          insights: res.insights,
        });
      }
      const slotsRes = await api.getAdminTodaySlots(selectedHostel);
      if (slotsRes.success) {
        setTodaySlots(slotsRes.slots);
        setTodayDateStr(slotsRes.date);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load summary');
    }
  }, [selectedHostel]);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await api.getAdminOrders({
        hostelId: selectedHostel,
        status: orderStatusFilter,
        dateRange: orderDateRange,
        search: orderSearch,
      });
      if (res.success) {
        setOrders(res.orders);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load orders');
    }
  }, [selectedHostel, orderStatusFilter, orderDateRange, orderSearch]);

  const fetchComplaints = useCallback(async () => {
    try {
      const res = await api.getAdminComplaints({
        hostelId: selectedHostel,
        status: complaintStatusFilter,
      });
      if (res.success) {
        setComplaints(res.complaints);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load complaints');
    }
  }, [selectedHostel, complaintStatusFilter]);

  const fetchStorage = useCallback(async () => {
    try {
      const res = await api.getAdminStorage(selectedHostel);
      if (res.success) {
        setStorageData({
          stats: res.stats,
          storage: res.storage,
        });
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load storage');
    }
  }, [selectedHostel]);

  const fetchDirectory = useCallback(async () => {
    try {
      const [stRes, sfRes] = await Promise.all([
        api.getAdminStudents({ hostelId: selectedHostel, search: studentSearch }),
        api.getAdminStaff(selectedHostel),
      ]);
      if (stRes.success) setStudents(stRes.students);
      if (sfRes.success) setStaffList(sfRes.staff);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load directory');
    }
  }, [selectedHostel, studentSearch]);

  const fetchAuditLogs = useCallback(async () => {
    try {
      const res = await api.getAdminAuditLogs({ limit: 60 });
      if (res.success) setAuditLogs(res.logs);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load audit logs');
    }
  }, []);

  const loadTabData = useCallback(async () => {
    setErrorMessage(null);
    if (activeTab === 'overview') await fetchOverview();
    else if (activeTab === 'orders') await fetchOrders();
    else if (activeTab === 'complaints') await fetchComplaints();
    else if (activeTab === 'storage') await fetchStorage();
    else if (activeTab === 'directory') await fetchDirectory();
    else if (activeTab === 'audit') await fetchAuditLogs();
  }, [activeTab, fetchOverview, fetchOrders, fetchComplaints, fetchStorage, fetchDirectory, fetchAuditLogs]);

  useEffect(() => {
    setIsLoading(true);
    loadTabData().finally(() => setIsLoading(false));
  }, [loadTabData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadTabData();
    setIsRefreshing(false);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login');
  };

  const handleResolveComplaint = async () => {
    if (!selectedComplaint) return;
    setIsResolving(true);
    setErrorMessage(null);
    try {
      const res = await api.resolveComplaint(selectedComplaint.id);
      if (res.success) {
        setResolveSuccessMsg(`Complaint for ${selectedComplaint.student.name} marked as RESOLVED.`);
        setSelectedComplaint(null);
        await fetchComplaints();
        setTimeout(() => setResolveSuccessMsg(null), 5000);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to resolve complaint');
    } finally {
      setIsResolving(false);
    }
  };

  const formatStatusBadge = (status: string) => {
    switch (status) {
      case 'BOOKED':
        return <Badge variant="amber" size="sm">Booked</Badge>;
      case 'IN_PROGRESS':
        return <Badge variant="water" size="sm">In Progress</Badge>;
      case 'COMPLETED':
        return <Badge variant="cyan" size="sm">Completed</Badge>;
      case 'VERIFIED':
        return <Badge variant="emerald" size="sm">Verified</Badge>;
      case 'UNDER_REVIEW':
        return <Badge variant="red" size="sm">Under Review</Badge>;
      case 'RESOLVED':
        return <Badge variant="emerald" size="sm">Resolved</Badge>;
      default:
        return <Badge variant="slate" size="sm">{status}</Badge>;
    }
  };

  const formatComplaintTypeLabel = (type: string) => {
    switch (type) {
      case 'CLOTHES_TORN':
        return 'Clothes Torn';
      case 'NUMBER_OF_CLOTHES_REDUCED':
        return 'Number of Clothes Reduced';
      case 'OTHER_ISSUE':
        return 'Other Issue';
      default:
        return type;
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* ── Top Header Banner ────────────────────────────────────────────── */}
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-ocean-900 to-water-950 text-white p-6 sm:p-8 shadow-card border border-white/10 relative overflow-hidden">
        {/* Subtle Water Reflection Effect */}
        <div className="absolute -right-20 -bottom-20 w-80 h-80 rounded-full bg-water-500/10 blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wider uppercase bg-water-500/20 text-water-200 border border-water-400/30">
                <span className="w-1.5 h-1.5 rounded-full bg-water-400 animate-pulse" />
                Administrative Portal
              </span>
              <span className="text-xs text-slate-300 font-medium">Campus-wide Laundry Operations</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              WASHWISE Command Center
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl">
              Cross-hostel monitoring, real-time demand analytics, storage audits, and student dispute resolution.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Hostel Scope Selector */}
            <div className="flex items-center gap-1 bg-white/10 backdrop-blur-md rounded-xl p-1 border border-white/10">
              <span className="text-[11px] font-semibold text-slate-300 px-2 flex items-center gap-1">
                <Building className="w-3.5 h-3.5 text-water-300" />
                Hostel:
              </span>
              <select
                value={selectedHostel}
                onChange={(e) => setSelectedHostel(e.target.value)}
                className="bg-slate-900 text-white text-xs font-semibold rounded-lg px-2.5 py-1.5 border border-white/20 focus:outline-none focus:ring-1 focus:ring-water-400 cursor-pointer"
              >
                <option value="ALL">All Hostels (Campus-wide)</option>
                {summaryData?.hostels.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name} ({h.code})
                  </option>
                ))}
              </select>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="bg-white/10 text-white border-white/20 hover:bg-white/20"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={handleLogout}
              className="bg-rose-500/20 text-rose-200 border-rose-400/30 hover:bg-rose-500/30"
            >
              <LogOut className="w-3.5 h-3.5 mr-1.5" />
              Sign Out
            </Button>
          </div>
        </div>

        {/* Global Admin Details Bar */}
        <div className="mt-6 pt-4 border-t border-white/10 flex flex-wrap gap-4 text-xs text-slate-300">
          <div>
            <span className="text-[10px] text-slate-400 block uppercase font-semibold">Active Admin</span>
            <span className="font-bold text-white">{user?.email || 'admin@rajalakshmi.edu.in'}</span>
          </div>
          <div className="h-6 w-px bg-white/10 my-auto hidden sm:block" />
          <div>
            <span className="text-[10px] text-slate-400 block uppercase font-semibold">Hostels Covered</span>
            <span className="font-bold text-white">Habitat (Boys), Thandalam (Boys), Girls Hostel</span>
          </div>
          <div className="h-6 w-px bg-white/10 my-auto hidden sm:block" />
          <div>
            <span className="text-[10px] text-slate-400 block uppercase font-semibold">System Integrity</span>
            <span className="font-bold text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              Role Guard & Storage Enforced
            </span>
          </div>
        </div>
      </div>

      {/* ── Success and Error Banners ────────────────────────────────────── */}
      {resolveSuccessMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-medium flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <span>{resolveSuccessMsg}</span>
          </div>
          <button
            onClick={() => setResolveSuccessMsg(null)}
            className="text-xs text-emerald-600 hover:text-emerald-800 font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-medium flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-rose-600 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-xs text-rose-600 hover:text-rose-800 font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ── Navigation Tabs ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 bg-white p-1.5 rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'overview'
              ? 'bg-water-700 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Activity className="w-4 h-4" />
          Overview & Analytics
        </button>

        <button
          onClick={() => setActiveTab('orders')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'orders'
              ? 'bg-water-700 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Shirt className="w-4 h-4" />
          Laundry Orders
        </button>

        <button
          onClick={() => setActiveTab('complaints')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'complaints'
              ? 'bg-water-700 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          Complaints Management
          {summaryData?.summary.underReviewComplaints ? (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-rose-500 text-white font-black">
              {summaryData.summary.underReviewComplaints}
            </span>
          ) : null}
        </button>

        <button
          onClick={() => setActiveTab('storage')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'storage'
              ? 'bg-water-700 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Warehouse className="w-4 h-4" />
          Storage Capacity
        </button>

        <button
          onClick={() => setActiveTab('directory')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'directory'
              ? 'bg-water-700 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Users className="w-4 h-4" />
          Students & Staff
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'audit'
              ? 'bg-water-700 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <History className="w-4 h-4" />
          Audit Logs
        </button>
      </div>

      {/* ── Tab Content Loading State ────────────────────────────────────── */}
      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center">
          <LoadingSpinner text="Retrieving operational data from database..." />
        </div>
      ) : (
        <>
          {/* ═══════════════════════════════════════════════════════════════════
              TAB 1: OVERVIEW & ANALYTICS
             ═══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'overview' && summaryData && (
            <div className="space-y-6">
              {/* Summary Metric Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Card className="border-slate-200">
                  <div className="flex items-center justify-between text-slate-500 mb-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Students</span>
                    <Users className="w-4 h-4 text-water-600" />
                  </div>
                  <div className="text-2xl font-black text-slate-900">
                    {summaryData.summary.totalStudents}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Enrolled across campus</div>
                </Card>

                <Card className="border-slate-200">
                  <div className="flex items-center justify-between text-slate-500 mb-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Staff</span>
                    <Building className="w-4 h-4 text-water-600" />
                  </div>
                  <div className="text-2xl font-black text-slate-900">
                    {summaryData.summary.totalStaff}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Assigned operators</div>
                </Card>

                <Card className="border-slate-200">
                  <div className="flex items-center justify-between text-slate-500 mb-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Today's Bookings</span>
                    <Calendar className="w-4 h-4 text-water-600" />
                  </div>
                  <div className="text-2xl font-black text-slate-900">
                    {summaryData.summary.todayBookings}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Scheduled for today</div>
                </Card>

                <Card className="border-slate-200">
                  <div className="flex items-center justify-between text-slate-500 mb-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider">In Progress</span>
                    <Clock className="w-4 h-4 text-amber-500" />
                  </div>
                  <div className="text-2xl font-black text-amber-600">
                    {summaryData.summary.inProgressOrders}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Washing & processing</div>
                </Card>

                <Card className="border-slate-200">
                  <div className="flex items-center justify-between text-slate-500 mb-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Completed</span>
                    <Package className="w-4 h-4 text-water-600" />
                  </div>
                  <div className="text-2xl font-black text-water-700">
                    {summaryData.summary.completedOrders}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Awaiting student pickup</div>
                </Card>

                <Card className="border-slate-200">
                  <div className="flex items-center justify-between text-slate-500 mb-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Verified Pickups</span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div className="text-2xl font-black text-emerald-600">
                    {summaryData.summary.verifiedOrders}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Completed cycles</div>
                </Card>

                <Card className="border-slate-200">
                  <div className="flex items-center justify-between text-slate-500 mb-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Under Review</span>
                    <AlertTriangle className="w-4 h-4 text-rose-500" />
                  </div>
                  <div className="text-2xl font-black text-rose-600">
                    {summaryData.summary.underReviewComplaints}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Open student complaints</div>
                </Card>

                <Card className="border-slate-200">
                  <div className="flex items-center justify-between text-slate-500 mb-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Storage Usage</span>
                    <Warehouse className="w-4 h-4 text-slate-600" />
                  </div>
                  <div className="text-2xl font-black text-slate-900">
                    {summaryData.summary.storageUtilizationPercent}%
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {summaryData.summary.occupiedStorageLocations} / {summaryData.summary.totalStorageLocations} Shelves
                  </div>
                </Card>
              </div>

              {/* 3 Hostels Comparative Overview */}
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Building className="w-4 h-4 text-water-700" />
                  Hostel Operations Breakdown
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {summaryData.hostels.map((hostel) => (
                    <Card
                      key={hostel.id}
                      className={`border-slate-200 hover:shadow-md transition-all ${
                        selectedHostel === hostel.id ? 'ring-2 ring-water-500 bg-water-50/20' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                        <div>
                          <h4 className="text-base font-bold text-slate-900">{hostel.name}</h4>
                          <span className="text-xs text-slate-500">{hostel.description || hostel.code}</span>
                        </div>
                        <span className="text-xs font-bold px-2 py-0.5 rounded bg-water-50 text-water-700 border border-water-200">
                          {hostel.code}
                        </span>
                      </div>

                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between py-1 border-b border-slate-100">
                          <span className="text-slate-600">Students Registered</span>
                          <span className="font-bold text-slate-900">{hostel.studentCount}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-100">
                          <span className="text-slate-600">Staff Assigned</span>
                          <span className="font-bold text-slate-900">{hostel.staffCount}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-100">
                          <span className="text-slate-600">Today's Bookings</span>
                          <span className="font-bold text-slate-900">{hostel.todayBookingsCount}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-100">
                          <span className="text-slate-600">Active Laundry</span>
                          <span className="font-bold text-amber-600">
                            {hostel.inProgressCount} in progress
                          </span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-100">
                          <span className="text-slate-600">Awaiting Pickup</span>
                          <span className="font-bold text-water-700">
                            {hostel.completedCount} ready
                          </span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-100">
                          <span className="text-slate-600">Open Complaints</span>
                          <span className={`font-bold ${hostel.underReviewComplaintsCount > 0 ? 'text-rose-600' : 'text-slate-800'}`}>
                            {hostel.underReviewComplaintsCount}
                          </span>
                        </div>
                        <div className="pt-2">
                          <div className="flex justify-between text-[11px] font-semibold text-slate-600 mb-1">
                            <span>Storage Occupancy</span>
                            <span>{hostel.storageOccupied} / {hostel.storageTotal} ({hostel.storageUtilizationPercent}%)</span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className="h-full bg-water-600 rounded-full transition-all"
                              style={{ width: `${hostel.storageUtilizationPercent}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Demand Insights & 7-Day Activity Trends */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Descriptive Real-Data Insights */}
                <Card className="border-slate-200">
                  <div className="flex items-center gap-2 mb-4">
                    <Sparkles className="w-5 h-5 text-water-600" />
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                        Operational Demand Insights
                      </h4>
                      <p className="text-xs text-slate-500">Computed transparently from database activity</p>
                    </div>
                  </div>

                  <div className="space-y-4 text-xs">
                    <div className="p-3 rounded-xl bg-water-50/50 border border-water-100 flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-water-100 text-water-800 mt-0.5">
                        <Building className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 text-sm">
                          Busiest Hostel: {summaryData.insights.busiestHostel}
                        </div>
                        <div className="text-slate-600 mt-0.5">
                          Accounts for the highest volume of laundry submissions on campus.
                        </div>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-water-50/50 border border-water-100 flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-water-100 text-water-800 mt-0.5">
                        <Clock className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 text-sm">
                          Peak Booking Slot: {summaryData.insights.peakSlotTime}
                        </div>
                        <div className="text-slate-600 mt-0.5">
                          Consistently registers the earliest capacity exhaustion among students.
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Lifetime Orders</span>
                        <span className="text-lg font-black text-slate-900">{summaryData.insights.totalOrdersAllTime}</span>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Average Clothes / Order</span>
                        <span className="text-lg font-black text-slate-900">{summaryData.insights.avgClothesPerOrder} items</span>
                      </div>
                    </div>
                  </div>
                </Card>

                {/* 7-Day Trend Chart */}
                <Card className="border-slate-200">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-water-600" />
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                          7-Day Booking Trends
                        </h4>
                        <p className="text-xs text-slate-500">Daily intake load across hostels</p>
                      </div>
                    </div>
                  </div>

                  <div className="h-44 flex items-end justify-between gap-2 pt-6 pb-2 px-2">
                    {summaryData.insights.recent7DaysTrends.map((d) => {
                      const maxVal = Math.max(...summaryData.insights.recent7DaysTrends.map((x) => x.count), 5);
                      const heightPercent = Math.max(12, Math.round((d.count / maxVal) * 100));
                      const isToday = d.date === todayDateStr;

                      return (
                        <div key={d.date} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
                          <span className="text-[11px] font-bold text-slate-700 opacity-80 group-hover:opacity-100">
                            {d.count}
                          </span>
                          <div
                            className={`w-full max-w-[36px] rounded-t-lg transition-all ${
                              isToday ? 'bg-water-700 shadow-md' : 'bg-water-300 hover:bg-water-400'
                            }`}
                            style={{ height: `${heightPercent}%` }}
                          />
                          <span className={`text-[10px] font-semibold ${isToday ? 'text-water-700 font-bold' : 'text-slate-400'}`}>
                            {d.date.slice(5)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              </div>

              {/* Today's Slots Capacity Table */}
              <Card className="border-slate-200">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                      Today's Slot Utilization ({todayDateStr})
                    </h4>
                    <p className="text-xs text-slate-500">Live booking capacity monitoring</p>
                  </div>
                </div>

                {todaySlots.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-500">
                    No active slots configured for today.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                          <th className="py-2.5 px-3">Hostel</th>
                          <th className="py-2.5 px-3">Slot Time</th>
                          <th className="py-2.5 px-3 text-center">Booked</th>
                          <th className="py-2.5 px-3 text-center">Capacity</th>
                          <th className="py-2.5 px-3 text-center">Remaining</th>
                          <th className="py-2.5 px-3">Utilization</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {todaySlots.map((slot) => (
                          <tr key={slot.id} className="hover:bg-slate-50/70">
                            <td className="py-2.5 px-3 font-bold text-slate-900">
                              {slot.hostel.name}
                            </td>
                            <td className="py-2.5 px-3 text-slate-700 font-medium">
                              {slot.startTime} – {slot.endTime}
                            </td>
                            <td className="py-2.5 px-3 text-center font-bold text-slate-900">
                              {slot.bookedCount}
                            </td>
                            <td className="py-2.5 px-3 text-center text-slate-600">
                              {slot.capacity}
                            </td>
                            <td className="py-2.5 px-3 text-center font-semibold text-emerald-600">
                              {slot.remainingCapacity}
                            </td>
                            <td className="py-2.5 px-3 w-40">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${
                                      slot.utilizationPercent >= 80 ? 'bg-rose-500' : 'bg-water-600'
                                    }`}
                                    style={{ width: `${slot.utilizationPercent}%` }}
                                  />
                                </div>
                                <span className="text-[10px] font-bold text-slate-600 w-8">
                                  {slot.utilizationPercent}%
                                </span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
              TAB 2: LAUNDRY ORDERS MONITORING
             ═══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'orders' && (
            <div className="space-y-4">
              {/* Filter and Search Bar */}
              <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search by student name or ID..."
                    value={orderSearch}
                    onChange={(e) => setOrderSearch(e.target.value)}
                    className="w-full text-xs pl-9 pr-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-water-500"
                  />
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
                  <div className="flex items-center gap-1.5 text-xs text-slate-600">
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span>Status:</span>
                    <select
                      value={orderStatusFilter}
                      onChange={(e) => setOrderStatusFilter(e.target.value)}
                      className="text-xs font-semibold rounded-lg border border-slate-200 px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-water-500 cursor-pointer"
                    >
                      <option value="ALL">All Statuses</option>
                      <option value="BOOKED">Booked</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="COMPLETED">Completed</option>
                      <option value="VERIFIED">Verified</option>
                      <option value="UNDER_REVIEW">Under Review</option>
                      <option value="RESOLVED">Resolved</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-slate-600">
                    <span>Range:</span>
                    <select
                      value={orderDateRange}
                      onChange={(e) => setOrderDateRange(e.target.value)}
                      className="text-xs font-semibold rounded-lg border border-slate-200 px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-water-500 cursor-pointer"
                    >
                      <option value="ALL">All Time</option>
                      <option value="today">Today</option>
                      <option value="7days">Last 7 Days</option>
                      <option value="month">Current Month</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Orders Table */}
              <Card className="border-slate-200 overflow-hidden">
                {orders.length === 0 ? (
                  <div className="text-center py-16 text-slate-500 text-xs">
                    No laundry orders match the selected filters.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] bg-slate-50/50">
                          <th className="py-3 px-3">Student</th>
                          <th className="py-3 px-3">Hostel</th>
                          <th className="py-3 px-3">Slot Schedule</th>
                          <th className="py-3 px-3 text-center">Items</th>
                          <th className="py-3 px-3">Storage (Internal)</th>
                          <th className="py-3 px-3">Status</th>
                          <th className="py-3 px-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {orders.map((o) => (
                          <tr key={o.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-3">
                              <div className="font-bold text-slate-900">{o.student.name}</div>
                              <div className="text-[11px] text-slate-500">{o.student.studentId}</div>
                            </td>
                            <td className="py-3 px-3">
                              <span className="font-semibold text-slate-700">{o.hostel.name}</span>
                            </td>
                            <td className="py-3 px-3 text-slate-600">
                              {o.slot ? (
                                <div>
                                  <div className="font-medium">{o.slot.date}</div>
                                  <div className="text-[11px] text-slate-400">
                                    {o.slot.startTime} – {o.slot.endTime}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-center">
                              <span className="font-bold text-slate-900 px-2 py-0.5 bg-slate-100 rounded-md">
                                {o.itemCount ? `${o.itemCount.totalCount} pcs` : '0 pcs'}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-slate-700">
                              {o.rackShelf ? (
                                <span className="font-semibold text-water-800 bg-water-50 border border-water-200 px-2 py-0.5 rounded text-[11px]">
                                  {o.rackShelf.label}
                                </span>
                              ) : (
                                <span className="text-slate-400 text-[11px]">Unassigned</span>
                              )}
                            </td>
                            <td className="py-3 px-3">
                              {formatStatusBadge(o.status)}
                            </td>
                            <td className="py-3 px-3 text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedOrder(o)}
                                className="text-xs py-1 px-2.5"
                              >
                                View Details
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
              TAB 3: COMPLAINTS MANAGEMENT
             ═══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'complaints' && (
            <div className="space-y-4">
              {/* Complaints Filter */}
              <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Student Complaints Queue</h3>
                  <p className="text-xs text-slate-500">Review reported garment issues and execute resolutions</p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-600 font-semibold">Filter:</span>
                  <select
                    value={complaintStatusFilter}
                    onChange={(e) => setComplaintStatusFilter(e.target.value)}
                    className="text-xs font-semibold rounded-lg border border-slate-200 px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-water-500 cursor-pointer"
                  >
                    <option value="ALL">All Complaints</option>
                    <option value="UNDER_REVIEW">Under Review (Open)</option>
                    <option value="RESOLVED">Resolved</option>
                  </select>
                </div>
              </div>

              {/* Complaints List */}
              <div className="space-y-3">
                {complaints.length === 0 ? (
                  <Card className="border-slate-200 text-center py-16">
                    <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                    <h4 className="text-sm font-bold text-slate-800">No Complaints In Queue</h4>
                    <p className="text-xs text-slate-500 mt-0.5">All student laundry issues are resolved.</p>
                  </Card>
                ) : (
                  complaints.map((c) => (
                    <Card
                      key={c.id}
                      className={`border transition-all ${
                        c.status === 'UNDER_REVIEW'
                          ? 'border-amber-200 bg-amber-50/10'
                          : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 mb-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={`p-1.5 rounded-lg ${
                              c.status === 'UNDER_REVIEW' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            <AlertTriangle className="w-4 h-4" />
                          </span>
                          <div>
                            <span className="text-sm font-bold text-slate-900">
                              {formatComplaintTypeLabel(c.type)}
                            </span>
                            <span className="text-xs text-slate-400 ml-2">
                              Reported on {new Date(c.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {c.status === 'UNDER_REVIEW' ? (
                            <Badge variant="amber" size="sm">Under Review</Badge>
                          ) : (
                            <Badge variant="emerald" size="sm">Resolved</Badge>
                          )}

                          {c.status === 'UNDER_REVIEW' && (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => setSelectedComplaint(c)}
                              className="text-xs py-1"
                            >
                              Resolve Issue
                            </Button>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs mb-3">
                        <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                          <span className="text-slate-400 block text-[10px] font-bold uppercase">Student</span>
                          <span className="font-bold text-slate-900">{c.student.name}</span>
                          <span className="text-slate-500 block text-[11px]">
                            {c.student.studentId} • {c.student.hostel.name}
                          </span>
                        </div>

                        <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                          <span className="text-slate-400 block text-[10px] font-bold uppercase">Order Information</span>
                          <span className="font-bold text-slate-900">
                            {c.order.itemCount ? `${c.order.itemCount.totalCount} clothes total` : 'N/A'}
                          </span>
                          <span className="text-slate-500 block text-[11px]">
                            Completed: {c.order.completedAt ? new Date(c.order.completedAt).toLocaleTimeString() : 'N/A'}
                          </span>
                        </div>

                        <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                          <span className="text-slate-400 block text-[10px] font-bold uppercase">Storage Status</span>
                          <span className="font-bold text-water-800">
                            {c.order.rackShelf ? c.order.rackShelf.label : 'None'}
                          </span>
                          <span className="text-slate-500 block text-[11px]">
                            {c.status === 'UNDER_REVIEW' ? 'Retained during review' : 'Storage released'}
                          </span>
                        </div>
                      </div>

                      {c.additionalDetails && (
                        <div className="p-3 rounded-lg bg-slate-50 text-xs text-slate-700 border border-slate-100">
                          <span className="font-bold text-slate-800 block mb-0.5">Student's Note:</span>
                          "{c.additionalDetails}"
                        </div>
                      )}

                      {c.resolvedAt && (
                        <div className="mt-2 text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Resolved by administrator on {new Date(c.resolvedAt).toLocaleString()}
                        </div>
                      )}
                    </Card>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
              TAB 4: STORAGE CAPACITY & AUDIT
             ═══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'storage' && storageData && (
            <div className="space-y-6">
              {/* Storage Stats Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Card className="border-slate-200">
                  <span className="text-[11px] font-bold uppercase text-slate-400">Total Capacity</span>
                  <div className="text-2xl font-black text-slate-900">{storageData.stats.total}</div>
                  <span className="text-[11px] text-slate-500">Rack / shelf locations</span>
                </Card>
                <Card className="border-slate-200">
                  <span className="text-[11px] font-bold uppercase text-slate-400">Occupied</span>
                  <div className="text-2xl font-black text-amber-600">{storageData.stats.occupied}</div>
                  <span className="text-[11px] text-slate-500">Holding student laundry</span>
                </Card>
                <Card className="border-slate-200">
                  <span className="text-[11px] font-bold uppercase text-slate-400">Available</span>
                  <div className="text-2xl font-black text-emerald-600">{storageData.stats.available}</div>
                  <span className="text-[11px] text-slate-500">Ready for incoming intake</span>
                </Card>
                <Card className="border-slate-200">
                  <span className="text-[11px] font-bold uppercase text-slate-400">Utilization</span>
                  <div className="text-2xl font-black text-water-700">{storageData.stats.utilizationPercent}%</div>
                  <span className="text-[11px] text-slate-500">Campus occupancy rate</span>
                </Card>
              </div>

              {/* Racks Visual Grid */}
              <Card className="border-slate-200">
                <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-1">
                  Physical Storage Racks Layout
                </h4>
                <p className="text-xs text-slate-500 mb-4">
                  Occupancy state across designated hostel shelves (remains occupied until final verification).
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {storageData.storage.map((loc) => (
                    <div
                      key={loc.id}
                      className={`p-3 rounded-xl border text-xs transition-all ${
                        loc.isOccupied
                          ? 'bg-amber-50/60 border-amber-300 text-amber-950 shadow-sm'
                          : 'bg-slate-50 border-slate-200 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-extrabold uppercase text-slate-500">
                          {loc.hostel.code}
                        </span>
                        <span
                          className={`w-2 h-2 rounded-full ${
                            loc.isOccupied ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                        />
                      </div>
                      <div className="font-extrabold text-sm text-slate-900 mb-1">{loc.label}</div>

                      {loc.isOccupied && loc.occupiedBy ? (
                        <div className="pt-1.5 border-t border-amber-200/60 text-[11px]">
                          <div className="font-bold text-slate-900 truncate">
                            {loc.occupiedBy.studentName}
                          </div>
                          <div className="text-slate-500 text-[10px]">
                            {loc.occupiedBy.studentId}
                          </div>
                          <span className="inline-block mt-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-200 text-amber-900">
                            {loc.occupiedBy.status}
                          </span>
                        </div>
                      ) : (
                        <div className="text-[11px] text-emerald-700 font-semibold mt-2">
                          Available
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
              TAB 5: STUDENTS & STAFF DIRECTORY
             ═══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'directory' && (
            <div className="space-y-6">
              {/* Students Section */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Student Roster & Usage Monitoring</h3>
                    <p className="text-xs text-slate-500">Tracking compliance with the 4-use monthly quota</p>
                  </div>

                  <div className="relative w-full sm:w-64">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search students..."
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      className="w-full text-xs pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-water-500"
                    />
                  </div>
                </div>

                <Card className="border-slate-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] bg-slate-50/50">
                          <th className="py-2.5 px-3">Student Name</th>
                          <th className="py-2.5 px-3">ID / Department</th>
                          <th className="py-2.5 px-3">Hostel</th>
                          <th className="py-2.5 px-3">Email Address</th>
                          <th className="py-2.5 px-3 text-center">Monthly Quota (Max 4)</th>
                          <th className="py-2.5 px-3 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {students.map((st) => (
                          <tr key={st.id} className="hover:bg-slate-50/80">
                            <td className="py-2.5 px-3 font-bold text-slate-900">{st.name}</td>
                            <td className="py-2.5 px-3 text-slate-600">
                              <div>{st.studentId}</div>
                              <div className="text-[10px] text-slate-400">{st.department || 'Undergraduate'}</div>
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-slate-700">{st.hostel.name}</td>
                            <td className="py-2.5 px-3 text-slate-600">{st.email}</td>
                            <td className="py-2.5 px-3">
                              <div className="flex items-center justify-center gap-2">
                                <div className="w-20 h-2 rounded-full bg-slate-100 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${
                                      st.monthlyUsage.used >= 4
                                        ? 'bg-rose-500'
                                        : st.monthlyUsage.used >= 3
                                        ? 'bg-amber-500'
                                        : 'bg-water-600'
                                    }`}
                                    style={{ width: `${(st.monthlyUsage.used / 4) * 100}%` }}
                                  />
                                </div>
                                <span className="font-bold text-slate-800 text-[11px]">
                                  {st.monthlyUsage.used}/4
                                </span>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <Badge variant="emerald" size="sm">Active</Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>

              {/* Staff Operators Section */}
              <div className="space-y-3">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <h3 className="text-sm font-bold text-slate-900">Hostel Laundry Staff Operators</h3>
                  <p className="text-xs text-slate-500">Authorized personnel responsible for laundry intake & completion</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {staffList.map((sf) => (
                    <Card key={sf.id} className="border-slate-200">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-water-100 text-water-800 flex items-center justify-center font-bold text-sm">
                          {sf.name.charAt(0)}
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-slate-900">{sf.name}</h4>
                          <span className="text-[11px] text-slate-500 block">{sf.staffId}</span>
                          <span className="text-xs font-semibold text-water-700">{sf.hostel.name}</span>
                        </div>
                      </div>
                      <div className="mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-600">
                        Email: {sf.email}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
              TAB 6: AUDIT LOGS
             ═══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'audit' && (
            <Card className="border-slate-200">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                    System Audit Trail
                  </h4>
                  <p className="text-xs text-slate-500">Immutable trace of intakes, completions, verifications, and resolutions</p>
                </div>
                <Badge variant="slate" size="sm">Audit Protection Active</Badge>
              </div>

              {auditLogs.length === 0 ? (
                <div className="text-center py-12 text-xs text-slate-500">
                  No audit logs recorded yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] bg-slate-50/50">
                        <th className="py-2.5 px-3">Timestamp</th>
                        <th className="py-2.5 px-3">Actor</th>
                        <th className="py-2.5 px-3">Action</th>
                        <th className="py-2.5 px-3">Entity</th>
                        <th className="py-2.5 px-3">Details / Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                      {auditLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50">
                          <td className="py-2 px-3 text-slate-500 whitespace-nowrap">
                            {new Date(log.createdAt).toLocaleString()}
                          </td>
                          <td className="py-2 px-3">
                            <span className="font-bold text-slate-900">{log.actor.email}</span>
                            <span className="text-[10px] text-slate-400 ml-1">({log.actor.role})</span>
                          </td>
                          <td className="py-2 px-3">
                            <span className="font-bold text-water-800 bg-water-50 px-1.5 py-0.5 rounded border border-water-200 text-[10px]">
                              {log.action}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-slate-600 font-sans">
                            {log.entityType}
                          </td>
                          <td className="py-2 px-3 text-slate-700 font-sans">
                            {log.reason || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}
        </>
      )}

      {/* ── MODAL: RESOLVE COMPLAINT ─────────────────────────────────────── */}
      {selectedComplaint && (
        <Modal
          isOpen={true}
          onClose={() => !isResolving && setSelectedComplaint(null)}
          title="Resolve Student Complaint"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 space-y-1">
              <div className="font-bold text-sm">
                Issue: {formatComplaintTypeLabel(selectedComplaint.type)}
              </div>
              <div>Student: <strong>{selectedComplaint.student.name}</strong> ({selectedComplaint.student.studentId})</div>
              <div>Hostel: {selectedComplaint.student.hostel.name}</div>
            </div>

            {selectedComplaint.additionalDetails && (
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <span className="font-bold text-slate-700 block mb-0.5">Reported Details:</span>
                "{selectedComplaint.additionalDetails}"
              </div>
            )}

            <div className="p-3 rounded-lg bg-water-50/50 border border-water-100 text-slate-700 space-y-1">
              <span className="font-bold text-slate-900 block mb-1">Administrative Resolution Impact:</span>
              <p>• The complaint status will transition to <strong>RESOLVED</strong> with the current server timestamp.</p>
              <p>• Associated physical storage location (rack/shelf) will be automatically released for future student orders.</p>
              <p>• The student's laundry history will permanently reflect the resolved state.</p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedComplaint(null)}
                disabled={isResolving}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleResolveComplaint}
                disabled={isResolving}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {isResolving ? 'Resolving...' : 'Confirm Resolution'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── MODAL: ORDER DETAILS INSPECTION ──────────────────────────────── */}
      {selectedOrder && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedOrder(null)}
          title={`Order #${selectedOrder.id.slice(-8).toUpperCase()}`}
        >
          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Status</span>
                {formatStatusBadge(selectedOrder.status)}
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Hostel</span>
                <span className="font-bold text-slate-900">{selectedOrder.hostel.name}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Student</span>
                <div className="font-bold text-slate-900">{selectedOrder.student.name}</div>
                <div className="text-slate-500">{selectedOrder.student.studentId}</div>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Storage Allocation</span>
                <div className="font-bold text-water-800">
                  {selectedOrder.rackShelf ? selectedOrder.rackShelf.label : 'None'}
                </div>
                <div className="text-slate-500 text-[10px]">
                  {selectedOrder.rackShelf ? `Rack ${selectedOrder.rackShelf.rackNumber}, Shelf ${selectedOrder.rackShelf.shelfNumber}` : 'Pending assignment'}
                </div>
              </div>
            </div>

            {selectedOrder.itemCount && (
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Clothes Breakdown</span>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-1.5 bg-white rounded border border-slate-200">
                    <span className="text-[10px] text-slate-400 block">T-Shirts/Shirts</span>
                    <span className="font-bold text-slate-800 text-sm">{selectedOrder.itemCount.tShirtShirtCount}</span>
                  </div>
                  <div className="p-1.5 bg-white rounded border border-slate-200">
                    <span className="text-[10px] text-slate-400 block">Pants/Tracks</span>
                    <span className="font-bold text-slate-800 text-sm">{selectedOrder.itemCount.pantsTrackCount}</span>
                  </div>
                  <div className="p-1.5 bg-water-50 rounded border border-water-200 text-water-800">
                    <span className="text-[10px] text-water-600 block">Total Items</span>
                    <span className="font-black text-sm">{selectedOrder.itemCount.totalCount}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-1.5 pt-2 border-t border-slate-100 text-slate-600">
              <div className="flex justify-between">
                <span>Intake Staff:</span>
                <span className="font-semibold text-slate-900">{selectedOrder.staff?.name || 'Unassigned'}</span>
              </div>
              {selectedOrder.startedAt && (
                <div className="flex justify-between">
                  <span>Processing Started:</span>
                  <span className="font-medium text-slate-900">{new Date(selectedOrder.startedAt).toLocaleString()}</span>
                </div>
              )}
              {selectedOrder.completedAt && (
                <div className="flex justify-between">
                  <span>Marked Completed:</span>
                  <span className="font-medium text-slate-900">{new Date(selectedOrder.completedAt).toLocaleString()}</span>
                </div>
              )}
              {selectedOrder.verifiedAt && (
                <div className="flex justify-between">
                  <span>Student Verified:</span>
                  <span className="font-medium text-emerald-700 font-bold">{new Date(selectedOrder.verifiedAt).toLocaleString()}</span>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <Button variant="secondary" size="sm" onClick={() => setSelectedOrder(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
