"""
POST /predict  — Clothing detection endpoint
"""

import os
import uuid
import logging
from flask import Blueprint, request, jsonify
from werkzeug.utils import secure_filename
from services.annotator import annotate_image

logger = logging.getLogger(__name__)

predict_bp = Blueprint("predict", __name__)

ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "webp"}
MAX_SIZE_MB = int(os.getenv("MAX_IMAGE_SIZE_MB", "10"))
AI_MODE = os.getenv("AI_MODE", "mock")
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


@predict_bp.route("/predict", methods=["POST"])
def predict():
    """
    Accept an image file, run clothing detection, return detections
    with an annotated image encoded as base64.
    """
    # ── Validate file presence ──────────────────────────────────
    if "image" not in request.files:
        return jsonify({
            "success": False,
            "error": "No image file provided. Send the image in the 'image' field.",
        }), 400

    file = request.files["image"]
    if file.filename == "" or file.filename is None:
        return jsonify({
            "success": False,
            "error": "No file selected.",
        }), 400

    if not allowed_file(file.filename):
        return jsonify({
            "success": False,
            "error": f"Unsupported file type. Allowed: {', '.join(ALLOWED_EXTENSIONS)}.",
        }), 415

    # ── Validate file size ──────────────────────────────────────
    file.seek(0, 2)
    size_mb = file.tell() / (1024 * 1024)
    file.seek(0)
    if size_mb > MAX_SIZE_MB:
        return jsonify({
            "success": False,
            "error": f"Image too large ({size_mb:.1f} MB). Maximum allowed: {MAX_SIZE_MB} MB.",
        }), 413

    # ── Save temp file ──────────────────────────────────────────
    ext = secure_filename(file.filename).rsplit(".", 1)[-1].lower()
    temp_filename = f"{uuid.uuid4().hex}.{ext}"
    temp_path = os.path.join(UPLOAD_DIR, temp_filename)

    try:
        file.save(temp_path)

        # ── Run detection ───────────────────────────────────────
        ai_mode = os.getenv("AI_MODE", "mock").lower()
        if ai_mode == "production":
            from services.detector import run_inference, get_model, load_model
            if get_model() is None:
                load_model()
            if get_model() is None:
                return jsonify({
                    "success": False,
                    "error": (
                        "AI model is not loaded. "
                        "Ensure MODEL_PATH points to a valid .pt file "
                        "and restart the AI service."
                    ),
                }), 503
            result = run_inference(temp_path)
        else:
            # MOCK mode (no .pt model required)
            from services.mock_detector import run_mock_inference
            result = run_mock_inference()

        detections = result.get("detections", [])

        # ── Check threshold / empty ─────────────────────────────
        if not detections:
            return jsonify({
                "success": True,
                "isMock": result.get("isMock", False),
                "mockWarning": result.get("mockWarning"),
                "detections": [],
                "summary": {
                    "totalItems": 0,
                    "counts": {},
                    "averageConfidence": 0,
                },
                "annotatedImage": None,
                "message": (
                    "No clothing items could be detected. "
                    "Please take a clearer photo with the clothes separated and fully visible."
                ),
            }), 200

        # ── Annotate image ──────────────────────────────────────
        annotated_image_b64 = None
        try:
            annotated_image_b64 = annotate_image(temp_path, detections)
        except Exception as ann_err:
            logger.warning(f"Annotation failed (non-fatal): {ann_err}")

        return jsonify({
            "success": True,
            "isMock": result.get("isMock", False),
            "mockWarning": result.get("mockWarning"),
            "detections": detections,
            "summary": result["summary"],
            "annotatedImage": annotated_image_b64,
        }), 200

    except Exception as e:
        logger.exception(f"Inference error: {e}")
        return jsonify({
            "success": False,
            "error": f"AI inference failed: {str(e)}",
        }), 500

    finally:
        # Always clean up temp file
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass
