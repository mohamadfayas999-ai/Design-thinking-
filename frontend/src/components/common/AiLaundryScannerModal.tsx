import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Camera,
  Upload,
  Sparkles,
  X,
  AlertCircle,
  Info,
  RefreshCw,
  ArrowRight,
  Eye,
  CheckCircle2,
  Layers,
  Activity,
} from 'lucide-react';
import { api } from '../../services/api';
import {
  AiClothingScanResult,
  ClothingScanSummary,
  AiLaundryEstimate,
  AiServiceHealth,
} from '../../types';
import { playWaterBubbleSound } from '../../utils/sound';
import {
  captureLaundryPhoto,
  CameraPermissionError,
  CameraCancelledError,
} from '../../utils/camera';
import { Capacitor } from '@capacitor/core';

export interface AiLaundryScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanComplete?: (
    scanId: string,
    estimate: AiLaundryEstimate,
    detectedCounts?: {
      tShirtShirt: number;
      pantsTrack: number;
      total: number;
      rawSummary: ClothingScanSummary;
      yoloResult: AiClothingScanResult;
    }
  ) => void;
  onNavigateToBookingWithCounts?: (counts: {
    tShirtShirt: number;
    pantsTrack: number;
    scanId?: string;
  }) => void;
}

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];

// Helper to convert detected classes into the 2 Washwise booking categories
function calculateBookingCounts(counts: Record<string, number>) {
  const tShirtShirt = (counts['tshirt'] || 0) + (counts['shirt'] || 0);
  const pantsTrack =
    (counts['pant'] || 0) + (counts['jeans'] || 0) + (counts['shorts'] || 0);
  const others =
    (counts['towel'] || 0) +
    (counts['bedsheet'] || 0) +
    (counts['other'] || 0) +
    (counts['unknown'] || 0);
  const total = tShirtShirt + pantsTrack + others;

  return { tShirtShirt, pantsTrack, others, total };
}

export function AiLaundryScannerModal({
  isOpen,
  onClose,
  onScanComplete,
  onNavigateToBookingWithCounts,
}: AiLaundryScannerModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState<string>('Initializing...');
  const [error, setError] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<AiClothingScanResult | null>(null);
  const [viewMode, setViewMode] = useState<'annotated' | 'original'>('annotated');
  const [selectedDetectionIndex, setSelectedDetectionIndex] = useState<number | null>(null);

  // Health status
  const [serviceHealth, setServiceHealth] = useState<AiServiceHealth | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Check AI service status when modal opens
  useEffect(() => {
    if (isOpen) {
      api
        .getAiHealthStatus()
        .then((res) => {
          if (res.success && res.aiService) {
            setServiceHealth(res.aiService);
          } else {
            setServiceHealth(null);
          }
        })
        .catch(() => {
          setServiceHealth(null);
        });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  function handleFileSelect(file: File) {
    setError(null);
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Please select a JPG, PNG, or WEBP image.');
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError('Image file is larger than 10MB. Please choose a smaller photo.');
      return;
    }

    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setScanResult(null);
    playWaterBubbleSound();
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  }

  async function handleTakePhoto() {
    setError(null);
    try {
      const { file, previewUrl: photoUrl } = await captureLaundryPhoto();
      setSelectedFile(file);
      setPreviewUrl(photoUrl);
      setScanResult(null);
      playWaterBubbleSound();
    } catch (err: any) {
      if (err instanceof CameraCancelledError) {
        // User closed or cancelled camera
        return;
      }
      if (err instanceof CameraPermissionError) {
        setError(
          'Camera permission is required to take a photo. You can also choose Upload Photo instead.'
        );
        return;
      }
      // Web fallback if Capacitor native camera is unavailable
      if (!Capacitor.isNativePlatform()) {
        cameraInputRef.current?.click();
        return;
      }
      setError(
        err.message?.includes('permission') || err.message?.includes('denied')
          ? 'Camera permission is required to take a photo. You can also choose Upload Photo instead.'
          : err.message || 'Could not open camera. Please try Upload Photo.'
      );
    }
  }

  function resetSelection() {
    setSelectedFile(null);
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setScanResult(null);
    setError(null);
    setSelectedDetectionIndex(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    playWaterBubbleSound();
  }

  async function handleAnalyze() {
    if (!selectedFile) {
      setError('Please capture or upload a laundry photo first.');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setAnalysisStep('Preprocessing image for YOLOv8 model...');
    playWaterBubbleSound();

    const stepTimer1 = setTimeout(() => {
      setAnalysisStep('Detecting clothing boundaries & neural feature maps...');
    }, 1100);

    const stepTimer2 = setTimeout(() => {
      setAnalysisStep('Classifying garments & drawing bounding box annotations...');
    }, 2200);

    try {
      const response = await api.scanLaundryClothYolo(selectedFile);

      if (response && response.success) {
        setScanResult(response);
        setViewMode('annotated');
        playWaterBubbleSound();
      } else {
        throw new Error(response.message || 'AI detection failed to return results.');
      }
    } catch (err: any) {
      setError(
        err.message ||
          'AI detection service is currently unreachable. You can continue with manual booking.'
      );
    } finally {
      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      setIsAnalyzing(false);
    }
  }

  function handleApplyToBooking() {
    if (!scanResult) return;
    playWaterBubbleSound();

    const bookingCounts = calculateBookingCounts(scanResult.summary.counts);
    const primaryScanId = scanResult.scanId || `ai-scan-${Date.now()}`;

    // Synthetic AiLaundryEstimate for backwards compatibility with booking storage
    const estimate: AiLaundryEstimate = {
      visibleClothingCount: scanResult.summary.totalItems,
      clothingType: Object.entries(scanResult.summary.counts)
        .map(([k, v]) => `${k}:${v}`)
        .join(', '),
      mainColor: 'Multi-color',
      possibleStain: 'Not checked',
      stainSeverity: 'None',
      confidence:
        scanResult.summary.averageConfidence >= 0.8
          ? 'High'
          : scanResult.summary.averageConfidence >= 0.6
          ? 'Medium'
          : 'Low',
      recommendation: {
        washMode: 'Standard Cold Wash',
        preTreatment: 'None required',
        detergentLevel: 'Medium',
        detergentNote: 'Standard campus dispenser dosage',
      },
    };

    if (onScanComplete) {
      onScanComplete(primaryScanId, estimate, {
        tShirtShirt: bookingCounts.tShirtShirt,
        pantsTrack: bookingCounts.pantsTrack,
        total: bookingCounts.total,
        rawSummary: scanResult.summary,
        yoloResult: scanResult,
      });
      onClose();
    } else if (onNavigateToBookingWithCounts) {
      onNavigateToBookingWithCounts({
        tShirtShirt: bookingCounts.tShirtShirt,
        pantsTrack: bookingCounts.pantsTrack,
        scanId: primaryScanId,
      });
      onClose();
    } else {
      onClose();
    }
  }

  const bookingCounts = scanResult ? calculateBookingCounts(scanResult.summary.counts) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-md"
      />

      {/* Modal Dialog */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden border border-cyan-200"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-water-900 via-cyan-900 to-sky-950 px-6 py-4 flex items-center justify-between text-white border-b border-cyan-800/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-cyan-500/20 rounded-xl backdrop-blur-sm border border-cyan-400/30 text-cyan-300">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base tracking-tight leading-tight">
                  WASHWISE AI Cloth Scanner
                </h3>
                <span className="text-[10px] font-extrabold uppercase tracking-wider bg-cyan-400/20 text-cyan-200 px-2 py-0.5 rounded-full border border-cyan-300/30">
                  YOLOv8 Vision
                </span>
              </div>
              <p className="text-xs text-cyan-200/80 mt-0.5">
                Automated object detection & clothing counter
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Live Service Status Pill */}
            <div
              className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                serviceHealth?.status === 'ok'
                  ? serviceHealth.mode === 'production'
                    ? 'bg-emerald-950/70 text-emerald-300 border-emerald-500/40'
                    : 'bg-amber-950/70 text-amber-300 border-amber-500/40'
                  : 'bg-slate-800 text-slate-300 border-slate-700'
              }`}
              title={
                serviceHealth
                  ? `AI Mode: ${serviceHealth.mode.toUpperCase()}`
                  : 'Checking AI Service...'
              }
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  serviceHealth?.status === 'ok'
                    ? serviceHealth.mode === 'production'
                      ? 'bg-emerald-400 animate-pulse'
                      : 'bg-amber-400'
                    : 'bg-slate-400'
                }`}
              />
              <span>
                {serviceHealth
                  ? serviceHealth.mode === 'production'
                    ? 'YOLO Online'
                    : 'AI Mock Mode'
                  : 'AI Checking...'}
              </span>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="text-white/70 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1 bg-slate-50/50">
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
              <div className="p-4 bg-gradient-to-r from-cyan-50 to-sky-50 border border-cyan-200/80 rounded-xl text-xs text-cyan-950 flex items-start gap-3">
                <Info className="w-4 h-4 text-cyan-700 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-bold text-slate-900 block">
                    Instant AI Laundry Cloth Detection
                  </span>
                  <p className="text-slate-600 leading-relaxed">
                    Spread your laundry flat or take a clear photo of the load. Our YOLOv8
                    neural network identifies individual garments (Shirts, T-shirts, Pants,
                    Shorts, Towels) and counts them automatically.
                  </p>
                  <p className="text-cyan-800 font-semibold text-[11px] pt-1">
                    ✓ Bounding box visualization &middot; ✓ Auto-calculates counts &middot; ✓
                    One-click apply to booking
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <button
                  type="button"
                  onClick={handleTakePhoto}
                  className="flex flex-col items-center justify-center p-6 rounded-2xl border-2 border-dashed border-cyan-300 bg-white hover:bg-cyan-50/70 hover:border-cyan-500 transition-all group cursor-pointer shadow-xs hover:shadow-md"
                >
                  <div className="w-14 h-14 rounded-2xl bg-cyan-100/80 flex items-center justify-center text-cyan-700 group-hover:scale-110 transition-transform mb-3 shadow-inner">
                    <Camera className="w-7 h-7" />
                  </div>
                  <span className="text-sm font-bold text-slate-900">Take Photo</span>
                  <span className="text-xs text-slate-500 mt-1 text-center">
                    Use smartphone / webcam
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center p-6 rounded-2xl border-2 border-dashed border-sky-300 bg-white hover:bg-sky-50/70 hover:border-sky-500 transition-all group cursor-pointer shadow-xs hover:shadow-md"
                >
                  <div className="w-14 h-14 rounded-2xl bg-sky-100/80 flex items-center justify-center text-sky-700 group-hover:scale-110 transition-transform mb-3 shadow-inner">
                    <Upload className="w-7 h-7" />
                  </div>
                  <span className="text-sm font-bold text-slate-900">Upload Photo</span>
                  <span className="text-xs text-slate-500 mt-1 text-center">
                    JPG, PNG, WEBP (Up to 10MB)
                  </span>
                </button>
              </div>

              {/* Supported Detection Tags */}
              <div className="p-3.5 bg-white rounded-xl border border-slate-200">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                  Detectable Garment Categories
                </span>
                <div className="flex flex-wrap gap-1.5 text-xs">
                  {[
                    { label: 'T-Shirt', emoji: '👕' },
                    { label: 'Shirt', emoji: '👔' },
                    { label: 'Pant', emoji: '👖' },
                    { label: 'Jeans', emoji: '👖' },
                    { label: 'Shorts', emoji: '🩳' },
                    { label: 'Towel', emoji: '🧖' },
                    { label: 'Bedsheet', emoji: '🛏️' },
                    { label: 'Other Fabric', emoji: '👗' },
                  ].map((cat) => (
                    <span
                      key={cat.label}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-medium flex items-center gap-1 border border-slate-200/80"
                    >
                      <span>{cat.emoji}</span>
                      <span>{cat.label}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Image Preview & Scan Panel */
            <div className="space-y-4">
              {/* Image Display Area */}
              <div className="relative rounded-2xl overflow-hidden border border-slate-300 bg-slate-900 shadow-md">
                {/* View Mode Toggle when results exist */}
                {scanResult && scanResult.annotatedImage && (
                  <div className="absolute top-3 left-3 z-20 flex bg-slate-900/85 backdrop-blur-md p-1 rounded-xl border border-white/20 shadow-md text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setViewMode('annotated')}
                      className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                        viewMode === 'annotated'
                          ? 'bg-cyan-500 text-white shadow-xs'
                          : 'text-white/80 hover:text-white'
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>Bounding Boxes</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('original')}
                      className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                        viewMode === 'original'
                          ? 'bg-cyan-500 text-white shadow-xs'
                          : 'text-white/80 hover:text-white'
                      }`}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Original</span>
                    </button>
                  </div>
                )}

                {/* Change photo button */}
                {!isAnalyzing && (
                  <button
                    type="button"
                    onClick={resetSelection}
                    className="absolute top-3 right-3 z-20 bg-slate-900/80 hover:bg-slate-900 text-white px-3 py-1.5 rounded-xl text-xs font-semibold backdrop-blur-md transition-all border border-white/20 shadow-sm"
                  >
                    Change Photo
                  </button>
                )}

                {/* Image container */}
                <div className="relative min-h-[220px] max-h-[360px] flex items-center justify-center overflow-hidden">
                  <img
                    src={
                      viewMode === 'annotated' && scanResult?.annotatedImage
                        ? scanResult.annotatedImage
                        : previewUrl
                    }
                    alt="Laundry Load"
                    className="w-full h-auto max-h-[360px] object-contain mx-auto"
                  />

                  {/* Scanning Laser Beam overlay while analyzing */}
                  {isAnalyzing && (
                    <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-white text-center">
                      <div className="relative w-20 h-20 mb-4">
                        <div className="absolute inset-0 rounded-full border-4 border-cyan-500/30 animate-ping" />
                        <div className="absolute inset-0 rounded-full border-4 border-cyan-400 border-t-transparent animate-spin" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Activity className="w-8 h-8 text-cyan-300 animate-pulse" />
                        </div>
                      </div>
                      <span className="text-base font-bold text-white mb-1">
                        YOLOv8 Neural Detection
                      </span>
                      <p className="text-xs text-cyan-200/90 font-mono tracking-wide max-w-sm">
                        {analysisStep}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Action bar before scanning */}
              {!scanResult && (
                <div className="flex gap-2.5">
                  <button
                    type="button"
                    onClick={resetSelection}
                    disabled={isAnalyzing}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleAnalyze}
                    disabled={isAnalyzing}
                    className="flex-1 px-5 py-3 rounded-xl bg-gradient-to-r from-water-800 via-cyan-800 to-sky-800 text-white text-sm font-bold hover:from-water-900 hover:to-sky-900 transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-lg disabled:opacity-50 cursor-pointer"
                  >
                    {isAnalyzing ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-cyan-200" />
                        <span>Analyzing with YOLOv8...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-cyan-300" />
                        <span>Run YOLO Cloth Detection</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-xs text-rose-900">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-bold block mb-1">Scan Notice</span>
                <p className="leading-relaxed">{error}</p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-3 py-1.5 bg-white border border-rose-300 text-rose-700 rounded-lg text-xs font-semibold hover:bg-rose-100"
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
              {/* Mock Warning Banner if running in mock mode */}
              {scanResult.isMock && (
                <div className="p-3 bg-amber-50 border border-amber-200/90 rounded-xl text-xs text-amber-900 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    <span className="font-semibold">
                      Mock AI Mode: Simulated detection results for development/testing.
                    </span>
                  </div>
                  <span className="text-[10px] font-mono bg-amber-200/80 px-2 py-0.5 rounded text-amber-950 font-bold">
                    DEV_MOCK
                  </span>
                </div>
              )}

              {/* Main Results Summary Header */}
              <div className="bg-gradient-to-br from-white to-cyan-50/50 border border-cyan-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cyan-100 pb-3">
                  <div>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                      Detection Result
                    </span>
                    <div className="flex items-baseline gap-2 mt-0.5">
                      <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
                        {scanResult.summary.totalItems}
                      </span>
                      <span className="text-sm font-bold text-slate-600">Total Clothes Found</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Confidence
                      </span>
                      <span className="text-sm font-extrabold text-cyan-800">
                        {Math.round(scanResult.summary.averageConfidence * 100)}% Avg
                      </span>
                    </div>
                    <div className="p-2 bg-cyan-100 rounded-xl text-cyan-700">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                  </div>
                </div>

                {/* Garment Category Count Pills */}
                <div>
                  <span className="text-xs font-bold text-slate-700 block mb-2">
                    Garment Breakdown
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {Object.entries(scanResult.summary.counts).map(([cls, count]) => {
                      const sampleDetection = scanResult.detections.find((d) => d.class === cls);
                      return (
                        <div
                          key={cls}
                          className="bg-white p-3 rounded-xl border border-cyan-100 shadow-2xs flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{sampleDetection?.emoji || '👕'}</span>
                            <div>
                              <span className="text-xs font-bold text-slate-800 block capitalize">
                                {sampleDetection?.classDisplay || cls}
                              </span>
                              <span className="text-[10px] text-slate-400 font-medium">
                                Detected
                              </span>
                            </div>
                          </div>
                          <span className="text-base font-extrabold text-cyan-800 bg-cyan-50 px-2.5 py-0.5 rounded-lg border border-cyan-100">
                            {count}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Individual BBox Detections List */}
                {scanResult.detections.length > 0 && (
                  <div className="pt-2">
                    <span className="text-xs font-bold text-slate-700 block mb-2">
                      Individual Detected Objects ({scanResult.detections.length})
                    </span>
                    <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                      {scanResult.detections.map((det, idx) => (
                        <div
                          key={idx}
                          onMouseEnter={() => setSelectedDetectionIndex(idx)}
                          onMouseLeave={() => setSelectedDetectionIndex(null)}
                          className={`p-2 rounded-xl text-xs flex items-center justify-between border transition-all ${
                            selectedDetectionIndex === idx
                              ? 'bg-cyan-100/70 border-cyan-400'
                              : 'bg-white border-slate-200/80 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span>{det.emoji}</span>
                            <span className="font-bold text-slate-800">
                              #{idx + 1} {det.classDisplay}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              [{Math.round(det.bbox.x1)}, {Math.round(det.bbox.y1)}]
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="bg-cyan-600 h-full rounded-full"
                                style={{ width: `${Math.round(det.confidence * 100)}%` }}
                              />
                            </div>
                            <span className="font-extrabold text-slate-700 text-[11px] w-9 text-right">
                              {Math.round(det.confidence * 100)}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Booking Auto-Fill Formula Preview */}
                {bookingCounts && (
                  <div className="p-3.5 bg-gradient-to-r from-water-50 via-sky-50 to-cyan-50 border border-water-200 rounded-xl space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-water-950">
                      <span>WASHWISE Booking Mapping</span>
                      <span className="text-[10px] font-semibold text-water-700">
                        Max 20 clothes limit
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-white/90 p-2 rounded-lg border border-water-100">
                        <span className="text-[11px] text-slate-500 block">T-shirt / Shirt:</span>
                        <span className="font-bold text-water-800 text-sm">
                          {bookingCounts.tShirtShirt} items
                        </span>
                      </div>
                      <div className="bg-white/90 p-2 rounded-lg border border-water-100">
                        <span className="text-[11px] text-slate-500 block">Pants / Track:</span>
                        <span className="font-bold text-water-800 text-sm">
                          {bookingCounts.pantsTrack} items
                        </span>
                      </div>
                    </div>
                    {bookingCounts.others > 0 && (
                      <p className="text-[11px] text-slate-500 italic">
                        * Note: {bookingCounts.others} other items (towels/bedsheets) will be
                        counted by staff at physical intake.
                      </p>
                    )}
                  </div>
                )}

                {/* Disclaimer */}
                <div className="p-2.5 rounded-xl bg-amber-50/90 border border-amber-200/80 text-[11px] text-amber-900 flex items-start gap-2">
                  <Info className="w-3.5 h-3.5 text-amber-700 flex-shrink-0 mt-0.5" />
                  <span>
                    <strong>Verification policy:</strong> AI results provide fast assisted counts.
                    Laundry staff will physically verify all clothes at the hostel intake counter.
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={resetSelection}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Scan Another Photo
                </button>
                <button
                  type="button"
                  onClick={handleApplyToBooking}
                  className="flex-1 px-5 py-3 rounded-xl bg-gradient-to-r from-water-700 to-cyan-700 text-white text-xs font-bold hover:from-water-800 hover:to-cyan-800 transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-lg cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4 text-cyan-200" />
                  <span>
                    {onScanComplete
                      ? `Apply ${scanResult.summary.totalItems} Items to Booking`
                      : `Book Slot with ${scanResult.summary.totalItems} Items`}
                  </span>
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
export default AiLaundryScannerModal;
