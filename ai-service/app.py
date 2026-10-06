"""
WASHWISE AI Service — Clothing Detection
=========================================

This service exposes a REST API that accepts an image and returns
clothing object detections using YOLOv8.

MODES:
  AI_MODE=mock        → Returns simulated detections (development/no model)
  AI_MODE=production  → Uses a real trained YOLOv8 clothing model

ENVIRONMENT VARIABLES:
  AI_MODE               = mock | production        (default: mock)
  MODEL_PATH            = path to .pt model file   (default: ./models/clothing_yolov8.pt)
  CONFIDENCE_THRESHOLD  = float 0-1               (default: 0.50)
  PORT                  = integer                  (default: 8000)
  MAX_IMAGE_SIZE_MB     = integer                  (default: 10)
"""

import os
from flask import Flask
from flask_cors import CORS
from dotenv import load_dotenv
from routes.predict import predict_bp
from routes.health import health_bp

load_dotenv()

def create_app():
    app = Flask(__name__)
    CORS(app, origins="*")

    # Register blueprints
    app.register_blueprint(predict_bp)
    app.register_blueprint(health_bp)

    # In production mode, attempt to load the YOLO model
    ai_mode = os.getenv("AI_MODE", "mock").lower()
    if ai_mode == "production":
        try:
            from services.detector import load_model
            load_model()
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning(
                f"Could not load YOLO model on startup: {e}. Running in standby mode."
            )

    return app


# Module-level WSGI application for Gunicorn / Render production server
app = create_app()

import sys
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    ai_mode = os.getenv("AI_MODE", "mock")
    print(f"\n{'='*55}")
    print(f"  WASHWISE AI Service - Clothing Detection")
    print(f"  Mode       : {ai_mode.upper()}")
    print(f"  Port       : {port}")
    print(f"  Endpoint   : http://0.0.0.0:{port}/predict")
    print(f"  Health     : http://0.0.0.0:{port}/health")
    if ai_mode == "mock":
        print(f"\n  [!] MOCK MODE: Results are simulated, not real AI.")
        print(f"  To use real AI, set AI_MODE=production and provide MODEL_PATH.")
    print(f"{'='*55}\n")
    app.run(host="0.0.0.0", port=port, debug=False)
