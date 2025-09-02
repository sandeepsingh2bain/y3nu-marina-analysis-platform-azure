#!/usr/bin/env python3

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

def detect_and_measure_boats(image_path: str):
    """
    Detect boats in a satellite image of a marina and measure each boat's length.
    Returns a list of detections, each containing:
    label (str), score (float), bbox (List[float]), and boat_length_pixels (float).
    
    Steps:
      1) Load the image from image_path.
      2) Use owlv2_object_detection with prompt="yacht, boat, vessel" and box_threshold=0.3.
      3) For each boat detection, compute length in pixels by taking 
         the max dimension of the bounding box (in pixels).
      4) Overlay bounding boxes and label each boat with the format 
         "Boat {index} ({boat_length_pixels}px)".
      5) Save the resulting image with bounding boxes.
      6) Return the list of detections with boat_length_pixels.
    """
    try:
        # 1) Load the image
        image = load_image(image_path)
        
        # 2) Detect boats using vision-agent owlv2_object_detection
        detections = owlv2_object_detection("boat", image, box_threshold=0.3)
        
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
        
        # 5) Save the image with "_annotated" suffix
        base_name, ext = os.path.splitext(image_path)
        output_path = f"{base_name}_annotated{ext}"
        save_image(annotated_image, output_path)
        
        # 6) Return the list of detections with boat_length_pixels
        return detections, output_path
        
    except Exception as e:
        print(f"Error in boat detection: {str(e)}")
        return [], None

def main():
    """
    Command-line interface for boat detection using vision-agent
    """
    import sys
    
    if len(sys.argv) != 3:
        print("Usage: python boat_detection.py <input_image_path> <output_directory>")
        sys.exit(1)
    
    input_image_path = sys.argv[1]
    output_directory = sys.argv[2]
    
    # Ensure output directory exists
    os.makedirs(output_directory, exist_ok=True)
    
    try:
        # Run boat detection using vision-agent
        detections, annotated_path = detect_and_measure_boats(input_image_path)
        
        # Move annotated image to output directory
        if annotated_path:
            filename = os.path.basename(annotated_path)
            final_path = os.path.join(output_directory, filename)
            os.rename(annotated_path, final_path)
            annotated_path = final_path
        
        # Convert detections to required format
        formatted_detections = []
        for i, det in enumerate(detections):
            formatted_detections.append({
                "objectId": f"boat_{i+1}",
                "objectType": "boat",
                "subType": "boat",  # Use only "boat" label
                "confidence": float(det["score"]),
                "bbox": det["bbox"],
                "boat_length_pixels": float(det["boat_length_pixels"]),
                "label": det.get("label", f"Boat {i+1}")
            })
        
        # Output results as JSON for Node.js to parse
        result = {
            "detections": formatted_detections,
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