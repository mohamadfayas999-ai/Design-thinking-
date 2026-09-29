import React, { useState } from 'react';
import {
  CheckCircle2,
  Shirt,
  Calendar,
  Clock,
  PackageCheck,
  AlertTriangle,
  X,
} from 'lucide-react';
import { CompletionNotification, ComplaintType } from '../../types';
import { Button } from './Button';
import { ErrorAlert } from './ErrorAlert';
import { api } from '../../services/api';

// ── Helpers ───────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

// ── Complaint Form ─────────────────────────────────────────────

const COMPLAINT_OPTIONS: { value: ComplaintType; label: string; description: string }[] = [
  { value: 'CLOTHES_TORN', label: 'Clothes Torn', description: 'One or more items have tears or damage.' },
  { value: 'NUMBER_OF_CLOTHES_REDUCED', label: 'Number of Clothes Reduced', description: 'Fewer clothes returned than submitted.' },
  { value: 'OTHER_ISSUE', label: 'Other Issue', description: 'Something else is wrong with my laundry.' },
];

interface ComplaintFormProps {
  orderId: string;
  clothesCount: number;
  bookingDate: string;
  slotTiming: string;
  completedAt: string | null;
  onBack: () => void;
  onSuccess: () => void;
}

const ComplaintForm: React.FC<ComplaintFormProps> = ({
  orderId,
  clothesCount,
  bookingDate,
  slotTiming,
  completedAt,
  onBack,
  onSuccess,
}) => {
  const [selectedType, setSelectedType] = useState<ComplaintType | ''>('');
  const [details, setDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!selectedType) {
      setError('Please select a complaint type.');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await api.submitComplaint(orderId, {
        type: selectedType,
        additionalDetails: details.trim() || undefined,
      });
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to submit complaint. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Laundry Summary */}
      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Laundry Summary</p>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-slate-400 block">Booking Date</span>
            <span className="font-semibold text-slate-800">
              {new Date(bookingDate + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block">Slot</span>
            <span className="font-semibold text-slate-800">{slotTiming}</span>
          </div>
          <div>
            <span className="text-slate-400 block">Clothes</span>
            <span className="font-semibold text-slate-800">{clothesCount} items</span>
          </div>
          {completedAt && (
            <div>
              <span className="text-slate-400 block">Completed</span>
              <span className="font-semibold text-slate-800">{formatDate(completedAt)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Complaint Type */}
      <div>
        <p className="text-xs font-bold text-slate-700 mb-3">Select Complaint Type</p>
        <div className="space-y-2">
          {COMPLAINT_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                selectedType === opt.value
                  ? 'border-red-300 bg-red-50'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                name="complaintType"
                value={opt.value}
                checked={selectedType === opt.value}
                onChange={() => setSelectedType(opt.value)}
                className="mt-0.5 accent-red-500 flex-shrink-0"
              />
              <div>
                <p className={`text-sm font-semibold ${selectedType === opt.value ? 'text-red-700' : 'text-slate-800'}`}>
                  {opt.label}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">{opt.description}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Additional Details */}
      <div>
        <label htmlFor="complaintDetails" className="text-xs font-bold text-slate-700 block mb-2">
          Additional Details <span className="font-normal text-slate-400">(optional)</span>
        </label>
        <textarea
          id="complaintDetails"
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          maxLength={1000}
          rows={3}
          placeholder="Describe the issue if you would like to provide more information..."
          className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white placeholder-slate-400 text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-red-300 resize-none transition-colors"
        />
        <p className="text-right text-[10px] text-slate-400 mt-1">{details.length}/1000</p>
      </div>

      {error && <ErrorAlert message={error} onDismiss={() => setError(null)} />}

      <div className="flex gap-3 pt-1">
        <Button variant="secondary" onClick={onBack} disabled={isSubmitting} className="flex-1">
          Back
        </Button>
        <Button
          variant="danger"
          onClick={handleSubmit}
          isLoading={isSubmitting}
          disabled={!selectedType}
          className="flex-1"
        >
          Submit Complaint
        </Button>
      </div>
    </div>
  );
};

// ── Verify Confirmation ───────────────────────────────────────

interface VerifyConfirmProps {
  orderId: string;
  clothesCount: number;
  onBack: () => void;
  onSuccess: () => void;
}

const VerifyConfirm: React.FC<VerifyConfirmProps> = ({ orderId, clothesCount, onBack, onSuccess }) => {
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleVerify = async () => {
    setIsVerifying(true);
    setError(null);
    try {
      await api.verifyOrder(orderId);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to verify. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center text-center py-2">
        <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mb-3">
          <PackageCheck className="w-7 h-7 text-emerald-600" />
        </div>
        <p className="text-sm text-slate-600 leading-relaxed max-w-xs">
          Confirm that you received your laundry and everything is correct?
        </p>
        <div className="mt-3 px-4 py-2 rounded-lg bg-emerald-50 border border-emerald-100 text-xs font-semibold text-emerald-700">
          {clothesCount} items will be marked as received
        </div>
      </div>

      {error && <ErrorAlert message={error} onDismiss={() => setError(null)} />}

      <div className="flex gap-3">
        <Button variant="secondary" onClick={onBack} disabled={isVerifying} className="flex-1">
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleVerify}
          isLoading={isVerifying}
          icon={<PackageCheck className="w-4 h-4" />}
          className="flex-1"
        >
          Confirm Verification
        </Button>
      </div>
    </div>
  );
};

// ── Main Completion Popup ─────────────────────────────────────

type PopupStep = 'main' | 'verify' | 'complaint' | 'verified' | 'complained';

export interface CompletionPopupProps {
  notification: CompletionNotification;
  onDismiss: () => void;
  onActioned: () => void;
}

export const CompletionPopup: React.FC<CompletionPopupProps> = ({
  notification,
  onDismiss,
  onActioned,
}) => {
  const [step, setStep] = useState<PopupStep>('main');
  const order = notification.order;

  const handleVerifySuccess = () => {
    setStep('verified');
    setTimeout(() => {
      onActioned();
    }, 3000);
  };

  const handleComplaintSuccess = () => {
    setStep('complained');
    setTimeout(() => {
      onActioned();
    }, 3000);
  };

  const getTitle = () => {
    if (step === 'verified') return 'Laundry Verified';
    if (step === 'complained') return 'Complaint Submitted';
    if (step === 'complaint') return 'Submit Complaint';
    if (step === 'verify') return 'Confirm Pickup';
    return 'Laundry Completed';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Laundry completed notification">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" />

      {/* Panel */}
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 z-10 overflow-hidden">
        {/* Header */}
        <div className={`px-6 pt-5 pb-4 border-b border-slate-100 flex items-center gap-3 ${
          step === 'verified' ? 'bg-emerald-50' :
          step === 'complained' ? 'bg-amber-50' : 'bg-gradient-to-r from-water-50 to-white'
        }`}>
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
            step === 'verified' ? 'bg-emerald-100' :
            step === 'complained' ? 'bg-amber-100' : 'bg-water-100'
          }`}>
            {step === 'verified' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            ) : step === 'complained' ? (
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            ) : (
              <Shirt className="w-5 h-5 text-water-600" />
            )}
          </div>
          <div className="flex-1">
            <h2 className="text-base font-bold text-slate-900">{getTitle()}</h2>
            {step === 'main' && (
              <p className="text-xs text-slate-500 mt-0.5">Action required</p>
            )}
          </div>
          {/* Only allow dismissal from main if no action taken yet */}
          {step === 'main' && (
            <button
              onClick={onDismiss}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
              aria-label="Later"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {step === 'main' && (
            <div className="space-y-5">
              <p className="text-sm text-slate-600 leading-relaxed">
                Your laundry has been processed and is ready for pickup at the laundry area.
              </p>

              {/* Completion details */}
              {order && (
                <div className="grid grid-cols-2 gap-3">
                  {order.completedAt && (
                    <>
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                        <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                          <Calendar className="w-3.5 h-3.5" />
                          <span className="text-[10px] font-semibold uppercase tracking-wide">Completed</span>
                        </div>
                        <p className="text-xs font-bold text-slate-800">{formatDate(order.completedAt)}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                        <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                          <Clock className="w-3.5 h-3.5" />
                          <span className="text-[10px] font-semibold uppercase tracking-wide">Time</span>
                        </div>
                        <p className="text-xs font-bold text-slate-800">{formatTime(order.completedAt)}</p>
                      </div>
                    </>
                  )}
                  <div className="p-3 rounded-xl bg-water-50 border border-water-100 col-span-2">
                    <div className="flex items-center gap-1.5 text-water-500 mb-1">
                      <Shirt className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-semibold uppercase tracking-wide">Total Clothes</span>
                    </div>
                    <p className="text-lg font-extrabold text-water-900">{order.clothesCount} items</p>
                  </div>
                </div>
              )}

              <div className="p-3 rounded-xl bg-blue-50 border border-blue-100 text-xs text-blue-800 leading-relaxed">
                Please go to the laundry area to collect your clothes, then confirm below.
              </div>

              {/* Action buttons */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider text-center">
                  After collecting your laundry:
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setStep('verify')}
                    className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-emerald-200 bg-emerald-50 hover:border-emerald-400 hover:bg-emerald-100 transition-all group focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  >
                    <CheckCircle2 className="w-7 h-7 text-emerald-500 group-hover:text-emerald-600" />
                    <div className="text-center">
                      <p className="text-sm font-bold text-emerald-700">Verify</p>
                      <p className="text-[10px] text-emerald-600 mt-0.5">Everything is correct</p>
                    </div>
                  </button>
                  <button
                    onClick={() => setStep('complaint')}
                    className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-red-200 bg-red-50 hover:border-red-400 hover:bg-red-100 transition-all group focus:outline-none focus:ring-2 focus:ring-red-400"
                  >
                    <AlertTriangle className="w-7 h-7 text-red-400 group-hover:text-red-500" />
                    <div className="text-center">
                      <p className="text-sm font-bold text-red-700">Complain</p>
                      <p className="text-[10px] text-red-600 mt-0.5">There is an issue</p>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 'verify' && order && (
            <VerifyConfirm
              orderId={order.id}
              clothesCount={order.clothesCount}
              onBack={() => setStep('main')}
              onSuccess={handleVerifySuccess}
            />
          )}

          {step === 'complaint' && order && (
            <ComplaintForm
              orderId={order.id}
              clothesCount={order.clothesCount}
              bookingDate={order.slot.date}
              slotTiming={`${order.slot.startTime} – ${order.slot.endTime}`}
              completedAt={order.completedAt}
              onBack={() => setStep('main')}
              onSuccess={handleComplaintSuccess}
            />
          )}

          {step === 'verified' && (
            <div className="flex flex-col items-center text-center py-4 space-y-3">
              <div className="w-16 h-16 rounded-full bg-emerald-100 border-2 border-emerald-300 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Laundry Verified</h3>
                <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                  Your laundry has been successfully verified.
                </p>
              </div>
              <p className="text-xs text-slate-400">This will close automatically…</p>
            </div>
          )}

          {step === 'complained' && (
            <div className="flex flex-col items-center text-center py-4 space-y-3">
              <div className="w-16 h-16 rounded-full bg-amber-100 border-2 border-amber-300 flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-amber-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Complaint Submitted</h3>
                <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                  Your complaint is under review. We will look into it.
                </p>
                <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 border border-amber-200 text-xs font-bold text-amber-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  UNDER REVIEW
                </div>
              </div>
              <p className="text-xs text-slate-400">This will close automatically…</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
