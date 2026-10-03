import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Camera,
  Upload,
  Sparkles,
  X,
  AlertCircle,
  Info,
  RefreshCw,
  Droplets,
  ArrowRight,
} from 'lucide-react';
import { api } from '../../services/api';
import { AiScanResponse, AiLaundryEstimate } from '../../types';
import { playWaterBubbleSound } from '../../utils/sound';

interface AiLaundryScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanComplete: (scanId: string, estimate: AiLaundryEstimate) => void;
}

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];

export function AiLaundryScannerModal({
  isOpen,
  onClose,
  onScanComplete,
}: AiLaundryScannerModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<AiScanResponse | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  function handleFileSelect(file: File) {
    setError(null);
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Please select a JPG, PNG, or WEBP image.');
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError('Image file is larger than 5MB. Please choose a smaller photo.');
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setPreviewUrl(result);
      setImageBase64(result);
      setScanResult(null);
    };
    reader.readAsDataURL(file);
    playWaterBubbleSound();
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  }

  function resetSelection() {
    setSelectedFile(null);
    setPreviewUrl(null);
    setImageBase64(null);
    setScanResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    playWaterBubbleSound();
  }

  async function handleAnalyze() {
    if (!imageBase64 || !selectedFile) {
      setError('Please capture or upload a photo first.');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    playWaterBubbleSound();

    try {
      const response = await api.scanLaundryWithAi({
        imageBase64,
        mimeType: selectedFile.type,
      });

      if (response && response.success && response.estimate) {
        setScanResult(response);
      } else {
        throw new Error('AI scan did not return a valid estimate.');
      }
    } catch (err: any) {
      setError(
        err.message || 'AI scan unavailable. You can continue with normal booking.'
      );
    } finally {
      setIsAnalyzing(false);
    }
  }

  function handleApplyAndContinue() {
    if (scanResult) {
      playWaterBubbleSound();
      onScanComplete(scanResult.scanId, scanResult.estimate);
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
      />

      {/* Modal Dialog */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden border border-cyan-100"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-water-700 via-cyan-700 to-sky-700 px-6 py-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/10 rounded-xl backdrop-blur-sm">
              <Sparkles className="w-5 h-5 text-cyan-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base leading-tight">AI Laundry Scanner</h3>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-white/20 text-cyan-100 px-2 py-0.5 rounded-full">
                  Optional
                </span>
              </div>
              <p className="text-xs text-cyan-100/90 mt-0.5">
                Analyze clothes for visible stains and laundry recommendations
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/70 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Hidden inputs */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleInputChange}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleInputChange}
          />

          {!previewUrl ? (
            /* Upload / Capture Choices */
            <div className="space-y-4">
              <div className="p-4 bg-cyan-50/70 border border-cyan-200/80 rounded-xl text-xs text-cyan-900 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-cyan-700 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold block mb-0.5">Assisted Estimation Tool</span>
                  Take a photo or upload an image of your laundry load. The AI will estimate visible
                  clothing counts, colors, possible stains, and suggest laundry care.
                  <span className="block mt-1 font-medium text-cyan-800">
                    Your manual booking count remains authoritative and can be edited freely.
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex flex-col items-center justify-center p-6 rounded-xl border-2 border-dashed border-cyan-300 bg-white hover:bg-cyan-50/60 hover:border-cyan-500 transition-all group cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-xl bg-cyan-100 flex items-center justify-center text-cyan-700 group-hover:scale-110 transition-transform mb-3">
                    <Camera className="w-6 h-6" />
                  </div>
                  <span className="text-sm font-bold text-slate-800">Take Photo</span>
                  <span className="text-[11px] text-slate-500 mt-1 text-center">
                    Use device camera
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center p-6 rounded-xl border-2 border-dashed border-sky-300 bg-white hover:bg-sky-50/60 hover:border-sky-500 transition-all group cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-xl bg-sky-100 flex items-center justify-center text-sky-700 group-hover:scale-110 transition-transform mb-3">
                    <Upload className="w-6 h-6" />
                  </div>
                  <span className="text-sm font-bold text-slate-800">Upload Photo</span>
                  <span className="text-[11px] text-slate-500 mt-1 text-center">
                    JPG, PNG, or WEBP (Max 5MB)
                  </span>
                </button>
              </div>
            </div>
          ) : (
            /* Image Preview & Action */
            <div className="space-y-4">
              <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-100 max-h-56 flex items-center justify-center">
                <img
                  src={previewUrl}
                  alt="Laundry Load Preview"
                  className="w-full h-56 object-cover"
                />
                {!isAnalyzing && (
                  <button
                    type="button"
                    onClick={resetSelection}
                    className="absolute top-2 right-2 bg-slate-900/70 hover:bg-slate-900 text-white p-1.5 rounded-lg text-xs backdrop-blur-sm transition-all"
                  >
                    Change Photo
                  </button>
                )}
              </div>

              {!scanResult && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={resetSelection}
                    disabled={isAnalyzing}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleAnalyze}
                    disabled={isAnalyzing}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-water-700 to-cyan-700 text-white text-sm font-semibold hover:from-water-800 hover:to-cyan-800 transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                  >
                    {isAnalyzing ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Analyzing clothes with AI...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-cyan-200" />
                        <span>Analyze Clothes</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-800">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-semibold block mb-0.5">Notice</span>
                {error}
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-3 py-1 bg-white border border-rose-300 text-rose-700 rounded-lg text-[11px] font-semibold hover:bg-rose-100"
                  >
                    Continue with Manual Booking
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* AI Result Card */}
          {scanResult && (
            <div className="space-y-4">
              <div className="bg-gradient-to-br from-cyan-50/90 via-sky-50/50 to-blue-50/80 border border-cyan-200 rounded-xl p-4">
                <div className="flex items-center justify-between border-b border-cyan-100 pb-2 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-800">AI Laundry Scan</span>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider bg-cyan-200 text-cyan-900 px-2 py-0.5 rounded-full">
                      AI Estimate
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500 font-medium">
                    Confidence: {scanResult.estimate.confidence}
                  </span>
                </div>

                {/* Attributes Table */}
                <div className="grid grid-cols-2 gap-2.5 mb-3 text-xs">
                  <div className="bg-white/80 p-2.5 rounded-lg border border-cyan-100">
                    <span className="text-slate-500 block text-[11px]">Visible Clothes</span>
                    <span className="text-sm font-bold text-water-800">
                      {scanResult.estimate.visibleClothingCount} items
                    </span>
                  </div>
                  <div className="bg-white/80 p-2.5 rounded-lg border border-cyan-100">
                    <span className="text-slate-500 block text-[11px]">Clothing Type</span>
                    <span className="text-sm font-bold text-slate-800">
                      {scanResult.estimate.clothingType}
                    </span>
                  </div>
                  <div className="bg-white/80 p-2.5 rounded-lg border border-cyan-100">
                    <span className="text-slate-500 block text-[11px]">Main Color</span>
                    <span className="text-sm font-bold text-slate-800">
                      {scanResult.estimate.mainColor}
                    </span>
                  </div>
                  <div className="bg-white/80 p-2.5 rounded-lg border border-cyan-100">
                    <span className="text-slate-500 block text-[11px]">Possible Stain</span>
                    <span className="text-sm font-bold text-slate-800">
                      {scanResult.estimate.possibleStain}
                    </span>
                  </div>
                </div>

                <div className="bg-white/80 p-2.5 rounded-lg border border-cyan-100 flex items-center justify-between text-xs mb-3">
                  <span className="text-slate-500">Stain Severity:</span>
                  <span
                    className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                      scanResult.estimate.stainSeverity === 'High'
                        ? 'bg-rose-100 text-rose-800'
                        : scanResult.estimate.stainSeverity === 'Medium'
                        ? 'bg-amber-100 text-amber-800'
                        : scanResult.estimate.stainSeverity === 'Low'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {scanResult.estimate.stainSeverity}
                  </span>
                </div>

                {/* Recommendation Box */}
                <div className="bg-white p-3 rounded-lg border border-cyan-200 space-y-1.5 text-xs text-slate-700">
                  <div className="font-semibold text-slate-800 flex items-center gap-1.5 mb-1">
                    <Droplets className="w-3.5 h-3.5 text-cyan-600" />
                    <span>WASHWISE Recommended Laundry Process:</span>
                  </div>
                  <div className="flex justify-between py-0.5 border-b border-slate-100">
                    <span className="text-slate-500">Wash Mode:</span>
                    <span className="font-semibold text-slate-800">
                      {scanResult.estimate.recommendation.washMode}
                    </span>
                  </div>
                  <div className="flex justify-between py-0.5 border-b border-slate-100">
                    <span className="text-slate-500">Pre-treatment:</span>
                    <span className="font-semibold text-slate-800">
                      {scanResult.estimate.recommendation.preTreatment}
                    </span>
                  </div>
                  <div className="flex justify-between py-0.5">
                    <span className="text-slate-500">Detergent Level:</span>
                    <span className="font-semibold text-slate-800">
                      {scanResult.estimate.recommendation.detergentLevel} (Estimated — staff confirmation required)
                    </span>
                  </div>
                </div>

                {/* Important Disclaimer */}
                <div className="mt-3 p-2.5 rounded-lg bg-amber-50/90 border border-amber-200/80 text-[11px] text-amber-900 flex items-start gap-2">
                  <Info className="w-3.5 h-3.5 text-amber-700 flex-shrink-0 mt-0.5" />
                  <span>
                    <strong>Important:</strong> AI results are estimates based on the uploaded image.
                    They may be inaccurate and must be verified by laundry staff.
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={resetSelection}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Scan Another Photo
                </button>
                <button
                  type="button"
                  onClick={handleApplyAndContinue}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-water-700 text-white text-xs font-bold hover:bg-water-800 transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <span>Continue to Booking</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
