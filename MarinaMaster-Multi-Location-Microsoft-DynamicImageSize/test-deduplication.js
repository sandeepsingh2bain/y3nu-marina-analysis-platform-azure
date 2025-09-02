// Test script to demonstrate deduplication functionality
// This creates test data with intentional duplicates to verify the deduplication logic

const testDetections = [
  {
    objectId: "boat_1",
    objectType: "boat",
    subType: "vessel",
    lat: 41.62900000000000,
    lng: -71.21800000000000,
    length: 12.5,
    width: 4.2,
    area: 52.5,
    confidence: 85,
    status: "detected",
    boundingBox: { x: 100, y: 150, width: 50, height: 20 },
    geoPolygon: {
      topLeft: { lat: 41.629100000000000, lng: -71.218100000000000 },
      topRight: { lat: 41.629100000000000, lng: -71.217900000000000 },
      bottomLeft: { lat: 41.628900000000000, lng: -71.218100000000000 },
      bottomRight: { lat: 41.628900000000000, lng: -71.217900000000000 }
    },
    tileIndex: 0
  },
  {
    objectId: "boat_2",
    objectType: "boat", 
    subType: "vessel",
    lat: 41.62900500000000,
    lng: -71.21800500000000,
    length: 12.3,
    width: 4.1,
    area: 50.4,
    confidence: 82,
    status: "detected",
    boundingBox: { x: 105, y: 155, width: 48, height: 19 },
    geoPolygon: {
      topLeft: { lat: 41.629105000000000, lng: -71.218105000000000 },
      topRight: { lat: 41.629105000000000, lng: -71.217905000000000 },
      bottomLeft: { lat: 41.628905000000000, lng: -71.218105000000000 },
      bottomRight: { lat: 41.628905000000000, lng: -71.217905000000000 }
    },
    tileIndex: 1
  },
  {
    objectId: "boat_3",
    objectType: "boat",
    subType: "vessel", 
    lat: 41.62850000000000,
    lng: -71.21750000000000,
    length: 8.7,
    width: 3.2,
    area: 27.8,
    confidence: 78,
    status: "detected",
    boundingBox: { x: 200, y: 250, width: 35, height: 15 },
    geoPolygon: {
      topLeft: { lat: 41.628600000000000, lng: -71.217600000000000 },
      topRight: { lat: 41.628600000000000, lng: -71.217400000000000 },
      bottomLeft: { lat: 41.628400000000000, lng: -71.217600000000000 },
      bottomRight: { lat: 41.628400000000000, lng: -71.217400000000000 }
    },
    tileIndex: 2
  }
];

console.log("Test detections created:");
console.log(`Total detections: ${testDetections.length}`);
console.log("Detection 1 and 2 should be considered duplicates (>70% overlap)");
console.log("Detection 3 should be unique");

// Export for use in testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = testDetections;
}