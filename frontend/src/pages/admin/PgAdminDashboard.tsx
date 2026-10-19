import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import {
  AdminSummaryMetrics,
  AdminHostelSummary,
  AdminDemandInsights,
  AdminOrder,
  AdminTodaySlot,
  AdminStudent,
  AdminAuditLog,
  AdminBooking,
  AdminHistoryItem,
  AdminNotificationItem,
  Hostel,
} from '../../types';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { PageTransition } from '../../components/common/PageTransition';
import { tabContentVariants } from '../../utils/animations';
import {
  Home,
  Users,
  Shirt,
  Calendar,
  Clock,
  Layers,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  LogOut,
  Search,
  Filter,
  History,
  Bell,
  TrendingUp,
  Building2,
  Sparkles,
} from 'lucide-react';

type PgTab = 'overview' | 'residents' | 'bookings' | 'orders' | 'slots' | 'history';

export const PgAdminDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Active state
  const [activeTab, setActiveTab] = useState<PgTab>('overview');
  const [selectedFacility, setSelectedFacility] = useState<string>('ALL');
  const [facilities, setFacilities] = useState<Hostel[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Tab Data States
  const [summaryData, setSummaryData] = useState<{
    summary: AdminSummaryMetrics;
    hostels: AdminHostelSummary[];
    insights: AdminDemandInsights;
  } | null>(null);

  // Residents
  const [residents, setResidents] = useState<AdminStudent[]>([]);
  const [residentSearch, setResidentSearch] = useState<string>('');

  // Bookings
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [bookingStatusFilter, setBookingStatusFilter] = useState<string>('ALL');
  const [bookingSearch, setBookingSearch] = useState<string>('');
  const [selectedBooking, setSelectedBooking] = useState<AdminBooking | null>(null);

  // Orders
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('ALL');
  const [orderSearch, setOrderSearch] = useState<string>('');
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null);

  // Slots
  const [slots, setSlots] = useState<AdminTodaySlot[]>([]);
  const [slotDateStr, setSlotDateStr] = useState<string>('');
  const [selectedSlotDate, setSelectedSlotDate] = useState<string>('');

  // History & Notifications & Audit
  const [historyList, setHistoryList] = useState<AdminHistoryItem[]>([]);
  const [historySearch, setHistorySearch] = useState<string>('');
  const [notifications, setNotifications] = useState<AdminNotificationItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [subHistoryTab, setSubHistoryTab] = useState<'history' | 'notifications' | 'audit'>('history');

  // Load facilities on mount
  useEffect(() => {
    async function fetchPgFacilities() {
      try {
        const res = await api.getHostels({ environment: 'PG_SHARED' });
        if (res.data) {
          setFacilities(res.data);
        }
      } catch (err: any) {
        console.error('Failed to load PG facilities:', err);
      }
    }
    fetchPgFacilities();
  }, []);

  // ── Data Fetchers ──────────────────────────────────────────────────────────

  const fetchOverview = useCallback(async () => {
    try {
      const res = await api.getAdminSummary(selectedFacility);
      if (res.success) {
        setSummaryData({
          summary: res.summary,
          hostels: res.hostels,
          insights: res.insights,
        });
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to fetch PG summary metrics.');
    }
  }, [selectedFacility]);

  const fetchResidents = useCallback(async () => {
    try {
      const res = await api.getAdminStudents({
        hostelId: selectedFacility,
        search: residentSearch || undefined,
      });
      if (res.success) {
        setResidents(res.students);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to fetch PG residents.');
    }
  }, [selectedFacility, residentSearch]);

  const fetchBookings = useCallback(async () => {
    try {
      const res = await api.getAdminBookings({
        hostelId: selectedFacility,
        status: bookingStatusFilter !== 'ALL' ? bookingStatusFilter : undefined,
        search: bookingSearch || undefined,
      });
      if (res.success) {
        setBookings(res.bookings);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to fetch PG bookings.');
    }
  }, [selectedFacility, bookingStatusFilter, bookingSearch]);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await api.getAdminOrders({
        hostelId: selectedFacility,
        status: orderStatusFilter !== 'ALL' ? orderStatusFilter : undefined,
        search: orderSearch || undefined,
      });
      if (res.success) {
        setOrders(res.orders);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to fetch PG laundry orders.');
    }
  }, [selectedFacility, orderStatusFilter, orderSearch]);

  const fetchSlots = useCallback(async () => {
    try {
      const res = await api.getAdminTodaySlots(selectedFacility, selectedSlotDate || undefined);
      if (res.success) {
        setSlots(res.slots);
        setSlotDateStr(res.date);
        if (!selectedSlotDate) {
          setSelectedSlotDate(res.date);
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to fetch PG slots.');
    }
  }, [selectedFacility, selectedSlotDate]);

  const fetchHistoryAndLogs = useCallback(async () => {
    try {
      const [histRes, notifRes, auditRes] = await Promise.all([
        api.getAdminHistory({ hostelId: selectedFacility, search: historySearch || undefined }),
        api.getAdminNotifications({ limit: 50 }),
        api.getAdminAuditLogs({ limit: 50 }),
      ]);
      if (histRes.success) setHistoryList(histRes.history);
      if (notifRes.success) setNotifications(notifRes.notifications);
      if (auditRes.success) setAuditLogs(auditRes.logs);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to fetch PG history and audit logs.');
    }
  }, [selectedFacility, historySearch]);

  // Main loader dispatcher based on active tab
  const loadActiveTabData = useCallback(async () => {
    setErrorMessage(null);
    switch (activeTab) {
      case 'overview':
        await fetchOverview();
        break;
      case 'residents':
        await fetchResidents();
        break;
      case 'bookings':
        await fetchBookings();
        break;
      case 'orders':
        await fetchOrders();
        break;
      case 'slots':
        await fetchSlots();
        break;
      case 'history':
        await fetchHistoryAndLogs();
        break;
    }
  }, [activeTab, fetchOverview, fetchResidents, fetchBookings, fetchOrders, fetchSlots, fetchHistoryAndLogs]);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    loadActiveTabData().finally(() => {
      if (isMounted) setIsLoading(false);
    });
    return () => {
      isMounted = false;
    };
  }, [loadActiveTabData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadActiveTabData();
    setIsRefreshing(false);
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch {
      navigate('/login');
    }
  };

  // Helper date formatters
  const formatDateTime = (isoString?: string | null) => {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      return d.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  const formatWeight = (grams?: number | null) => {
    if (grams === undefined || grams === null) return '—';
    return `${(grams / 1000).toFixed(2)} kg (${grams}g)`;
  };

  return (
    <PageTransition className="max-w-7xl mx-auto pb-16 px-4 sm:px-6 lg:px-8">
      {/* Top Header */}
      <div className="pt-6 pb-4 border-b border-slate-200">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase tracking-wider">
                <Home className="w-3 h-3 text-emerald-600" />
                PG_SHARED Environment
              </span>
              <span className="text-xs text-slate-400">•</span>
              <span className="text-xs font-medium text-slate-500">Co-Living Laundry Operations</span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              PG Hostel Admin Portal
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Logged in as <span className="font-semibold text-slate-800">{user?.email}</span> (PG Operations Administrator)
            </p>
          </div>

          {/* Top Actions & Facility Filter */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 shadow-xs">
              <Building2 className="w-4 h-4 text-emerald-600" />
              <label htmlFor="pg-facility-select" className="text-xs font-semibold text-slate-700">
                Facility:
              </label>
              <select
                id="pg-facility-select"
                value={selectedFacility}
                onChange={(e) => setSelectedFacility(e.target.value)}
                className="text-xs font-semibold text-slate-800 bg-transparent border-none focus:outline-none cursor-pointer"
              >
                <option value="ALL">All PG Facilities (4)</option>
                {facilities.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              isLoading={isRefreshing}
              className="border-slate-200 hover:bg-slate-50 text-slate-700 text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="border-rose-200 hover:bg-rose-50 text-rose-700 text-xs"
            >
              <LogOut className="w-3.5 h-3.5 mr-1" />
              Sign Out
            </Button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 mt-6 overflow-x-auto no-scrollbar border-b border-slate-200">
          {[
            { id: 'overview', label: 'Overview', icon: TrendingUp },
            { id: 'residents', label: 'Residents', icon: Users },
            { id: 'bookings', label: 'Bookings & Batches', icon: Calendar },
            { id: 'orders', label: 'Laundry Orders', icon: Shirt },
            { id: 'slots', label: 'Slot Capacity', icon: Clock },
            { id: 'history', label: 'History & Audit', icon: History },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as PgTab)}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-all border-b-2 whitespace-nowrap ${
                  isActive
                    ? 'border-emerald-600 text-emerald-800 bg-emerald-50/60 font-bold'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-700' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Error alert */}
      {errorMessage && (
        <div className="mt-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-xs font-semibold underline hover:text-rose-900"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <div className="mt-6">
        {isLoading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3">
            <LoadingSpinner size="lg" />
            <p className="text-xs font-medium text-slate-500 animate-pulse">
              Loading PG data from live database...
            </p>
          </div>
        ) : (
          <motion.div
            key={activeTab}
            variants={tabContentVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            {/* ── TAB 1: OVERVIEW ────────────────────────────────────────── */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Metric Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card className="border-slate-200 bg-gradient-to-br from-white to-emerald-50/40 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-500">Total PG Residents</span>
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                        <Users className="w-4 h-4" />
                      </div>
                    </div>
                    <p className="text-2xl font-black text-slate-900 mt-2">
                      {summaryData?.summary.totalStudents ?? 0}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                      <span className="font-semibold text-emerald-700">Oak, Maple, Pine, Cedar</span>
                    </p>
                  </Card>

                  <Card className="border-slate-200 bg-gradient-to-br from-white to-sky-50/40 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-500">Total Bookings</span>
                      <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center">
                        <Calendar className="w-4 h-4" />
                      </div>
                    </div>
                    <p className="text-2xl font-black text-slate-900 mt-2">
                      {summaryData?.summary.totalBookings ?? 0}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Active: <span className="font-semibold text-sky-700">{summaryData?.summary.activeBookings ?? 0}</span> • Upcoming: {summaryData?.summary.upcomingBookings ?? 0}
                    </p>
                  </Card>

                  <Card className="border-slate-200 bg-gradient-to-br from-white to-amber-50/40 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-500">Active Wash Cycles</span>
                      <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                        <Shirt className="w-4 h-4" />
                      </div>
                    </div>
                    <p className="text-2xl font-black text-slate-900 mt-2">
                      {summaryData?.summary.inProgressOrders ?? 0}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Self-Service washing in progress
                    </p>
                  </Card>

                  <Card className="border-slate-200 bg-gradient-to-br from-white to-emerald-50/40 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-500">Completed & Verified</span>
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                    </div>
                    <p className="text-2xl font-black text-slate-900 mt-2">
                      {(summaryData?.summary.completedOrders ?? 0) + (summaryData?.summary.verifiedOrders ?? 0)}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Completed: {summaryData?.summary.completedOrders ?? 0} • Verified: {summaryData?.summary.verifiedOrders ?? 0}
                    </p>
                  </Card>
                </div>

                {/* PG Facility Breakdown Table */}
                <Card className="border-slate-200 overflow-hidden">
                  <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                    <div>
                      <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-emerald-600" />
                        PG Facility Operations Breakdown
                      </h2>
                      <p className="text-xs text-slate-500">
                        Operational status by co-living facility
                      </p>
                    </div>
                    <span className="text-xs font-medium text-slate-500">
                      Total Facilities: {summaryData?.hostels.length ?? 0}
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                          <th className="py-2.5 px-4">Facility Name</th>
                          <th className="py-2.5 px-4">Code</th>
                          <th className="py-2.5 px-4 text-center">Residents</th>
                          <th className="py-2.5 px-4 text-center">Total Bookings</th>
                          <th className="py-2.5 px-4 text-center">Active Bookings</th>
                          <th className="py-2.5 px-4 text-center">In Progress</th>
                          <th className="py-2.5 px-4 text-center">Completed</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {summaryData?.hostels.map((h) => (
                          <tr key={h.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-3 px-4 font-bold text-slate-900 flex items-center gap-2">
                              <Home className="w-3.5 h-3.5 text-emerald-600" />
                              {h.name}
                            </td>
                            <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">
                              {h.code}
                            </td>
                            <td className="py-3 px-4 text-center font-semibold text-slate-800">
                              {h.studentCount}
                            </td>
                            <td className="py-3 px-4 text-center text-slate-700">
                              {h.totalBookingsCount ?? h.todayBookingsCount}
                            </td>
                            <td className="py-3 px-4 text-center text-slate-700">
                              <span className="px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 font-semibold text-[11px]">
                                {h.activeBookingsCount ?? 0}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center text-slate-700">
                              {h.inProgressCount}
                            </td>
                            <td className="py-3 px-4 text-center text-emerald-700 font-semibold">
                              {h.completedCount + h.verifiedCount}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>

                {/* Self-Service Architecture Callout */}
                <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 flex items-start gap-3.5">
                  <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 border border-emerald-200">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
                      PG Co-Living Self-Service Laundry Model
                    </h2>
                    <p className="text-xs text-emerald-800 mt-1 leading-relaxed">
                      PG facilities operate on a resident self-service model. Residents scan their garments, choose weight-optimized batches, and directly operate smart laundry units. There are no assigned college laundry staff or staff intake racks in PG hostels.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ── TAB 2: RESIDENTS ───────────────────────────────────────── */}
            {activeTab === 'residents' && (
              <div className="space-y-4">
                {/* Search Bar */}
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="relative flex-1 min-w-[240px] max-w-md">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Search PG resident by name, email, or resident ID..."
                      value={residentSearch}
                      onChange={(e) => setResidentSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <span className="text-xs font-semibold text-slate-500">
                    Showing {residents.length} PG Resident{residents.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Residents Table */}
                <Card className="border-slate-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                          <th className="py-2.5 px-4">Resident</th>
                          <th className="py-2.5 px-4">Resident Identifier</th>
                          <th className="py-2.5 px-4">Assigned PG Facility</th>
                          <th className="py-2.5 px-4 text-center">Monthly Allowance</th>
                          <th className="py-2.5 px-4 text-center">Total Bookings</th>
                          <th className="py-2.5 px-4 text-center">Active Bookings</th>
                          <th className="py-2.5 px-4 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {residents.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="py-8 text-center text-slate-500 text-xs">
                              No PG residents found matching criteria.
                            </td>
                          </tr>
                        ) : (
                          residents.map((r) => (
                            <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                              <td className="py-3 px-4">
                                <span className="font-bold text-slate-900 block">{r.name}</span>
                                <span className="text-[11px] text-slate-500">{r.email}</span>
                              </td>
                              <td className="py-3 px-4 font-mono font-semibold text-slate-700 text-xs">
                                {r.studentId}
                              </td>
                              <td className="py-3 px-4">
                                <span className="inline-flex items-center gap-1 font-semibold text-slate-800">
                                  <Home className="w-3.5 h-3.5 text-emerald-600" />
                                  {r.hostel.name}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <div className="text-[11px]">
                                  <span className="font-semibold text-slate-900">
                                    {r.monthlyUsage.used} / {r.monthlyUsage.max} washes
                                  </span>
                                  <div className="w-20 bg-slate-100 rounded-full h-1.5 mx-auto mt-1">
                                    <div
                                      className="bg-emerald-600 h-1.5 rounded-full"
                                      style={{
                                        width: `${Math.min(100, (r.monthlyUsage.used / r.monthlyUsage.max) * 100)}%`,
                                      }}
                                    />
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-center font-bold text-slate-900">
                                {r.bookingSummary?.totalBookings ?? 0}
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold text-[11px]">
                                  {r.bookingSummary?.activeBookings ?? 0}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800">
                                  Active Resident
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
            )}

            {/* ── TAB 3: BOOKINGS & BATCHES ──────────────────────────────── */}
            {activeTab === 'bookings' && (
              <div className="space-y-4">
                {/* Filter and Search Bar */}
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="relative min-w-[220px]">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        placeholder="Search resident, ID, batch..."
                        value={bookingSearch}
                        onChange={(e) => setBookingSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <div className="flex items-center gap-1.5 text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 shadow-xs">
                      <Filter className="w-3.5 h-3.5 text-slate-400" />
                      <label htmlFor="pg-booking-status-filter" className="font-semibold text-slate-600">
                        Status:
                      </label>
                      <select
                        id="pg-booking-status-filter"
                        value={bookingStatusFilter}
                        onChange={(e) => setBookingStatusFilter(e.target.value)}
                        className="bg-transparent border-none text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer"
                      >
                        <option value="ALL">All Statuses</option>
                        <option value="BOOKED">BOOKED</option>
                        <option value="COMPLETED">COMPLETED</option>
                        <option value="CANCELLED">CANCELLED</option>
                      </select>
                    </div>
                  </div>

                  <span className="text-xs font-semibold text-slate-500">
                    Total Bookings: {bookings.length}
                  </span>
                </div>

                {/* Bookings Table */}
                <Card className="border-slate-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                          <th className="py-2.5 px-4">Resident</th>
                          <th className="py-2.5 px-4">PG Facility</th>
                          <th className="py-2.5 px-4">Booking Created At</th>
                          <th className="py-2.5 px-4">Scheduled Slot Time</th>
                          <th className="py-2.5 px-4 text-center">Batch Info</th>
                          <th className="py-2.5 px-4 text-center">Garments & Weight</th>
                          <th className="py-2.5 px-4 text-center">Status</th>
                          <th className="py-2.5 px-4 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {bookings.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="py-8 text-center text-slate-500 text-xs">
                              No PG bookings found.
                            </td>
                          </tr>
                        ) : (
                          bookings.map((b) => (
                            <tr key={b.id} className="hover:bg-slate-50/70 transition-colors">
                              <td className="py-3 px-4">
                                <span className="font-bold text-slate-900 block">{b.student.name}</span>
                                <span className="text-[11px] text-slate-500 font-mono">
                                  {b.student.studentId}
                                </span>
                              </td>
                              <td className="py-3 px-4 font-semibold text-slate-800">
                                {b.hostel.name}
                              </td>
                              <td className="py-3 px-4 text-slate-600 text-[11px]">
                                <span className="font-medium text-slate-800 block">
                                  {formatDateTime(b.bookedAt)}
                                </span>
                                <span className="text-[10px] text-slate-400">Creation Timestamp</span>
                              </td>
                              <td className="py-3 px-4 text-slate-800">
                                <span className="font-bold text-slate-900 block">{b.slot.date}</span>
                                <span className="text-[11px] text-emerald-700 font-medium">
                                  {b.slot.startTime} - {b.slot.endTime}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-center">
                                {b.batchNumber && b.totalBatches ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold text-[11px]">
                                    <Layers className="w-3 h-3" />
                                    Batch {b.batchNumber} of {b.totalBatches}
                                  </span>
                                ) : (
                                  <span className="text-slate-400 text-[11px]">Single Batch</span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-center">
                                <div className="text-[11px]">
                                  <span className="font-bold text-slate-900">
                                    {b.order?.itemCount?.totalCount ?? 0} items
                                  </span>
                                  <span className="block text-slate-500 font-mono text-[10px]">
                                    {formatWeight(b.weightGrams ?? b.order?.itemCount?.totalWeightGrams)}
                                  </span>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span
                                  className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                    b.status === 'COMPLETED'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : b.status === 'BOOKED'
                                      ? 'bg-sky-100 text-sky-800'
                                      : b.status === 'CANCELLED'
                                      ? 'bg-rose-100 text-rose-800'
                                      : 'bg-slate-100 text-slate-800'
                                  }`}
                                >
                                  {b.status}
                                </span>
                                {b.cancelledAt && (
                                  <span className="block text-[10px] text-rose-600 mt-0.5">
                                    Cancelled: {formatDateTime(b.cancelledAt)}
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-center">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setSelectedBooking(b)}
                                  className="text-xs text-emerald-700 hover:text-emerald-900 hover:bg-emerald-50 px-2 py-1"
                                >
                                  Details
                                </Button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
            )}

            {/* ── TAB 4: LAUNDRY ORDERS ─────────────────────────────────── */}
            {activeTab === 'orders' && (
              <div className="space-y-4">
                {/* Search & Status Filter */}
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="relative min-w-[220px]">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        placeholder="Search order ID, resident name..."
                        value={orderSearch}
                        onChange={(e) => setOrderSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <div className="flex items-center gap-1.5 text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 shadow-xs">
                      <Filter className="w-3.5 h-3.5 text-slate-400" />
                      <label htmlFor="pg-order-status-filter" className="font-semibold text-slate-600">
                        Status:
                      </label>
                      <select
                        id="pg-order-status-filter"
                        value={orderStatusFilter}
                        onChange={(e) => setOrderStatusFilter(e.target.value)}
                        className="bg-transparent border-none text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer"
                      >
                        <option value="ALL">All Statuses</option>
                        <option value="BOOKED">BOOKED</option>
                        <option value="IN_PROGRESS">IN_PROGRESS</option>
                        <option value="COMPLETED">COMPLETED</option>
                        <option value="UNDER_REVIEW">UNDER_REVIEW</option>
                        <option value="VERIFIED">VERIFIED</option>
                        <option value="RESOLVED">RESOLVED</option>
                        <option value="CANCELLED">CANCELLED</option>
                      </select>
                    </div>
                  </div>

                  <span className="text-xs font-semibold text-slate-500">
                    Total Orders: {orders.length}
                  </span>
                </div>

                {/* Orders Table */}
                <Card className="border-slate-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                          <th className="py-2.5 px-4">Order ID & Facility</th>
                          <th className="py-2.5 px-4">Resident</th>
                          <th className="py-2.5 px-4">Operating Model</th>
                          <th className="py-2.5 px-4 text-center">Garments & Weight</th>
                          <th className="py-2.5 px-4">Timeline</th>
                          <th className="py-2.5 px-4 text-center">Status</th>
                          <th className="py-2.5 px-4 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {orders.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="py-8 text-center text-slate-500 text-xs">
                              No PG laundry orders found.
                            </td>
                          </tr>
                        ) : (
                          orders.map((o) => (
                            <tr key={o.id} className="hover:bg-slate-50/70 transition-colors">
                              <td className="py-3 px-4">
                                <span className="font-mono text-xs font-bold text-slate-900 block">
                                  #{o.id.slice(0, 8)}
                                </span>
                                <span className="text-[11px] text-slate-500 flex items-center gap-1">
                                  <Home className="w-3 h-3 text-emerald-600" />
                                  {o.hostel.name}
                                </span>
                              </td>
                              <td className="py-3 px-4">
                                <span className="font-bold text-slate-900 block">{o.student.name}</span>
                                <span className="text-[11px] text-slate-500 font-mono">
                                  {o.student.studentId}
                                </span>
                              </td>
                              <td className="py-3 px-4">
                                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                  <Sparkles className="w-3 h-3 text-emerald-600" />
                                  Self-Service (PG Facility)
                                </span>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span className="font-bold text-slate-900 block">
                                  {o.itemCount?.totalCount ?? 0} pieces
                                </span>
                                <span className="text-[10px] text-slate-500 font-mono">
                                  {formatWeight(o.itemCount?.totalWeightGrams ?? o.booking?.weightGrams)}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-slate-600 text-[11px]">
                                {o.completedAt ? (
                                  <div>
                                    <span className="font-semibold text-emerald-700 block">
                                      Completed: {formatDateTime(o.completedAt)}
                                    </span>
                                    {o.verifiedAt && (
                                      <span className="text-[10px] text-slate-500">
                                        Verified: {formatDateTime(o.verifiedAt)}
                                      </span>
                                    )}
                                  </div>
                                ) : o.startedAt ? (
                                  <span className="font-semibold text-amber-700">
                                    Started: {formatDateTime(o.startedAt)}
                                  </span>
                                ) : (
                                  <span className="text-slate-400">
                                    Submitted: {formatDateTime(o.submittedAt || o.createdAt)}
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span
                                  className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                    o.status === 'VERIFIED'
                                      ? 'bg-teal-100 text-teal-800'
                                      : o.status === 'COMPLETED'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : o.status === 'IN_PROGRESS'
                                      ? 'bg-amber-100 text-amber-800'
                                      : o.status === 'BOOKED'
                                      ? 'bg-sky-100 text-sky-800'
                                      : (o.status as string) === 'CANCELLED'
                                      ? 'bg-rose-100 text-rose-800'
                                      : 'bg-slate-100 text-slate-800'
                                  }`}
                                >
                                  {o.status}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setSelectedOrder(o)}
                                  className="text-xs text-emerald-700 hover:text-emerald-900 hover:bg-emerald-50 px-2 py-1"
                                >
                                  Details
                                </Button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
            )}

            {/* ── TAB 5: SLOT CAPACITY ──────────────────────────────────── */}
            {activeTab === 'slots' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 shadow-xs">
                      <Calendar className="w-4 h-4 text-emerald-600" />
                      <label htmlFor="pg-slot-date-picker" className="text-xs font-semibold text-slate-700">
                        Date:
                      </label>
                      <input
                        id="pg-slot-date-picker"
                        type="date"
                        value={selectedSlotDate}
                        onChange={(e) => setSelectedSlotDate(e.target.value)}
                        className="text-xs font-semibold text-slate-800 bg-transparent border-none focus:outline-none cursor-pointer"
                      />
                    </div>
                  </div>

                  <span className="text-xs font-semibold text-slate-500">
                    Showing {slots.length} Slots for {selectedSlotDate || slotDateStr}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {slots.map((s) => (
                    <Card
                      key={s.id}
                      className={`border p-4 transition-all ${
                        s.bookedCount > 0
                          ? 'border-emerald-200 bg-emerald-50/20'
                          : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                        <div className="flex items-center gap-1.5 font-bold text-slate-900 text-xs">
                          <Home className="w-3.5 h-3.5 text-emerald-600" />
                          {s.hostel.name}
                        </div>
                        <span className="text-[11px] font-mono font-semibold text-slate-600">
                          {s.startTime} - {s.endTime}
                        </span>
                      </div>

                      <div className="mt-3 flex items-center justify-between">
                        <div>
                          <span className="text-[11px] text-slate-500 block">Slot Availability</span>
                          <span className="text-sm font-black text-slate-900">
                            {s.remainingCapacity} / {s.capacity} spots open
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[11px] text-slate-500 block">Utilization</span>
                          <span className="text-sm font-bold text-emerald-700">
                            {s.utilizationPercent}%
                          </span>
                        </div>
                      </div>

                      {/* Associated bookings list */}
                      {s.bookings && s.bookings.length > 0 && (
                        <div className="mt-3 pt-2.5 border-t border-dashed border-slate-200">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                            Booked Residents ({s.bookings.length})
                          </span>
                          <div className="space-y-1">
                            {s.bookings.map((bk) => (
                              <div
                                key={bk.id}
                                className="flex items-center justify-between text-[11px] bg-slate-50 p-1.5 rounded"
                              >
                                <span className="font-semibold text-slate-800">
                                  {bk.student.name} ({bk.student.studentId})
                                </span>
                                <span className="text-emerald-700 font-mono text-[10px]">
                                  {bk.weightGrams ? `${bk.weightGrams}g` : 'Standard'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* ── TAB 6: HISTORY & NOTIFICATIONS & AUDIT ─────────────────── */}
            {activeTab === 'history' && (
              <div className="space-y-4">
                {/* Sub-tabs */}
                <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                  <button
                    onClick={() => setSubHistoryTab('history')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      subHistoryTab === 'history'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Laundry History ({historyList.length})
                  </button>
                  <button
                    onClick={() => setSubHistoryTab('notifications')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      subHistoryTab === 'notifications'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    System Notifications ({notifications.length})
                  </button>
                  <button
                    onClick={() => setSubHistoryTab('audit')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      subHistoryTab === 'audit'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Audit Logs ({auditLogs.length})
                  </button>
                </div>

                {/* Sub Tab: Laundry History */}
                {subHistoryTab === 'history' && (
                  <Card className="border-slate-200 overflow-hidden">
                    <div className="p-3 border-b border-slate-100 flex items-center justify-between">
                      <div className="relative min-w-[220px]">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                        <input
                          type="text"
                          placeholder="Search resident or facility in history..."
                          value={historySearch}
                          onChange={(e) => setHistorySearch(e.target.value)}
                          className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                      <span className="text-xs text-slate-500 font-semibold">
                        {historyList.length} Archived Operations
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                            <th className="py-2.5 px-4">Resident</th>
                            <th className="py-2.5 px-4">Facility</th>
                            <th className="py-2.5 px-4">Completed Date</th>
                            <th className="py-2.5 px-4 text-center">Items & Weight</th>
                            <th className="py-2.5 px-4 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs">
                          {historyList.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="py-8 text-center text-slate-500 text-xs">
                                No PG laundry history found.
                              </td>
                            </tr>
                          ) : (
                            historyList.map((h) => (
                              <tr key={h.id} className="hover:bg-slate-50/70 transition-colors">
                                <td className="py-3 px-4 font-bold text-slate-900">
                                  {h.user.name} ({h.user.studentId})
                                </td>
                                <td className="py-3 px-4 text-slate-700">
                                  {h.order.hostel.name}
                                </td>
                                <td className="py-3 px-4 text-slate-600">
                                  {formatDateTime(h.completedAt)}
                                </td>
                                <td className="py-3 px-4 text-center">
                                  <span className="font-semibold text-slate-900 block">
                                    {h.order.itemCount?.totalCount ?? 0} pieces
                                  </span>
                                  <span className="text-[10px] text-slate-500 font-mono">
                                    {formatWeight(h.order.itemCount?.totalWeightGrams)}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-center">
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800">
                                    {h.order.status}
                                  </span>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                )}

                {/* Sub Tab: Notifications */}
                {subHistoryTab === 'notifications' && (
                  <Card className="border-slate-200 overflow-hidden divide-y divide-slate-100">
                    {notifications.length === 0 ? (
                      <div className="py-8 text-center text-slate-500 text-xs">
                        No notifications found.
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div key={n.id} className="p-4 hover:bg-slate-50/70 transition-colors">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Bell className="w-4 h-4 text-emerald-600" />
                              <span className="font-bold text-slate-900 text-xs">{n.title}</span>
                              <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                                {n.type}
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-400">
                              {formatDateTime(n.createdAt)}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 mt-1 pl-6">{n.message}</p>
                          <div className="mt-1 pl-6 text-[11px] text-slate-500">
                            Recipient: <span className="font-semibold text-slate-700">{n.user.name}</span> ({n.user.studentId} • {n.user.email})
                          </div>
                        </div>
                      ))
                    )}
                  </Card>
                )}

                {/* Sub Tab: Audit Logs */}
                {subHistoryTab === 'audit' && (
                  <Card className="border-slate-200 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                            <th className="py-2.5 px-4">Action</th>
                            <th className="py-2.5 px-4">Entity Type</th>
                            <th className="py-2.5 px-4">Actor</th>
                            <th className="py-2.5 px-4">Reason / Details</th>
                            <th className="py-2.5 px-4">Timestamp</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs font-mono">
                          {auditLogs.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="py-8 text-center text-slate-500 text-xs font-sans">
                                No audit logs found.
                              </td>
                            </tr>
                          ) : (
                            auditLogs.map((log) => (
                              <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                                <td className="py-2.5 px-4 font-bold text-slate-900">
                                  {log.action}
                                </td>
                                <td className="py-2.5 px-4 text-emerald-800">
                                  {log.entityType}
                                </td>
                                <td className="py-2.5 px-4 text-slate-700 font-sans text-xs">
                                  {log.actor.email}
                                </td>
                                <td className="py-2.5 px-4 text-slate-500 font-sans text-xs">
                                  {log.reason || '—'}
                                </td>
                                <td className="py-2.5 px-4 text-slate-500 text-[11px]">
                                  {formatDateTime(log.createdAt)}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                )}
              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* Booking Details Modal */}
      {selectedBooking && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedBooking(null)}
          title="PG Booking & Garment Details"
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Resident</span>
                <span className="font-bold text-slate-900 text-sm">{selectedBooking.student.name}</span>
                <span className="text-slate-500 block font-mono text-[11px]">
                  {selectedBooking.student.studentId}
                </span>
                <span className="text-slate-500 block text-[11px]">{selectedBooking.student.email}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">PG Facility</span>
                <span className="font-bold text-slate-900 text-sm">{selectedBooking.hostel.name}</span>
                <span className="text-emerald-700 font-semibold block text-[11px]">
                  Code: {selectedBooking.hostel.code}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Booking Created At
                </span>
                <span className="font-semibold text-slate-800">
                  {formatDateTime(selectedBooking.bookedAt)}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Scheduled Slot Window
                </span>
                <span className="font-bold text-slate-900 block">{selectedBooking.slot.date}</span>
                <span className="text-emerald-700 font-medium">
                  {selectedBooking.slot.startTime} - {selectedBooking.slot.endTime}
                </span>
              </div>
            </div>

            {/* Batch Info */}
            <div className="p-3 bg-indigo-50/50 rounded-lg border border-indigo-200">
              <span className="text-[10px] uppercase font-bold text-indigo-500 block">
                Multi-Batch Configuration
              </span>
              <p className="font-bold text-indigo-900 mt-1">
                {selectedBooking.batchNumber && selectedBooking.totalBatches
                  ? `Batch ${selectedBooking.batchNumber} of ${selectedBooking.totalBatches}`
                  : 'Single Batch Booking'}
              </p>
              {selectedBooking.batchGroupId && (
                <span className="text-[10px] font-mono text-indigo-700 block mt-0.5">
                  Group ID: {selectedBooking.batchGroupId}
                </span>
              )}
            </div>

            {/* Garment Breakdown */}
            {selectedBooking.order?.itemCount && (
              <div className="p-3 bg-white rounded-lg border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-2">
                  Garment Category Breakdown
                </span>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 bg-slate-50 rounded">
                    <span className="text-slate-500 block text-[10px]">Shirts</span>
                    <span className="font-bold text-slate-800">
                      {selectedBooking.order.itemCount.shirtCount ?? 0}
                    </span>
                  </div>
                  <div className="p-2 bg-slate-50 rounded">
                    <span className="text-slate-500 block text-[10px]">T-Shirts</span>
                    <span className="font-bold text-slate-800">
                      {selectedBooking.order.itemCount.tshirtCount ?? 0}
                    </span>
                  </div>
                  <div className="p-2 bg-slate-50 rounded">
                    <span className="text-slate-500 block text-[10px]">Pants</span>
                    <span className="font-bold text-slate-800">
                      {selectedBooking.order.itemCount.pantsCount ?? 0}
                    </span>
                  </div>
                  <div className="p-2 bg-slate-50 rounded">
                    <span className="text-slate-500 block text-[10px]">Jeans</span>
                    <span className="font-bold text-slate-800">
                      {selectedBooking.order.itemCount.jeansCount ?? 0}
                    </span>
                  </div>
                  <div className="p-2 bg-slate-50 rounded">
                    <span className="text-slate-500 block text-[10px]">Shorts</span>
                    <span className="font-bold text-slate-800">
                      {selectedBooking.order.itemCount.shortsCount ?? 0}
                    </span>
                  </div>
                  <div className="p-2 bg-emerald-50 rounded border border-emerald-200">
                    <span className="text-emerald-700 block text-[10px] font-bold">Total Weight</span>
                    <span className="font-black text-emerald-900">
                      {formatWeight(
                        selectedBooking.weightGrams ??
                          selectedBooking.order.itemCount.totalWeightGrams
                      )}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Status & Cancellation */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <span className="text-xs text-slate-500">Status:</span>
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                  selectedBooking.status === 'COMPLETED'
                    ? 'bg-emerald-100 text-emerald-800'
                    : selectedBooking.status === 'BOOKED'
                    ? 'bg-sky-100 text-sky-800'
                    : selectedBooking.status === 'CANCELLED'
                    ? 'bg-rose-100 text-rose-800'
                    : 'bg-slate-100 text-slate-800'
                }`}
              >
                {selectedBooking.status}
              </span>
            </div>

            {selectedBooking.cancelledAt && (
              <div className="p-2.5 rounded bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                Cancellation Recorded: {formatDateTime(selectedBooking.cancelledAt)}
              </div>
            )}

            <div className="pt-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setSelectedBooking(null)}
              >
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Order Details Modal */}
      {selectedOrder && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedOrder(null)}
          title={`Order #${selectedOrder.id.slice(0, 8)} Details`}
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Resident</span>
                <span className="font-bold text-slate-900">{selectedOrder.student.name}</span>
                <span className="text-slate-500 block font-mono text-[11px]">
                  {selectedOrder.student.studentId}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Facility</span>
                <span className="font-bold text-slate-900">{selectedOrder.hostel.name}</span>
                <span className="text-emerald-700 font-semibold block text-[11px]">
                  Self-Service Model
                </span>
              </div>
            </div>

            <div className="p-3 bg-emerald-50/50 rounded-lg border border-emerald-200">
              <span className="text-[10px] uppercase font-bold text-emerald-600 block">
                Order Lifecycle
              </span>
              <div className="mt-2 space-y-1 text-[11px] text-slate-700">
                <div>Submitted: {formatDateTime(selectedOrder.submittedAt || selectedOrder.createdAt)}</div>
                {selectedOrder.startedAt && (
                  <div>Wash Started: {formatDateTime(selectedOrder.startedAt)}</div>
                )}
                {selectedOrder.completedAt && (
                  <div>Completed: {formatDateTime(selectedOrder.completedAt)}</div>
                )}
                {selectedOrder.verifiedAt && (
                  <div>Verified by Resident: {formatDateTime(selectedOrder.verifiedAt)}</div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <span className="text-xs text-slate-500">Current Status:</span>
              <span className="px-3 py-1 rounded-full text-xs font-bold uppercase bg-emerald-100 text-emerald-800">
                {selectedOrder.status}
              </span>
            </div>

            <div className="pt-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setSelectedOrder(null)}
              >
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </PageTransition>
  );
};
