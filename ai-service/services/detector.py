"""
Detector Service
================
Handles loading a YOLOv8 clothing model and running inference.

CLASS MAP — matches the expected YOLOv8 training config:
  0: shirt
  1: tshirt
  2: pant
  3: jeans
  4: shorts
  5: towel
  6: bedsheet
  7: other

This map is kept configurable so it can be updated without
modifying any other source files.
"""

import os
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# ── Configurable class map ─────────────────────────────────────
# These labels MUST match the class indices used when training your
# custom YOLOv8 model.  If you use a different training config,
# update only this dictionary.
CLASS_NAMES: dict[int, str] = {
    0: "shirt",
    1: "tshirt",
    2: "pant",
    3: "jeans",
    4: "shorts",
    5: "towel",
    6: "bedsheet",
    7: "other",
}

# Display-friendly labels (for frontend)
CLASS_DISPLAY: dict[str, str] = {
    "shirt":    "Shirt",
    "tshirt":   "T-Shirt",
    "pant":     "Pant",
    "jeans":    "Jeans",
    "shorts":   "Shorts",
    "towel":    "Towel",
    "bedsheet": "Bedsheet",
    "other":    "Other",
    "unknown":  "Unknown",
}

# Emoji icons for each class (used by frontend summary)
CLASS_EMOJI: dict[str, str] = {
    "shirt":    "👔",
    "tshirt":   "👕",
    "pant":     "👖",
    "jeans":    "👖",
    "shorts":   "🩳",
    "towel":    "🧺",
    "bedsheet": "🛏️",
    "other":    "👗",
    "unknown":  "❓",
}

_model: Optional[object] = None


def load_model() -> bool:
    """
    Attempt to load the YOLOv8 model from MODEL_PATH.
    Returns True if the model loaded successfully, False otherwise.
    """
    global _model
    model_path = os.getenv("MODEL_PATH", "./models/clothing_yolov8.pt")
    
    if not os.path.exists(model_path):
        logger.warning(
            f"YOLOv8 model not found at: {model_path}\n"
            f"Set MODEL_PATH to your trained clothing_yolov8.pt file.\n"
            f"Running in MOCK mode."
        )
        return False

    try:
        from ultralytics import YOLO  # type: ignore
        _model = YOLO(model_path)
        logger.info(f"YOLOv8 model loaded from: {model_path}")
        return True
    except Exception as e:
        logger.error(f"Failed to load YOLOv8 model: {e}")
        return False


def get_model():
    return _model


def run_inference(image_path: str) -> dict:
    """
    Run YOLOv8 inference on the given image path.
    Returns a standardised result dict.
    """
    model = get_model()
    if model is None:
        raise RuntimeError("Model not loaded. Call load_model() first.")

    confidence_threshold = float(os.getenv("CONFIDENCE_THRESHOLD", "0.50"))

    results = model(image_path, conf=confidence_threshold)
    detections = []
    counts: dict[str, int] = {}

    for result in results:
        if result.boxes is None:
            continue
        for box in result.boxes:
            class_idx = int(box.cls[0])
            confidence = float(box.conf[0])
            x1, y1, x2, y2 = [float(v) for v in box.xyxy[0]]
            
            class_name = CLASS_NAMES.get(class_idx, "other")
            
            detections.append({
                "class":      class_name,
                "classDisplay": CLASS_DISPLAY.get(class_name, class_name.title()),
                "emoji":      CLASS_EMOJI.get(class_name, "👗"),
                "confidence": round(confidence, 4),
                "bbox": {
                    "x1": round(x1),
                    "y1": round(y1),
                    "x2": round(x2),
                    "y2": round(y2),
                },
            })
            counts[class_name] = counts.get(class_name, 0) + 1

    avg_confidence = (
        round(sum(d["confidence"] for d in detections) / len(detections), 4)
        if detections else 0.0
    )

    return {
        "detections": detections,
        "summary": {
            "totalItems":       len(detections),
            "counts":           counts,
            "averageConfidence": avg_confidence,
        },
    }
