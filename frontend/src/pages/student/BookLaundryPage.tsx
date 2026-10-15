import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  Calendar,
  Clock,
  CheckCircle2,
  ChevronRight,
  AlertCircle,
  Users,
  ArrowLeft,
  Camera,
  Sparkles,
  Scale,
  Layers,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { api } from '../../services/api';
import {
  LaundrySlot,
  MonthlyUsage,
  ActiveBooking,
  AiLaundryEstimate,
  SmartPlanningResponse,
  MultiBatchBookingResponse,
} from '../../types';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { PageTransition } from '../../components/common/PageTransition';
import { AiLaundryScannerModal } from '../../components/common/AiLaundryScannerModal';
import {
  stepVariants,
  successIconVariants,
  loginCardVariants,
  staggerContainerVariants,
} from '../../utils/animations';

// ── Types ──────────────────────────────────────

type BookingStep = 1 | 2 | 3 | 4;

interface DetailedGarmentCounts {
  shirt: number;
  tshirt: number;
  pants: number;
  jeans: number;
  shorts: number;
}

const REFERENCE_WEIGHTS = {
  shirt: 200,
  tshirt: 180,
  pants: 350,
  jeans: 600,
  shorts: 200,
} as const;

const SESSION_LIMIT_GRAMS = 4500;
const WEEKLY_ALLOWANCE_LIMIT_GRAMS = 7000;

// ── Helpers ────────────────────────────────────

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatShortDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-IN', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function isToday(dateStr: string): boolean {
  return dateStr === new Date().toISOString().split('T')[0];
}

function isTomorrow(dateStr: string): boolean {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return dateStr === tomorrow.toISOString().split('T')[0];
}

function getDateLabel(dateStr: string): string {
  if (isToday(dateStr)) return 'Today';
  if (isTomorrow(dateStr)) return 'Tomorrow';
  return formatShortDate(dateStr);
}

function parseSlotDateTime(dateStr: string, timeStr: string): Date {
  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1;
  const day = parseInt(dayStr, 10);

  let hours = 0;
  let minutes = 0;
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
  if (match) {
    hours = parseInt(match[1], 10);
    minutes = parseInt(match[2], 10);
    const meridiem = match[3]?.toUpperCase();
    if (meridiem === 'PM' && hours < 12) {
      hours += 12;
    } else if (meridiem === 'AM' && hours === 12) {
      hours = 0;
    }
  }

  return new Date(year, month, day, hours, minutes, 0, 0);
}

function isSlotInFuture(dateStr: string, startTimeStr: string, now: Date = new Date()): boolean {
  const slotDate = parseSlotDateTime(dateStr, startTimeStr);
  return slotDate.getTime() > now.getTime();
}

// ── Slot Card ────────────────────────────────────

interface SlotCardProps {
  slot: LaundrySlot;
  isSelected: boolean;
  onSelect: () => void;
}

const SlotCard: React.FC<SlotCardProps> = ({ slot, isSelected, onSelect }) => {
  const availabilityPercent = slot.capacity > 0 ? (slot.bookedCount / slot.capacity) * 100 : 100;
  const isAlmostFull = availabilityPercent >= 70 && !slot.isFull;

  return (
    <button
      onClick={onSelect}
      disabled={slot.isFull}
      className={`
        w-full text-left p-4 rounded-xl border-2 transition-all duration-200
        focus:outline-none focus:ring-2 focus:ring-water-400 focus:ring-offset-2
        active:scale-[0.98]
        ${slot.isFull
          ? 'border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed'
          : isSelected
          ? 'border-water-500 bg-water-50 shadow-md'
          : 'border-slate-200 bg-white hover:border-water-300 hover:bg-water-50/40 hover:shadow-sm'
        }
      `}
      aria-label={`${slot.startTime} to ${slot.endTime}, ${slot.availableSpots} spots available`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Clock className={`w-4 h-4 ${isSelected ? 'text-water-600' : 'text-slate-500'}`} />
          <span className={`text-sm font-bold ${isSelected ? 'text-water-900' : 'text-slate-800'}`}>
            {slot.startTime}
          </span>
          <ChevronRight className="w-3 h-3 text-slate-400" />
          <span className={`text-sm font-medium ${isSelected ? 'text-water-700' : 'text-slate-600'}`}>
            {slot.endTime}
          </span>
        </div>
        {isSelected && !slot.isFull && (
          <CheckCircle2 className="w-4 h-4 text-water-600 flex-shrink-0" />
        )}
      </div>

      {/* Capacity bar */}
      <div className="mb-2">
        <div className="flex items-center justify-between text-[11px] mb-1">
          <span className="text-slate-500 flex items-center gap-1">
            <Users className="w-3 h-3" />
            {slot.bookedCount} / {slot.capacity} booked
          </span>
          <span
            className={`font-semibold ${
              slot.isFull
                ? 'text-red-600'
                : isAlmostFull
                ? 'text-amber-600'
                : 'text-emerald-600'
            }`}
          >
            {slot.isFull ? 'Full' : `${slot.availableSpots} left`}
          </span>
        </div>
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              slot.isFull
                ? 'bg-red-400'
                : isAlmostFull
                ? 'bg-amber-400'
                : 'bg-emerald-400'
            }`}
            style={{ width: `${Math.min(availabilityPercent, 100)}%` }}
          />
        </div>
      </div>
    </button>
  );
};

// ── Main Booking Page ──────────────────────────────

export const BookLaundryPage: React.FC = () => {
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();

  // Data
  const [slots, setSlots] = useState<LaundrySlot[]>([]);
  const [usage, setUsage] = useState<MonthlyUsage | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  // Booking state
  const [step, setStep] = useState<BookingStep>(1);
  const [selectedSlot, setSelectedSlot] = useState<LaundrySlot | null>(null);
  const [countError, setCountError] = useState<string | null>(null);

  // Phase 3: Detailed garment counts with approved reference weights
  const [garments, setGarments] = useState<DetailedGarmentCounts>({
    shirt: 0,
    tshirt: 0,
    pants: 0,
    jeans: 0,
    shorts: 0,
  });

  // Items from YOLO / AI scan that require classification/review
  const [unresolvedItems, setUnresolvedItems] = useState<
    Array<{ className: string; count: number; reason: string }>
  >([]);

  // Phase 3: Smart batch planning state
  const [smartPlan, setSmartPlan] = useState<SmartPlanningResponse | null>(null);
  const [isPlanningLoading, setIsPlanningLoading] = useState(false);
  const [planningError, setPlanningError] = useState<string | null>(null);

  // AI Scanner state (optional)
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [aiScanId, setAiScanId] = useState<string | null>(null);
  const [aiScanData, setAiScanData] = useState<AiLaundryEstimate | null>(null);

  // Submission
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmedBooking, setConfirmedBooking] = useState<ActiveBooking | null>(null);

  // Active booking guard & QR state
  const [existingActiveBooking, setExistingActiveBooking] = useState<ActiveBooking | null>(null);
  const [qrToken, setQrToken] = useState<string | null>(null);

  // Phase 4: Multi-batch booking state
  const [confirmedBatchGroup, setConfirmedBatchGroup] = useState<MultiBatchBookingResponse | null>(null);
  const [batchSlotAssignments, setBatchSlotAssignments] = useState<Record<number, string>>({});
  const [idempotencyKey, setIdempotencyKey] = useState<string>('');

  // Group slots by date (only slots whose start time is in the future)
  const futureSlots = slots.filter((slot) => isSlotInFuture(slot.date, slot.startTime));

  const slotsByDate = futureSlots.reduce<Record<string, LaundrySlot[]>>((acc, slot) => {
    if (!acc[slot.date]) acc[slot.date] = [];
    acc[slot.date].push(slot);
    return acc;
  }, {});

  const loadData = useCallback(async () => {
    setIsLoadingData(true);
    setDataError(null);
    try {
      const [slotsRes, usageRes, activeBookingRes, qrRes] = await Promise.all([
        api.getAvailableSlots(),
        api.getStudentUsage(),
        api.getMyActiveBooking().catch(() => ({ booking: null })),
        api.getStudentQrToken().catch(() => ({ qrToken: '' })),
      ]);
      const activeFutureSlots = (slotsRes.slots || []).filter((s) =>
        isSlotInFuture(s.date, s.startTime)
      );
      setSlots(activeFutureSlots);
      setUsage(usageRes.usage || null);
      setExistingActiveBooking(activeBookingRes.booking || null);
      if (qrRes?.qrToken) setQrToken(qrRes.qrToken);
    } catch (err: any) {
      setDataError(err.message || 'Failed to load booking data.');
    } finally {
      setIsLoadingData(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Garment totals and weight calculation (Phase 3)
  const totalGarments =
    garments.shirt + garments.tshirt + garments.pants + garments.jeans + garments.shorts;

  const totalWeightGrams =
    garments.shirt * REFERENCE_WEIGHTS.shirt +
    garments.tshirt * REFERENCE_WEIGHTS.tshirt +
    garments.pants * REFERENCE_WEIGHTS.pants +
    garments.jeans * REFERENCE_WEIGHTS.jeans +
    garments.shorts * REFERENCE_WEIGHTS.shorts;

  const isGarmentsValid = totalGarments >= 1 && totalGarments <= 30;

  const handleGarmentChange = (field: keyof DetailedGarmentCounts, value: string) => {
    // Reset idempotency key when garments change
    setIdempotencyKey('');
    const num = parseInt(value, 10);
    if (value === '' || value === '0') {
      setGarments((prev) => ({ ...prev, [field]: 0 }));
      setCountError(null);
      return;
    }
    if (isNaN(num) || num < 0) {
      setCountError('Please enter a valid non-negative garment count.');
      return;
    }
    if (num > 30) {
      setCountError('Individual garment count cannot exceed 30.');
      return;
    }
    setCountError(null);
    setGarments((prev) => ({ ...prev, [field]: num }));
  };

  const handleGoToStep2 = () => {
    if (!selectedSlot) return;
    setStep(2);
    setCountError(null);
  };

  const handleGoToReview = async () => {
    if (totalGarments < 1) {
      setCountError('Please enter at least 1 garment item.');
      return;
    }
    setCountError(null);
    setIsPlanningLoading(true);
    setPlanningError(null);

    try {
      const countsPayload: Record<string, number> = { ...garments };
      for (const item of unresolvedItems) {
        countsPayload[item.className] = item.count;
      }

      const planRes = await api.planBatch({
        garmentCounts: countsPayload,
        targetDate: selectedSlot?.date,
      });
      setSmartPlan(planRes);

      // Generate idempotency UUID if not yet set for this booking session
      let activeKey = idempotencyKey;
      if (!activeKey) {
        activeKey =
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : 'ww-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
        setIdempotencyKey(activeKey);
      }

      // Pre-seed batch slot assignments so every batch has a valid slot
      const initialAssignments: Record<number, string> = {};
      if (planRes.batchRecommendations) {
        planRes.batchRecommendations.forEach((rec, idx) => {
          const bNum = rec.batch.batchNumber;
          if (bNum === 1 && selectedSlot) {
            initialAssignments[1] = selectedSlot.id;
          } else if (rec.recommendedSlots && rec.recommendedSlots.length > 0) {
            // Distribute across available recommended slots
            const pick = rec.recommendedSlots[idx] || rec.recommendedSlots[0];
            initialAssignments[bNum] = pick.slotId;
          } else if (futureSlots.length > 0) {
            initialAssignments[bNum] = futureSlots[idx % futureSlots.length].id;
          }
        });
      }
      if (planRes.batchPlan) {
        for (const b of planRes.batchPlan.batches) {
          if (!initialAssignments[b.batchNumber]) {
            if (b.batchNumber === 1 && selectedSlot) {
              initialAssignments[1] = selectedSlot.id;
            } else if (futureSlots.length > 0) {
              initialAssignments[b.batchNumber] = futureSlots[0].id;
            }
          }
        }
      }
      setBatchSlotAssignments(initialAssignments);
      setStep(3);
    } catch (err: any) {
      setPlanningError(err.message || 'Failed to generate batch plan.');
      setStep(3);
    } finally {
      setIsPlanningLoading(false);
    }
  };

  const handleConfirmBooking = async () => {
    if (!selectedSlot || !isGarmentsValid) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const res = await api.bookSlot({
        slotId: selectedSlot.id,
        tShirtShirtCount: garments.shirt + garments.tshirt,
        pantsTrackCount: garments.pants + garments.jeans + garments.shorts,
        aiScanId: aiScanId || undefined,
      });
      if (res.success && res.booking) {
        setConfirmedBooking(res.booking);
        setStep(4);
        loadData();
      }
    } catch (err: any) {
      setSubmitError(err.message || 'Booking failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Phase 4: Atomic Multi-Batch Confirmation Handler
  const handleConfirmMultiBatch = async () => {
    if (!smartPlan?.batchPlan) return;
    setIsSubmitting(true);
    setSubmitError(null);

    const assignments = smartPlan.batchPlan.batches.map((b) => ({
      batchNumber: b.batchNumber,
      slotId: batchSlotAssignments[b.batchNumber] || (b.batchNumber === 1 && selectedSlot ? selectedSlot.id : ''),
    }));

    if (assignments.some((a) => !a.slotId)) {
      setSubmitError('Please select a laundry slot for all planned batches before confirming.');
      setIsSubmitting(false);
      return;
    }

    const countsPayload: Record<string, number> = { ...garments };
    for (const item of unresolvedItems) {
      countsPayload[item.className] = item.count;
    }

    try {
      const res = await api.bookMultiBatch({
        garmentCounts: countsPayload,
        batchSlotAssignments: assignments,
        idempotencyKey,
      });

      if (res.success) {
        setConfirmedBatchGroup(res);
        setStep(4);
        loadData();
      }
    } catch (err: any) {
      setSubmitError(
        err.message ||
          'Multi-batch booking failed. Atomic rollback guaranteed: no partial batches were booked.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Render ────────────────────────────────────

  if (isLoadingData) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <LoadingSpinner text="Loading available slots..." />
      </div>
    );
  }

  if (dataError) {
    return (
      <div className="max-w-xl mx-auto py-8">
        <ErrorAlert message={dataError} />
        <Button variant="outline" className="mt-4" onClick={loadData}>
          Try Again
        </Button>
      </div>
    );
  }

  // ── Step 4: Success ──────────────────────────────

  // ── Step 4: Success ──────────────────────────────

  if (step === 4 && (confirmedBooking || confirmedBatchGroup)) {
    if (confirmedBatchGroup) {
      return (
        <PageTransition className="max-w-xl mx-auto py-8">
          <motion.div
            variants={staggerContainerVariants}
            initial={shouldReduceMotion ? false : 'initial'}
            animate="animate"
            className="text-center mb-8"
          >
            <motion.div
              variants={shouldReduceMotion ? undefined : successIconVariants}
              className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4 border-4 border-emerald-200 shadow-sm"
            >
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </motion.div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              All Batches Confirmed!
            </h1>
            <p className="text-sm text-slate-500 mt-1.5">
              All {confirmedBatchGroup.totalBatches} batches have been booked atomically in a single interactive transaction.
            </p>
            {confirmedBatchGroup.isIdempotentReplay && (
              <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-semibold">
                <Info className="w-3.5 h-3.5" />
                Confirmed from prior request (Idempotent Replay)
              </div>
            )}
          </motion.div>

          <motion.div
            variants={shouldReduceMotion ? undefined : loginCardVariants}
            initial={shouldReduceMotion ? false : 'initial'}
            animate="animate"
            className="space-y-4 mb-6"
          >
            {/* Student Permanent QR Code Verification */}
            {qrToken && (
              <Card className="border-water-200 bg-water-50/50 text-center py-4">
                <span className="text-xs font-bold text-water-900 uppercase tracking-wide block mb-2">
                  Student Verification QR Token
                </span>
                <div className="p-3 bg-white rounded-xl shadow-xs border border-slate-200 inline-block mx-auto mb-2">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrToken)}`}
                    alt="Student Permanent QR Code"
                    className="w-32 h-32 rounded mx-auto"
                  />
                </div>
                <div className="block">
                  <span className="font-mono text-xs text-slate-700 bg-white px-3 py-1 rounded-md border border-slate-200 inline-block">
                    {qrToken}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-2">
                  Present this permanent QR code or token to laundry staff upon dropping off garments.
                </p>
              </Card>
            )}

            <Card className="border-emerald-200 bg-emerald-50/40">
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-emerald-100">
                  <span className="text-xs text-slate-500 uppercase tracking-wide font-semibold">
                    Batch Group ID
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-800">
                    {confirmedBatchGroup.batchGroupId}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-emerald-100">
                  <span className="text-xs text-slate-500 uppercase tracking-wide font-semibold">
                    Total Batches Booked
                  </span>
                  <span className="text-sm font-bold text-slate-800">
                    {confirmedBatchGroup.totalBatches} batches
                  </span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-xs text-slate-500 uppercase tracking-wide font-semibold">
                    Total Confirmed Weight
                  </span>
                  <span className="text-sm font-extrabold text-water-700">
                    {confirmedBatchGroup.totalWeightGrams.toLocaleString()} g
                  </span>
                </div>
              </div>
            </Card>

            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide pt-2">
              Assigned Slots by Batch
            </h3>

            {confirmedBatchGroup.bookings.map((b) => (
              <Card key={b.id} className="border-slate-200 bg-white">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-water-600 text-white font-extrabold text-xs flex items-center justify-center">
                      {b.batchNumber}
                    </span>
                    <span className="font-bold text-xs text-slate-900">
                      Batch {b.batchNumber} of {b.totalBatches}
                    </span>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    {b.status}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs py-2 border-b border-slate-100">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">Slot Date</span>
                    <span className="font-semibold text-slate-800">{formatDate(b.slot.date)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">Slot Time</span>
                    <span className="font-semibold text-slate-800">
                      {b.slot.startTime} – {b.slot.endTime}
                    </span>
                  </div>
                </div>
                <div className="pt-2 flex items-center justify-between text-xs">
                  <div className="text-[11px] text-slate-600">
                    {Object.entries(b.garmentCounts)
                      .filter(([_, cnt]) => cnt > 0)
                      .map(([gType, cnt]) => `${gType}: ${cnt}`)
                      .join(', ')}
                  </div>
                  <span className="font-bold text-water-700">{b.weightGrams} g</span>
                </div>
              </Card>
            ))}
          </motion.div>

          <Button
            variant="primary"
            size="lg"
            className="w-full"
            onClick={() => navigate('/student/dashboard')}
          >
            View Dashboard
          </Button>
        </PageTransition>
      );
    }

    if (confirmedBooking) {
      return (
        <PageTransition className="max-w-md mx-auto py-8">
          <motion.div
            variants={staggerContainerVariants}
            initial={shouldReduceMotion ? false : 'initial'}
            animate="animate"
            className="text-center mb-8"
          >
            <motion.div
              variants={shouldReduceMotion ? undefined : successIconVariants}
              className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4 border-4 border-emerald-200"
            >
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </motion.div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Booking Confirmed</h1>
            <p className="text-sm text-slate-500 mt-1.5">Your laundry slot has been successfully booked.</p>
          </motion.div>

          <motion.div
            variants={shouldReduceMotion ? undefined : loginCardVariants}
            initial={shouldReduceMotion ? false : 'initial'}
            animate="animate"
          >
            {/* Student Permanent QR Code Verification */}
            {qrToken && (
              <Card className="border-water-200 bg-water-50/50 text-center py-4 mb-4">
                <span className="text-xs font-bold text-water-900 uppercase tracking-wide block mb-2">
                  Student Verification QR Token
                </span>
                <div className="p-3 bg-white rounded-xl shadow-xs border border-slate-200 inline-block mx-auto mb-2">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrToken)}`}
                    alt="Student Permanent QR Code"
                    className="w-32 h-32 rounded mx-auto"
                  />
                </div>
                <div className="block">
                  <span className="font-mono text-xs text-slate-700 bg-white px-3 py-1 rounded-md border border-slate-200 inline-block">
                    {qrToken}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-2">
                  Present this permanent QR code or token to laundry staff upon dropping off garments.
                </p>
              </Card>
            )}

            <Card className="border-emerald-200 bg-emerald-50/40 mb-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-emerald-100">
                  <span className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Status</span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    BOOKED
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-emerald-100">
                  <span className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Date</span>
                  <span className="text-sm font-semibold text-slate-800">{formatDate(confirmedBooking.slot.date)}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-emerald-100">
                  <span className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Time</span>
                  <span className="text-sm font-semibold text-slate-800">
                    {confirmedBooking.slot.startTime} – {confirmedBooking.slot.endTime}
                  </span>
                </div>
                {confirmedBooking.itemCount && (
                  <>
                    <div className="flex items-center justify-between py-2 border-b border-emerald-100">
                      <span className="text-xs text-slate-500 uppercase tracking-wide font-semibold">T-shirt / Shirt</span>
                      <span className="text-sm font-semibold text-slate-800">{confirmedBooking.itemCount.tShirtShirtCount} items</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-emerald-100">
                      <span className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Pants / Track</span>
                      <span className="text-sm font-semibold text-slate-800">{confirmedBooking.itemCount.pantsTrackCount} items</span>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <span className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Total Clothes</span>
                      <span className="text-sm font-bold text-water-700">{confirmedBooking.itemCount.totalCount} / 20</span>
                    </div>
                  </>
                )}
              </div>
            </Card>
          </motion.div>

          <Button
            variant="primary"
            size="lg"
            className="w-full"
            onClick={() => navigate('/student/dashboard')}
          >
            View Dashboard
          </Button>
        </PageTransition>
      );
    }
  }

  return (
    <PageTransition className="max-w-2xl mx-auto py-6 space-y-6">
      {/* Header */}
      <div>
        <button
          onClick={() => {
            if (step === 1) navigate('/student/dashboard');
            else setStep((s) => (s - 1) as BookingStep);
          }}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-water-700 mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {step === 1 ? 'Back to Dashboard' : 'Back'}
        </button>

        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Book Laundry</h1>
        <p className="text-sm text-slate-500 mt-1">Complete all 3 steps to confirm your booking.</p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-2">
        {(['Select Slot', 'Clothes Count', 'Review'].map((label, i) => {
          const stepNum = (i + 1) as 1 | 2 | 3;
          const isCompleted = step > stepNum;
          const isCurrent = step === stepNum;
          return (
            <React.Fragment key={label}>
              <div className={`flex items-center gap-2 ${isCurrent ? 'text-water-700' : isCompleted ? 'text-emerald-600' : 'text-slate-400'}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 flex-shrink-0 transition-colors
                  ${isCompleted ? 'bg-emerald-100 border-emerald-400 text-emerald-700' : isCurrent ? 'bg-water-100 border-water-500 text-water-700' : 'bg-slate-100 border-slate-300 text-slate-400'}`}>
                  {isCompleted ? <CheckCircle2 className="w-3.5 h-3.5" /> : stepNum}
                </div>
                <span className="text-xs font-semibold hidden sm:block">{label}</span>
              </div>
              {i < 2 && <div className={`flex-1 h-px ${step > stepNum ? 'bg-emerald-300' : 'bg-slate-200'}`} />}
            </React.Fragment>
          );
        }))}
      </div>

      {/* Monthly Limit Info */}
      {usage && (
        <div className={`flex items-center gap-3 p-3 rounded-xl border text-sm ${
          !usage.canBook
            ? 'bg-red-50 border-red-200 text-red-800'
            : usage.remainingCount <= 1
            ? 'bg-amber-50 border-amber-200 text-amber-800'
            : 'bg-water-50 border-water-200 text-water-800'
        }`}>
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="text-xs font-medium">
            {!usage.canBook
              ? `Monthly limit reached. You have used all ${usage.maxCount} laundry bookings for ${usage.month}.`
              : `${usage.usedCount} of ${usage.maxCount} monthly uses — ${usage.remainingCount} remaining for ${usage.month}.`}
          </span>
        </div>
      )}

      <AnimatePresence mode="wait">
        {/* STEP 1: Select Slot */}
        {step === 1 && (
          <motion.div
            key="step-1"
            variants={shouldReduceMotion ? undefined : stepVariants}
            initial={shouldReduceMotion ? false : 'initial'}
            animate="animate"
            exit="exit"
            className="space-y-6"
          >
          {/* Active Booking Notice if resident already holds a reservation */}
          {existingActiveBooking && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 text-xs">
                <strong className="block text-sm font-bold text-amber-950 mb-1">
                  Active Booking Already In Progress
                </strong>
                <p className="text-amber-800 mb-2">
                  You already have an active laundry reservation scheduled for <strong>{formatDate(existingActiveBooking.slot.date)} ({existingActiveBooking.slot.startTime} – {existingActiveBooking.slot.endTime})</strong>.
                  Hostel policy allows 1 active session at a time.
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => navigate('/student/dashboard')}
                  >
                    Manage Active Booking in Dashboard
                  </Button>
                </div>
              </div>
            </div>
          )}

          {!usage?.canBook ? (
            <Card className="border-red-200 bg-red-50/40 text-center py-8">
              <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
              <h3 className="text-base font-bold text-red-800 mb-1">Monthly Limit Reached</h3>
              <p className="text-sm text-red-600">
                You have used all {usage?.maxCount} laundry bookings for {usage?.month}. New bookings open on the 1st of next month.
              </p>
            </Card>
          ) : Object.keys(slotsByDate).length === 0 ? (
            <Card className="border-slate-200 text-center py-10">
              <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-600 mb-1">No Available Slots</h3>
              <p className="text-sm text-slate-500">
                There are currently no laundry slots available for your hostel. Please check back later.
              </p>
            </Card>
          ) : (
            Object.entries(slotsByDate).map(([date, dateSlots]) => (
              <div key={date}>
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="w-3.5 h-3.5 text-water-600" />
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                    {getDateLabel(date)}
                  </h3>
                  <span className="text-xs text-slate-400">· {formatDate(date)}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {dateSlots.map((slot) => (
                    <SlotCard
                      key={slot.id}
                      slot={slot}
                      isSelected={selectedSlot?.id === slot.id}
                      onSelect={() => setSelectedSlot(slot)}
                    />
                  ))}
                </div>
              </div>
            ))
          )}

          {/* Sticky Floating Bottom Continue Bar when Slot Selected */}
          {selectedSlot && usage?.canBook && (
            <div className="sticky bottom-4 z-30 p-3.5 sm:p-4 rounded-2xl bg-white/95 backdrop-blur-md border-2 border-water-500 shadow-xl flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-water-100 text-water-700 flex items-center justify-center font-bold flex-shrink-0">
                  <CheckCircle2 className="w-5 h-5 text-water-600" />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-800 block">
                    {formatDate(selectedSlot.date)}
                  </span>
                  <span className="text-[11px] text-water-700 font-semibold">
                    {selectedSlot.startTime} – {selectedSlot.endTime} &middot; {selectedSlot.availableSpots} spots left
                  </span>
                </div>
              </div>
              <Button
                variant="primary"
                size="md"
                onClick={handleGoToStep2}
                icon={<ChevronRight className="w-4 h-4" />}
                iconPosition="right"
              >
                Continue to Clothes Count
              </Button>
            </div>
          )}

          {usage?.canBook && !selectedSlot && (
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              disabled={true}
              icon={<ChevronRight className="w-4 h-4" />}
              iconPosition="right"
            >
              Select a Slot to Continue
            </Button>
          )}
          </motion.div>
        )}

        {/* STEP 2: Clothing Count */}
        {step === 2 && selectedSlot && (
          <motion.div
            key="step-2"
            variants={shouldReduceMotion ? undefined : stepVariants}
            initial={shouldReduceMotion ? false : 'initial'}
            animate="animate"
            exit="exit"
            className="space-y-5"
          >
          {/* Selected slot reminder */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-water-50 border border-water-200">
            <Clock className="w-4 h-4 text-water-600 flex-shrink-0" />
            <div className="text-xs">
              <span className="font-bold text-water-900">{formatShortDate(selectedSlot.date)}</span>
              <span className="text-water-700 ml-2">
                {selectedSlot.startTime} – {selectedSlot.endTime}
              </span>
            </div>
          </div>

          {/* Optional AI Laundry Scanner entry point */}
          <div className="p-4 rounded-xl border border-cyan-200 bg-gradient-to-r from-cyan-50/80 via-sky-50/50 to-white shadow-2xs">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-600 text-white flex items-center justify-center flex-shrink-0 shadow-xs">
                  <Camera className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-800">AI Laundry Scanner</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-cyan-100 text-cyan-800 px-2 py-0.5 rounded-full">
                      Optional
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Optional — analyze your clothes before booking.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsScannerOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-white border border-cyan-300 text-xs font-bold text-cyan-800 hover:bg-cyan-50 hover:border-cyan-400 transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer flex-shrink-0"
              >
                <Sparkles className="w-3.5 h-3.5 text-cyan-600" />
                <span>{aiScanData ? 'Re-scan Photo' : 'Scan Clothes'}</span>
              </button>
            </div>

            {/* If AI scan was performed, show transparent AI Estimate summary */}
            {aiScanData && (
              <div className="mt-3 pt-3 border-t border-cyan-100 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-600" />
                    <span className="text-xs font-bold text-cyan-950">AI Scan Attached</span>
                    <span className="text-[9px] font-extrabold uppercase bg-cyan-200 text-cyan-900 px-1.5 py-0.5 rounded">
                      AI Estimate
                    </span>
                  </div>
                  <span className="text-[11px] text-cyan-800 font-medium">
                    Staff verification required
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="bg-white p-2 rounded-lg border border-cyan-100">
                    <span className="text-[10px] text-slate-400 block">AI Visible Estimate</span>
                    <span className="font-bold text-slate-800">{aiScanData.visibleClothingCount} items</span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-cyan-100">
                    <span className="text-[10px] text-slate-400 block">Clothing Type</span>
                    <span className="font-bold text-slate-800">{aiScanData.clothingType}</span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-cyan-100">
                    <span className="text-[10px] text-slate-400 block">Color / Stain</span>
                    <span className="font-bold text-slate-800">
                      {aiScanData.mainColor} &middot; {aiScanData.stainSeverity}
                    </span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-cyan-100">
                    <span className="text-[10px] text-slate-400 block">Care Mode</span>
                    <span className="font-bold text-slate-800">{aiScanData.recommendation.washMode}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-600 bg-white/70 px-3 py-1.5 rounded-lg border border-cyan-100">
                  <span><strong>Student garments:</strong> {totalGarments} items ({totalWeightGrams} g)</span>
                  <span><strong>AI visible estimate:</strong> {aiScanData.visibleClothingCount} clothes</span>
                  <span className="text-amber-700 font-semibold">Staff physically verifies weight at intake</span>
                </div>
              </div>
            )}
          </div>

          <Card className="border-slate-200">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Scale className="w-4 h-4 text-water-600" />
                Garment Weight & Counts
              </h3>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-water-100 text-water-800">
                Phase 3 Smart Weight
              </span>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Approved reference weights apply. Session limit is 4,500 g; weekly allowance is 7,000 g.
            </p>

            {/* 5 Approved Garment Categories */}
            <div className="space-y-3.5">
              {[
                { key: 'shirt', label: 'Shirt', weight: 200, emoji: '👔' },
                { key: 'tshirt', label: 'T-shirt', weight: 180, emoji: '👕' },
                { key: 'pants', label: 'Pants', weight: 350, emoji: '👖' },
                { key: 'jeans', label: 'Jeans', weight: 600, emoji: '👖' },
                { key: 'shorts', label: 'Shorts', weight: 200, emoji: '🩳' },
              ].map(({ key, label, weight, emoji }) => {
                const garmentKey = key as keyof DetailedGarmentCounts;
                const count = garments[garmentKey];
                return (
                  <div
                    key={key}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 hover:bg-slate-50/80 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-lg">{emoji}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-800">{label}</span>
                          <span className="text-[10px] font-medium text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                            {weight} g / item
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-500">
                          Subtotal: <strong className="text-slate-700">{count * weight} g</strong>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleGarmentChange(garmentKey, String(Math.max(0, count - 1)))}
                        className="w-8 h-8 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 flex items-center justify-center text-slate-700 font-bold text-base transition-colors focus:outline-none focus:ring-2 focus:ring-water-400"
                        aria-label={`Decrease ${label} count`}
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min={0}
                        max={30}
                        value={count}
                        onChange={(e) => handleGarmentChange(garmentKey, e.target.value)}
                        className="w-14 text-center text-base font-bold text-slate-900 border border-slate-300 rounded-lg py-1 focus:outline-none focus:ring-2 focus:ring-water-400 bg-white"
                        aria-label={`${label} count`}
                      />
                      <button
                        type="button"
                        onClick={() => handleGarmentChange(garmentKey, String(Math.min(30, count + 1)))}
                        className="w-8 h-8 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 flex items-center justify-center text-slate-700 font-bold text-base transition-colors focus:outline-none focus:ring-2 focus:ring-water-400"
                        aria-label={`Increase ${label} count`}
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Live Weight & Session Limit Bar */}
            <div className="mt-5 p-4 rounded-xl bg-gradient-to-br from-water-50/70 to-blue-50/50 border border-water-200">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Scale className="w-3.5 h-3.5 text-water-600" />
                    Total Estimated Weight
                  </span>
                  <span className="text-xs text-slate-500">
                    {totalGarments} garment{totalGarments === 1 ? '' : 's'} selected
                  </span>
                </div>
                <div className="text-right">
                  <span className={`text-lg font-extrabold ${
                    totalWeightGrams > WEEKLY_ALLOWANCE_LIMIT_GRAMS
                      ? 'text-red-600'
                      : totalWeightGrams > SESSION_LIMIT_GRAMS
                      ? 'text-amber-600'
                      : 'text-water-700'
                  }`}>
                    {totalWeightGrams.toLocaleString()} g
                  </span>
                  <span className="text-[10px] block text-slate-500">
                    Session Limit: 4,500 g
                  </span>
                </div>
              </div>

              {/* Progress toward single session limit (4500g) */}
              <div className="w-full bg-slate-200 rounded-full h-2 mb-2 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    totalWeightGrams > WEEKLY_ALLOWANCE_LIMIT_GRAMS
                      ? 'bg-red-500'
                      : totalWeightGrams > SESSION_LIMIT_GRAMS
                      ? 'bg-amber-500'
                      : 'bg-water-600'
                  }`}
                  style={{ width: `${Math.min(100, (totalWeightGrams / SESSION_LIMIT_GRAMS) * 100)}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-600">
                <span>
                  {totalWeightGrams <= SESSION_LIMIT_GRAMS ? (
                    <span className="text-emerald-700 font-semibold">Fits in 1 session batch</span>
                  ) : (
                    <span className="text-amber-700 font-semibold flex items-center gap-1">
                      <Layers className="w-3 h-3" />
                      Requires {Math.ceil(totalWeightGrams / SESSION_LIMIT_GRAMS)} batches (Smart Planner will pack garments)
                    </span>
                  )}
                </span>
                <span className="text-slate-500">Weekly Max: 7,000 g</span>
              </div>
            </div>

            {/* Unresolved items banner (if detected by YOLO without approved weight) */}
            {unresolvedItems.length > 0 && (
              <div className="mt-4 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-amber-900 mb-1">
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <span>Garments Requiring Review ({unresolvedItems.length})</span>
                </div>
                <p className="text-amber-800 text-[11px] mb-2">
                  The following detected item class(es) have no approved reference weight and cannot be confirmed without classification:
                </p>
                <div className="space-y-1">
                  {unresolvedItems.map((u, i) => (
                    <div key={i} className="flex justify-between text-[11px] bg-white/70 px-2.5 py-1 rounded border border-amber-100 text-amber-900">
                      <span className="font-semibold uppercase">{u.className}</span>
                      <span>{u.count} item(s) &middot; Pending staff review</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {countError && (
              <div className="mt-3 flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2.5">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                {countError}
              </div>
            )}
          </Card>

          <Button
            variant="primary"
            size="lg"
            className="w-full"
            disabled={!isGarmentsValid || isPlanningLoading}
            isLoading={isPlanningLoading}
            onClick={handleGoToReview}
            icon={<ChevronRight className="w-4 h-4" />}
            iconPosition="right"
          >
            Review & Plan Smart Batches
          </Button>
        </motion.div>
      )}

      {/* STEP 3: Smart Batch Plan & Review */}
      {step === 3 && selectedSlot && (
        <motion.div
          key="step-3"
          variants={shouldReduceMotion ? undefined : stepVariants}
          initial={shouldReduceMotion ? false : 'initial'}
          animate="animate"
          exit="exit"
          className="space-y-5"
        >
          {planningError && (
            <ErrorAlert message={planningError} onDismiss={() => setPlanningError(null)} />
          )}

          {/* Planning Status Banner */}
          {smartPlan && (
            <div className={`p-4 rounded-xl border flex items-start gap-3 ${
              smartPlan.planningStatus === 'CONFIRMED'
                ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                : smartPlan.planningStatus === 'EXCEEDS_ALLOWANCE'
                ? 'bg-red-50/80 border-red-200 text-red-900'
                : 'bg-amber-50/80 border-amber-200 text-amber-900'
            }`}>
              {smartPlan.planningStatus === 'CONFIRMED' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              ) : smartPlan.planningStatus === 'EXCEEDS_ALLOWANCE' ? (
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              )}
              <div>
                <div className="font-bold text-sm">
                  {smartPlan.planningStatus === 'CONFIRMED' && 'Smart Batch Plan Confirmed'}
                  {smartPlan.planningStatus === 'REQUIRES_REVIEW' && 'Classification Required'}
                  {smartPlan.planningStatus === 'EXCEEDS_ALLOWANCE' && 'Load Exceeds Weekly Allowance'}
                  {smartPlan.planningStatus === 'NO_SLOTS' && 'No Available Slots for Batch'}
                  {smartPlan.planningStatus === 'UNBATCHABLE' && 'Unbatchable Garments Detected'}
                </div>
                <div className="text-xs mt-0.5 opacity-90">
                  {smartPlan.planningStatus === 'CONFIRMED' &&
                    'All garments are classified with approved reference weights and respect session & scheduled-week limits.'}
                  {smartPlan.planningStatus === 'REQUIRES_REVIEW' &&
                    'Some items lack approved reference weights. Please review them before confirming.'}
                  {smartPlan.planningStatus === 'EXCEEDS_ALLOWANCE' &&
                    `This load exceeds your available weekly allowance of ${smartPlan.weeklyAllowance.maxWeeklyAllowanceGrams} g.`}
                  {smartPlan.planningStatus === 'NO_SLOTS' &&
                    'Insufficient future slots were found in your assigned facility to accommodate all planned batches.'}
                </div>
              </div>
            </div>
          )}

          {/* Scheduled-Week Allowance Card */}
          {smartPlan && (
            <Card className="border-slate-200">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-water-600" />
                  <span className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                    Weekly Allowance (Scheduled-Week Rule)
                  </span>
                </div>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-water-100 text-water-800">
                  {smartPlan.weeklyAllowance.scheduledWeek.weekLabel}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 my-3 text-xs">
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-[10px] text-slate-500 block">Weekly Max</span>
                  <span className="font-bold text-slate-800">
                    {smartPlan.weeklyAllowance.maxWeeklyAllowanceGrams.toLocaleString()} g
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-[10px] text-slate-500 block">Committed Weight</span>
                  <span className="font-bold text-slate-800">
                    {smartPlan.weeklyAllowance.committedWeightGrams.toLocaleString()} g
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-[10px] text-slate-500 block">This Request</span>
                  <span className="font-bold text-water-700">
                    +{smartPlan.weeklyAllowance.proposedWeightGrams.toLocaleString()} g
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-[10px] text-slate-500 block">Remaining Balance</span>
                  <span className={`font-bold ${
                    smartPlan.weeklyAllowance.remainingAllowanceGrams >= smartPlan.weeklyAllowance.proposedWeightGrams
                      ? 'text-emerald-700'
                      : 'text-red-600'
                  }`}>
                    {Math.max(
                      0,
                      smartPlan.weeklyAllowance.remainingAllowanceGrams - smartPlan.weeklyAllowance.proposedWeightGrams
                    ).toLocaleString()}{' '}
                    g
                  </span>
                </div>
              </div>

              {smartPlan.weeklyAllowance.hasLegacyUnweightedBookings && (
                <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-900 flex items-start gap-2">
                  <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <span>{smartPlan.weeklyAllowance.warning}</span>
                </div>
              )}
            </Card>
          )}

          {/* Planned Batches & Advisory Slot Recommendations */}
          {smartPlan?.batchPlan && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-water-600" />
                  Planned Batches ({smartPlan.batchPlan.totalBatches}) &amp; Advisory Slots
                </h4>
                <span className="text-[11px] text-slate-500 font-medium">
                  Facility: <strong>{smartPlan.facility.name}</strong>
                </span>
              </div>

              {smartPlan.batchRecommendations.map((rec, idx) => {
                const assignedSlotId = batchSlotAssignments[rec.batch.batchNumber];
                const assignedSlot = futureSlots.find((s) => s.id === assignedSlotId);

                return (
                  <Card
                    key={idx}
                    className={`border-2 transition-all ${
                      assignedSlotId ? 'border-water-300 bg-white' : 'border-amber-300 bg-amber-50/20'
                    }`}
                  >
                    <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-water-600 text-white font-extrabold text-xs flex items-center justify-center">
                          {rec.batch.batchNumber}
                        </span>
                        <span className="font-bold text-xs text-slate-800">
                          Batch {rec.batch.batchNumber} of {rec.batch.totalBatches}
                        </span>
                        {assignedSlot ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Slot Selected
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                            Slot Required
                          </span>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="font-extrabold text-xs text-water-800">
                          {rec.batch.weightGrams} g
                        </span>
                        <span className="text-[10px] text-slate-400 block">/ 4,500 g max</span>
                      </div>
                    </div>

                    {/* Garment breakdown for this batch */}
                    <div className="py-2.5 border-b border-slate-100 text-xs">
                      <span className="text-[11px] font-semibold text-slate-500 block mb-1">
                        Garments in this batch ({rec.batch.itemCount} items):
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(rec.batch.garmentCounts)
                          .filter(([_, count]) => count > 0)
                          .map(([type, count]) => (
                            <span
                              key={type}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-medium"
                            >
                              <span className="capitalize">{type}:</span>
                              <strong>{count}</strong>
                            </span>
                          ))}
                      </div>
                    </div>

                    {/* Visible Selected Slot Preview */}
                    {assignedSlot && (
                      <div className="my-2.5 p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-200 text-xs flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                          <div>
                            <span className="font-bold text-slate-800">
                              {formatDate(assignedSlot.date)}
                            </span>
                            <span className="text-slate-600 text-[11px] block">
                              {assignedSlot.startTime} – {assignedSlot.endTime}
                            </span>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold text-emerald-700 bg-white px-2 py-1 rounded border border-emerald-200">
                          Assigned to Batch {rec.batch.batchNumber}
                        </span>
                      </div>
                    )}

                    {/* Advisory Recommended Slots */}
                    <div className="pt-2">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-water-600" />
                          Recommended Slots (Advisory):
                        </span>
                        <span className="text-[10px] bg-sky-100 text-sky-800 px-1.5 py-0.5 rounded font-bold">
                          Advisory
                        </span>
                      </div>

                      {rec.recommendedSlots && rec.recommendedSlots.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mb-2">
                          {rec.recommendedSlots.slice(0, 4).map((s) => {
                            const isSelected = assignedSlotId === s.slotId;
                            return (
                              <button
                                key={s.slotId}
                                type="button"
                                onClick={() =>
                                  setBatchSlotAssignments((prev) => ({
                                    ...prev,
                                    [rec.batch.batchNumber]: s.slotId,
                                  }))
                                }
                                className={`p-2 rounded-lg text-left text-xs transition-all border flex items-center justify-between ${
                                  isSelected
                                    ? 'border-water-600 bg-water-50 ring-2 ring-water-400 font-bold'
                                    : 'border-slate-200 bg-slate-50 hover:bg-water-50/50'
                                }`}
                              >
                                <div>
                                  <div className="text-slate-800 font-semibold">
                                    {formatShortDate(s.date)} &middot; {s.startTime}
                                  </div>
                                  <div className="text-[10px] text-slate-500">
                                    {s.scheduledWeekLabel}
                                  </div>
                                </div>
                                <span className="text-[10px] font-semibold text-emerald-700 bg-white px-1.5 py-0.5 rounded border border-emerald-200">
                                  {s.availableSpots} left
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="p-2.5 rounded-lg bg-amber-50 text-[11px] text-amber-800 mb-2">
                          No advisory recommendations found. Select a slot below.
                        </div>
                      )}

                      {/* Select Any Available Slot */}
                      <div className="mt-2">
                        <label className="text-[10px] text-slate-500 block mb-1">
                          Or select any available slot in {smartPlan.facility.name}:
                        </label>
                        <select
                          value={assignedSlotId || ''}
                          onChange={(e) =>
                            setBatchSlotAssignments((prev) => ({
                              ...prev,
                              [rec.batch.batchNumber]: e.target.value,
                            }))
                          }
                          className="w-full text-xs font-medium text-slate-800 bg-white border border-slate-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-water-400"
                        >
                          <option value="">-- Choose a slot for Batch {rec.batch.batchNumber} --</option>
                          {futureSlots.map((s) => (
                            <option key={s.id} value={s.id} disabled={s.isFull}>
                              {formatShortDate(s.date)} ({s.startTime} – {s.endTime}) — {s.availableSpots} spots left {s.isFull ? '(FULL)' : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Phase 4 Atomic Concurrency Notice */}
          <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200 text-xs text-blue-900 flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <strong className="block font-bold">Atomic Multi-Batch Guarantee</strong>
              All batch reservations are processed together in a single interactive transaction. If any slot becomes full or validation fails, all bookings roll back completely.
            </div>
          </div>

          {submitError && (
            <ErrorAlert message={submitError} onDismiss={() => setSubmitError(null)} />
          )}

          {smartPlan?.batchPlan && smartPlan.batchPlan.totalBatches > 1 && !smartPlan.batchPlan.batches.every((b) => !!batchSlotAssignments[b.batchNumber]) && (
            <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span>Please assign a slot to each batch above to enable confirmation.</span>
            </div>
          )}

          <div className="flex gap-3">
            <Button
              variant="outline"
              size="lg"
              className="flex-1"
              onClick={() => setStep(2)}
              icon={<ArrowLeft className="w-4 h-4" />}
            >
              Edit Garments
            </Button>

            {smartPlan?.batchPlan && smartPlan.batchPlan.totalBatches === 1 && smartPlan.isActionable ? (
              <Button
                variant="primary"
                size="lg"
                className="flex-1"
                isLoading={isSubmitting}
                onClick={handleConfirmMultiBatch}
                icon={<CheckCircle2 className="w-4 h-4" />}
              >
                Confirm Single Booking
              </Button>
            ) : smartPlan?.batchPlan && smartPlan.batchPlan.totalBatches > 1 && smartPlan.isActionable ? (
              <Button
                variant="primary"
                size="lg"
                className="flex-1"
                isLoading={isSubmitting}
                disabled={
                  isSubmitting ||
                  !smartPlan.batchPlan.batches.every((b) => !!batchSlotAssignments[b.batchNumber])
                }
                onClick={handleConfirmMultiBatch}
                icon={<CheckCircle2 className="w-4 h-4" />}
              >
                Confirm All Batches ({smartPlan.batchPlan.totalBatches})
              </Button>
            ) : (
              <Button
                variant="primary"
                size="lg"
                className="flex-1"
                disabled={true}
              >
                {smartPlan?.planningStatus === 'EXCEEDS_ALLOWANCE'
                  ? 'Exceeds Weekly Allowance'
                  : smartPlan?.planningStatus === 'REQUIRES_REVIEW'
                  ? 'Review Required'
                  : 'Multi-Batch Booking'}
              </Button>
            )}
          </div>
        </motion.div>
      )}
      </AnimatePresence>

      {/* Optional AI Laundry Scanner Modal */}
      <AiLaundryScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanComplete={(scanId, estimate, detectedCounts) => {
          setAiScanId(scanId);
          setAiScanData(estimate);
          if (detectedCounts?.rawSummary?.counts) {
            const raw = detectedCounts.rawSummary.counts;
            setGarments({
              shirt: raw['shirt'] || 0,
              tshirt: raw['tshirt'] || 0,
              pants: raw['pant'] || 0,
              jeans: raw['jeans'] || 0,
              shorts: raw['shorts'] || 0,
            });

            const unapproved: Array<{ className: string; count: number; reason: string }> = [];
            for (const [cls, cnt] of Object.entries(raw)) {
              const lower = cls.toLowerCase();
              if (!['shirt', 'tshirt', 'pant', 'jeans', 'shorts'].includes(lower) && cnt > 0) {
                unapproved.push({
                  className: cls,
                  count: cnt,
                  reason: `Item class "${cls}" has no approved reference weight and requires classification/review.`,
                });
              }
            }
            setUnresolvedItems(unapproved);
            setCountError(null);
          } else if (detectedCounts) {
            setGarments({
              shirt: 0,
              tshirt: detectedCounts.tShirtShirt || 0,
              pants: detectedCounts.pantsTrack || 0,
              jeans: 0,
              shorts: 0,
            });
            setCountError(null);
          }
        }}
      />
    </PageTransition>
  );
};

