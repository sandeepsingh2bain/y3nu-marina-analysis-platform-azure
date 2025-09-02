#!/usr/bin/env python3

import os
import sys

# Set environment variables to fix threading and numpy issues
os.environ['OPENBLAS_NUM_THREADS'] = '1'
os.environ['MKL_NUM_THREADS'] = '1'
os.environ['NUMEXPR_NUM_THREADS'] = '1'
os.environ['OMP_NUM_THREADS'] = '1'

import json
import numpy as np
from vision_agent.tools import *
from vision_agent.tools.planner_tools import judge_od_results
from typing import *
from pillow_heif import register_heif_opener
register_heif_opener()
import vision_agent as va
from vision_agent.tools import register_tool
from vision_agent.tools import load_image, owlv2_object_detection, overlay_bounding_boxes, save_image

def analyze_marina_image(image_path: str, output_dir: str):
    """
    Authentic marina image analysis using Vision Agent for boat detection
    """
    try:
        # Check if API key is available
        api_key = os.getenv('VISION_AGENT_API_KEY')
        if not api_key:
            print("ERROR: VISION_AGENT_API_KEY environment variable not found")
            return {
                "detections": [],
                "annotated_image_path": None,
                "status": "error",
                "error": "VISION_AGENT_API_KEY not configured"
            }
        
        print(f"Loading image from: {image_path}")
        if not os.path.exists(image_path):
            print(f"ERROR: Image file does not exist: {image_path}")
            return {
                "detections": [],
                "annotated_image_path": None,
                "status": "error",
                "error": f"Image file not found: {image_path}"
            }
        
        # Load the image using Vision Agent
        image = load_image(image_path)
        print(f"Image loaded successfully, shape: {image.shape}")
        
        # Detect boats using authentic Vision Agent owlv2_object_detection
        print("Starting boat detection with owlv2_object_detection...")
        detections = owlv2_object_detection("yacht, boat, vessel", image, box_threshold=0.3)
        print(f"Detection completed, found {len(detections)} objects")
        
        # Calculate the length of each boat in pixels
        height, width, _ = image.shape
        for det in detections:
            x_min, y_min, x_max, y_max = det["bbox"]
            box_width = (x_max - x_min) * width
            box_height = (y_max - y_min) * height
            det["boat_length_pixels"] = max(box_width, box_height)
        
        # Add labels showing boat number and length
        for i, det in enumerate(detections, 1):
            det['label'] = f"Boat {i} ({int(det['boat_length_pixels'])}px)"
        
        # Overlay bounding boxes with boat labels
        annotated_image = overlay_bounding_boxes(image, detections)
        
        # Save the annotated image to output directory
        os.makedirs(output_dir, exist_ok=True)
        annotated_image_path = os.path.join(output_dir, "annotated_image.jpg")
        save_image(annotated_image, annotated_image_path)
        
        # Convert Vision Agent detections to our format
        formatted_detections = []
        for i, det in enumerate(detections, 1):
            bbox = det["bbox"]  # normalized coordinates [x_min, y_min, x_max, y_max]
            boat_length_pixels = det["boat_length_pixels"]
            
            detection = {
                "objectId": f"boat_{i}",
                "objectType": "boat", 
                "subType": "vessel",
                "confidence": round(det["score"] * 100, 1),  # Convert to percentage
                "bbox": bbox,  # Already normalized
                "boat_length_pixels": boat_length_pixels,
                "latitude": 0.0,
                "longitude": 0.0,
                "length": boat_length_pixels * 0.15,  # Convert pixels to meters (rough estimate)
                "width": boat_length_pixels * 0.75 * 0.15,  # Assume width is 75% of length
                "area": boat_length_pixels * boat_length_pixels * 0.75 * 0.0225
            }
            formatted_detections.append(detection)
        
        return {
            "detections": formatted_detections,
            "image_width": int(width),
            "image_height": int(height),
            "annotated_image_path": annotated_image_path,
            "status": "success"
        }
        
    except Exception as e:
        error_msg = f"Error in marina image analysis: {str(e)}"
        print(error_msg)
        print(f"Error type: {type(e).__name__}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        return {
            "detections": [],
            "annotated_image_path": None,
            "status": "error",
            "error": error_msg
        }

def main():
    if len(sys.argv) != 3:
        print("Usage: python working_detection.py <image_path> <output_dir>", file=sys.stderr)
        sys.exit(1)
    
    image_path = sys.argv[1]
    output_dir = sys.argv[2]
    
    if not os.path.exists(image_path):
        print(f"Error: Image file not found: {image_path}", file=sys.stderr)
        sys.exit(1)
    
    result = analyze_marina_image(image_path, output_dir)
    # Output only the JSON result to stdout, everything else to stderr
    print(json.dumps(result), flush=True)

if __name__ == "__main__":
    main()