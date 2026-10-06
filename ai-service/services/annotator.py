"""
Annotator Service
=================
Draws YOLOv8 bounding boxes + labels over the original image.
Returns the annotated image as a base64-encoded JPEG string
so it can be embedded directly in the JSON response.
"""

import base64
import os
from io import BytesIO
from PIL import Image, ImageDraw, ImageFont
from services.detector import CLASS_DISPLAY

# Color palette per class (BGR-like but for PIL RGB)
CLASS_COLORS: dict[str, tuple[int, int, int]] = {
    "shirt":    (37, 99, 235),   # blue-600
    "tshirt":   (16, 185, 129),  # emerald-500
    "pant":     (139, 92, 246),  # violet-500
    "jeans":    (99, 102, 241),  # indigo-500
    "shorts":   (245, 158, 11),  # amber-500
    "towel":    (236, 72, 153),  # pink-500
    "bedsheet": (239, 68, 68),   # red-500
    "other":    (107, 114, 128), # gray-500
    "unknown":  (156, 163, 175), # gray-400
}

DEFAULT_COLOR = (107, 114, 128)


def annotate_image(image_path: str, detections: list[dict]) -> str:
    """
    Draw colored bounding boxes and class labels on the image.
    Returns a base64-encoded JPEG data URI string.
    """
    img = Image.open(image_path).convert("RGB")
    draw = ImageDraw.Draw(img)
    
    # Try to load a font across Linux (Render) and Windows; fall back to default
    font = None
    candidate_fonts = [
        "DejaVuSans.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "arial.ttf",
        r"C:\Windows\Fonts\calibri.ttf",
    ]
    for candidate in candidate_fonts:
        try:
            font = ImageFont.truetype(candidate, 16)
            break
        except Exception:
            continue

    if font is None:
        font = ImageFont.load_default()

    for det in detections:
        cls = det["class"]
        conf = det["confidence"]
        bbox = det["bbox"]
        color = CLASS_COLORS.get(cls, DEFAULT_COLOR)

        x1, y1, x2, y2 = bbox["x1"], bbox["y1"], bbox["x2"], bbox["y2"]
        
        # Clip to image bounds
        img_w, img_h = img.size
        x1 = max(0, min(x1, img_w))
        y1 = max(0, min(y1, img_h))
        x2 = max(0, min(x2, img_w))
        y2 = max(0, min(y2, img_h))

        # Draw box (3px border)
        for offset in range(3):
            draw.rectangle(
                [x1 - offset, y1 - offset, x2 + offset, y2 + offset],
                outline=color,
            )

        # Label text
        label = CLASS_DISPLAY.get(cls, cls.title())
        label_text = f"{label} {conf*100:.0f}%"

        # Background pill for text
        text_bbox = draw.textbbox((x1, y1), label_text, font=font)
        text_w = text_bbox[2] - text_bbox[0]
        text_h = text_bbox[3] - text_bbox[1]
        pad = 4

        label_y = max(0, y1 - text_h - pad * 2)
        draw.rectangle(
            [x1, label_y, x1 + text_w + pad * 2, label_y + text_h + pad * 2],
            fill=color,
        )
        draw.text(
            (x1 + pad, label_y + pad),
            label_text,
            fill=(255, 255, 255),
            font=font,
        )

    # Encode as JPEG base64
    buf = BytesIO()
    img.save(buf, format="JPEG", quality=90)
    buf.seek(0)
    b64 = base64.b64encode(buf.read()).decode("utf-8")
    return f"data:image/jpeg;base64,{b64}"
