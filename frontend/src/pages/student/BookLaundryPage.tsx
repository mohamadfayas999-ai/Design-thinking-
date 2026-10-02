import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  Calendar,
  Clock,
  Shirt,
  CheckCircle2,
  ChevronRight,
  AlertCircle,
  Users,
  ArrowLeft,
} from 'lucide-react';
import { api } from '../../services/api';
import { LaundrySlot, MonthlyUsage, ActiveBooking } from '../../types';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { PageTransition } from '../../components/common/PageTransition';
import {
  stepVariants,
  successIconVariants,
  loginCardVariants,
  staggerContainerVariants,
} from '../../utils/animations';

// ── Types ──────────────────────────────────────

type BookingStep = 1 | 2 | 3 | 4;

interface ClothingCounts {
  tShirtShirt: number;
  pantsTrack: number;
}

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
  const [counts, setCounts] = useState<ClothingCounts>({ tShirtShirt: 0, pantsTrack: 0 });
  const [countError, setCountError] = useState<string | null>(null);

  // Submission
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmedBooking, setConfirmedBooking] = useState<ActiveBooking | null>(null);

  // Group slots by date
  const slotsByDate = slots.reduce<Record<string, LaundrySlot[]>>((acc, slot) => {
    if (!acc[slot.date]) acc[slot.date] = [];
    acc[slot.date].push(slot);
    return acc;
  }, {});

  const loadData = useCallback(async () => {
    setIsLoadingData(true);
    setDataError(null);
    try {
      const [slotsRes, usageRes] = await Promise.all([
        api.getAvailableSlots(),
        api.getStudentUsage(),
      ]);
      setSlots(slotsRes.slots || []);
      setUsage(usageRes.usage || null);
    } catch (err: any) {
      setDataError(err.message || 'Failed to load booking data.');
    } finally {
      setIsLoadingData(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const totalClothes = counts.tShirtShirt + counts.pantsTrack;
  const isCountValid = totalClothes >= 1 && totalClothes <= 20 && counts.tShirtShirt >= 0 && counts.pantsTrack >= 0;

  const handleCountChange = (field: keyof ClothingCounts, value: string) => {
    const num = parseInt(value, 10);
    if (value === '' || value === '0') {
      setCounts((prev) => ({ ...prev, [field]: 0 }));
      setCountError(null);
      return;
    }
    if (isNaN(num) || num < 0) {
      setCountError('Please enter a valid clothing count.');
      return;
    }
    if (num > 20) {
      setCountError('Please enter a valid clothing count.');
      return;
    }
    setCountError(null);
    setCounts((prev) => {
      const next = { ...prev, [field]: num };
      const total = next.tShirtShirt + next.pantsTrack;
      if (total > 20) {
        setCountError('Maximum 20 clothes are allowed per laundry submission.');
      } else {
        setCountError(null);
      }
      return next;
    });
  };

  const handleGoToStep2 = () => {
    if (!selectedSlot) return;
    setStep(2);
    setCountError(null);
  };

  const handleGoToReview = () => {
    if (totalClothes < 1) {
      setCountError('Please enter at least 1 clothing item.');
      return;
    }
    if (totalClothes > 20) {
      setCountError('Maximum 20 clothes are allowed per laundry submission.');
      return;
    }
    if (counts.tShirtShirt < 0 || counts.pantsTrack < 0) {
      setCountError('Please enter a valid clothing count.');
      return;
    }
    setCountError(null);
    setStep(3);
  };

  const handleConfirmBooking = async () => {
    if (!selectedSlot || !isCountValid) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const res = await api.bookSlot({
        slotId: selectedSlot.id,
        tShirtShirtCount: counts.tShirtShirt,
        pantsTrackCount: counts.pantsTrack,
      });
      if (res.success && res.booking) {
        setConfirmedBooking(res.booking);
        setStep(4);
      }
    } catch (err: any) {
      setSubmitError(err.message || 'Booking failed. Please try again.');
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

  if (step === 4 && confirmedBooking) {
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

          {usage?.canBook && (
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              disabled={!selectedSlot}
              onClick={handleGoToStep2}
              icon={<ChevronRight className="w-4 h-4" />}
              iconPosition="right"
            >
              {selectedSlot ? `Continue with ${selectedSlot.startTime} – ${selectedSlot.endTime}` : 'Select a Slot to Continue'}
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

          <Card className="border-slate-200">
            <h3 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-2">
              <Shirt className="w-4 h-4 text-water-600" />
              Enter Clothing Counts
            </h3>
            <p className="text-xs text-slate-500 mb-5">Maximum 20 clothes total. Two categories only.</p>

            <div className="space-y-4">
              {/* T-shirt / Shirt */}
              <div>
                <label htmlFor="tshirt-count" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  T-shirt / Shirt
                </label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleCountChange('tShirtShirt', String(Math.max(0, counts.tShirtShirt - 1)))}
                    className="w-9 h-9 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-600 font-bold text-lg transition-colors focus:outline-none focus:ring-2 focus:ring-water-400"
                    aria-label="Decrease t-shirt count"
                  >
                    −
                  </button>
                  <input
                    id="tshirt-count"
                    type="number"
                    min={0}
                    max={20}
                    value={counts.tShirtShirt}
                    onChange={(e) => handleCountChange('tShirtShirt', e.target.value)}
                    className="w-20 text-center text-lg font-bold text-slate-900 border border-slate-200 rounded-lg py-2 focus:outline-none focus:ring-2 focus:ring-water-400 bg-white"
                    aria-label="T-shirt and shirt count"
                  />
                  <button
                    type="button"
                    onClick={() => handleCountChange('tShirtShirt', String(Math.min(20, counts.tShirtShirt + 1)))}
                    className="w-9 h-9 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-600 font-bold text-lg transition-colors focus:outline-none focus:ring-2 focus:ring-water-400"
                    aria-label="Increase t-shirt count"
                  >
                    +
                  </button>
                  <span className="text-xs text-slate-500 ml-1">items</span>
                </div>
              </div>

              {/* Pants / Track */}
              <div>
                <label htmlFor="pants-count" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Pants / Track
                </label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleCountChange('pantsTrack', String(Math.max(0, counts.pantsTrack - 1)))}
                    className="w-9 h-9 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-600 font-bold text-lg transition-colors focus:outline-none focus:ring-2 focus:ring-water-400"
                    aria-label="Decrease pants count"
                  >
                    −
                  </button>
                  <input
                    id="pants-count"
                    type="number"
                    min={0}
                    max={20}
                    value={counts.pantsTrack}
                    onChange={(e) => handleCountChange('pantsTrack', e.target.value)}
                    className="w-20 text-center text-lg font-bold text-slate-900 border border-slate-200 rounded-lg py-2 focus:outline-none focus:ring-2 focus:ring-water-400 bg-white"
                    aria-label="Pants and track count"
                  />
                  <button
                    type="button"
                    onClick={() => handleCountChange('pantsTrack', String(Math.min(20, counts.pantsTrack + 1)))}
                    className="w-9 h-9 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-600 font-bold text-lg transition-colors focus:outline-none focus:ring-2 focus:ring-water-400"
                    aria-label="Increase pants count"
                  >
                    +
                  </button>
                  <span className="text-xs text-slate-500 ml-1">items</span>
                </div>
              </div>
            </div>

            {/* Total counter */}
            <div className={`mt-5 p-3 rounded-xl border flex items-center justify-between ${
              totalClothes > 20
                ? 'bg-red-50 border-red-200'
                : totalClothes === 0
                ? 'bg-slate-50 border-slate-200'
                : 'bg-emerald-50 border-emerald-200'
            }`}>
              <span className="text-xs font-semibold text-slate-600">Total Clothes</span>
              <span className={`text-base font-extrabold ${
                totalClothes > 20 ? 'text-red-700' : totalClothes === 0 ? 'text-slate-400' : 'text-emerald-700'
              }`}>
                {totalClothes} / 20
              </span>
            </div>

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
            disabled={!isCountValid || !!countError}
            onClick={handleGoToReview}
            icon={<ChevronRight className="w-4 h-4" />}
            iconPosition="right"
          >
            Review Booking
          </Button>
        </motion.div>
      )}

      {/* STEP 3: Review */}
      {step === 3 && selectedSlot && (
        <motion.div
          key="step-3"
          variants={shouldReduceMotion ? undefined : stepVariants}
          initial={shouldReduceMotion ? false : 'initial'}
          animate="animate"
          exit="exit"
          className="space-y-5"
        >
          <Card className="border-slate-200">
            <h3 className="text-sm font-bold text-slate-900 mb-4 pb-3 border-b border-slate-100">
              Booking Summary
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Date</span>
                <span className="text-sm font-semibold text-slate-800">{formatDate(selectedSlot.date)}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Time Slot</span>
                <span className="text-sm font-semibold text-slate-800">
                  {selectedSlot.startTime} – {selectedSlot.endTime}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-xs text-slate-500 uppercase tracking-wide font-semibold">T-shirt / Shirt</span>
                <span className="text-sm font-semibold text-slate-800">{counts.tShirtShirt} items</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Pants / Track</span>
                <span className="text-sm font-semibold text-slate-800">{counts.pantsTrack} items</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Total Clothes</span>
                <span className="text-base font-extrabold text-water-700">{totalClothes} / 20</span>
              </div>
            </div>

            {usage && (
              <div className="mt-4 p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600">
                After this booking: <strong className="text-slate-800">{usage.usedCount + 1} / {usage.maxCount}</strong> uses for {usage.month}.
              </div>
            )}
          </Card>

          {submitError && (
            <ErrorAlert message={submitError} onDismiss={() => setSubmitError(null)} />
          )}

          <Button
            variant="primary"
            size="lg"
            className="w-full"
            isLoading={isSubmitting}
            onClick={handleConfirmBooking}
            icon={<CheckCircle2 className="w-4 h-4" />}
          >
            Confirm Booking
          </Button>
        </motion.div>
      )}
      </AnimatePresence>
    </PageTransition>
  );
};
