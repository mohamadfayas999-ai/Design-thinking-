"""GET /health — AI service health check"""

import os
from flask import Blueprint, jsonify
from services.detector import get_model, CLASS_NAMES

health_bp = Blueprint("health", __name__)


@health_bp.route("/health", methods=["GET"])
@health_bp.route("/", methods=["GET"])
def health():
    ai_mode = os.getenv("AI_MODE", "mock")
    model_loaded = get_model() is not None

    return jsonify({
        "status":      "ok",
        "service":     "WASHWISE AI Clothing Detection",
        "mode":        ai_mode,
        "modelLoaded": model_loaded,
        "modelPath":   os.getenv("MODEL_PATH", "./models/clothing_yolov8.pt"),
        "classes":     list(CLASS_NAMES.values()),
        "threshold":   float(os.getenv("CONFIDENCE_THRESHOLD", "0.50")),
    })
