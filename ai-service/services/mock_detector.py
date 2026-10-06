"""
Mock Detector
=============
Used when AI_MODE=mock (no trained model available).

IMPORTANT: These results are SIMULATED. They are NOT real AI predictions.
They exist only to allow frontend/backend development without a trained model.

This module will NEVER be imported or called in AI_MODE=production.
"""

import random
from services.detector import CLASS_NAMES, CLASS_DISPLAY, CLASS_EMOJI


def run_mock_inference() -> dict:
    """
    Returns clearly marked fake detections for development use only.
    The response always includes 'isMock: true' so the client can
    distinguish simulated data from real AI results.
    """
    possible_classes = list(CLASS_NAMES.values())
    
    # Pick 3-7 random items
    num_items = random.randint(3, 7)
    detections = []
    counts: dict[str, int] = {}

    for i in range(num_items):
        class_name = random.choice(possible_classes)
        confidence = round(random.uniform(0.52, 0.97), 4)
        
        # Generate plausible non-overlapping bounding boxes
        x1 = random.randint(10, 300)
        y1 = random.randint(10, 300)
        x2 = x1 + random.randint(100, 250)
        y2 = y1 + random.randint(150, 300)

        detections.append({
            "class":        class_name,
            "classDisplay": CLASS_DISPLAY.get(class_name, class_name.title()),
            "emoji":        CLASS_EMOJI.get(class_name, "👗"),
            "confidence":   confidence,
            "bbox": {
                "x1": x1,
                "y1": y1,
                "x2": x2,
                "y2": y2,
            },
        })
        counts[class_name] = counts.get(class_name, 0) + 1

    avg_confidence = round(
        sum(d["confidence"] for d in detections) / len(detections), 4
    ) if detections else 0.0

    return {
        "isMock": True,
        "mockWarning": (
            "⚠️ MOCK MODE: These results are SIMULATED for development. "
            "A trained YOLOv8 clothing model has not been loaded. "
            "Set AI_MODE=production and provide MODEL_PATH to enable real detection."
        ),
        "detections": detections,
        "summary": {
            "totalItems":        len(detections),
            "counts":            counts,
            "averageConfidence": avg_confidence,
        },
    }
