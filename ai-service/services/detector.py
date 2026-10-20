"""
Detector Service
================
Handles loading the Fashionpedia YOLOv8 Nano TorchScript model and running inference.

MODEL METADATA:
  Repository: louisJLN/yolo8-fashionpedia
  Format: TorchScript (results/yolov8n-fashionpedia-1.torchscript)
  Model path: ai-service/models/clothing_yolov8n.torchscript
  Classes: 46 Fashionpedia categories (0-45)

WASHWISE CATEGORY MAPPINGS:
  - 'shirt, blouse' (0)          -> 'shirt'
  - 'top, t-shirt, sweatshirt' (1) -> 'tshirt'
  - 'pants' (6)                   -> 'pants'
  - 'shorts' (7)                  -> 'shorts'
  - other supported apparel classes -> 'other' (requires unmapped review in booking)
  - structural garment parts (27-45) and non-garment accessories (13, 18, 19, 23, 24, 26)
    are excluded from discrete laundry piece counts to prevent double-counting.
"""

import os
import logging
from typing import Optional
import torch

# ── Container / Render CPU Optimizations ────────────────────────
# Restrict PyTorch to 1 CPU thread to avoid thread contention, high context
# switching overhead, and memory spikes on shared container environments.
try:
    torch.set_num_threads(1)
    if hasattr(torch, "set_num_interop_threads"):
        torch.set_num_interop_threads(1)
except Exception:
    pass

logger = logging.getLogger(__name__)

# Base directory of the AI service (ai-service/)
AI_SERVICE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ── 46 Verified Fashionpedia Class Names & Indices ──────────────
FASHIONPEDIA_CLASSES: dict[int, str] = {
    0: "shirt, blouse",
    1: "top, t-shirt, sweatshirt",
    2: "sweater",
    3: "cardigan",
    4: "jacket",
    5: "vest",
    6: "pants",
    7: "shorts",
    8: "skirt",
    9: "coat",
    10: "dress",
    11: "jumpsuit",
    12: "cape",
    13: "glasses",
    14: "hat",
    15: "headband, head covering, hair accessory",
    16: "tie",
    17: "glove",
    18: "watch",
    19: "belt",
    20: "leg warmer",
    21: "tights, stockings",
    22: "sock",
    23: "shoe",
    24: "bag, wallet",
    25: "scarf",
    26: "umbrella",
    27: "hood",
    28: "collar",
    29: "lapel",
    30: "epaulette",
    31: "sleeve",
    32: "pocket",
    33: "neckline",
    34: "buckle",
    35: "zipper",
    36: "applique",
    37: "bead",
    38: "bow",
    39: "flower",
    40: "fringe",
    41: "ribbon",
    42: "rivet",
    43: "ruffle",
    44: "sequin",
    45: "tassel",
}

# ── Explicit Mapping to WASHWISE Categories ─────────────────────
# Verified main categories:
#   shirt, blouse            -> shirt
#   top, t-shirt, sweatshirt -> tshirt
#   pants                    -> pants
#   shorts                   -> shorts
# Other wearable apparel items -> other (routed to staff/unmapped review)
# Note: Jeans are categorized as general pants per model training.
# Neither towels nor bedsheets exist in Fashionpedia; they are not fabricated.
CATEGORY_MAPPING: dict[int, str] = {
    0: "shirt",
    1: "tshirt",
    2: "other",   # sweater
    3: "other",   # cardigan
    4: "other",   # jacket
    5: "other",   # vest
    6: "pants",   # pants
    7: "shorts",  # shorts
    8: "other",   # skirt
    9: "other",   # coat
    10: "other",  # dress
    11: "other",  # jumpsuit
    12: "other",  # cape
    14: "other",  # hat
    15: "other",  # headband
    16: "other",  # tie
    17: "other",  # glove
    20: "other",  # leg warmer
    21: "other",  # tights, stockings
    22: "other",  # sock
    25: "other",  # scarf
}

# Target categories exposed by the service
CLASS_NAMES: dict[int, str] = {
    0: "shirt",
    1: "tshirt",
    2: "pants",
    3: "shorts",
    4: "other",
}

# Display labels for frontend
CLASS_DISPLAY: dict[str, str] = {
    "shirt":    "Shirt",
    "tshirt":   "T-Shirt",
    "pants":    "Pants",
    "pant":     "Pants",
    "shorts":   "Shorts",
    "other":    "Other",
    "unknown":  "Unknown",
}

# Emoji icons for frontend summary
CLASS_EMOJI: dict[str, str] = {
    "shirt":    "👔",
    "tshirt":   "👕",
    "pants":    "👖",
    "pant":     "👖",
    "shorts":   "🩳",
    "other":    "👗",
    "unknown":  "❓",
}

_model: Optional[object] = None


def resolve_model_path() -> str:
    """
    Resolve the model path relative to the AI service directory (AI_SERVICE_DIR),
    never relying on the current working directory of the shell or process.
    """
    configured = os.getenv("MODEL_PATH", "models/clothing_yolov8n.torchscript")
    if os.path.isabs(configured):
        return os.path.normpath(configured)
    return os.path.normpath(os.path.join(AI_SERVICE_DIR, configured))


def load_model() -> bool:
    """
    Load the YOLOv8 Fashionpedia TorchScript model from the resolved model path.
    Returns True if successfully loaded, False otherwise.
    """
    global _model
    model_path = resolve_model_path()

    if not os.path.exists(model_path):
        logger.error(
            f"AI model file not found at: {model_path}\n"
            f"Resolved relative to AI service directory: {AI_SERVICE_DIR}\n"
            f"Please verify MODEL_PATH in .env."
        )
        _model = None
        return False

    try:
        from ultralytics import YOLO  # type: ignore
        _model = YOLO(model_path, task="detect")
        logger.info(f"YOLOv8 Fashionpedia model successfully loaded from: {model_path}")
        return True
    except Exception as e:
        logger.error(f"Failed to load TorchScript YOLO model from {model_path}: {e}")
        _model = None
        return False


def get_model():
    return _model


def run_inference(image_path: str) -> dict:
    """
    Execute real TorchScript YOLOv8 inference on the specified image.
    Maps Fashionpedia detections to WASHWISE categories and preserves genuine
    bounding boxes and confidence scores.

    Raises RuntimeError if the model is not loaded.
    """
    model = get_model()
    if model is None:
        raise RuntimeError(
            "AI model is not loaded. Ensure MODEL_PATH is valid and load_model() succeeds."
        )

    confidence_threshold = float(os.getenv("CONFIDENCE_THRESHOLD", "0.50"))

    # Execute YOLO inference using Ultralytics with TorchScript engine.
    # imgsz=640 standardizes image scale to prevent memory spikes on phone photos.
    # torch.inference_mode() prevents tracking gradients and intermediate graph tensors.
    with torch.inference_mode():
        results = model(
            image_path,
            imgsz=640,
            conf=confidence_threshold,
            verbose=False,
            device="cpu",
        )

    detections = []
    counts: dict[str, int] = {}

    for result in results:
        if result.boxes is None or len(result.boxes) == 0:
            continue

        for box in result.boxes:
            class_idx = int(box.cls[0])
            confidence = float(box.conf[0])
            x1, y1, x2, y2 = [float(v) for v in box.xyxy[0]]

            # Map the Fashionpedia class index to WASHWISE category
            # If not in CATEGORY_MAPPING (e.g. sub-parts or non-garment accessories),
            # skip it from discrete clothing piece counts.
            if class_idx not in CATEGORY_MAPPING:
                continue

            target_class = CATEGORY_MAPPING[class_idx]
            raw_class_name = FASHIONPEDIA_CLASSES.get(class_idx, f"class_{class_idx}")

            detections.append({
                "class": target_class,
                "classDisplay": CLASS_DISPLAY.get(target_class, target_class.title()),
                "emoji": CLASS_EMOJI.get(target_class, "👗"),
                "confidence": round(confidence, 4),
                "rawClass": raw_class_name,
                "bbox": {
                    "x1": round(x1),
                    "y1": round(y1),
                    "x2": round(x2),
                    "y2": round(y2),
                },
            })
            counts[target_class] = counts.get(target_class, 0) + 1

    avg_confidence = (
        round(sum(d["confidence"] for d in detections) / len(detections), 4)
        if detections else 0.0
    )

    return {
        "isMock": False,
        "mockWarning": None,
        "detections": detections,
        "summary": {
            "totalItems": len(detections),
            "counts": counts,
            "averageConfidence": avg_confidence,
        },
    }
