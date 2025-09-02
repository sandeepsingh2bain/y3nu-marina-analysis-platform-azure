#!/usr/bin/env python3
"""
Tile Visualization Script for Marina Analysis
Annotates final detections on a specific tile image
"""

import sys
import json
import os
from PIL import Image, ImageDraw, ImageFont
import requests
from urllib.parse import urlparse
import numpy as np

def download_tile_image(tile_url, output_path):
    """Download tile image from URL"""
    try:
        if tile_url.startswith('http'):
            # Download from URL
            response = requests.get(tile_url, timeout=30)
            response.raise_for_status()
            
            with open(output_path, 'wb') as f:
                f.write(response.content)
        else:
            # Local file path - copy or use directly
            if tile_url.startswith('/api/static/'):
                # Convert API path to filesystem path
                local_path = tile_url.replace('/api/static/', 'server/static/')
                if os.path.exists(local_path):
                    with open(local_path, 'rb') as src:
                        with open(output_path, 'wb') as dst:
                            dst.write(src.read())
                else:
                    raise FileNotFoundError(f"Local tile image not found: {local_path}")
            else:
                # Direct file path
                if os.path.exists(tile_url):
                    with open(tile_url, 'rb') as src:
                        with open(output_path, 'wb') as dst:
                            dst.write(src.read())
                else:
                    raise FileNotFoundError(f"Tile image not found: {tile_url}")
        
        return True
    except Exception as e:
        print(f"Error downloading tile image: {e}")
        return False

def visualize_tile_detections(data_file, output_dir):
    """
    Visualize final detections on a specific tile
    """
    try:
        # Load visualization data
        with open(data_file, 'r') as f:
            viz_data = json.load(f)
        
        tile_url = viz_data['tileUrl']
        detections = viz_data['detections']
        tile_index = viz_data['tileIndex']
        analysis_id = viz_data['analysisId']
        
        print(f"Processing tile {tile_index} for analysis {analysis_id}")
        print(f"Tile URL: {tile_url}")
        print(f"Final detections to visualize: {len(detections)}")
        
        # Download tile image
        temp_tile_path = os.path.join(output_dir, f"temp_tile_{analysis_id}_{tile_index}.jpg")
        
        if not download_tile_image(tile_url, temp_tile_path):
            raise Exception("Failed to download tile image")
        
        # Load and process image directly as RGB
        image = Image.open(temp_tile_path).convert('RGB')
        draw = ImageDraw.Draw(image)
        
        print(f"Image dimensions: {image.width} x {image.height}")
        
        # Try to load a font with much larger size for better visibility
        try:
            font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 24)
            print("Loaded DejaVu Sans Bold font at size 24")
        except Exception as e:
            print(f"Failed to load DejaVu font: {e}")
            try:
                font = ImageFont.truetype("arial.ttf", 24)
                print("Loaded Arial font at size 24")
            except Exception as e2:
                print(f"Failed to load Arial font: {e2}")
                font = ImageFont.load_default()
                print("Using default font")
        
        # Colors for different boat sizes
        size_colors = {
            'small': '#00FF00',    # Green for small boats
            'medium': '#FFFF00',   # Yellow for medium boats  
            'large': '#FF0000'     # Red for large boats
        }
        
        # Draw final detections
        detection_count = 0
        for detection in detections:
            try:
                # Get bounding box from detection data
                bounding_box = detection.get('boundingBox', detection.get('bounding_box'))
                
                if bounding_box:
                    # Handle JSONB format: {x, y, width, height}
                    if isinstance(bounding_box, dict):
                        x = bounding_box.get('x', 0)
                        y = bounding_box.get('y', 0)
                        width = bounding_box.get('width', 0)
                        height = bounding_box.get('height', 0)
                        
                        x1 = int(x)
                        y1 = int(y)
                        x2 = int(x + width)
                        y2 = int(y + height)
                    else:
                        continue
                else:
                    # Fallback: use center coordinates if available
                    center_x = detection.get('centerX', detection.get('center_x', 320))
                    center_y = detection.get('centerY', detection.get('center_y', 320))
                    width = detection.get('width', 5) * 10  # Scale up for visibility
                    length = detection.get('length', 5) * 10
                    
                    x1 = int(center_x - width/2)
                    y1 = int(center_y - length/2)
                    x2 = int(center_x + width/2)
                    y2 = int(center_y + length/2)
                
                # Ensure coordinates are within image bounds
                x1 = max(0, min(x1, image.width))
                y1 = max(0, min(y1, image.height))
                x2 = max(0, min(x2, image.width))
                y2 = max(0, min(y2, image.height))
                
                # Determine boat size category
                boat_length = detection.get('length', 0)
                if boat_length < 12:
                    size_category = 'small'
                elif boat_length < 20:
                    size_category = 'medium'
                else:
                    size_category = 'large'
                
                color = size_colors.get(size_category, '#FFFFFF')
                
                # Create semi-transparent overlay for bounding box
                overlay = Image.new('RGBA', image.size, (0, 0, 0, 0))
                overlay_draw = ImageDraw.Draw(overlay)
                
                # Convert hex color to RGB
                color_rgb = tuple(int(color[i:i+2], 16) for i in (1, 3, 5))
                
                # Draw semi-transparent filled rectangle (20% opacity)
                overlay_draw.rectangle([x1, y1, x2, y2], fill=(*color_rgb, 50), outline=(*color_rgb, 100), width=2)
                
                # Composite the overlay onto the main image
                image = Image.alpha_composite(image.convert('RGBA'), overlay).convert('RGB')
                
                # Create label with boat info including detection ID for debugging
                confidence = detection.get('confidence', 0)
                length_m = detection.get('length', 0)
                object_id = detection.get('objectId', detection.get('object_id', 'Unknown'))
                detection_id = detection.get('id', detection.get('detectionId', 'N/A'))
                
                # Debug logging for detection IDs (can be removed in production)
                # print(f"Detection data keys: {list(detection.keys())}")
                # print(f"Detection ID found: {detection_id}")
                
                # Include detection ID for debugging purposes
                label = f"ID:{detection_id}\n{object_id} {length_m:.1f}m"
                
                # Use a very conservative approach - place text in the center of the bounding box
                # and ensure it's well within image bounds
                center_x = (x1 + x2) // 2
                center_y = (y1 + y2) // 2
                
                # Calculate text dimensions first to ensure proper positioning
                temp_bbox = draw.textbbox((0, 0), label, font=font)
                text_width = temp_bbox[2] - temp_bbox[0]
                text_height = temp_bbox[3] - temp_bbox[1]
                
                # Ensure text position keeps the entire text within image bounds with safe margins
                label_x = max(10, min(center_x - text_width//2, image.width - text_width - 10))
                label_y = max(10, min(center_y - text_height//2, image.height - text_height - 10))
                
                # Draw label background for better visibility with extreme contrast
                bbox_text = draw.textbbox((label_x, label_y), label, font=font)
                # Expand background slightly for padding, but constrain within image bounds
                bg_left = max(0, bbox_text[0] - 5)
                bg_top = max(0, bbox_text[1] - 5)
                bg_right = min(image.width - 1, bbox_text[2] + 5)
                bg_bottom = min(image.height - 1, bbox_text[3] + 5)
                bg_bbox = (bg_left, bg_top, bg_right, bg_bottom)
                
                # Draw high-contrast background for better text visibility
                draw.rectangle(bg_bbox, fill='black', outline='white', width=2)
                
                # Draw label text in bright white for maximum visibility
                draw.text((label_x, label_y), label, fill='white', font=font)
                
                detection_count += 1
                
            except Exception as e:
                object_id = detection.get('objectId', detection.get('object_id', 'unknown'))
                print(f"Error drawing detection {object_id}: {e}")
                continue
        
        # Add title with final detection count
        title = f"Tile {tile_index} - Final Detections: {detection_count}"
        title_bbox = draw.textbbox((10, 10), title, font=font)
        draw.rectangle(title_bbox, fill='black', outline='white')
        draw.text((10, 10), title, fill='white', font=font)
        
        # Add legend
        legend_y = 40
        for size, color in size_colors.items():
            legend_text = f"● {size.capitalize()}"
            draw.text((10, legend_y), legend_text, fill=color, font=font)
            legend_y += 20
        
        # Save annotated image
        output_filename = f"tile_{analysis_id}_{tile_index}_final_detections.jpg"
        output_path = os.path.join(output_dir, output_filename)
        image.save(output_path, 'JPEG', quality=95)
        
        # Clean up temp file
        if os.path.exists(temp_tile_path):
            os.remove(temp_tile_path)
        
        print(f"Visualization saved: {output_path}")
        print(f"Final detections visualized: {detection_count}")
        
        # Return result
        result = {
            "status": "success",
            "annotated_image_path": output_path,
            "detections_count": detection_count,
            "tile_index": tile_index,
            "analysis_id": analysis_id
        }
        
        print(f"RESULT:{json.dumps(result)}")
        return result
        
    except Exception as e:
        print(f"Error in tile visualization: {e}")
        result = {
            "status": "error",
            "error": str(e),
            "annotated_image_path": "",
            "detections_count": 0
        }
        print(f"RESULT:{json.dumps(result)}")
        return result

def main():
    if len(sys.argv) != 3:
        print("Usage: python3 visualize_tile.py <data_file> <output_dir>")
        sys.exit(1)
    
    data_file = sys.argv[1]
    output_dir = sys.argv[2]
    
    # Ensure output directory exists
    os.makedirs(output_dir, exist_ok=True)
    
    visualize_tile_detections(data_file, output_dir)

if __name__ == "__main__":
    main()