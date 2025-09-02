#!/usr/bin/env node

/**
 * Comprehensive test for coordinate conversion calculations
 * Tests both pixel-to-lat/lng and lat/lng-to-pixel conversions for image tiles
 */

// Import the conversion functions (simulated for testing)
function getMetersPerPixel(request) {
  const earthCircumference = 40075000; // meters
  const tilesAtZoom = Math.pow(2, request.zoomLevel);
  const metersPerPixelAtEquator = earthCircumference / (tilesAtZoom * 256);
  const latitude = (request.topLeftLat + request.bottomRightLat) / 2;
  return metersPerPixelAtEquator * Math.cos(latitude * Math.PI / 180);
}

function pixelToLatitude(pixelY, request, imageHeight = 640) {
  const latRange = Math.abs(request.topLeftLat - request.bottomRightLat);
  return request.topLeftLat - (pixelY / imageHeight) * latRange;
}

function pixelToLongitude(pixelX, request, imageWidth = 640) {
  const lngRange = Math.abs(request.topLeftLng - request.bottomRightLng);
  return request.topLeftLng + (pixelX / imageWidth) * lngRange;
}

function latLngToPixel(lat, lng, request, imageWidth = 640, imageHeight = 640) {
  const latRange = Math.abs(request.topLeftLat - request.bottomRightLat);
  const lngRange = Math.abs(request.topLeftLng - request.bottomRightLng);
  
  const pixelY = ((request.topLeftLat - lat) / latRange) * imageHeight;
  const pixelX = ((lng - request.topLeftLng) / lngRange) * imageWidth;
  
  return { x: pixelX, y: pixelY };
}

function latLngToTile(lat, lng, zoom) {
  const n = Math.pow(2, zoom);
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2) * n);
  return { x, y };
}

function tileToBounds(x, y, zoom) {
  const n = Math.pow(2, zoom);
  
  // Calculate longitude bounds (simple linear transformation)
  const west = (x / n) * 360 - 180;
  const east = ((x + 1) / n) * 360 - 180;
  
  // Calculate latitude bounds using inverse Web Mercator projection
  const northRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n)));
  const southRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 1)) / n)));
  
  const north = (northRad * 180) / Math.PI;
  const south = (southRad * 180) / Math.PI;
  
  return { north, south, east, west };
}

function getTileCoordinates(tileIndex, request) {
  // This simulates the tile calculation logic from the main system
  const latRange = Math.abs(request.topLeftLat - request.bottomRightLat);
  const lngRange = Math.abs(request.bottomRightLng - request.topLeftLng);
  
  let gridRows, gridCols;
  if (latRange < 0.002 && lngRange < 0.002) {
    gridRows = 2; gridCols = 2;
  } else if (latRange < 0.005 && lngRange < 0.005) {
    gridRows = 3; gridCols = 3;
  } else {
    gridRows = 4; gridCols = 4;
  }
  
  const tileRow = Math.floor(tileIndex / gridCols);
  const tileCol = tileIndex % gridCols;
  
  const latStep = latRange / gridRows;
  const lngStep = lngRange / gridCols;
  
  const tileCenterLat = request.topLeftLat - (tileRow + 0.5) * latStep;
  const tileCenterLng = request.topLeftLng + (tileCol + 0.5) * lngStep;
  
  // Calculate tile bounds
  const tileTopLat = request.topLeftLat - tileRow * latStep;
  const tileBottomLat = request.topLeftLat - (tileRow + 1) * latStep;
  const tileLeftLng = request.topLeftLng + tileCol * lngStep;
  const tileRightLng = request.topLeftLng + (tileCol + 1) * lngStep;
  
  return {
    centerLat: tileCenterLat,
    centerLng: tileCenterLng,
    topLeftLat: tileTopLat,
    topLeftLng: tileLeftLng,
    bottomRightLat: tileBottomLat,
    bottomRightLng: tileRightLng,
    tileRow,
    tileCol,
    gridRows,
    gridCols
  };
}

// Test data: Newport Marina coordinates (same as used in the actual system)
const testRequest = {
  topLeftLat: 41.489482,
  topLeftLng: -71.326262,
  bottomRightLat: 41.486718,
  bottomRightLng: -71.320838,
  zoomLevel: 20
};

console.log("=== COORDINATE CONVERSION TEST ===");
console.log("Test Area: Newport Marina, RI");
console.log(`Bounds: ${testRequest.topLeftLat}, ${testRequest.topLeftLng} to ${testRequest.bottomRightLat}, ${testRequest.bottomRightLng}`);
console.log(`Zoom Level: ${testRequest.zoomLevel}`);
console.log();

// Test 1: Basic pixel-to-coordinate conversion accuracy
console.log("=== TEST 1: Pixel-to-Coordinate Conversion ===");

const testPixels = [
  { x: 0, y: 0, desc: "Top-left corner" },
  { x: 640, y: 0, desc: "Top-right corner" },
  { x: 0, y: 640, desc: "Bottom-left corner" },
  { x: 640, y: 640, desc: "Bottom-right corner" },
  { x: 320, y: 320, desc: "Center" },
  { x: 100, y: 150, desc: "Arbitrary point 1" },
  { x: 500, y: 450, desc: "Arbitrary point 2" }
];

testPixels.forEach(pixel => {
  const lat = pixelToLatitude(pixel.y, testRequest);
  const lng = pixelToLongitude(pixel.x, testRequest);
  
  console.log(`${pixel.desc}: Pixel (${pixel.x}, ${pixel.y}) → Lat/Lng (${lat.toFixed(6)}, ${lng.toFixed(6)})`);
});

console.log();

// Test 2: Coordinate-to-pixel conversion accuracy
console.log("=== TEST 2: Coordinate-to-Pixel Conversion ===");

const testCoords = [
  { lat: testRequest.topLeftLat, lng: testRequest.topLeftLng, desc: "Top-left bound" },
  { lat: testRequest.topLeftLat, lng: testRequest.bottomRightLng, desc: "Top-right bound" },
  { lat: testRequest.bottomRightLat, lng: testRequest.topLeftLng, desc: "Bottom-left bound" },
  { lat: testRequest.bottomRightLat, lng: testRequest.bottomRightLng, desc: "Bottom-right bound" },
  { lat: (testRequest.topLeftLat + testRequest.bottomRightLat) / 2, lng: (testRequest.topLeftLng + testRequest.bottomRightLng) / 2, desc: "Center" }
];

testCoords.forEach(coord => {
  const pixel = latLngToPixel(coord.lat, coord.lng, testRequest);
  const inBounds = pixel.x >= 0 && pixel.x <= 640 && pixel.y >= 0 && pixel.y <= 640;
  
  console.log(`${coord.desc}: Lat/Lng (${coord.lat.toFixed(6)}, ${coord.lng.toFixed(6)}) → Pixel (${pixel.x.toFixed(1)}, ${pixel.y.toFixed(1)}) ${inBounds ? '✓' : '✗ OUT OF BOUNDS'}`);
});

console.log();

// Test 3: Round-trip conversion accuracy
console.log("=== TEST 3: Round-Trip Conversion Accuracy ===");

const roundTripTests = [
  { x: 100, y: 100 },
  { x: 320, y: 320 },
  { x: 500, y: 400 }
];

roundTripTests.forEach(original => {
  // Convert pixel to lat/lng
  const lat = pixelToLatitude(original.y, testRequest);
  const lng = pixelToLongitude(original.x, testRequest);
  
  // Convert back to pixel
  const backToPixel = latLngToPixel(lat, lng, testRequest);
  
  const errorX = Math.abs(original.x - backToPixel.x);
  const errorY = Math.abs(original.y - backToPixel.y);
  
  console.log(`Original: (${original.x}, ${original.y}) → Lat/Lng: (${lat.toFixed(6)}, ${lng.toFixed(6)}) → Back: (${backToPixel.x.toFixed(1)}, ${backToPixel.y.toFixed(1)})`);
  console.log(`  Error: X=${errorX.toFixed(2)}px, Y=${errorY.toFixed(2)}px ${errorX < 1 && errorY < 1 ? '✓' : '✗'}`);
});

console.log();

// Test 4: Tile-specific coordinate conversion
console.log("=== TEST 4: Tile-Specific Coordinate Conversion ===");

for (let tileIndex = 0; tileIndex < 4; tileIndex++) {
  const tileCoords = getTileCoordinates(tileIndex, testRequest);
  
  console.log(`\nTile ${tileIndex} (Row ${tileCoords.tileRow}, Col ${tileCoords.tileCol}):`);
  console.log(`  Center: (${tileCoords.centerLat.toFixed(6)}, ${tileCoords.centerLng.toFixed(6)})`);
  console.log(`  Bounds: ${tileCoords.topLeftLat.toFixed(6)}, ${tileCoords.topLeftLng.toFixed(6)} to ${tileCoords.bottomRightLat.toFixed(6)}, ${tileCoords.bottomRightLng.toFixed(6)}`);
  
  // Test a few points within this tile
  const tileCenterPixel = latLngToPixel(tileCoords.centerLat, tileCoords.centerLng, {
    topLeftLat: tileCoords.topLeftLat,
    topLeftLng: tileCoords.topLeftLng,
    bottomRightLat: tileCoords.bottomRightLat,
    bottomRightLng: tileCoords.bottomRightLng,
    zoomLevel: testRequest.zoomLevel
  });
  
  console.log(`  Center pixel in tile image: (${tileCenterPixel.x.toFixed(1)}, ${tileCenterPixel.y.toFixed(1)})`);
}

console.log();

// Test 5: Out-of-bounds detection
console.log("=== TEST 5: Out-of-Bounds Detection ===");

const outOfBoundsCoords = [
  { lat: testRequest.topLeftLat + 0.01, lng: testRequest.topLeftLng, desc: "North of bounds" },
  { lat: testRequest.bottomRightLat - 0.01, lng: testRequest.bottomRightLng, desc: "South of bounds" },
  { lat: testRequest.topLeftLat, lng: testRequest.topLeftLng - 0.01, desc: "West of bounds" },
  { lat: testRequest.bottomRightLat, lng: testRequest.bottomRightLng + 0.01, desc: "East of bounds" }
];

outOfBoundsCoords.forEach(coord => {
  const pixel = latLngToPixel(coord.lat, coord.lng, testRequest);
  const inBounds = pixel.x >= 0 && pixel.x <= 640 && pixel.y >= 0 && pixel.y <= 640;
  
  console.log(`${coord.desc}: Lat/Lng (${coord.lat.toFixed(6)}, ${coord.lng.toFixed(6)}) → Pixel (${pixel.x.toFixed(1)}, ${pixel.y.toFixed(1)}) ${inBounds ? '✓ IN BOUNDS' : '✗ OUT OF BOUNDS'}`);
  
  if (!inBounds) {
    console.log(`  → LOGGED: Coordinate falls outside image bounds`);
  }
});

console.log();

// Test 6: Precision analysis
console.log("=== TEST 6: Precision Analysis ===");

const metersPerPixel = getMetersPerPixel(testRequest);
console.log(`Meters per pixel at zoom ${testRequest.zoomLevel}: ${metersPerPixel.toFixed(3)}m`);

const sampleDistance = 10; // meters
const pixelDistance = sampleDistance / metersPerPixel;
console.log(`${sampleDistance}m translates to ~${pixelDistance.toFixed(2)} pixels`);

// Calculate the coordinate precision we can achieve
const latRange = Math.abs(testRequest.topLeftLat - testRequest.bottomRightLat);
const lngRange = Math.abs(testRequest.bottomRightLng - testRequest.topLeftLng);
const latPrecisionPerPixel = latRange / 640;
const lngPrecisionPerPixel = lngRange / 640;

console.log(`Coordinate precision per pixel:`);
console.log(`  Latitude: ${latPrecisionPerPixel.toFixed(8)} degrees`);
console.log(`  Longitude: ${lngPrecisionPerPixel.toFixed(8)} degrees`);

console.log();
console.log("=== TEST COMPLETE ===");