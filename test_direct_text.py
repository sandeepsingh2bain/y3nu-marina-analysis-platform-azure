#!/usr/bin/env python3
"""
Direct test of text drawing on a satellite image
"""
import requests
from PIL import Image, ImageDraw, ImageFont
import tempfile
import os

def test_direct_text_on_tile():
    """Test text drawing directly on a tile image"""
    
    # Use a simple test image instead of downloading
    # Create a simple test image
    image = Image.new('RGB', (640, 640), color='lightblue')
    draw = ImageDraw.Draw(image)
    
    print(f"Image size: {image.width}x{image.height}")
    
    # Try to load font
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 24)
        print("Font loaded successfully")
    except:
        font = ImageFont.load_default()
        print("Using default font")
    
    # Draw multiple test texts with different approaches
    tests = [
        {"text": "TEST 1", "pos": (100, 100), "color": "red"},
        {"text": "TEST 2", "pos": (200, 200), "color": "white"},
        {"text": "TEST 3", "pos": (300, 300), "color": "yellow"},
        {"text": "ID:12345\nB001 10.5m", "pos": (400, 400), "color": "magenta"},
    ]
    
    for i, test in enumerate(tests):
        # Draw background rectangle
        bbox = draw.textbbox(test["pos"], test["text"], font=font)
        draw.rectangle([bbox[0]-5, bbox[1]-5, bbox[2]+5, bbox[3]+5], 
                      fill="black", outline="white", width=2)
        
        # Draw text
        draw.text(test["pos"], test["text"], fill=test["color"], font=font)
        print(f"Drew {test['text']} at {test['pos']} in {test['color']}")
    
    # Save result
    output_path = "test_direct_text_result.jpg"
    image.save(output_path, "JPEG", quality=95)
    print(f"Saved test image to: {output_path}")
    
    return True

if __name__ == "__main__":
    test_direct_text_on_tile()