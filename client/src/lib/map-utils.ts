export interface Coordinates {
  topLeftLat: number;
  topLeftLng: number;
  bottomRightLat: number;
  bottomRightLng: number;
}

export function validateCoordinates(coords: Coordinates): boolean {
  const { topLeftLat, topLeftLng, bottomRightLat, bottomRightLng } = coords;
  
  // Check if coordinates are valid numbers
  if (isNaN(topLeftLat) || isNaN(topLeftLng) || isNaN(bottomRightLat) || isNaN(bottomRightLng)) {
    return false;
  }
  
  // Check if coordinates are within valid ranges
  if (topLeftLat < -90 || topLeftLat > 90 || bottomRightLat < -90 || bottomRightLat > 90) {
    return false;
  }
  
  if (topLeftLng < -180 || topLeftLng > 180 || bottomRightLng < -180 || bottomRightLng > 180) {
    return false;
  }
  
  // Check if top-left is actually top-left of bottom-right
  if (topLeftLat <= bottomRightLat || topLeftLng >= bottomRightLng) {
    return false;
  }
  
  // Check if area is not too large (reasonable size for marina analysis)
  const latDiff = Math.abs(topLeftLat - bottomRightLat);
  const lngDiff = Math.abs(topLeftLng - bottomRightLng);
  
  if (latDiff > 0.1 || lngDiff > 0.1) {
    return false;
  }
  
  return true;
}

export function calculateTileCount(coords: Coordinates, zoomLevel: number): number {
  const latDiff = Math.abs(coords.topLeftLat - coords.bottomRightLat);
  const lngDiff = Math.abs(coords.topLeftLng - coords.bottomRightLng);
  const tilesPerDegree = Math.pow(2, zoomLevel - 8);
  return Math.ceil(latDiff * tilesPerDegree) * Math.ceil(lngDiff * tilesPerDegree);
}

export function formatCoordinates(lat: number, lng: number): string {
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

export function pixelToCoordinate(
  pixelX: number,
  pixelY: number,
  mapBounds: Coordinates,
  mapWidth: number,
  mapHeight: number
): { lat: number; lng: number } {
  const latRange = mapBounds.topLeftLat - mapBounds.bottomRightLat;
  const lngRange = mapBounds.bottomRightLng - mapBounds.topLeftLng;
  
  const lat = mapBounds.topLeftLat - (pixelY / mapHeight) * latRange;
  const lng = mapBounds.topLeftLng + (pixelX / mapWidth) * lngRange;
  
  return { lat, lng };
}

export function coordinateToPixel(
  lat: number,
  lng: number,
  mapBounds: Coordinates,
  mapWidth: number,
  mapHeight: number
): { x: number; y: number } {
  const latRange = mapBounds.topLeftLat - mapBounds.bottomRightLat;
  const lngRange = mapBounds.bottomRightLng - mapBounds.topLeftLng;
  
  const x = ((lng - mapBounds.topLeftLng) / lngRange) * mapWidth;
  const y = ((mapBounds.topLeftLat - lat) / latRange) * mapHeight;
  
  return { x, y };
}

export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export function getMetersPerPixel(lat: number, zoomLevel: number): number {
  const earthCircumference = 40075016.686; // meters
  const metersPerPixel = earthCircumference * Math.cos((lat * Math.PI) / 180) / Math.pow(2, zoomLevel + 8);
  return metersPerPixel;
}
