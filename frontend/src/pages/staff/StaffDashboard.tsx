import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LogOut, Search, RefreshCw, Package, Clock, CheckCircle2,
  AlertCircle, ChevronDown, ChevronUp, Shirt, ArrowRight,
  Loader2, Layers, User, Calendar,
  ClipboardList, Inbox, X, CheckCheck, TriangleAlert, Volume2, VolumeX
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { isSoundEnabled, toggleSound } from '../../utils/sound';
import {
  StaffDashboard as StaffDashboardData,
  StaffBooking,
  RackShelfLocation,
  LaundryOrderDetail,
  TodaySlot
} from '../../types';
import {
  smoothEase,
  staggerContainerVariants,
  staggerItemVariants,
  modalBackdropVariants,
  modalDialogVariants,
  successIconVariants
} from '../../utils/animations';
import { PageTransition } from '../../components/common/PageTransition';

// ── Status helpers ────────────────────────────────────────────

const statusConfig: Record<string, { label: string; cls: string }> = {
  BOOKED: {
    label: 'Waiting',
    cls: 'bg-amber-50 text-amber-700 border border-amber-200',
  },
  IN_PROGRESS: {
    label: 'In Progress',
    cls: 'bg-blue-50 text-blue-700 border border-blue-200',
  },
  COMPLETED: {
    label: 'Completed',
    cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  },
  VERIFIED: {
    label: 'Verified',
    cls: 'bg-teal-50 text-teal-700 border border-teal-200',
  },
  UNDER_REVIEW: {
    label: 'Under Review',
    cls: 'bg-rose-50 text-rose-700 border border-rose-200',
  },
  RESOLVED: {
    label: 'Resolved',
    cls: 'bg-purple-50 text-purple-700 border border-purple-200',
  },
  CANCELLED: {
    label: 'Cancelled',
    cls: 'bg-slate-100 text-slate-500 border border-slate-200',
  },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = statusConfig[status] || { label: status, cls: 'bg-slate-100 text-slate-600' };
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${cfg.cls}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
      {cfg.label}
    </span>
  );
}

// ── Stat Card ─────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  accent: string;
  sub?: string;
}

function StatCard({ label, value, icon, accent, sub }: StatCardProps) {
  return (
    <motion.div
      variants={staggerItemVariants}
      whileHover={{ y: -2, transition: { duration: 0.15, ease: smoothEase } }}
      className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4 hover:border-slate-300 hover:shadow-sm transition-all"
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${accent}`}>
        {icon}
      </div>
      <div>
        <div className="text-2xl font-bold text-slate-900 leading-none">{value}</div>
        <div className="text-xs text-slate-500 mt-0.5">{label}</div>
        {sub && <div className="text-[10px] text-slate-400 mt-0.5">{sub}</div>}
      </div>
    </motion.div>
  );
}

// ── Storage Grid ──────────────────────────────────────────────

function StorageGrid({
  storage,
  selectedId,
  onSelect,
}: {
  storage: RackShelfLocation[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const racks = [1, 2, 3];
  return (
    <div className="space-y-3">
      {racks.map((rack) => {
        const shelves = storage.filter((loc) => loc.rackNumber === rack);
        return (
          <div key={rack}>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Rack {rack}
            </div>
            <div className="grid grid-cols-4 gap-2">
              {shelves.map((loc) => {
                const isSelected = selectedId === loc.id;
                const isOccupied = loc.isOccupied;
                return (
                  <motion.button
                    key={loc.id}
                    type="button"
                    disabled={isOccupied}
                    whileTap={!isOccupied ? { scale: 0.96 } : undefined}
                    onClick={() => !isOccupied && onSelect(loc.id)}
                    title={isOccupied ? `Occupied by ${loc.occupiedBy?.studentName}` : loc.label}
                    className={`
                      relative h-14 rounded-lg border-2 text-[11px] font-semibold transition-all duration-150
                      ${isOccupied
                        ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'
                        : isSelected
                          ? 'border-water-600 bg-water-50 text-water-700 shadow-sm scale-[1.02]'
                          : 'border-emerald-200 bg-emerald-50/60 text-emerald-700 hover:border-emerald-400 hover:bg-emerald-50 cursor-pointer'
                      }
                    `}
                  >
                    <div>S{loc.shelfNumber}</div>
                    <div className={`text-[9px] mt-0.5 font-medium ${isOccupied ? 'text-slate-400' : isSelected ? 'text-water-600' : 'text-emerald-600'}`}>
                      {isOccupied ? 'OCCUPIED' : isSelected ? 'SELECTED' : 'AVAIL'}
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Intake Modal ──────────────────────────────────────────────

interface IntakeModalProps {
  booking: StaffBooking;
  storage: RackShelfLocation[];
  onClose: () => void;
  onSuccess: (order: LaundryOrderDetail) => void;
}

function IntakeModal({ booking, storage, onClose, onSuccess }: IntakeModalProps) {
  const [step, setStep] = useState<'verify' | 'storage' | 'confirm' | 'submitting'>('verify');
  const [hasDiscrepancy, setHasDiscrepancy] = useState(false);
  const [selectedRackShelf, setSelectedRackShelf] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Student declared counts (immutable source of truth)
  const shirts = booking.laundryOrder?.itemCount?.tShirtShirtCount ?? 0;
  const pants = booking.laundryOrder?.itemCount?.pantsTrackCount ?? 0;
  const total = shirts + pants;
  const selectedLoc = storage.find((s) => s.id === selectedRackShelf);

  function handleVerifyProceed() {
    setError(null);
    if (hasDiscrepancy) {
      setError('Cannot proceed with intake while clothing count discrepancy is unresolved.');
      return;
    }
    if (total < 1) {
      setError('Invalid booking count: booking must have at least 1 item.');
      return;
    }
    setStep('storage');
  }

  function handleStorageProceed() {
    setError(null);
    if (!selectedRackShelf) {
      setError('Please select a rack and shelf location.');
      return;
    }
    setStep('confirm');
  }

  async function handleFinalConfirm() {
    setError(null);
    setStep('submitting');
    try {
      const res = await api.performIntake(booking.id, {
        tShirtShirtCount: shirts,
        pantsTrackCount: pants,
        rackShelfId: selectedRackShelf,
      });
      onSuccess(res.order);
    } catch (e: any) {
      setError(e.message || 'Intake failed. Please try again.');
      setStep('confirm');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        variants={modalBackdropVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
      />

      {/* Dialog */}
      <motion.div
        variants={modalDialogVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-6 py-4 flex items-start justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Laundry Intake &bull; Count Verification
            </div>
            <div className="text-white font-bold text-base leading-tight">
              {booking.student.name}
            </div>
            <div className="text-slate-300 text-xs mt-0.5">
              {booking.student.studentId} &middot; {booking.slot.startTime} – {booking.slot.endTime}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>


        {/* Step indicator */}
        <div className="flex border-b border-slate-100">
          {[
            { id: 'verify', label: '1. Verify Booked Count' },
            { id: 'storage', label: '2. Allocate Rack' },
            { id: 'confirm', label: '3. Confirmation' },
          ].map((s, i) => {
            const stepIdx = ['verify', 'storage', 'confirm', 'submitting'].indexOf(step);
            const done = stepIdx > i;
            const active = stepIdx === i || (step === 'submitting' && i === 2);
            return (
              <div key={s.id} className={`flex-1 py-2 text-center text-[11px] font-semibold transition-colors ${
                active ? 'text-water-700 border-b-2 border-water-600 bg-water-50/30' :
                done ? 'text-slate-400' : 'text-slate-300'
              }`}>
                {s.label}
              </div>
            );
          })}
        </div>

        <div className="p-6">
          {/* Step 1: Verify Booked Count */}
          {step === 'verify' && (
            <div className="space-y-4">
              <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-blue-800">
                    Student Declared Booking
                  </span>
                  <span className="text-[10px] font-semibold bg-blue-200 text-blue-800 px-2 py-0.5 rounded-full">
                    Immutable
                  </span>
                </div>
                <div className="text-xs text-blue-900 mb-3">
                  Staff cannot modify student booking quantities. Verify that the clothes received physically match the counts below:
                </div>

                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="bg-white rounded-lg p-3 border border-blue-100 shadow-xs">
                    <div className="text-xs text-slate-500">T-shirt / Shirt</div>
                    <div className="text-xl font-bold text-slate-900 mt-0.5">{shirts}</div>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-blue-100 shadow-xs">
                    <div className="text-xs text-slate-500">Pants / Track</div>
                    <div className="text-xl font-bold text-slate-900 mt-0.5">{pants}</div>
                  </div>
                </div>

                <div className="bg-white rounded-lg px-4 py-2.5 border border-blue-100 flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-700">Total Booked Quantity:</span>
                  <span className="text-base font-bold text-water-700">{total} Items</span>
                </div>
              </div>

              {/* Discrepancy toggle / report */}
              <div className="border border-slate-200 rounded-xl p-3 bg-slate-50">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-slate-800">Count Discrepancy?</div>
                    <div className="text-[11px] text-slate-500">Does physical count differ from {total} items?</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setHasDiscrepancy(!hasDiscrepancy);
                      setError(null);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      hasDiscrepancy
                        ? 'bg-rose-100 border-rose-300 text-rose-800'
                        : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {hasDiscrepancy ? 'Count Mismatch Reported' : 'Count does not match'}
                  </button>
                </div>

                {hasDiscrepancy && (
                  <div className="mt-3 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
                    <TriangleAlert className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold block mb-0.5">Intake Blocked Due to Count Mismatch</span>
                      Physical count does not match the student's booking ({total} items). Per system policy, staff cannot alter the booking quantity.
                      Please have the student adjust their submission or consult the hostel administrator before intake can be completed.
                    </div>
                  </div>
                )}
              </div>

              {error && (
                <div className="flex items-start gap-2 p-2.5 rounded-lg bg-red-50 border border-red-200">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-700">{error}</p>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleVerifyProceed}
                  disabled={hasDiscrepancy}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-water-700 text-white text-sm font-semibold hover:bg-water-800 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  <CheckCheck className="w-4 h-4" />
                  Verify & Allocate Rack
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Allocate Rack & Shelf */}
          {step === 'storage' && (
            <div className="space-y-4">
              <div>
                <div className="text-sm font-semibold text-slate-700 mb-0.5">
                  Select Rack & Shelf
                </div>
                <p className="text-xs text-slate-500">
                  Assign an available storage compartment for this verified booking ({total} clothes).
                </p>
              </div>

              <StorageGrid
                storage={storage}
                selectedId={selectedRackShelf}
                onSelect={setSelectedRackShelf}
              />

              {selectedLoc && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-water-50 border border-water-200">
                  <Layers className="w-4 h-4 text-water-600" />
                  <span className="text-sm font-semibold text-water-700">
                    Allocated Location: {selectedLoc.label}
                  </span>
                </div>
              )}

              {error && (
                <div className="flex items-start gap-2 p-2.5 rounded-lg bg-red-50 border border-red-200">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-700">{error}</p>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setStep('verify')}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  &larr; Back to Counts
                </button>
                <button
                  type="button"
                  onClick={handleStorageProceed}
                  disabled={!selectedRackShelf}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-water-700 text-white text-sm font-semibold hover:bg-water-800 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  Continue to Confirmation <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Confirmation required by CHANGE 2 */}
          {(step === 'confirm' || step === 'submitting') && (
            <div className="space-y-4">
              <div className="border-b border-slate-100 pb-2">
                <h3 className="text-base font-bold text-slate-800">Verify Clothes Received</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Confirm that the received clothing count matches the student's booking.
                </p>
              </div>

              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2.5">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Student booked:
                </div>
                <div className="space-y-1.5 text-sm text-slate-700 pl-1">
                  <div className="flex justify-between">
                    <span>&bull; T-shirts / Shirts:</span>
                    <span className="font-bold text-slate-900">{shirts}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>&bull; Pants / Track:</span>
                    <span className="font-bold text-slate-900">{pants}</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-slate-200">
                    <span className="font-semibold text-slate-800">Total:</span>
                    <span className="font-bold text-water-700">{total} items</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-xs">
                  <span className="text-slate-500">Allocated Rack:</span>
                  <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    {selectedLoc?.label}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-lg text-xs text-amber-800 leading-relaxed">
                <strong>Confirmation notice:</strong> Staff is verifying the received quantity matches the booking.
                Staff cannot edit quantities; this will lock the count and transition the order to <strong>IN PROGRESS</strong>.
              </div>

              {error && (
                <div className="flex items-start gap-2 p-2.5 rounded-lg bg-red-50 border border-red-200">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-700">{error}</p>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setStep('storage')}
                  disabled={step === 'submitting'}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleFinalConfirm}
                  disabled={step === 'submitting'}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-70 shadow-sm"
                >
                  {step === 'submitting' ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Allocating...
                    </>
                  ) : (
                    <>
                      <CheckCheck className="w-4 h-4" />
                      Confirm & Allocate Rack
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ── Intake Success Modal ──────────────────────────────────────

function IntakeSuccessModal({ order, onClose }: { order: LaundryOrderDetail; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        variants={modalBackdropVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
      />

      {/* Dialog */}
      <motion.div
        variants={modalDialogVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 text-center border border-slate-200"
      >
        <motion.div
          variants={successIconVariants}
          initial="hidden"
          animate="visible"
          className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4"
        >
          <CheckCircle2 className="w-8 h-8 text-emerald-600" />
        </motion.div>
        <h2 className="text-xl font-bold text-slate-900 mb-1">Intake Confirmed</h2>
        <p className="text-sm text-slate-500 mb-6">
          Laundry is now <strong className="text-blue-600">IN PROGRESS</strong>
        </p>

        <div className="rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden mb-6 text-left">
          {[
            { label: 'Student', value: order.student.name },
            { label: 'Storage', value: order.rackShelf?.label || '—' },
            { label: 'Items', value: `${order.itemCount?.tShirtShirtCount} shirts · ${order.itemCount?.pantsTrackCount} pants · ${order.itemCount?.totalCount} total` },
          ].map((row) => (
            <div key={row.label} className="flex items-center justify-between px-4 py-2.5">
              <span className="text-xs text-slate-500">{row.label}</span>
              <span className="text-sm font-semibold text-slate-800">{row.value}</span>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full px-4 py-3 rounded-xl bg-water-700 text-white font-semibold text-sm hover:bg-water-800 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-water-400"
        >
          Done
        </button>
      </motion.div>
    </div>
  );
}

// ── Booking Row ───────────────────────────────────────────────

function BookingRow({
  booking,
  onIntake,
  onComplete,
}: {
  booking: StaffBooking;
  onIntake: (b: StaffBooking) => void;
  onComplete: (orderId: string) => void;
}) {
  const orderStatus = booking.laundryOrder?.status;
  const isWaiting = booking.status === 'BOOKED' && (!orderStatus || orderStatus === 'BOOKED');
  const isInProgress = orderStatus === 'IN_PROGRESS';
  const isCompleted = orderStatus === 'COMPLETED';
  const isVerified = orderStatus === 'VERIFIED';
  const isUnderReview = orderStatus === 'UNDER_REVIEW';
  const isResolved = orderStatus === 'RESOLVED';
  const effectiveStatus = orderStatus || booking.status;
  const total = booking.laundryOrder?.itemCount?.totalCount;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: smoothEase }}
      className="flex items-center gap-3 px-4 py-3 bg-white rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all"
    >
      {/* Student info */}
      <div className="w-8 h-8 rounded-full bg-water-100 flex items-center justify-center flex-shrink-0">
        <User className="w-4 h-4 text-water-600" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-slate-800 text-sm truncate">{booking.student.name}</div>
        <div className="text-xs text-slate-500">{booking.student.studentId} &middot; {booking.student.department}</div>
      </div>

      {/* Slot */}
      <div className="hidden sm:flex flex-col items-end text-right">
        <div className="text-xs font-medium text-slate-700">{booking.slot.startTime} – {booking.slot.endTime}</div>
        <div className="text-[10px] text-slate-400">{new Date(booking.slot.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</div>
      </div>

      {/* Clothes count */}
      <div className="hidden md:block text-center w-12">
        <div className="text-sm font-bold text-slate-800">{total ?? '—'}</div>
        <div className="text-[10px] text-slate-400">items</div>
      </div>

      {/* Storage (if in progress or completed) */}
      {(isInProgress || isCompleted) && booking.laundryOrder?.rackShelf && (
        <div className="hidden lg:block text-center w-20">
          <div className="text-xs font-semibold text-blue-700">{booking.laundryOrder.rackShelf.label}</div>
          <div className="text-[10px] text-slate-400">storage</div>
        </div>
      )}

      {/* Status */}
      <div className="w-24 flex justify-center">
        <StatusBadge status={effectiveStatus} />
      </div>

      {/* Action */}
      <div className="w-36 flex justify-end">
        {isWaiting ? (
          <button
            type="button"
            onClick={() => onIntake(booking)}
            className="px-3 py-1.5 rounded-lg bg-water-700 text-white text-xs font-semibold hover:bg-water-800 active:scale-95 transition-all whitespace-nowrap shadow-sm hover:shadow focus:outline-none focus:ring-2 focus:ring-water-400"
          >
            Start Intake
          </button>
        ) : isInProgress ? (
          <button
            type="button"
            onClick={() => booking.laundryOrder && onComplete(booking.laundryOrder.id)}
            className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 active:scale-95 transition-all whitespace-nowrap flex items-center gap-1 shadow-sm hover:shadow focus:outline-none focus:ring-2 focus:ring-emerald-400"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            Mark Done
          </button>
        ) : isCompleted ? (
          <span className="text-xs font-semibold text-emerald-700 whitespace-nowrap flex items-center gap-1 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Laundry Completed
          </span>
        ) : isVerified ? (
          <span className="text-xs font-semibold text-teal-700 whitespace-nowrap flex items-center gap-1 bg-teal-50 px-2.5 py-1 rounded-md border border-teal-200">
            <CheckCheck className="w-3.5 h-3.5" />
            Verified
          </span>
        ) : isUnderReview ? (
          <span className="text-xs font-semibold text-rose-700 whitespace-nowrap flex items-center gap-1 bg-rose-50 px-2.5 py-1 rounded-md border border-rose-200">
            <AlertCircle className="w-3.5 h-3.5" />
            Under Review
          </span>
        ) : isResolved ? (
          <span className="text-xs font-semibold text-purple-700 whitespace-nowrap flex items-center gap-1 bg-purple-50 px-2.5 py-1 rounded-md border border-purple-200">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Resolved
          </span>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        )}
      </div>
    </motion.div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────

export const StaffDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [dashboard, setDashboard] = useState<StaffDashboardData | null>(null);
  const [bookings, setBookings] = useState<StaffBooking[]>([]);
  const [storage, setStorage] = useState<RackShelfLocation[]>([]);
  const [isDashLoading, setIsDashLoading] = useState(true);
  const [isBookingsLoading, setIsBookingsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'BOOKED' | 'IN_PROGRESS'>('ALL');
  const [dateFilter, setDateFilter] = useState<'today' | 'all'>('today');
  const [search, setSearch] = useState('');
  const [intakeBooking, setIntakeBooking] = useState<StaffBooking | null>(null);
  const [successOrder, setSuccessOrder] = useState<LaundryOrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSlots, setShowSlots] = useState(false);

  // Phase 4: complete order state
  const [isCompleting, setIsCompleting] = useState<string | null>(null); // orderId being completed
  const [completeSuccess, setCompleteSuccess] = useState<string | null>(null); // success message
  const [soundOn, setSoundOn] = useState(isSoundEnabled());

  const today = new Date().toISOString().split('T')[0];

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await api.getStaffDashboard();
      setDashboard(res.dashboard);
    } catch (e: any) {
      setError(e.message || 'Failed to load dashboard.');
    } finally {
      setIsDashLoading(false);
    }
  }, []);

  const fetchBookings = useCallback(async () => {
    setIsBookingsLoading(true);
    try {
      const params: Record<string, string> = {};
      if (dateFilter === 'today') params.date = today;
      if (statusFilter === 'BOOKED') params.status = 'BOOKED';
      if (search.trim()) params.search = search.trim();
      const res = await api.getStaffBookings(params);
      setBookings(res.bookings);
    } catch (e: any) {
      setError(e.message || 'Failed to load bookings.');
    } finally {
      setIsBookingsLoading(false);
    }
  }, [dateFilter, statusFilter, search, today]);

  const fetchStorage = useCallback(async () => {
    try {
      const res = await api.getStorage();
      setStorage(res.storage);
    } catch {}
  }, []);

  useEffect(() => {
    fetchDashboard();
    fetchStorage();
  }, [fetchDashboard, fetchStorage]);

  useEffect(() => {
    const t = setTimeout(fetchBookings, 300);
    return () => clearTimeout(t);
  }, [fetchBookings]);

  function handleIntakeSuccess(order: LaundryOrderDetail) {
    setIntakeBooking(null);
    setSuccessOrder(order);
    fetchDashboard();
    fetchBookings();
    fetchStorage();
  }

  // Phase 4: Handle mark complete
  async function handleCompleteOrder(orderId: string) {
    setIsCompleting(orderId);
    setError(null);
    try {
      const res = await api.completeOrder(orderId);
      setCompleteSuccess(res.message || 'Order marked as completed.');
      fetchDashboard();
      fetchBookings();
      fetchStorage();
      setTimeout(() => setCompleteSuccess(null), 5000);
    } catch (e: any) {
      setError(e.message || 'Failed to mark order as completed.');
    } finally {
      setIsCompleting(null);
    }
  }

  // Filter bookings client-side for IN_PROGRESS and truly waiting BOOKED status
  const displayedBookings = bookings.filter((b) => {
    if (statusFilter === 'IN_PROGRESS') {
      return b.laundryOrder?.status === 'IN_PROGRESS';
    }
    if (statusFilter === 'BOOKED') {
      return b.status === 'BOOKED' && (!b.laundryOrder?.status || b.laundryOrder?.status === 'BOOKED');
    }
    return true;
  });

  const waitingBookings = displayedBookings.filter(
    (b) => b.status === 'BOOKED' && (!b.laundryOrder?.status || b.laundryOrder?.status === 'BOOKED')
  );
  const inProgressBookings = displayedBookings.filter(
    (b) => b.laundryOrder?.status === 'IN_PROGRESS'
  );

  if (!user || user.role !== 'STAFF') {
    navigate('/');
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top navigation */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-water-700 flex items-center justify-center">
              <Shirt className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="font-bold text-slate-900 text-sm">WASHWISE</span>
              <span className="ml-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                {isDashLoading ? '…' : dashboard?.staff?.hostel?.name} Laundry
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                const next = toggleSound();
                setSoundOn(next);
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              title={soundOn ? 'Disable Sound Effects' : 'Enable Sound Effects'}
            >
              {soundOn ? <Volume2 className="w-3.5 h-3.5 text-water-600" /> : <VolumeX className="w-3.5 h-3.5 text-slate-400" />}
              <span className="hidden sm:inline">{soundOn ? 'Sound ON' : 'Muted'}</span>
            </button>
            <div className="text-right hidden sm:block">
              <div className="text-xs font-semibold text-slate-700">{user.name || 'Staff'}</div>
              <div className="text-[10px] text-slate-400">Laundry Staff</div>
            </div>
            <button
              type="button"
              onClick={() => { logout(); navigate('/'); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Logout
            </button>
          </div>
        </div>
      </header>

      <PageTransition>
      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {error && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
          </div>
        )}

        {/* Phase 4: Completion success toast */}
        {completeSuccess && (
          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-50 border border-emerald-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <p className="text-sm text-emerald-800 font-medium">{completeSuccess}</p>
            <button onClick={() => setCompleteSuccess(null)} className="ml-auto text-emerald-400 hover:text-emerald-600"><X className="w-4 h-4" /></button>
          </div>
        )}

        {/* Processing overlay indicator */}
        {isCompleting && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-blue-50 border border-blue-200">
            <Loader2 className="w-4 h-4 text-blue-600 animate-spin flex-shrink-0" />
            <p className="text-sm text-blue-800 font-medium">Marking laundry as completed…</p>
          </div>
        )}

        {/* Stats */}
        {isDashLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 h-20 animate-pulse">
                <div className="h-4 bg-slate-200 rounded w-2/3 mb-2" />
                <div className="h-6 bg-slate-200 rounded w-1/3" />
              </div>
            ))}
          </div>
        ) : dashboard && (
          <motion.div
            variants={staggerContainerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-2 md:grid-cols-4 gap-3"
          >
            <StatCard
              label="Today's Bookings"
              value={dashboard.stats.todayBookings}
              icon={<Calendar className="w-5 h-5 text-slate-600" />}
              accent="bg-slate-100"
            />
            <StatCard
              label="Waiting for Intake"
              value={dashboard.stats.waitingCount}
              icon={<Clock className="w-5 h-5 text-amber-600" />}
              accent="bg-amber-100"
              sub="Need action"
            />
            <StatCard
              label="In Progress"
              value={dashboard.stats.inProgressCount}
              icon={<Package className="w-5 h-5 text-blue-600" />}
              accent="bg-blue-100"
            />
            <StatCard
              label="Storage Available"
              value={dashboard.stats.availableStorage}
              icon={<Layers className="w-5 h-5 text-emerald-600" />}
              accent="bg-emerald-100"
              sub={`of ${dashboard.stats.totalStorage} total`}
            />
          </motion.div>
        )}

        {/* Today's slot breakdown — collapsible */}
        {dashboard && dashboard.todaySlots.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowSlots(!showSlots)}
              className="w-full flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <ClipboardList className="w-4 h-4 text-slate-400" />
                Today's Slot Summary
                <span className="ml-1 text-[10px] font-normal text-slate-400">(your hostel only)</span>
              </div>
              {showSlots ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </button>
            {showSlots && (
              <div className="px-5 pb-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 border-t border-slate-100">
                {dashboard.todaySlots.map((slot: TodaySlot) => (
                  <div
                    key={slot.id}
                    className="rounded-lg border border-slate-200 p-2.5 text-center bg-slate-50/50"
                  >
                    <div className="text-xs font-semibold text-slate-700">{slot.startTime}</div>
                    <div className="text-xs text-slate-400 mt-0.5">→ {slot.endTime}</div>
                    <div className="mt-1.5 text-sm font-bold text-water-700">{slot.bookedCount}</div>
                    <div className="text-[10px] text-slate-400">booked</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Bookings list */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {/* Toolbar */}
          <div className="px-4 py-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search student name or student ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-water-400 bg-slate-50"
              />
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Date */}
              <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs font-medium">
                {(['today', 'all'] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDateFilter(d)}
                    className={`px-3 py-1.5 transition-colors ${dateFilter === d ? 'bg-water-700 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                  >
                    {d === 'today' ? 'Today' : 'All Dates'}
                  </button>
                ))}
              </div>

              {/* Status */}
              <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs font-medium">
                {(['ALL', 'BOOKED', 'IN_PROGRESS'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatusFilter(s)}
                    className={`px-3 py-1.5 transition-colors ${statusFilter === s ? 'bg-water-700 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                  >
                    {s === 'ALL' ? 'All' : s === 'BOOKED' ? 'Waiting' : 'In Progress'}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => { fetchBookings(); fetchDashboard(); fetchStorage(); }}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-colors"
                title="Refresh"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* List body */}
          <div className="p-4 space-y-4">
            {isBookingsLoading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : (
              <>
                {/* Waiting section */}
                {(statusFilter === 'ALL' || statusFilter === 'BOOKED') && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 rounded-full bg-amber-400" />
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Waiting for Intake
                        {waitingBookings.length > 0 && (
                          <span className="ml-1.5 text-amber-600">({waitingBookings.length})</span>
                        )}
                      </span>
                    </div>
                    {waitingBookings.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <Inbox className="w-8 h-8 text-slate-300 mb-2" />
                        <p className="text-sm text-slate-500">No bookings waiting for intake.</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {waitingBookings.map((b) => (
                          <BookingRow
                            key={b.id}
                            booking={b}
                            onIntake={setIntakeBooking}
                            onComplete={handleCompleteOrder}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* In Progress section */}
                {(statusFilter === 'ALL' || statusFilter === 'IN_PROGRESS') && (
                  <div>
                    <div className="flex items-center gap-2 mb-2 mt-4">
                      <div className="w-2 h-2 rounded-full bg-blue-500" />
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        In Progress
                        {inProgressBookings.length > 0 && (
                          <span className="ml-1.5 text-blue-600">({inProgressBookings.length})</span>
                        )}
                      </span>
                    </div>
                    {inProgressBookings.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <Package className="w-8 h-8 text-slate-300 mb-2" />
                        <p className="text-sm text-slate-500">No laundry currently in progress.</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {inProgressBookings.map((b) => (
                          <BookingRow
                            key={b.id}
                            booking={b}
                            onIntake={setIntakeBooking}
                            onComplete={handleCompleteOrder}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Storage overview */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <div className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Layers className="w-4 h-4 text-slate-400" />
              Storage Overview
            </div>
            <button onClick={fetchStorage} className="p-1 text-slate-400 hover:text-slate-600 transition-colors">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="p-4">
            {storage.length === 0 ? (
              <div className="py-6 text-center text-sm text-slate-500">No storage locations found.</div>
            ) : (
              <div className="space-y-3">
                {[1, 2, 3].map((rack) => {
                  const shelves = storage.filter((s) => s.rackNumber === rack);
                  return (
                    <div key={rack}>
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                        Rack {rack}
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        {shelves.map((loc) => (
                          <div
                            key={loc.id}
                            title={loc.isOccupied ? `${loc.occupiedBy?.studentName} (${loc.occupiedBy?.studentId})` : 'Available'}
                            className={`h-14 rounded-lg border-2 flex flex-col items-center justify-center text-[11px] font-semibold transition-colors ${
                              loc.isOccupied
                                ? 'border-slate-200 bg-slate-100 text-slate-500'
                                : 'border-emerald-200 bg-emerald-50/60 text-emerald-700'
                            }`}
                          >
                            <div>S{loc.shelfNumber}</div>
                            <div className={`text-[9px] mt-0.5 font-medium ${loc.isOccupied ? 'text-slate-400' : 'text-emerald-600'}`}>
                              {loc.isOccupied ? 'OCCUPIED' : 'AVAIL'}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>
      </PageTransition>

      {/* Intake & Success Modals */}
      <AnimatePresence>
        {intakeBooking && (
          <IntakeModal
            key="intake-modal"
            booking={intakeBooking}
            storage={storage}
            onClose={() => setIntakeBooking(null)}
            onSuccess={handleIntakeSuccess}
          />
        )}
        {successOrder && (
          <IntakeSuccessModal
            key="success-modal"
            order={successOrder}
            onClose={() => setSuccessOrder(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default StaffDashboard;
