import math
from typing import Tuple, Dict, Optional

class GoogleMapsConverter:
    """
    Google Maps Pixel to Coordinate Converter
    For Google Static Maps API with Web Mercator projection
    """
    
    def __init__(self, center_lat: float, center_lng: float, zoom_level: int, 
                 image_width: int, image_height: int, custom_resolution: Optional[float] = None):
        """
        Initialize the converter with map parameters
        
        Args:
            center_lat: Center latitude of the image
            center_lng: Center longitude of the image
            zoom_level: Zoom level (1-20)
            image_width: Image width in pixels
            image_height: Image height in pixels
            custom_resolution: Custom meters per pixel (if None, calculates from zoom/lat)
        """
        self.center_lat = center_lat
        self.center_lng = center_lng
        self.zoom_level = zoom_level
        self.image_width = image_width
        self.image_height = image_height
        
        # Web Mercator constants
        self.EARTH_RADIUS = 6378137  # Earth's radius in meters
        self.ORIGIN_SHIFT = 2 * math.pi * self.EARTH_RADIUS / 2.0
        
        # Calculate center point in Web Mercator coordinates
        self.center_mercator = self._lat_lng_to_mercator(center_lat, center_lng)
        
        # Set resolution (custom or calculated)
        if custom_resolution is not None:
            self.meters_per_pixel = custom_resolution
        else:
            self.meters_per_pixel = self._calculate_meters_per_pixel(center_lat, zoom_level)
    
    def _lat_lng_to_mercator(self, lat: float, lng: float) -> Dict[str, float]:
        """Convert latitude/longitude to Web Mercator coordinates"""
        x = lng * self.ORIGIN_SHIFT / 180.0
        y = math.log(math.tan((90 + lat) * math.pi / 360.0)) / (math.pi / 180.0)
        y = y * self.ORIGIN_SHIFT / 180.0
        return {'x': x, 'y': y}
    
    def _mercator_to_lat_lng(self, x: float, y: float) -> Dict[str, float]:
        """Convert Web Mercator coordinates to latitude/longitude"""
        lng = (x / self.ORIGIN_SHIFT) * 180.0
        lat = (y / self.ORIGIN_SHIFT) * 180.0
        lat = 180 / math.pi * (2 * math.atan(math.exp(lat * math.pi / 180.0)) - math.pi / 2.0)
        return {'lat': lat, 'lng': lng}
    
    def _calculate_meters_per_pixel(self, lat: float, zoom: int) -> float:
        """Calculate meters per pixel at given latitude and zoom level"""
        lat_rad = lat * math.pi / 180
        return (156543.03392 * math.cos(lat_rad)) / (2 ** zoom)
    
    def pixel_to_lat_lng(self, pixel_x: int, pixel_y: int) -> Dict[str, float]:
        """
        Convert pixel coordinates to latitude/longitude
        
        Args:
            pixel_x: X coordinate in image (0 = left edge)
            pixel_y: Y coordinate in image (0 = top edge)
            
        Returns:
            Dictionary with 'lat' and 'lng' keys
        """
        # Calculate offset from center in pixels
        offset_x = pixel_x - (self.image_width / 2)
        offset_y = pixel_y - (self.image_height / 2)
        
        # Convert pixel offset to meters (note: Y is inverted)
        meter_x = offset_x * self.meters_per_pixel
        meter_y = -offset_y * self.meters_per_pixel
        
        # Calculate new mercator coordinates
        new_mercator_x = self.center_mercator['x'] + meter_x
        new_mercator_y = self.center_mercator['y'] + meter_y
        
        # Convert back to lat/lng
        return self._mercator_to_lat_lng(new_mercator_x, new_mercator_y)
    
    def lat_lng_to_pixel(self, lat: float, lng: float) -> Dict[str, float]:
        """
        Convert latitude/longitude to pixel coordinates
        
        Args:
            lat: Latitude
            lng: Longitude
            
        Returns:
            Dictionary with 'x' and 'y' pixel coordinates
        """
        # Convert to mercator
        mercator = self._lat_lng_to_mercator(lat, lng)
        
        # Calculate offset in meters from center
        meter_offset_x = mercator['x'] - self.center_mercator['x']
        meter_offset_y = mercator['y'] - self.center_mercator['y']
        
        # Convert to pixel offset (note: Y is inverted)
        pixel_offset_x = meter_offset_x / self.meters_per_pixel
        pixel_offset_y = -meter_offset_y / self.meters_per_pixel
        
        # Calculate final pixel coordinates
        pixel_x = (self.image_width / 2) + pixel_offset_x
        pixel_y = (self.image_height / 2) + pixel_offset_y
        
        return {'x': pixel_x, 'y': pixel_y}
    
    def get_resolution_info(self) -> Dict:
        """Get resolution and configuration information"""
        return {
            'meters_per_pixel': self.meters_per_pixel,
            'zoom_level': self.zoom_level,
            'center_coordinates': {'lat': self.center_lat, 'lng': self.center_lng},
            'image_size': {'width': self.image_width, 'height': self.image_height}
        }
    
    def calculate_distance_from_center(self, pixel_x: int, pixel_y: int) -> Dict[str, float]:
        """
        Calculate distance in meters from center point
        
        Args:
            pixel_x: X coordinate in pixels
            pixel_y: Y coordinate in pixels
            
        Returns:
            Dictionary with horizontal, vertical, and total distance in meters
        """
        horizontal_distance = (pixel_x - self.image_width/2) * self.meters_per_pixel
        vertical_distance = (pixel_y - self.image_height/2) * self.meters_per_pixel
        total_distance = math.sqrt(horizontal_distance**2 + vertical_distance**2)
        
        return {
            'horizontal': horizontal_distance,
            'vertical': vertical_distance,
            'total': total_distance
        }


# Example usage and test functions
def main():
    """Example usage of the GoogleMapsConverter"""
    
    # Your specific parameters
    center_lat = 41.552013
    center_lng = -70.601921
    zoom_level = 19
    image_width = 640
    image_height = 640
    custom_resolution = 0.298  # Your optimal resolution
    
    # Create converter instance
    converter = GoogleMapsConverter(
        center_lat, center_lng, zoom_level, 
        image_width, image_height, custom_resolution
    )
    
    print("=== Google Maps Pixel-Coordinate Converter ===")
    print(f"Configuration: {converter.get_resolution_info()}")
    print()
    
    # Test conversion: pixel (514, 452) to lat/lng
    test_pixel_x, test_pixel_y = 514, 452
    coords = converter.pixel_to_lat_lng(test_pixel_x, test_pixel_y)
    print(f"Pixel ({test_pixel_x}, {test_pixel_y}) -> Lat/Lng: {coords['lat']:.8f}, {coords['lng']:.8f}")
    
    # Test reverse conversion
    pixel_coords = converter.lat_lng_to_pixel(coords['lat'], coords['lng'])
    print(f"Lat/Lng back to pixel: ({pixel_coords['x']:.1f}, {pixel_coords['y']:.1f})")
    
    # Calculate distance from center
    distance = converter.calculate_distance_from_center(test_pixel_x, test_pixel_y)
    print(f"Distance from center: {distance['total']:.1f}m (H: {distance['horizontal']:.1f}m, V: {distance['vertical']:.1f}m)")
    
    # Test image corners
    print("\n=== Image Corners ===")
    corners = [
        (0, 0, "Top-left"),
        (image_width, 0, "Top-right"),
        (0, image_height, "Bottom-left"),
        (image_width, image_height, "Bottom-right"),
        (image_width//2, image_height//2, "Center")
    ]
    
    for x, y, name in corners:
        corner_coords = converter.pixel_to_lat_lng(x, y)
        print(f"{name} ({x}, {y}): {corner_coords['lat']:.8f}, {corner_coords['lng']:.8f}")


def convert_pixel_to_coordinates(pixel_x: int, pixel_y: int, 
                                center_lat: float, center_lng: float,
                                zoom_level: int = 19, 
                                image_width: int = 640, image_height: int = 640,
                                resolution: float = 0.298) -> Tuple[float, float]:
    """
    Simple function to convert a single pixel to coordinates
    
    Args:
        pixel_x: X coordinate in pixels
        pixel_y: Y coordinate in pixels
        center_lat: Center latitude of the image
        center_lng: Center longitude of the image
        zoom_level: Zoom level (default: 19)
        image_width: Image width in pixels (default: 640)
        image_height: Image height in pixels (default: 640)
        resolution: Meters per pixel (default: 0.298)
        
    Returns:
        Tuple of (latitude, longitude)
    """
    converter = GoogleMapsConverter(center_lat, center_lng, zoom_level, 
                                   image_width, image_height, resolution)
    coords = converter.pixel_to_lat_lng(pixel_x, pixel_y)
    return coords['lat'], coords['lng']


def convert_coordinates_to_pixel(lat: float, lng: float,
                                center_lat: float, center_lng: float,
                                zoom_level: int = 19,
                                image_width: int = 640, image_height: int = 640,
                                resolution: float = 0.298) -> Tuple[float, float]:
    """
    Simple function to convert coordinates to pixel
    
    Args:
        lat: Latitude
        lng: Longitude
        center_lat: Center latitude of the image
        center_lng: Center longitude of the image
        zoom_level: Zoom level (default: 19)
        image_width: Image width in pixels (default: 640)
        image_height: Image height in pixels (default: 640)
        resolution: Meters per pixel (default: 0.298)
        
    Returns:
        Tuple of (pixel_x, pixel_y)
    """
    converter = GoogleMapsConverter(center_lat, center_lng, zoom_level,
                                   image_width, image_height, resolution)
    pixel_coords = converter.lat_lng_to_pixel(lat, lng)
    return pixel_coords['x'], pixel_coords['y']


if __name__ == "__main__":
    main()
    
    print("\n=== Simple Function Examples ===")
    # Quick conversion examples
    lat, lng = convert_pixel_to_coordinates(514, 452, 41.552013, -70.601921)
    print(f"Pixel (514, 452) -> {lat:.8f}, {lng:.8f}")
    
    x, y = convert_coordinates_to_pixel(lat, lng, 41.552013, -70.601921)
    print(f"Coordinates back to pixel: ({x:.1f}, {y:.1f})")