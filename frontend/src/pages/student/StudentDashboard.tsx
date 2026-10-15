import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import {
  QrCode,
  Calendar,
  Clock,
  Shirt,
  AlertCircle,
  LogOut,
  Plus,
  XCircle,
  RefreshCw,
  Droplets,
  CheckCircle2,
  ArrowRight,
  History,
  AlertTriangle,
  ShieldCheck,
  Sparkles,
  Camera,
  Play,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { ActiveBooking, MonthlyUsage, CompletionNotification } from '../../types';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import { Modal } from '../../components/common/Modal';
import { CompletionPopup } from '../../components/common/CompletionPopup';
import { AiLaundryScannerModal } from '../../components/common/AiLaundryScannerModal';
import { PageTransition } from '../../components/common/PageTransition';
import { staggerContainerVariants, staggerItemVariants } from '../../utils/animations';

// ── Helper ────────────────────────────────────────

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-IN', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

// ── Monthly Usage Ring ─────────────────────────────

const UsageRing: React.FC<{ used: number; max: number }> = ({ used, max }) => {
  const percent = max > 0 ? (used / max) * 100 : 0;
  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (percent / 100) * circumference;
  const isWarning = used >= max - 1 && used < max;
  const isMaxed = used >= max;

  return (
    <div className="relative w-20 h-20 flex-shrink-0">
      <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r={radius} fill="none" className="stroke-slate-100" strokeWidth="8" />
        <motion.circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          strokeWidth="8"
          strokeLinecap="round"
          stroke={isMaxed ? '#ef4444' : isWarning ? '#f59e0b' : '#0ea5e9'}
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: dashOffset }}
          transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-lg font-extrabold leading-none ${isMaxed ? 'text-red-600' : isWarning ? 'text-amber-600' : 'text-water-700'}`}>
          {used}
        </span>
        <span className="text-[10px] text-slate-400 font-medium">/ {max}</span>
      </div>
    </div>
  );
};

const COMPLAINT_LABELS: Record<string, string> = {
  CLOTHES_TORN: 'Clothes Torn',
  NUMBER_OF_CLOTHES_REDUCED: 'Number of Clothes Reduced',
  OTHER_ISSUE: 'Other Issue',
};

// ── Active Booking Card ───────────────────────────

interface ActiveBookingCardProps {
  booking: ActiveBooking;
  onCancel: () => void;
  isCancelling: boolean;
  isPgShared?: boolean;
  onRefresh?: () => void;
}

const ActiveBookingCard: React.FC<ActiveBookingCardProps> = ({
  booking,
  onCancel,
  isCancelling,
  isPgShared = false,
  onRefresh,
}) => {
  const [pgActionLoading, setPgActionLoading] = useState<string | null>(null);
  const [pgActionSuccess, setPgActionSuccess] = useState<string | null>(null);
  const [pgActionError, setPgActionError] = useState<string | null>(null);

  const batches = booking.batches && booking.batches.length > 0 ? booking.batches : null;
  const isMultiBatch = Boolean(batches && batches.length > 1);

  async function handleStartWash(orderId: string) {
    setPgActionLoading(orderId);
    setPgActionError(null);
    try {
      const res = await api.startPgSelfServiceWash(orderId);
      setPgActionSuccess(res.message || 'Wash cycle started!');
      if (onRefresh) onRefresh();
      setTimeout(() => setPgActionSuccess(null), 4000);
    } catch (err: any) {
      setPgActionError(err.message || 'Failed to start wash cycle.');
    } finally {
      setPgActionLoading(null);
    }
  }

  async function handleCompleteWash(orderId: string) {
    setPgActionLoading(orderId);
    setPgActionError(null);
    try {
      const res = await api.completePgSelfServiceWash(orderId);
      setPgActionSuccess(res.message || 'Wash cycle marked as completed!');
      if (onRefresh) onRefresh();
      setTimeout(() => setPgActionSuccess(null), 4000);
    } catch (err: any) {
      setPgActionError(err.message || 'Failed to complete wash cycle.');
    } finally {
      setPgActionLoading(null);
    }
  }

  const isComplaint =
    booking.orderStatus === 'UNDER_REVIEW' ||
    booking.orderStatus === 'COMPLAINT' ||
    Boolean(booking.complaint);
  const isInProgress = booking.orderStatus === 'IN_PROGRESS';
  const isCompleted = booking.orderStatus === 'COMPLETED';

  // Helper for batch status badge
  const renderStatusBadge = (status: string, orderStatus: string | null) => {
    if (status === 'CANCELLED') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200 text-[10px] font-bold">
          CANCELLED
        </span>
      );
    }
    if (orderStatus === 'UNDER_REVIEW' || orderStatus === 'COMPLAINT') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 text-[10px] font-bold">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
          UNDER REVIEW
        </span>
      );
    }
    if (orderStatus === 'IN_PROGRESS') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200 text-[10px] font-bold">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
          IN PROGRESS
        </span>
      );
    }
    if (orderStatus === 'COMPLETED') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-water-100 text-water-800 border border-water-200 text-[10px] font-bold">
          <span className="w-1.5 h-1.5 rounded-full bg-water-500" />
          COMPLETED
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-bold">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        {status}
      </span>
    );
  };

  return (
    <Card
      className={`transition-all ${
        isComplaint
          ? 'border-amber-300 bg-gradient-to-br from-white to-amber-50/40 shadow-sm'
          : 'border-water-200 bg-gradient-to-br from-white to-water-50/50'
      }`}
    >
      {/* Toast notifications for PG Self-Service actions */}
      {pgActionSuccess && (
        <div className="mb-4 flex items-center gap-2 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{pgActionSuccess}</span>
        </div>
      )}
      {pgActionError && (
        <div className="mb-4 flex items-center gap-2 p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
          <span>{pgActionError}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            {isComplaint ? (
              <AlertTriangle className="w-4 h-4 text-amber-600" />
            ) : isInProgress ? (
              <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            )}
            {isMultiBatch
              ? `Multi-Batch Booking (${batches!.length} Batches)`
              : isComplaint
              ? 'Active Laundry'
              : 'Active Booking'}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {isMultiBatch
              ? 'Individual batch statuses, scheduled slots, and garment breakdowns below'
              : isComplaint
              ? 'Complaint submitted · under administrative review'
              : isInProgress
              ? 'Your laundry is currently being processed'
              : isCompleted
              ? 'Laundry completed'
              : 'Your upcoming laundry session'}
          </p>
        </div>

        {/* Top-level Status Badge for single-batch or overall group pill */}
        {isMultiBatch ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-water-100 text-water-800 border border-water-300 text-[11px] font-bold flex-shrink-0">
            MULTI-BATCH GROUP
          </span>
        ) : (
          renderStatusBadge(booking.status, booking.orderStatus)
        )}
      </div>

      {/* Multi-Batch Group Display */}
      {isMultiBatch ? (
        <div className="space-y-3 mb-4">
          {batches!.map((batch, index) => {
            const bItemCount = batch.itemCount;
            const bWeight = batch.weightGrams ?? bItemCount?.totalWeightGrams ?? 0;
            const bHas5Cat =
              bItemCount?.shirtCount !== undefined || bItemCount?.tshirtCount !== undefined;
            const canSelfStart =
              isPgShared &&
              batch.orderId &&
              batch.status === 'BOOKED' &&
              (!batch.orderStatus || batch.orderStatus === 'BOOKED');
            const canSelfComplete =
              isPgShared && batch.orderId && batch.orderStatus === 'IN_PROGRESS';

            return (
              <div
                key={batch.id || index}
                className="p-3.5 rounded-xl border border-slate-200 bg-white/80 space-y-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-800">
                      Batch {batch.batchNumber || index + 1} of {batch.totalBatches || batches!.length}
                    </span>
                    {bWeight > 0 && (
                      <span className="text-[10px] font-medium text-water-700 bg-water-50 px-2 py-0.5 rounded border border-water-100">
                        {bWeight}g
                      </span>
                    )}
                  </div>
                  {renderStatusBadge(batch.status, batch.orderStatus)}
                </div>

                {/* Slot Details */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-1.5 text-slate-600">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>{formatDate(batch.slot.date)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-600">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      {batch.slot.startTime} – {batch.slot.endTime}
                    </span>
                  </div>
                </div>

                {/* Garment Breakdown */}
                {bItemCount && (
                  <div className="p-2 rounded-lg bg-slate-50 border border-slate-100 text-[11px] text-slate-600">
                    {bHas5Cat ? (
                      <div className="flex flex-wrap gap-x-2 gap-y-1">
                        <span>
                          T-Shirts: <strong className="text-slate-800">{bItemCount.tshirtCount ?? 0}</strong>
                        </span>
                        <span>&bull;</span>
                        <span>
                          Shirts: <strong className="text-slate-800">{bItemCount.shirtCount ?? 0}</strong>
                        </span>
                        <span>&bull;</span>
                        <span>
                          Pants: <strong className="text-slate-800">{bItemCount.pantsCount ?? 0}</strong>
                        </span>
                        <span>&bull;</span>
                        <span>
                          Jeans: <strong className="text-slate-800">{bItemCount.jeansCount ?? 0}</strong>
                        </span>
                        <span>&bull;</span>
                        <span>
                          Shorts: <strong className="text-slate-800">{bItemCount.shortsCount ?? 0}</strong>
                        </span>
                        <span className="ml-auto font-bold text-water-800">
                          Total: {bItemCount.totalCount} items
                        </span>
                      </div>
                    ) : (
                      <div className="flex justify-between">
                        <span>
                          Shirts: <strong className="text-slate-800">{bItemCount.tShirtShirtCount}</strong> &bull; Pants:{' '}
                          <strong className="text-slate-800">{bItemCount.pantsTrackCount}</strong>
                        </span>
                        <span className="font-bold text-water-800">Total: {bItemCount.totalCount} items</span>
                      </div>
                    )}
                  </div>
                )}

                {/* PG Self-Service Controls per Batch */}
                {canSelfStart && (
                  <Button
                    variant="primary"
                    size="sm"
                    className="w-full mt-2"
                    onClick={() => handleStartWash(batch.orderId!)}
                    isLoading={pgActionLoading === batch.orderId}
                    icon={<Play className="w-3.5 h-3.5" />}
                  >
                    Start Wash Cycle (Self-Service)
                  </Button>
                )}

                {canSelfComplete && (
                  <Button
                    variant="primary"
                    size="sm"
                    className="w-full mt-2 bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => handleCompleteWash(batch.orderId!)}
                    isLoading={pgActionLoading === batch.orderId}
                    icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                  >
                    Mark Wash Finished (Self-Service)
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* Single Batch / Legacy Display */
        <>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="p-3 rounded-xl bg-white border border-slate-200">
              <div className="flex items-center gap-1.5 text-slate-500 mb-1">
                <Calendar className="w-3.5 h-3.5" />
                <span className="text-[11px] font-semibold uppercase tracking-wide">Date</span>
              </div>
              <p className="text-xs font-bold text-slate-800">{formatDate(booking.slot.date)}</p>
            </div>
            <div className="p-3 rounded-xl bg-white border border-slate-200">
              <div className="flex items-center gap-1.5 text-slate-500 mb-1">
                <Clock className="w-3.5 h-3.5" />
                <span className="text-[11px] font-semibold uppercase tracking-wide">Time</span>
              </div>
              <p className="text-xs font-bold text-slate-800">
                {booking.slot.startTime} – {booking.slot.endTime}
              </p>
            </div>
          </div>

          {booking.itemCount && (
            <div className="mb-4">
              {booking.itemCount.shirtCount !== undefined || booking.itemCount.tshirtCount !== undefined ? (
                <div className="grid grid-cols-5 gap-1.5 mb-2">
                  <div className="p-2 rounded-lg bg-water-50 border border-water-200 text-center">
                    <p className="text-[9px] text-water-600 font-semibold uppercase">T-Shirts</p>
                    <p className="text-xs font-extrabold text-water-900">{booking.itemCount.tshirtCount ?? 0}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-water-50 border border-water-200 text-center">
                    <p className="text-[9px] text-water-600 font-semibold uppercase">Shirts</p>
                    <p className="text-xs font-extrabold text-water-900">{booking.itemCount.shirtCount ?? 0}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-water-50 border border-water-200 text-center">
                    <p className="text-[9px] text-water-600 font-semibold uppercase">Pants</p>
                    <p className="text-xs font-extrabold text-water-900">{booking.itemCount.pantsCount ?? 0}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-water-50 border border-water-200 text-center">
                    <p className="text-[9px] text-water-600 font-semibold uppercase">Jeans</p>
                    <p className="text-xs font-extrabold text-water-900">{booking.itemCount.jeansCount ?? 0}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-water-50 border border-water-200 text-center">
                    <p className="text-[9px] text-water-600 font-semibold uppercase">Shorts</p>
                    <p className="text-xs font-extrabold text-water-900">{booking.itemCount.shortsCount ?? 0}</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div className="p-2 rounded-lg bg-water-50 border border-water-200 text-center">
                    <p className="text-[10px] text-water-600 font-semibold uppercase">Shirts</p>
                    <p className="text-sm font-extrabold text-water-900">{booking.itemCount.tShirtShirtCount}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-water-50 border border-water-200 text-center">
                    <p className="text-[10px] text-water-600 font-semibold uppercase">Pants</p>
                    <p className="text-sm font-extrabold text-water-900">{booking.itemCount.pantsTrackCount}</p>
                  </div>
                </div>
              )}
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700">Total Booked Quantity:</span>
                <span className="font-bold text-water-800">
                  {booking.itemCount.totalCount} items
                  {(booking.weightGrams ?? booking.itemCount.totalWeightGrams ?? 0) > 0 &&
                    ` (${booking.weightGrams ?? booking.itemCount.totalWeightGrams}g)`}
                </span>
              </div>
            </div>
          )}

          {/* PG Self-Service Controls for Single Batch */}
          {isPgShared &&
            booking.orderId &&
            booking.status === 'BOOKED' &&
            (!booking.orderStatus || booking.orderStatus === 'BOOKED') && (
              <div className="mb-4">
                <Button
                  variant="primary"
                  size="sm"
                  className="w-full"
                  onClick={() => handleStartWash(booking.orderId!)}
                  isLoading={pgActionLoading === booking.orderId}
                  icon={<Play className="w-3.5 h-3.5" />}
                >
                  Start Wash Cycle (Self-Service)
                </Button>
              </div>
            )}

          {isPgShared && booking.orderId && booking.orderStatus === 'IN_PROGRESS' && (
            <div className="mb-4">
              <Button
                variant="primary"
                size="sm"
                className="w-full bg-emerald-600 hover:bg-emerald-700"
                onClick={() => handleCompleteWash(booking.orderId!)}
                isLoading={pgActionLoading === booking.orderId}
                icon={<CheckCircle2 className="w-3.5 h-3.5" />}
              >
                Mark Wash Finished (Self-Service)
              </Button>
            </div>
          )}
        </>
      )}

      {/* Complaint details box if under review / complained */}
      {isComplaint && (
        <div className="p-3.5 rounded-xl bg-amber-50/90 border border-amber-200 space-y-2 mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span className="text-xs font-bold text-amber-900">Complaint Status: Under Review</span>
            <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200/80 text-amber-800">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
              UNDER REVIEW
            </span>
          </div>
          {booking.complaint?.type && (
            <p className="text-xs text-amber-800">
              <span className="font-semibold">Issue:</span>{' '}
              {COMPLAINT_LABELS[booking.complaint.type] || booking.complaint.type}
            </p>
          )}
          {booking.complaint?.additionalDetails && (
            <p className="text-xs text-amber-700 italic pl-2 border-l-2 border-amber-300">
              "{booking.complaint.additionalDetails}"
            </p>
          )}
          <p className="text-[11px] text-amber-700 leading-relaxed">
            Your complaint has been submitted and is currently under review by campus administration.
          </p>
        </div>
      )}

      {/* Cancel button */}
      {booking.canCancel && (
        <Button
          variant="outline"
          size="sm"
          className="w-full border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
          onClick={onCancel}
          isLoading={isCancelling}
          icon={<XCircle className="w-3.5 h-3.5" />}
        >
          {isMultiBatch ? 'Cancel Entire Batch Group' : 'Cancel Booking'}
        </Button>
      )}
    </Card>
  );
};

// ── Main Dashboard ────────────────────────────────

export const StudentDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [qrToken, setQrToken] = useState<string | null>(null);
  const [isLoadingQr, setIsLoadingQr] = useState(true);

  const [activeBooking, setActiveBooking] = useState<ActiveBooking | null | undefined>(undefined);
  const [usage, setUsage] = useState<MonthlyUsage | null>(null);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);

  // Cancel modal
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelSuccess, setCancelSuccess] = useState(false);
  const [isAiScannerOpen, setIsAiScannerOpen] = useState(false);

  // Phase 4: Completion notification state
  const [completionNotification, setCompletionNotification] = useState<CompletionNotification | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load QR
  useEffect(() => {
    async function loadQr() {
      try {
        const res = await api.getStudentQrToken();
        if (res.qrToken) setQrToken(res.qrToken);
      } catch (err) {
        console.error('Failed to load QR token', err);
      } finally {
        setIsLoadingQr(false);
      }
    }
    loadQr();
  }, []);

  // Phase 4: Poll for completion notifications every 30s
  const checkNotifications = useCallback(async () => {
    try {
      const res = await api.getStudentNotifications();
      const unread = res.notifications?.find((n) => !n.isRead && n.order) || null;
      if (unread) {
        setCompletionNotification(unread);
      }
    } catch {
      // silent fail — polling should not disrupt the page
    }
  }, []);

  useEffect(() => {
    checkNotifications();
    pollIntervalRef.current = setInterval(checkNotifications, 30_000);
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [checkNotifications]);

  const [complaints, setComplaints] = useState<any[]>([]);

  const loadDashboardData = useCallback(async () => {
    setIsLoadingDashboard(true);
    setDashboardError(null);
    try {
      const [bookingRes, usageRes, complaintsRes] = await Promise.all([
        api.getMyActiveBooking(),
        api.getStudentUsage(),
        api.getStudentComplaints().catch(() => ({ complaints: [] })),
      ]);
      setActiveBooking(bookingRes.booking);
      setUsage(usageRes.usage || null);
      setComplaints(complaintsRes.complaints || []);
    } catch (err: any) {
      setDashboardError(err.message || 'Failed to load dashboard data.');
    } finally {
      setIsLoadingDashboard(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const handleCancelBooking = async () => {
    if (!activeBooking) return;
    setIsCancelling(true);
    setCancelError(null);
    try {
      await api.cancelBooking(activeBooking.id);
      setCancelSuccess(true);
      setShowCancelModal(false);
      // Refresh data
      await loadDashboardData();
    } catch (err: any) {
      setCancelError(err.message || 'Failed to cancel booking. Please try again.');
    } finally {
      setIsCancelling(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const shouldReduceMotion = useReducedMotion();

  return (
    <PageTransition className="space-y-6">
      {/* Phase 4: Completion Popup — renders above everything */}
      {completionNotification && (
        <CompletionPopup
          notification={completionNotification}
          onDismiss={() => setCompletionNotification(null)}
          onActioned={() => {
            setCompletionNotification(null);
            loadDashboardData();
          }}
        />
      )}

      {/* ── Header Banner ── */}
      <div className="rounded-2xl bg-gradient-to-r from-water-900 via-water-800 to-ocean-900 text-white p-6 sm:p-8 shadow-card relative overflow-hidden">
        {/* Decorative water bubbles */}
        <div className="absolute top-0 right-0 w-64 h-64 opacity-5">
          <Droplets className="w-full h-full" />
        </div>

        <div className="relative z-10 flex flex-wrap items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <Badge variant="cyan" size="sm">Student</Badge>
              <span className="text-xs text-water-200">{user?.hostelName} Hostel</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight truncate">
              {getGreeting()}, {user?.name?.split(' ')[0] || 'Student'}
            </h1>
            <p className="text-xs text-water-100/80 mt-1 leading-relaxed">
              Manage your campus laundry bookings.
            </p>

            <div className="mt-4 flex flex-wrap gap-3 text-xs">
              <div className="px-3 py-1.5 rounded-lg bg-white/10 backdrop-blur-sm border border-white/10">
                <span className="text-water-200 block text-[10px] uppercase font-semibold">Student ID</span>
                <span className="font-bold text-white">{user?.studentId}</span>
              </div>
              <div className="px-3 py-1.5 rounded-lg bg-white/10 backdrop-blur-sm border border-white/10">
                <span className="text-water-200 block text-[10px] uppercase font-semibold">Dept</span>
                <span className="font-bold text-white">{user?.department} · {user?.admissionYear}</span>
              </div>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="text-white/70 hover:text-white hover:bg-white/10 flex-shrink-0"
            onClick={handleLogout}
            icon={<LogOut className="w-4 h-4" />}
          >
            Sign Out
          </Button>
        </div>
      </div>

      {/* Cancel success toast */}
      {cancelSuccess && (
        <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-800">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span className="font-medium">Booking cancelled successfully. The slot has been released.</span>
          <button
            onClick={() => setCancelSuccess(false)}
            className="ml-auto text-emerald-600 hover:text-emerald-800 text-xs underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {dashboardError && (
        <ErrorAlert
          message={dashboardError}
          onDismiss={() => setDashboardError(null)}
        />
      )}

      {/* ── Main Grid ── */}
      <motion.div
        variants={staggerContainerVariants}
        initial={shouldReduceMotion ? false : 'initial'}
        animate="animate"
        className="grid grid-cols-1 lg:grid-cols-3 gap-6"
      >
        {/* ── Left Column: QR ── */}
        <motion.div variants={staggerItemVariants} className="lg:col-span-1">
          <Card className="border-slate-200">
            <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100 mb-4">
            <div className="w-8 h-8 rounded-lg bg-water-50 text-water-600 flex items-center justify-center border border-water-100">
              <QrCode className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Permanent ID QR</h3>
              <p className="text-[11px] text-slate-500">Display-only digital identity</p>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center p-5 bg-slate-50 rounded-xl border border-slate-200 text-center">
            {isLoadingQr ? (
              <LoadingSpinner size="sm" text="Loading QR..." />
            ) : qrToken ? (
              <>
                <div className="p-2.5 bg-white rounded-xl shadow-subtle border border-slate-200">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrToken)}`}
                    alt="Permanent Student QR Code"
                    className="w-32 h-32 rounded"
                    loading="lazy"
                  />
                </div>
                <p className="mt-2.5 text-xs font-bold text-slate-800">{user?.studentId} · {user?.name}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Permanent · Read-only</p>
              </>
            ) : (
              <p className="text-xs text-slate-500">Could not load QR.</p>
            )}
          </div>

          <div className="mt-3 p-2.5 rounded-lg bg-water-50/70 border border-water-100 text-[11px] text-water-900 flex items-start gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-water-600 flex-shrink-0 mt-0.5" />
            <p>This QR permanently identifies you. It is display-only and cannot be scanned.</p>
          </div>
        </Card>
        </motion.div>

        {/* ── Right Columns ── */}
        <motion.div variants={staggerItemVariants} className="lg:col-span-2 space-y-5">

          {/* Monthly Usage */}
          <Card className="border-slate-200">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-bold text-slate-900">Monthly Usage</h3>
              <button
                onClick={loadDashboardData}
                className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                aria-label="Refresh dashboard"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {isLoadingDashboard ? (
              <div className="flex items-center gap-3 py-4">
                <div className="w-20 h-20 rounded-full bg-slate-100 animate-pulse flex-shrink-0" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-slate-100 rounded animate-pulse w-3/4" />
                  <div className="h-3 bg-slate-100 rounded animate-pulse w-1/2" />
                </div>
              </div>
            ) : usage ? (
              <div className="flex items-center gap-5 mt-2">
                <UsageRing used={usage.usedCount} max={usage.maxCount} />
                <div>
                  <p className="text-sm font-bold text-slate-800">
                    {usage.usedCount} of {usage.maxCount} uses this {usage.month}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {usage.remainingCount > 0
                      ? `${usage.remainingCount} booking${usage.remainingCount !== 1 ? 's' : ''} remaining`
                      : 'Monthly limit reached'}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1.5">
                    Resets on the 1st of every month
                  </p>
                </div>
              </div>
            ) : null}
          </Card>

          {/* Active Booking / Book CTA / Complaint Card */}
          {isLoadingDashboard ? (
            <div className="p-5 rounded-2xl border border-slate-200 bg-white animate-pulse h-40" />
          ) : activeBooking ? (
            <ActiveBookingCard
              booking={activeBooking}
              onCancel={() => setShowCancelModal(true)}
              isCancelling={isCancelling}
              isPgShared={user?.environment === 'PG_SHARED'}
              onRefresh={loadDashboardData}
            />
          ) : complaints.some((c) => c.status === 'UNDER_REVIEW') ? (
            /* Fallback if complaint exists without active booking slot */
            (() => {
              const activeC = complaints.find((c) => c.status === 'UNDER_REVIEW');
              return (
                <Card className="border-amber-300 bg-gradient-to-br from-white to-amber-50/40 p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        Active Laundry
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">Complaint submitted · under administrative review</p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-300 text-[11px] font-bold flex-shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                      COMPLAINT UNDER REVIEW
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-amber-50/90 border border-amber-200 space-y-2">
                    <p className="text-xs text-amber-800">
                      <span className="font-semibold">Issue:</span> {COMPLAINT_LABELS[activeC?.type] || activeC?.type}
                    </p>
                    {activeC?.additionalDetails && (
                      <p className="text-xs text-amber-700 italic pl-2 border-l-2 border-amber-300">
                        "{activeC.additionalDetails}"
                      </p>
                    )}
                    <p className="text-[11px] text-amber-700 leading-relaxed">
                      Your complaint is currently under review by campus administration.
                    </p>
                  </div>
                </Card>
              );
            })()
          ) : (
            <Card className="border-slate-200 text-center py-6">
              <div className="w-12 h-12 rounded-full bg-water-50 border border-water-100 flex items-center justify-center mx-auto mb-3">
                <Shirt className="w-5 h-5 text-water-500" />
              </div>
              <h3 className="text-sm font-bold text-slate-700 mb-1">No Active Booking</h3>
              <p className="text-xs text-slate-500 mb-4">
                You don't have a laundry booking yet.
              </p>
              {usage?.canBook ? (
                <Button
                  variant="primary"
                  onClick={() => navigate('/student/book')}
                  icon={<Plus className="w-4 h-4" />}
                >
                  Book Laundry
                </Button>
              ) : (
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 font-medium">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Monthly limit reached ({usage?.maxCount}/{usage?.maxCount} uses)
                </div>
              )}
            </Card>
          )}

          {/* Recently resolved complaint notice (if any) */}
          {!activeBooking && complaints.length > 0 && complaints[0]?.status === 'RESOLVED' && (
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
              <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>
                Your laundry complaint regarding <strong>{COMPLAINT_LABELS[complaints[0].type] || complaints[0].type}</strong> has been{' '}
                <strong>RESOLVED</strong> by administration.
              </span>
            </div>
          )}

          {/* Quick Actions */}
          {activeBooking && activeBooking.canCancel && usage?.canBook && (
            <div className="p-4 rounded-xl border border-dashed border-slate-300 bg-slate-50/50">
              <p className="text-xs text-slate-500 mb-1 font-medium">You have an active booking above. Cancel it first to book a new slot.</p>
            </div>
          )}

          {/* AI Cloth Scanner Quick Action */}
          <div className="p-4 rounded-xl border border-cyan-200/90 bg-gradient-to-r from-cyan-50/80 via-sky-50/60 to-blue-50/70 shadow-2xs hover:shadow-sm transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-water-600 text-white flex items-center justify-center flex-shrink-0 shadow-xs">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-900">AI Laundry Cloth Scanner</span>
                  <span className="text-[10px] font-extrabold uppercase bg-cyan-200/80 text-cyan-900 px-2 py-0.5 rounded-full">
                    YOLOv8
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Snap a photo of your clothes to automatically detect garments & counts.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsAiScannerOpen(true)}
              className="w-full sm:w-auto px-3.5 py-2 rounded-xl bg-white border border-cyan-300 text-xs font-bold text-cyan-800 hover:bg-cyan-50 hover:border-cyan-400 transition-all flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer flex-shrink-0"
            >
              <Camera className="w-3.5 h-3.5 text-cyan-600" />
              <span>Launch Scanner</span>
            </button>
          </div>

          {/* History Quick Link */}
          <button
            onClick={() => navigate('/student/history')}
            className="w-full flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 flex-shrink-0">
                <History className="w-4 h-4" />
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-slate-800">Laundry History</p>
                <p className="text-xs text-slate-500">View your past laundry submissions</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
          </button>

          {/* Rules Summary */}
          <Card className="border-slate-200">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Shirt className="w-3.5 h-3.5" />
              Laundry Rules
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <p className="text-xs font-bold text-slate-800 mb-0.5">4 uses / month</p>
                <p className="text-[11px] text-slate-500">Calendar month limit</p>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <p className="text-xs font-bold text-slate-800 mb-0.5">Max 20 clothes</p>
                <p className="text-[11px] text-slate-500">Per submission</p>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <p className="text-xs font-bold text-slate-800 mb-0.5">T-shirt / Shirt</p>
                <p className="text-[11px] text-slate-500">Category 1</p>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <p className="text-xs font-bold text-slate-800 mb-0.5">Pants / Track</p>
                <p className="text-[11px] text-slate-500">Category 2</p>
              </div>
            </div>
          </Card>

          {/* Book Laundry Link (when no active booking and can book) */}
          {!activeBooking && usage?.canBook && (
            <button
              onClick={() => navigate('/student/book')}
              className="w-full flex items-center justify-between p-4 rounded-xl border border-water-200 bg-water-50/40 hover:bg-water-50 hover:border-water-300 transition-colors group"
            >
              <div className="flex items-center gap-3 text-left">
                <div className="w-9 h-9 rounded-xl bg-water-100 flex items-center justify-center text-water-700 flex-shrink-0">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-bold text-water-900">View Available Slots</p>
                  <p className="text-xs text-water-700">{usage?.remainingCount} uses remaining this month</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-water-500 group-hover:translate-x-0.5 transition-transform" />
            </button>
          )}
        </motion.div>
      </motion.div>

      {/* ── Cancel Confirmation Modal ── */}
      <Modal
        isOpen={showCancelModal}
        onClose={() => {
          if (!isCancelling) {
            setShowCancelModal(false);
            setCancelError(null);
          }
        }}
        title="Cancel Laundry Booking?"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setShowCancelModal(false);
                setCancelError(null);
              }}
              disabled={isCancelling}
            >
              Keep Booking
            </Button>
            <Button
              variant="danger"
              isLoading={isCancelling}
              onClick={handleCancelBooking}
              icon={<XCircle className="w-4 h-4" />}
            >
              Cancel Booking
            </Button>
          </>
        }
      >
        {activeBooking && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Are you sure you want to cancel this booking? The slot will be released for others.
            </p>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Date</span>
                <span className="font-semibold text-slate-800">{formatDate(activeBooking.slot.date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Time</span>
                <span className="font-semibold text-slate-800">
                  {activeBooking.slot.startTime} – {activeBooking.slot.endTime}
                </span>
              </div>
              {activeBooking.itemCount && (
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Clothes</span>
                  <span className="font-semibold text-slate-800">{activeBooking.itemCount.totalCount} items</span>
                </div>
              )}
            </div>
            <div className="text-[11px] text-slate-500 bg-amber-50 border border-amber-200 rounded-lg p-2.5 flex items-start gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
              Cancelling before staff intake will not count against your monthly quota.
            </div>
            {cancelError && <ErrorAlert message={cancelError} />}
          </div>
        )}
      </Modal>

      {/* AI Laundry Scanner Modal */}
      <AiLaundryScannerModal
        isOpen={isAiScannerOpen}
        onClose={() => setIsAiScannerOpen(false)}
        onNavigateToBookingWithCounts={(_counts) => {
          navigate('/student/book');
        }}
      />
    </PageTransition>
  );
};
