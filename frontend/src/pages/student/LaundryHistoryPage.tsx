import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  History,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Clock,
  Shirt,
  Calendar,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
} from 'lucide-react';
import { api, ApiError } from '../../services/api';
import { LaundryHistoryItem, ComplaintInfo, OrderStatus } from '../../types';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import { PageTransition } from '../../components/common/PageTransition';
import { smoothEase } from '../../utils/animations';

// ── Helpers ───────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

// ── Status config ─────────────────────────────────────────────

const statusConfig: Record<
  OrderStatus,
  { label: string; icon: React.ReactNode; badgeCls: string; stripCls: string }
> = {
  BOOKED: {
    label: 'Booked',
    icon: <Clock className="w-3.5 h-3.5" />,
    badgeCls: 'bg-amber-50 text-amber-700 border border-amber-200',
    stripCls: 'bg-amber-400',
  },
  IN_PROGRESS: {
    label: 'In Progress',
    icon: <RefreshCw className="w-3.5 h-3.5" />,
    badgeCls: 'bg-blue-50 text-blue-700 border border-blue-200',
    stripCls: 'bg-blue-400',
  },
  COMPLETED: {
    label: 'Completed',
    icon: <Shirt className="w-3.5 h-3.5" />,
    badgeCls: 'bg-water-50 text-water-700 border border-water-200',
    stripCls: 'bg-water-400',
  },
  VERIFIED: {
    label: 'Verified',
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    badgeCls: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    stripCls: 'bg-emerald-500',
  },
  COMPLAINT: {
    label: 'Complaint',
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
    badgeCls: 'bg-red-50 text-red-700 border border-red-200',
    stripCls: 'bg-red-400',
  },
  UNDER_REVIEW: {
    label: 'Under Review',
    icon: <ShieldCheck className="w-3.5 h-3.5" />,
    badgeCls: 'bg-amber-50 text-amber-700 border border-amber-200',
    stripCls: 'bg-amber-400',
  },
  RESOLVED: {
    label: 'Resolved',
    icon: <ShieldCheck className="w-3.5 h-3.5" />,
    badgeCls: 'bg-slate-100 text-slate-600 border border-slate-200',
    stripCls: 'bg-slate-400',
  },
};

const COMPLAINT_LABELS: Record<string, string> = {
  CLOTHES_TORN: 'Clothes Torn',
  NUMBER_OF_CLOTHES_REDUCED: 'Number of Clothes Reduced',
  OTHER_ISSUE: 'Other Issue',
};

// ── Complaint Badge ───────────────────────────────────────────

function ComplaintBadge({ complaint }: { complaint: ComplaintInfo }) {
  return (
    <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200 space-y-1.5">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
        <span className="text-xs font-bold text-amber-700">
          Complaint: {COMPLAINT_LABELS[complaint.type] || complaint.type}
        </span>
        <span
          className={`ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide ${
            complaint.status === 'RESOLVED'
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-amber-100 text-amber-700'
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${complaint.status === 'RESOLVED' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          {complaint.status === 'RESOLVED' ? 'RESOLVED' : 'UNDER REVIEW'}
        </span>
      </div>
      {complaint.additionalDetails && (
        <p className="text-xs text-amber-700 pl-5 italic">"{complaint.additionalDetails}"</p>
      )}
      {complaint.resolvedAt && (
        <p className="text-[10px] text-amber-600 pl-5">
          Resolved: {formatDateTime(complaint.resolvedAt)}
        </p>
      )}
    </div>
  );
}

// ── History Card ─────────────────────────────────────────────

function HistoryCard({ item, index }: { item: LaundryHistoryItem; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = statusConfig[item.status] || statusConfig.VERIFIED;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, delay: Math.min(index * 0.04, 0.3), ease: smoothEase }}
      className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-200"
    >
      {/* Color strip */}
      <div className={`h-1 w-full ${cfg.stripCls}`} />

      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full ${cfg.badgeCls}`}>
                {cfg.icon}
                {cfg.label}
              </span>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-3">
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>{formatDate(item.bookingDate)}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>{item.slotTiming}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-water-700 bg-water-50 px-2 py-0.5 rounded-md">
                <Shirt className="w-3.5 h-3.5" />
                <span>{item.clothesCount} items</span>
              </div>
            </div>
          </div>

          {/* Expand toggle */}
          <button
            onClick={() => setExpanded((p) => !p)}
            className="flex-shrink-0 text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-water-400"
            aria-label={expanded ? 'Collapse details' : 'Expand details'}
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {/* Complaint preview (always visible if present) */}
        {item.complaint && !expanded && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50/70 px-2.5 py-1.5 rounded-lg border border-amber-100">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
            <span>Complaint: {COMPLAINT_LABELS[item.complaint.type] || item.complaint.type}</span>
            <span className={`ml-1 text-[10px] font-bold ${item.complaint.status === 'RESOLVED' ? 'text-emerald-600' : 'text-amber-600'}`}>
              ({item.complaint.status === 'RESOLVED' ? 'Resolved' : 'Under Review'})
            </span>
          </div>
        )}

        {/* Expanded details */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: smoothEase }}
              className="mt-4 space-y-2.5 border-t border-slate-100 pt-4 text-xs overflow-hidden"
            >
              {item.startedAt && (
                <div className="flex justify-between text-slate-600">
                  <span className="text-slate-400 font-medium">Processing started</span>
                  <span className="font-semibold">{formatDateTime(item.startedAt)}</span>
                </div>
              )}
              {item.completedAt && (
                <div className="flex justify-between text-slate-600">
                  <span className="text-slate-400 font-medium">Completed</span>
                  <span className="font-semibold">{formatDateTime(item.completedAt)}</span>
                </div>
              )}
              {item.verifiedAt && (
                <div className="flex justify-between text-emerald-700">
                  <span className="text-emerald-500 font-medium">Verified by you</span>
                  <span className="font-semibold">{formatDateTime(item.verifiedAt)}</span>
                </div>
              )}
              {item.complaint && <ComplaintBadge complaint={item.complaint} />}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ── Main Page ─────────────────────────────────────────────────

export const LaundryHistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const [history, setHistory] = useState<LaundryHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.getStudentHistory();
      setHistory(res.history || []);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to load laundry history. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  return (
    <PageTransition>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Top-Left Back Button */}
        <div>
          <button
            onClick={() => navigate('/student/dashboard')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-water-700 transition-colors focus:outline-none focus:ring-2 focus:ring-water-400 rounded-lg py-1 px-1 -ml-1"
            aria-label="Back to Dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        </div>

        {/* Page header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-water-100 border border-water-200 flex items-center justify-center">
              <History className="w-5 h-5 text-water-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Laundry History</h1>
              <p className="text-xs text-slate-500">Your past laundry submissions</p>
            </div>
          </div>
          <button
            onClick={loadHistory}
            disabled={isLoading}
            className="flex items-center gap-1.5 text-xs font-semibold text-water-600 hover:text-water-700 transition-colors disabled:opacity-50 px-3 py-2 rounded-xl border border-water-200 hover:bg-water-50 focus:outline-none focus:ring-2 focus:ring-water-400"
            aria-label="Refresh history"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="py-20 flex justify-center">
            <LoadingSpinner text="Loading history..." />
          </div>
        ) : error ? (
          <ErrorAlert message={error} onDismiss={() => setError(null)} />
        ) : history.length === 0 ? (
          /* Exact requirement: NO HISTORY must be bold, centered horizontally and vertically */
          <div className="min-h-[360px] flex flex-col items-center justify-center text-center py-12">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center mb-3 text-slate-400">
              <History className="w-7 h-7" />
            </div>
            <p className="text-base font-bold text-slate-800">
              <strong>NO HISTORY</strong>
            </p>
            <p className="text-xs text-slate-500 mt-1 max-w-xs">
              You haven't completed any laundry bookings yet.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((item, i) => (
              <HistoryCard key={item.orderId} item={item} index={i} />
            ))}
          </div>
        )}
      </div>
    </PageTransition>
  );
};

