// ─────────────────────────────────────────────────────────────
// WASHWISE Deterministic Laundry Recommendation Engine
// Predefined campus rules: AI observation -> WASHWISE rules -> recommendation
// The AI vision model does NOT freely decide the final laundry process.
// ─────────────────────────────────────────────────────────────

export interface AiItemObservation {
  type: 'T-Shirt/Shirt' | 'Pants/Track' | 'UNKNOWN';
  color: string;
  possibleStain: string;
  stainSeverity: 'None' | 'Low' | 'Medium' | 'High' | 'Unknown';
  confidence: 'High' | 'Medium' | 'Low';
}

export interface AiObservation {
  visibleClothingCount: number;
  clothingType: string;
  mainColor: string;
  possibleStain: string;
  stainSeverity: 'None' | 'Low' | 'Medium' | 'High' | 'Unknown';
  confidence: 'High' | 'Medium' | 'Low';
  items?: AiItemObservation[];
}

export interface LaundryRecommendation {
  washMode: string;
  preTreatment: string;
  detergentLevel: 'Low' | 'Medium' | 'High';
  detergentNote: string;
}

/**
 * Deterministic recommendation engine based strictly on predefined WASHWISE rules:
 * - No visible stain: Wash mode "Standard Wash", Pre-treatment "Not normally required"
 * - Low stain severity: Wash mode "Standard Wash", Pre-treatment "Inspect / optional pre-treatment"
 * - Medium stain severity: Wash mode "Standard Wash + stain attention", Pre-treatment "Recommended"
 * - High stain severity: Wash mode "Careful Wash / Staff Inspection", Pre-treatment "Required before processing if appropriate"
 * - Unknown: Wash mode "Standard Wash", Pre-treatment "Staff inspection recommended"
 * 
 * Detergent Level:
 * - Low: 1 - 5 visible clothes
 * - Medium: 6 - 12 visible clothes
 * - High: 13 - 20 visible clothes
 */
export function computeRecommendation(observation: AiObservation): LaundryRecommendation {
  let washMode = 'Standard Wash';
  let preTreatment = 'Not normally required';

  const severity = observation.stainSeverity;
  const stain = (observation.possibleStain || '').toLowerCase();

  switch (severity) {
    case 'High':
      washMode = 'Careful Wash / Staff Inspection';
      preTreatment = 'Required before processing if appropriate';
      break;

    case 'Medium':
      washMode = 'Standard Wash + stain attention';
      preTreatment = 'Recommended';
      break;

    case 'Low':
      washMode = 'Standard Wash';
      preTreatment = 'Inspect / optional pre-treatment';
      break;

    case 'None':
      washMode = 'Standard Wash';
      preTreatment = 'Not normally required';
      break;

    case 'Unknown':
    default:
      if (
        stain.includes('dirt') ||
        stain.includes('food') ||
        stain.includes('oil') ||
        stain.includes('grease') ||
        stain.includes('ink')
      ) {
        washMode = 'Standard Wash + stain attention';
        preTreatment = 'Inspect / optional pre-treatment';
      } else {
        washMode = 'Standard Wash';
        preTreatment = 'Staff inspection recommended';
      }
      break;
  }

  // Detergent level based on load size / count:
  let detergentLevel: 'Low' | 'Medium' | 'High' = 'Medium';
  const count = observation.visibleClothingCount;
  if (count <= 5) {
    detergentLevel = 'Low';
  } else if (count <= 12) {
    detergentLevel = 'Medium';
  } else {
    detergentLevel = 'High';
  }

  return {
    washMode,
    preTreatment,
    detergentLevel,
    detergentNote: 'Estimated — staff confirmation required',
  };
}
