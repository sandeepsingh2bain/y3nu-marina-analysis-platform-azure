
import os
import sys
import json
import numpy as np
from vision_agent.tools import load_image, owlv2_object_detection, overlay_bounding_boxes, save_image
from pillow_heif import register_heif_opener
register_heif_opener()

def detect_boats_in_image(image_path: str, output_dir: str = "server/static/annotated"):
    """
    Detect boats in an image and return detection results with annotated image path.
    """
    try:
        # Ensure output directory exists
        os.makedirs(output_dir, exist_ok=True)
        
        # Load the image
        image = load_image(image_path)
        
        # Detect boats/vessels
        detections = owlv2_object_detection("yacht, boat, vessel, sailboat", image, box_threshold=0.25)
        
        # Calculate dimensions and add labels
        height, width, _ = image.shape
        for i, det in enumerate(detections, 1):
            x_min, y_min, x_max, y_max = det["bbox"]
            box_width = (x_max - x_min) * width
            box_height = (y_max - y_min) * height
            det["boat_length_pixels"] = max(box_width, box_height)
            det["boat_width_pixels"] = min(box_width, box_height)
            det["boat_id"] = i
            det['label'] = f"Boat {i} ({int(det['boat_length_pixels'])}px)"
        
        # Create annotated image
        annotated_image = overlay_bounding_boxes(image, detections)
        
        # Save annotated image
        base_name = os.path.splitext(os.path.basename(image_path))[0]
        output_filename = f"{base_name}_annotated.jpg"
        output_path = os.path.join(output_dir, output_filename)
        save_image(annotated_image, output_path)
        
        # Return results
        return {
            "detections": detections,
            "annotated_image_path": output_path,
            "annotated_image_url": f"/static/annotated/{output_filename}",
            "total_boats": len(detections)
        }
        
    except Exception as e:
        raise Exception(f"Object detection failed: {str(e)}")

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python object-detection.py <image_path>")
        sys.exit(1)
    
    image_path = sys.argv[1]
    result = detect_boats_in_image(image_path)
    print(json.dumps(result, indent=2))
