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
  Plus,
  Minus,
  Scale,
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

export interface DetailedGarmentCounts {
  shirt: number;
  tshirt: number;
  pants: number;
  jeans: number;
  shorts: number;
}

export const REFERENCE_WEIGHTS: Record<keyof DetailedGarmentCounts, number> = {
  shirt: 200,
  tshirt: 180,
  pants: 350,
  jeans: 600,
  shorts: 200,
};

export const SESSION_MAX_WEIGHT_GRAMS = 4500;
export const WEEKLY_ALLOWANCE_MAX_WEIGHT_GRAMS = 7000;

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
      editedGarments?: DetailedGarmentCounts;
    }
  ) => void;
  onNavigateToBookingWithCounts?: (counts: {
    tShirtShirt: number;
    pantsTrack: number;
    scanId?: string;
    garments?: DetailedGarmentCounts;
  }) => void;
}

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];

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

  // Editable garment counts state (resident-controlled)
  const [editedCounts, setEditedCounts] = useState<DetailedGarmentCounts>({
    shirt: 0,
    tshirt: 0,
    pants: 0,
    jeans: 0,
    shorts: 0,
  });

  // Unsupported garments detected by YOLO (e.g. other, towel, bedsheet)
  const [unsupportedDetections, setUnsupportedDetections] = useState<
    Array<{ name: string; count: number }>
  >([]);

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
    setEditedCounts({ shirt: 0, tshirt: 0, pants: 0, jeans: 0, shorts: 0 });
    setUnsupportedDetections([]);
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
      setEditedCounts({ shirt: 0, tshirt: 0, pants: 0, jeans: 0, shorts: 0 });
      setUnsupportedDetections([]);
      playWaterBubbleSound();
    } catch (err: any) {
      if (err instanceof CameraCancelledError) {
        return;
      }
      if (err instanceof CameraPermissionError) {
        setError(
          'Camera permission is required to take a photo. You can also choose Upload Photo instead.'
        );
        return;
      }
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
    setEditedCounts({ shirt: 0, tshirt: 0, pants: 0, jeans: 0, shorts: 0 });
    setUnsupportedDetections([]);
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

        // Extract detected counts and map into 5 approved categories
        const counts = response.summary?.counts || {};
        const initial: DetailedGarmentCounts = {
          shirt: counts['shirt'] || 0,
          tshirt: counts['tshirt'] || 0,
          pants: counts['pants'] || counts['pant'] || 0,
          jeans: counts['jeans'] || 0,
          shorts: counts['shorts'] || 0,
        };
        setEditedCounts(initial);

        // Identify any unsupported categories (e.g. other, towel, bedsheet)
        const unsupp: Array<{ name: string; count: number }> = [];
        for (const [cls, cnt] of Object.entries(counts)) {
          const lower = cls.toLowerCase();
          if (
            !['shirt', 'tshirt', 'pants', 'pant', 'jeans', 'shorts'].includes(lower) &&
            (cnt as number) > 0
          ) {
            unsupp.push({ name: cls, count: cnt as number });
          }
        }
        setUnsupportedDetections(unsupp);

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

  // Stepper handlers for resident edits
  function handleQuantityChange(category: keyof DetailedGarmentCounts, delta: number) {
    setEditedCounts((prev) => {
      const current = prev[category] || 0;
      const next = Math.max(0, Math.min(30, current + delta));
      return { ...prev, [category]: next };
    });
    setError(null);
    playWaterBubbleSound();
  }

  function handleDirectQuantityInput(category: keyof DetailedGarmentCounts, val: string) {
    const num = parseInt(val, 10);
    if (val === '' || val === '0') {
      setEditedCounts((prev) => ({ ...prev, [category]: 0 }));
      setError(null);
      return;
    }
    if (!isNaN(num) && num >= 0 && num <= 30) {
      setEditedCounts((prev) => ({ ...prev, [category]: num }));
      setError(null);
    }
  }

  // Live calculations
  const totalEditedItems =
    editedCounts.shirt +
    editedCounts.tshirt +
    editedCounts.pants +
    editedCounts.jeans +
    editedCounts.shorts;

  const totalEditedWeightGrams =
    editedCounts.shirt * REFERENCE_WEIGHTS.shirt +
    editedCounts.tshirt * REFERENCE_WEIGHTS.tshirt +
    editedCounts.pants * REFERENCE_WEIGHTS.pants +
    editedCounts.jeans * REFERENCE_WEIGHTS.jeans +
    editedCounts.shorts * REFERENCE_WEIGHTS.shorts;

  // Recommended batches calculation (max 4500 g per session)
  const recommendedBatches =
    totalEditedWeightGrams === 0
      ? 0
      : Math.max(1, Math.ceil(totalEditedWeightGrams / SESSION_MAX_WEIGHT_GRAMS));

  const isExceedingWeeklyLimit = totalEditedWeightGrams > WEEKLY_ALLOWANCE_MAX_WEIGHT_GRAMS;
  const isMultiBatch = totalEditedWeightGrams > SESSION_MAX_WEIGHT_GRAMS;

  function handleApplyToBooking() {
    if (!scanResult) return;
    if (totalEditedItems < 1) {
      setError('Please add or maintain at least 1 garment item to proceed.');
      return;
    }
    if (isExceedingWeeklyLimit) {
      setError('Total weight exceeds the 7,000 g weekly allowance. Please adjust quantities.');
      return;
    }

    playWaterBubbleSound();

    const primaryScanId = scanResult.scanId || `ai-scan-${Date.now()}`;
    const tShirtShirt = editedCounts.tshirt + editedCounts.shirt;
    const pantsTrack = editedCounts.pants + editedCounts.jeans + editedCounts.shorts;

    const estimate: AiLaundryEstimate = {
      visibleClothingCount: totalEditedItems,
      clothingType:
        Object.entries(editedCounts)
          .filter(([_, v]) => v > 0)
          .map(([k, v]) => `${k}:${v}`)
          .join(', ') || 'None',
      mainColor: 'Resident-verified',
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
        tShirtShirt,
        pantsTrack,
        total: totalEditedItems,
        rawSummary: {
          ...scanResult.summary,
          counts: { ...editedCounts },
          totalItems: totalEditedItems,
        },
        yoloResult: scanResult,
        editedGarments: editedCounts,
      });
      onClose();
    } else if (onNavigateToBookingWithCounts) {
      onNavigateToBookingWithCounts({
        tShirtShirt,
        pantsTrack,
        scanId: primaryScanId,
        garments: editedCounts,
      });
      onClose();
    } else {
      onClose();
    }
  }

  const garmentCategoriesList: Array<{
    key: keyof DetailedGarmentCounts;
    label: string;
    weight: number;
    emoji: string;
  }> = [
    { key: 'shirt', label: 'Shirt', weight: REFERENCE_WEIGHTS.shirt, emoji: '👔' },
    { key: 'tshirt', label: 'T-shirt', weight: REFERENCE_WEIGHTS.tshirt, emoji: '👕' },
    { key: 'pants', label: 'Pants', weight: REFERENCE_WEIGHTS.pants, emoji: '👖' },
    { key: 'jeans', label: 'Jeans', weight: REFERENCE_WEIGHTS.jeans, emoji: '👖' },
    { key: 'shorts', label: 'Shorts', weight: REFERENCE_WEIGHTS.shorts, emoji: '🩳' },
  ];

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
                Automated object detection with resident-editable quantities
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
                    Jeans, Shorts). You can review and adjust any quantities before booking.
                  </p>
                  <p className="text-cyan-800 font-semibold text-[11px] pt-1">
                    ✓ Bounding box visualization &middot; ✓ Resident editable counts &middot; ✓
                    Immediate weight recalculation &middot; ✓ No staff approval required
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
                  Supported Garment Categories & Reference Weights
                </span>
                <div className="flex flex-wrap gap-2 text-xs">
                  {garmentCategoriesList.map((cat) => (
                    <span
                      key={cat.key}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-medium flex items-center gap-1.5 border border-slate-200/80"
                    >
                      <span>{cat.emoji}</span>
                      <span className="font-semibold">{cat.label}</span>
                      <span className="text-[10px] text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                        {cat.weight} g
                      </span>
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
                    className="absolute top-3 right-3 z-20 bg-slate-900/80 hover:bg-slate-900 text-white px-3 py-1.5 rounded-xl text-xs font-semibold backdrop-blur-md transition-all border border-white/20 shadow-sm cursor-pointer"
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
                <span className="font-bold block mb-1">Booking Notice</span>
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

          {/* AI Result Card with Editable Quantity Controls */}
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

              {/* Main Results Summary & Editable Quantity Interface */}
              <div className="bg-gradient-to-br from-white to-cyan-50/50 border border-cyan-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
                {/* Header row: YOLO detections summary */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cyan-100 pb-3">
                  <div>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                      AI Detection Result
                    </span>
                    <div className="flex items-baseline gap-2 mt-0.5">
                      <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
                        {scanResult.summary.totalItems}
                      </span>
                      <span className="text-sm font-bold text-slate-600">Items Detected by AI</span>
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

                {/* Editable Garments Section */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">
                        Review & Edit Garment Quantities
                      </span>
                      <p className="text-[11px] text-slate-500">
                        Adjust counts if YOLO made a mistake, missed an item, or detected a false positive.
                      </p>
                    </div>
                    <span className="text-[10px] font-bold text-cyan-800 bg-cyan-100 px-2 py-0.5 rounded-full">
                      Editable
                    </span>
                  </div>

                  {/* 5 Garment Stepper Controls */}
                  <div className="space-y-2">
                    {garmentCategoriesList.map(({ key, label, weight, emoji }) => {
                      const count = editedCounts[key];
                      const subtotal = count * weight;
                      return (
                        <div
                          key={key}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-slate-200/90 shadow-2xs hover:border-cyan-300 transition-colors"
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="text-xl">{emoji}</span>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-900">{label}</span>
                                <span className="text-[10px] font-semibold text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
                                  {weight} g / item
                                </span>
                              </div>
                              <span className="text-[11px] text-slate-500">
                                Subtotal:{' '}
                                <strong className="text-slate-800">{subtotal.toLocaleString()} g</strong>
                              </span>
                            </div>
                          </div>

                          {/* Stepper Controls */}
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleQuantityChange(key, -1)}
                              disabled={count <= 0}
                              className="w-8 h-8 rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-slate-700 font-bold transition-colors cursor-pointer"
                              aria-label={`Decrease ${label} count`}
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <input
                              type="number"
                              min={0}
                              max={30}
                              value={count}
                              onChange={(e) => handleDirectQuantityInput(key, e.target.value)}
                              className="w-12 text-center text-sm font-extrabold text-slate-900 border border-slate-300 rounded-lg py-1 focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-white"
                              aria-label={`${label} quantity`}
                            />
                            <button
                              type="button"
                              onClick={() => handleQuantityChange(key, 1)}
                              disabled={count >= 30}
                              className="w-8 h-8 rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-slate-700 font-bold transition-colors cursor-pointer"
                              aria-label={`Increase ${label} count`}
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Unsupported items notification banner if any were detected */}
                {unsupportedDetections.length > 0 && (
                  <div className="p-3 bg-amber-50/90 border border-amber-200 rounded-xl text-xs text-amber-950 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-amber-900">
                      <Info className="w-4 h-4 text-amber-700 flex-shrink-0" />
                      <span>Unsupported Fabric Items Detected by AI</span>
                    </div>
                    <p className="text-[11px] text-amber-800 leading-relaxed pl-5">
                      The AI detected{' '}
                      <strong>
                        {unsupportedDetections.map((d) => `${d.count} ${d.name}`).join(', ')}
                      </strong>
                      . Items outside our approved categories (Shirt, T-shirt, Pants, Jeans, Shorts)
                      do not have standard reference weights and cannot be automatically weighed. You can
                      adjust your supported counts above or use manual entry if needed.
                    </p>
                  </div>
                )}

                {/* Real-time Weight & Batch Recommendation Panel */}
                <div className="p-3.5 bg-gradient-to-r from-water-50 via-sky-50 to-cyan-50 border border-water-200 rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between text-xs font-bold text-water-950">
                    <span className="flex items-center gap-1.5">
                      <Scale className="w-4 h-4 text-water-700" />
                      Live Weight & Batch Planning Preview
                    </span>
                    <span className="text-[10px] font-semibold text-water-700">
                      Limit: 4,500 g / batch &middot; 7,000 g / week
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-white/90 p-2.5 rounded-lg border border-water-100">
                      <span className="text-[11px] text-slate-500 block">Total Garments:</span>
                      <span className="font-extrabold text-slate-900 text-sm">
                        {totalEditedItems} item{totalEditedItems === 1 ? '' : 's'}
                      </span>
                    </div>
                    <div className="bg-white/90 p-2.5 rounded-lg border border-water-100">
                      <span className="text-[11px] text-slate-500 block">Estimated Weight:</span>
                      <span
                        className={`font-extrabold text-sm ${
                          isExceedingWeeklyLimit
                            ? 'text-red-600'
                            : isMultiBatch
                            ? 'text-amber-600'
                            : 'text-water-700'
                        }`}
                      >
                        {totalEditedWeightGrams.toLocaleString()} g
                      </span>
                    </div>
                  </div>

                  {/* Batch Recommendation Notice */}
                  <div className="text-[11px] font-medium text-slate-600 pt-0.5">
                    {totalEditedItems === 0 ? (
                      <span className="text-slate-500 italic">
                        Select at least 1 garment to see batch planning recommendations.
                      </span>
                    ) : isExceedingWeeklyLimit ? (
                      <span className="text-red-700 font-bold">
                        ⚠️ Exceeds 7,000 g weekly allowance! Please reduce garment quantities.
                      </span>
                    ) : isMultiBatch ? (
                      <span className="text-amber-800 font-semibold">
                        ℹ️ Requires {recommendedBatches} batches (weight exceeds 4,500 g session limit).
                        Multi-batch booking will allocate separate slots automatically.
                      </span>
                    ) : (
                      <span className="text-emerald-700 font-semibold">
                        ✓ Fits in a single session (within 4,500 g session limit).
                      </span>
                    )}
                  </div>
                </div>

                {/* Resident self-verification disclaimer */}
                <div className="p-2.5 rounded-xl bg-cyan-50/90 border border-cyan-200/80 text-[11px] text-cyan-950 flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-cyan-700 flex-shrink-0 mt-0.5" />
                  <span>
                    <strong>Resident verified:</strong> You have full control to review and adjust these
                    quantities. Your confirmed counts are applied directly to the booking system without
                    requiring staff pre-approval.
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
                  disabled={totalEditedItems < 1 || isExceedingWeeklyLimit}
                  className="flex-1 px-5 py-3 rounded-xl bg-gradient-to-r from-water-700 to-cyan-700 text-white text-xs font-bold hover:from-water-800 hover:to-cyan-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-lg cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4 text-cyan-200" />
                  <span>
                    Apply {totalEditedItems} Garments ({totalEditedWeightGrams.toLocaleString()} g) to Booking
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
