
import os
import numpy as np
from vision_agent.tools import *
from vision_agent.tools.planner_tools import judge_od_results
from typing import *
from pillow_heif import register_heif_opener
register_heif_opener()
import vision_agent as va
from vision_agent.tools import register_tool
from vision_agent.tools import load_image, owlv2_object_detection, overlay_bounding_boxes, save_image
import json

def detect_and_measure_boats(image_path: str, output_dir: str = None):
    """
    Detect boats in a satellite image of a marina and measure each boat's length.
    Returns a list of detections and the path to the annotated image.
    """
    try:
        # 1) Load the image
        image = load_image(image_path)
        
        # 2) Detect boats only in the image using vision-agent with retry logic
        import time
        max_retries = 3
        retry_delay = 2  # seconds
        
        detections = []
        for attempt in range(max_retries):
            try:
                detections = owlv2_object_detection("boat", image, box_threshold=0.4)
                break  # Success, exit retry loop
            except Exception as e:
                error_msg = str(e).lower()
                if "rate limit" in error_msg or "quota" in error_msg or "429" in error_msg:
                    if attempt < max_retries - 1:
                        print(f"Rate limit hit, retrying in {retry_delay} seconds... (attempt {attempt + 1}/{max_retries})")
                        time.sleep(retry_delay)
                        retry_delay *= 2  # Exponential backoff
                        continue
                    else:
                        print(f"Rate limit exceeded after {max_retries} attempts")
                        raise e
                else:
                    # Re-raise non-rate-limit errors immediately
                    raise e
        
        # 3) Calculate the length of each boat in pixels
        height, width, _ = image.shape
        for det in detections:
            x_min, y_min, x_max, y_max = det["bbox"]
            box_width = (x_max - x_min) * width
            box_height = (y_max - y_min) * height
            det["boat_length_pixels"] = max(box_width, box_height)
        
        # 4) Overlay bounding boxes with labels showing boat number and length
        for i, det in enumerate(detections, 1):
            det['label'] = f"Boat {i} ({int(det['boat_length_pixels'])}px)"
        
        annotated_image = overlay_bounding_boxes(image, detections)
        
        # 5) Save the image with "_output" suffix
        base_name, ext = os.path.splitext(image_path)
        if output_dir:
            filename = os.path.basename(base_name)
            output_path = os.path.join(output_dir, f"{filename}_annotated{ext}")
        else:
            output_path = f"{base_name}_annotated{ext}"
        
        save_image(annotated_image, output_path)
        
        # Convert detections to format compatible with existing schema
        formatted_detections = []
        for i, det in enumerate(detections):
            formatted_detections.append({
                "objectId": f"boat_{i+1}",
                "objectType": "boat",
                "subType": "vessel",
                "confidence": float(det["score"]),
                "bbox": det["bbox"],
                "boat_length_pixels": int(det["boat_length_pixels"]),
                "latitude": 0.0,  # Would need GPS data from image metadata
                "longitude": 0.0,
                "length": int(det["boat_length_pixels"]) * 0.1,  # Rough pixel to meter conversion
                "width": int(det["boat_length_pixels"]) * 0.05,
                "area": int(det["boat_length_pixels"]) * 0.005
            })
        
        return formatted_detections, output_path
        
    except Exception as e:
        print(f"Error in boat detection: {str(e)}")
        return [], None

def main():
    """
    Command-line interface for boat detection
    """
    import sys
    import warnings
    import logging
    
    # Suppress all warnings to keep stdout clean for JSON
    warnings.filterwarnings("ignore")
    logging.getLogger().setLevel(logging.ERROR)
    
    if len(sys.argv) != 3:
        error_result = {
            "detections": [],
            "annotated_image_path": None,
            "status": "error",
            "error": "Usage: python boat_detection.py <input_image_path> <output_base_path>"
        }
        print(json.dumps(error_result))
        sys.exit(1)
    
    input_image_path = sys.argv[1]
    output_base_path = sys.argv[2]
    
    # Ensure output directory exists
    os.makedirs(os.path.dirname(output_base_path), exist_ok=True)
    
    try:
        # Run boat detection
        detections, annotated_path = detect_and_measure_boats(input_image_path, os.path.dirname(output_base_path))
        
        # Output results as JSON for Node.js to parse
        result = {
            "detections": detections,
            "annotated_image_path": annotated_path,
            "status": "success"
        }
        
        print(json.dumps(result))
        
    except Exception as e:
        # Output error as JSON
        error_result = {
            "detections": [],
            "annotated_image_path": None,
            "status": "error",
            "error": str(e)
        }
        
        print(json.dumps(error_result))
        sys.exit(1)

if __name__ == "__main__":
    main()
