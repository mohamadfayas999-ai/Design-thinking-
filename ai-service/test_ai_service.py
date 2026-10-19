"""
Direct Test Suite for WASHWISE AI Service
=========================================
Tests the Flask service directly via Flask test_client:
1. Health check & configuration
2. Real T-shirt image detection (new.jpeg)
3. Semester marksheet non-clothing test (3rd sem marksheet.jpeg) - checks for zero false positives
4. Multiple garments / apparel detection (asbin.jpeg)
5. Blank / dark image test
6. Blurry image test
7. Invalid file rejection test
8. Mock mode vs Production mode behavior
9. Missing model safety check (no silent mock substitution)
"""

import os
import sys
import time
import io
import json
from PIL import Image, ImageFilter

# Add ai-service to path
AI_SERVICE_DIR = os.path.dirname(os.path.abspath(__file__))
if AI_SERVICE_DIR not in sys.path:
    sys.path.insert(0, AI_SERVICE_DIR)

# Set production mode for testing
os.environ["AI_MODE"] = "production"
os.environ["MODEL_PATH"] = "models/clothing_yolov8n.torchscript"
os.environ["CONFIDENCE_THRESHOLD"] = "0.45"

from app import create_app
from services.detector import load_model, get_model, FASHIONPEDIA_CLASSES, CATEGORY_MAPPING

def run_tests():
    print("=" * 70)
    print("WASHWISE AI Service — Direct Real-Model Validation Suite")
    print("=" * 70)

    # 1. Verify Model Loading
    print("\n[TEST 1] Loading TorchScript YOLOv8 Fashionpedia model...")
    t0 = time.time()
    loaded = load_model()
    load_time = time.time() - t0
    assert loaded is True, "Model failed to load!"
    assert get_model() is not None, "Model is None after load_model()!"
    print(f"  -> Model successfully loaded in {load_time:.2f}s")
    print(f"  -> Total Fashionpedia classes defined: {len(FASHIONPEDIA_CLASSES)}")
    print(f"  -> Total mapped apparel categories: {len(CATEGORY_MAPPING)}")

    app = create_app()
    client = app.test_client()

    # 2. Health Endpoint
    print("\n[TEST 2] GET /health endpoint...")
    res = client.get("/health")
    assert res.status_code == 200, f"Expected 200, got {res.status_code}"
    health_data = res.get_json()
    print("  -> Health response:", json.dumps(health_data, indent=2))
    assert health_data["status"] == "ok"
    assert health_data["modelLoaded"] is True
    assert health_data["mode"] == "production"

    # 3. Test with Real T-Shirt Image (new.jpeg)
    tshirt_path = r"C:\Users\mohamad fayas\Downloads\new.jpeg"
    print(f"\n[TEST 3] Testing Real T-Shirt Image ({tshirt_path})...")
    if os.path.exists(tshirt_path):
        with open(tshirt_path, "rb") as f:
            t0 = time.time()
            res = client.post("/predict", data={"image": (f, "new.jpeg")}, content_type="multipart/form-data")
            duration = (time.time() - t0) * 1000
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.data}"
        data = res.get_json()
        print(f"  -> Status code: {res.status_code}")
        print(f"  -> Inference time (client-side): {duration:.1f}ms")
        print(f"  -> Is Mock: {data.get('isMock')}")
        print(f"  -> Detections count: {len(data['detections'])}")
        for d in data["detections"]:
            print(f"     Class: {d['class']} ({d['classDisplay']}), Confidence: {d['confidence']*100:.1f}%, BBox: {d['bbox']}, RawClass: {d.get('rawClass')}")
        print(f"  -> Summary: {json.dumps(data['summary'])}")
        assert data.get("isMock") is False, "Should NOT be mock in production mode!"
        assert data["summary"]["totalItems"] >= 1, "Should detect at least 1 garment!"
        assert "tshirt" in data["summary"]["counts"] or "shirt" in data["summary"]["counts"], "Expected tshirt or shirt category!"
    else:
        print("  -> [SKIP] Image file not found locally.")

    # 4. Test with Real Semester Marksheet (3rd sem marksheet.jpeg)
    marksheet_path = r"C:\Users\mohamad fayas\Downloads\3rd sem marksheet.jpeg"
    print(f"\n[TEST 4] Testing Semester Marksheet for False Positives ({marksheet_path})...")
    if os.path.exists(marksheet_path):
        with open(marksheet_path, "rb") as f:
            t0 = time.time()
            res = client.post("/predict", data={"image": (f, "marksheet.jpeg")}, content_type="multipart/form-data")
            duration = (time.time() - t0) * 1000
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.data}"
        data = res.get_json()
        print(f"  -> Status code: {res.status_code}")
        print(f"  -> Inference time: {duration:.1f}ms")
        print(f"  -> Detections count: {len(data['detections'])}")
        print(f"  -> Summary: {json.dumps(data['summary'])}")
        print(f"  -> Message: {data.get('message')}")
        assert data["summary"]["totalItems"] == 0, f"False positive detected on marksheet! Detections: {data['detections']}"
        assert data["detections"] == [], "Detections should be empty for marksheet"
        print("  -> PASSED: Exactly 0 clothing items detected. No false positives!")
    else:
        print("  -> [SKIP] Marksheet image not found locally.")

    # 5. Test with Real Apparel Image (asbin.jpeg)
    apparel_path = r"C:\Users\mohamad fayas\Downloads\asbin.jpeg"
    print(f"\n[TEST 5] Testing Real Outerwear/Apparel Image ({apparel_path})...")
    if os.path.exists(apparel_path):
        with open(apparel_path, "rb") as f:
            t0 = time.time()
            res = client.post("/predict", data={"image": (f, "asbin.jpeg")}, content_type="multipart/form-data")
            duration = (time.time() - t0) * 1000
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.data}"
        data = res.get_json()
        print(f"  -> Status code: {res.status_code}")
        print(f"  -> Inference time: {duration:.1f}ms")
        print(f"  -> Detections count: {len(data['detections'])}")
        for d in data["detections"]:
            print(f"     Class: {d['class']} ({d['classDisplay']}), Confidence: {d['confidence']*100:.1f}%, RawClass: {d.get('rawClass')}")
        print(f"  -> Summary: {json.dumps(data['summary'])}")
        assert data.get("isMock") is False
    else:
        print("  -> [SKIP] File not found locally.")

    # 6. Test with Blank / Dark Image
    print("\n[TEST 6] Testing with a Blank / Solid Black Image...")
    blank_img = Image.new("RGB", (640, 640), color=(10, 10, 10))
    buf = io.BytesIO()
    blank_img.save(buf, format="JPEG")
    buf.seek(0)
    res = client.post("/predict", data={"image": (buf, "blank.jpg")}, content_type="multipart/form-data")
    assert res.status_code == 200
    data = res.get_json()
    print(f"  -> Status code: {res.status_code}")
    print(f"  -> Detections: {data['detections']}")
    print(f"  -> Summary: {json.dumps(data['summary'])}")
    assert data["summary"]["totalItems"] == 0, "Blank image should have 0 detections!"
    print("  -> PASSED: Blank image yielded 0 detections.")

    # 7. Test with Heavily Blurred Image
    print("\n[TEST 7] Testing with a Heavily Blurred Image...")
    if os.path.exists(tshirt_path):
        orig_img = Image.open(tshirt_path)
        blurred = orig_img.filter(ImageFilter.GaussianBlur(radius=30))
        buf = io.BytesIO()
        blurred.save(buf, format="JPEG")
        buf.seek(0)
        res = client.post("/predict", data={"image": (buf, "blurred.jpg")}, content_type="multipart/form-data")
        assert res.status_code == 200
        data = res.get_json()
        print(f"  -> Status code: {res.status_code}")
        print(f"  -> Detections on heavily blurred image: {len(data['detections'])}")
        print(f"  -> Summary: {json.dumps(data['summary'])}")
    else:
        print("  -> [SKIP] Base image for blur not found.")

    # 8. Test with Invalid / Non-image File
    print("\n[TEST 8] Testing with Invalid File Format (.txt)...")
    invalid_buf = io.BytesIO(b"This is a text file, not an image.")
    res = client.post("/predict", data={"image": (invalid_buf, "test.txt")}, content_type="multipart/form-data")
    print(f"  -> Status code: {res.status_code}")
    print(f"  -> Response: {res.get_json()}")
    assert res.status_code == 415, f"Expected 415 Unsupported Media Type, got {res.status_code}"
    print("  -> PASSED: Non-image file correctly rejected with HTTP 415.")

    # 9. Test Missing Model in Production Mode (Safety Check)
    print("\n[TEST 9] Testing Missing Model Error Handling (Safety: No silent mock fallback)...")
    import services.detector as det_module
    saved_model = det_module._model
    saved_path = os.environ.get("MODEL_PATH")
    try:
        det_module._model = None
        os.environ["MODEL_PATH"] = "nonexistent_model.pt"
        res = client.post("/predict", data={"image": (io.BytesIO(b"\xff\xd8\xff\xe0" + b"\x00" * 50), "fake.jpg")}, content_type="multipart/form-data")
        print(f"  -> Status code when model missing: {res.status_code}")
        print(f"  -> Error response: {res.get_json()}")
        assert res.status_code == 503, f"Expected 503 Service Unavailable, got {res.status_code}"
        assert res.get_json().get("success") is False
        assert "AI model is not loaded" in res.get_json().get("error", "")
        print("  -> PASSED: Missing model returns explicit 503 error; never silently substitutes mock.")
    finally:
        det_module._model = saved_model
        if saved_path:
            os.environ["MODEL_PATH"] = saved_path

    print("\n" + "=" * 70)
    print("ALL AI-SERVICE DIRECT TESTS PASSED SUCCESSFULLY!")
    print("=" * 70)

if __name__ == "__main__":
    run_tests()
