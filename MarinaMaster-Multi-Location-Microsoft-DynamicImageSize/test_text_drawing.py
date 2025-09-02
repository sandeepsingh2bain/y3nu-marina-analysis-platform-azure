#!/usr/bin/env python3
"""
Simple test to verify text drawing with PIL
"""
from PIL import Image, ImageDraw, ImageFont
import os

def test_text_drawing():
    # Create a simple test image
    image = Image.new('RGB', (300, 200), color='blue')
    draw = ImageDraw.Draw(image)
    
    # Try to load a font
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 24)
        print("✓ Loaded DejaVu Sans Bold font at size 24")
    except Exception as e:
        print(f"✗ Failed to load DejaVu font: {e}")
        font = ImageFont.load_default()
        print("✓ Using default font")
    
    # Draw background rectangle
    draw.rectangle((10, 10, 250, 80), fill='yellow', outline='red', width=3)
    print("✓ Drew background rectangle")
    
    # Draw text
    text = "TEST ID:12345\nBoat B001 10.5m"
    draw.text((15, 15), text, fill='black', font=font)
    print("✓ Drew text")
    
    # Save test image
    output_path = "server/static/visualizations/text_test.jpg"
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    image.save(output_path, 'JPEG', quality=95)
    print(f"✓ Saved test image to: {output_path}")

if __name__ == "__main__":
    test_text_drawing()