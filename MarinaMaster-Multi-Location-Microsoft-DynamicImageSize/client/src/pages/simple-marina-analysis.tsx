import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { RefreshCw, MapPin } from "lucide-react";
import BoatList from "../components/boat-list";
import { AnalysisStatistics } from "../components/AnalysisStatistics";
import CoordinateConversionTest from "../components/CoordinateConversionTest";
import * as XLSX from 'xlsx';

interface Detection {
  objectId: string;
  objectType: string;
  subType: string;
  lat: number;
  lng: number;
  length: number;
  width: number;
  area: number;
  confidence: number;
  status: string;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  geoPolygon?: {
    topLeft: { lat: number; lng: number };
    topRight: { lat: number; lng: number };
    bottomLeft: { lat: number; lng: number };
    bottomRight: { lat: number; lng: number };
  };
  tileIndex?: number;
}

interface AnalysisData {
  analysisId: number;
  status: string;
  mapImageUrl?: string;
  tileUrls?: string[];
  annotatedImageUrls?: string[];
  detections: Detection[];
  stats?: {
    totalVessels: number;
    processingTime: string;
    tileCount: number;
  };
}

// Utility function to calculate polygon area using Shoelace formula
function calculatePolygonArea(polygon: { lat: number; lng: number }[]): number {
  let area = 0;
  const n = polygon.length;
  
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += polygon[i].lat * polygon[j].lng;
    area -= polygon[j].lat * polygon[i].lng;
  }
  
  return Math.abs(area) / 2;
}

// Utility function to calculate intersection area between two polygons
function calculatePolygonIntersection(poly1: { lat: number; lng: number }[], poly2: { lat: number; lng: number }[]): number {
  // Simple bounding box overlap check for approximation
  const bbox1 = {
    minLat: Math.min(...poly1.map(p => p.lat)),
    maxLat: Math.max(...poly1.map(p => p.lat)),
    minLng: Math.min(...poly1.map(p => p.lng)),
    maxLng: Math.max(...poly1.map(p => p.lng))
  };
  
  const bbox2 = {
    minLat: Math.min(...poly2.map(p => p.lat)),
    maxLat: Math.max(...poly2.map(p => p.lat)),
    minLng: Math.min(...poly2.map(p => p.lng)),
    maxLng: Math.max(...poly2.map(p => p.lng))
  };
  
  // Calculate bounding box intersection
  const intersectionMinLat = Math.max(bbox1.minLat, bbox2.minLat);
  const intersectionMaxLat = Math.min(bbox1.maxLat, bbox2.maxLat);
  const intersectionMinLng = Math.max(bbox1.minLng, bbox2.minLng);
  const intersectionMaxLng = Math.min(bbox1.maxLng, bbox2.maxLng);
  
  if (intersectionMaxLat <= intersectionMinLat || intersectionMaxLng <= intersectionMinLng) {
    return 0; // No intersection
  }
  
  const intersectionArea = (intersectionMaxLat - intersectionMinLat) * (intersectionMaxLng - intersectionMinLng);
  return intersectionArea;
}

// Function to calculate overlap percentage between two polygons
function calculateOverlapPercentage(poly1: { lat: number; lng: number }[], poly2: { lat: number; lng: number }[]): number {
  const area1 = calculatePolygonArea(poly1);
  const area2 = calculatePolygonArea(poly2);
  const intersectionArea = calculatePolygonIntersection(poly1, poly2);
  
  if (area1 === 0 || area2 === 0) return 0;
  
  const smallerArea = Math.min(area1, area2);
  return (intersectionArea / smallerArea) * 100;
}

// Spatial filtering function to check if boat is at least 70% inside AOI polygon
function isBoatInAOI(boatPolygon: any, aoiPolygon: Array<{lat: number, lng: number}>): boolean {
  if (!boatPolygon || !aoiPolygon || aoiPolygon.length < 3) return true; // If no AOI polygon, include all boats
  
  // Get boat corners
  const boatCorners = [
    { lat: boatPolygon.topLeft.lat, lng: boatPolygon.topLeft.lng },
    { lat: boatPolygon.topRight.lat, lng: boatPolygon.topRight.lng },
    { lat: boatPolygon.bottomRight.lat, lng: boatPolygon.bottomRight.lng },
    { lat: boatPolygon.bottomLeft.lat, lng: boatPolygon.bottomLeft.lng }
  ];
  
  // Count how many corners are inside the AOI polygon
  let cornersInside = 0;
  for (const corner of boatCorners) {
    if (isPointInPolygon(corner, aoiPolygon)) {
      cornersInside++;
    }
  }
  
  // Require at least 3 out of 4 corners (75%) to be inside - this is stricter than 70%
  return cornersInside >= 3;
}

// Point-in-polygon test using ray casting algorithm
function isPointInPolygon(point: {lat: number, lng: number}, polygon: Array<{lat: number, lng: number}>): boolean {
  const x = point.lng;
  const y = point.lat;
  let inside = false;
  
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng;
    const yi = polygon[i].lat;
    const xj = polygon[j].lng;
    const yj = polygon[j].lat;
    
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  
  return inside;
}

// Filter detections by AOI polygon before deduplication
function filterDetectionsByAOI(detections: any[], aoiPolygon?: Array<{lat: number, lng: number}>): any[] {
  if (!aoiPolygon || aoiPolygon.length < 3) {
    return detections; // Return all detections if no AOI polygon
  }
  
  return detections.filter(detection => {
    if (!detection.geoPolygon) return false; // Skip detections without geo polygon
    return isBoatInAOI(detection.geoPolygon, aoiPolygon);
  });
}

// Function to deduplicate detections based on polygon overlap
function deduplicateDetections(detections: Detection[]): Detection[] {
  const deduplicated: Detection[] = [];
  const processed = new Set<string>();
  
  for (const detection of detections) {
    if (processed.has(detection.objectId)) continue;
    
    let isDuplicate = false;
    
    // Check against already processed detections
    for (const existing of deduplicated) {
      if (!detection.geoPolygon || !existing.geoPolygon) continue;
      
      const currentPolygon = [
        detection.geoPolygon.topLeft,
        detection.geoPolygon.topRight,
        detection.geoPolygon.bottomRight,
        detection.geoPolygon.bottomLeft
      ];
      
      const existingPolygon = [
        existing.geoPolygon.topLeft,
        existing.geoPolygon.topRight,
        existing.geoPolygon.bottomRight,
        existing.geoPolygon.bottomLeft
      ];
      
      const overlapPercentage = calculateOverlapPercentage(currentPolygon, existingPolygon);
      
      if (overlapPercentage > 70) {
        isDuplicate = true;
        break;
      }
    }
    
    if (!isDuplicate) {
      deduplicated.push(detection);
    }
    
    processed.add(detection.objectId);
  }
  
  return deduplicated;
}

export default function SimpleMarinaAnalysis() {
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState<string>("");
  const [showBoats, setShowBoats] = useState(true);
  const [selectedTile, setSelectedTile] = useState(0);

  // Editable coordinates state
  const [coordinates, setCoordinates] = useState({
    topLeftLat: 41.62932013181398,
    topLeftLng: -71.21881192032785,
    bottomRightLat: 41.62822755280231,
    bottomRightLng: -71.21756690031927,
    zoomLevel: 19
  });

  // Default polygon coordinates
  const defaultPolygon = [
    {"lat":41.55198676308433,"lng":-70.60154470100355},
    {"lat":41.55189837863271,"lng":-70.60108330172147},
    {"lat":41.55026726205903,"lng":-70.6016412729463},
    {"lat":41.550347613592926,"lng":-70.60189879812701},
    {"lat":41.551351999339936,"lng":-70.60143739884492},
    {"lat":41.55144841955067,"lng":-70.60174857510495}
  ];

  // Polygon input state - initialize with default polygon
  const [polygonInput, setPolygonInput] = useState(JSON.stringify(defaultPolygon, null, 2));
  const [validationError, setValidationError] = useState("");
  
  // Export metadata state (now in form instead of dialog)
  const [recordId, setRecordId] = useState("");
  const [formattedAddress, setFormattedAddress] = useState("");
  
  // Cached analysis state
  const [cachedAnalysisAvailable, setCachedAnalysisAvailable] = useState(false);
  const [cachedAnalysisMessage, setCachedAnalysisMessage] = useState("");
  
  // Statistics display state
  const [showStatistics, setShowStatistics] = useState(false);
  
  // Tile visualization state
  const [isGeneratingVisualization, setIsGeneratingVisualization] = useState(false);
  const [visualizationUrl, setVisualizationUrl] = useState<string | null>(null);
  const [showVisualizationModal, setShowVisualizationModal] = useState(false);

  // Load existing analysis on component mount and set default polygon
  useEffect(() => {
    // Set default polygon coordinates on load
    handlePolygonChange(JSON.stringify(defaultPolygon, null, 2));
    
    // Don't auto-load any analysis data - wait for user to load maps first
  }, []);

  // Auto-show statistics when analysis is completed and maps are loaded
  useEffect(() => {
    if (analysisData?.status === 'completed' && 
        analysisData?.detections && 
        analysisData.detections.length > 0 && 
        analysisData?.tileUrls && 
        analysisData.tileUrls.length > 0) {
      setShowStatistics(true);
    }
  }, [analysisData?.status, analysisData?.detections?.length, analysisData?.tileUrls?.length]);

  // Handle polygon input changes
  const calculateBoundsFromPolygon = (polygon: Array<{lat: number, lng: number}>) => {
    if (polygon.length === 0) return null;
    
    let minLat = polygon[0].lat;
    let maxLat = polygon[0].lat;
    let minLng = polygon[0].lng;
    let maxLng = polygon[0].lng;
    
    polygon.forEach(point => {
      minLat = Math.min(minLat, point.lat);
      maxLat = Math.max(maxLat, point.lat);
      minLng = Math.min(minLng, point.lng);
      maxLng = Math.max(maxLng, point.lng);
    });
    
    return {
      topLeftLat: maxLat,
      topLeftLng: minLng,
      bottomRightLat: minLat,
      bottomRightLng: maxLng,
      zoomLevel: coordinates.zoomLevel
    };
  };

  const handlePolygonChange = (value: string) => {
    setPolygonInput(value);
    setValidationError("");
    
    if (value.trim()) {
      try {
        const polygon = JSON.parse(value);
        if (Array.isArray(polygon) && polygon.length >= 3) {
          // Validate polygon format
          const isValid = polygon.every(point => 
            typeof point === 'object' && 
            typeof point.lat === 'number' && 
            typeof point.lng === 'number' &&
            point.lat >= -90 && point.lat <= 90 &&
            point.lng >= -180 && point.lng <= 180
          );
          
          if (isValid) {
            const bounds = calculateBoundsFromPolygon(polygon);
            if (bounds) {
              setCoordinates(bounds);
            }
          } else {
            setValidationError("Invalid polygon format. Each point must have valid lat/lng coordinates.");
          }
        } else {
          setValidationError("Polygon must be an array with at least 3 points.");
        }
      } catch (e) {
        setValidationError("Invalid JSON format for polygon.");
      }
    }
  };

  const checkCachedAnalysis = async (coords: any) => {
    if (!recordId.trim() || !formattedAddress.trim()) {
      return false; // No cached check without metadata
    }

    try {
      const response = await fetch('/api/check-cached-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordId: recordId.trim(),
          formattedAddress: formattedAddress.trim(),
          topLeftLat: coords.topLeftLat,
          topLeftLng: coords.topLeftLng,
          bottomRightLat: coords.bottomRightLat,
          bottomRightLng: coords.bottomRightLng,
          zoomLevel: coords.zoomLevel
        }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.isCached) {
          setCachedAnalysisAvailable(true);
          setCachedAnalysisMessage(`Analysis already available for "${recordId}" at this location (${result.analysisResult.detections.length} boats detected on ${new Date(result.analysisResult.cachedAt).toLocaleDateString()})`);
          
          // Set the cached analysis data (without tile URLs yet - they'll be merged after maps load)
          setAnalysisData({
            analysisId: 0, // Cached analysis doesn't have an active analysis ID
            status: 'completed',
            detections: result.analysisResult.detections,
            stats: result.analysisResult.stats,
            // Don't set tileUrls here - they'll come from the map loading process
          });
          
          return true;
        }
      }
    } catch (error) {
      console.warn('Error checking cached analysis:', error);
    }
    
    return false;
  };

  const loadMaps = async () => {
    setLoading(true);
    setValidationError("");
    setCachedAnalysisAvailable(false);
    setCachedAnalysisMessage("");
    
    try {
      // Validate input
      const hasPolygon = polygonInput.trim();
      const hasCoordinates = coordinates.topLeftLat && coordinates.topLeftLng && 
                            coordinates.bottomRightLat && coordinates.bottomRightLng;
      
      if (!hasPolygon && !hasCoordinates) {
        setValidationError("Please provide either a polygon or all coordinate fields. Polygon format: [{'lat':43.06,'lng':-86.19},{'lat':43.06,'lng':-86.19}]");
        setLoading(false);
        return;
      }

      let payload: any = {
        ...coordinates
      };

      if (hasPolygon) {
        try {
          const polygon = JSON.parse(polygonInput);
          payload.polygon = polygon;
        } catch (e) {
          setValidationError("Invalid polygon JSON format.");
          setLoading(false);
          return;
        }
      }

      // Load maps
      const response = await fetch('/api/load-maps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      // Check for area too large error
      if (result.error === "Area too large") {
        throw new Error(result.message);
      }
      
      setLoadingStatus(`Initiating tile loading for ${result.tileCount} tiles...`);

      // Poll for completion with detailed status updates
      let attempts = 0;
      const maxAttempts = 30; // 60 seconds max
      let data = null;
      
      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const dataResponse = await fetch(`/api/analysis/${result.analysisId}`);
        
        if (!dataResponse.ok) {
          throw new Error(`Failed to fetch analysis data: ${dataResponse.status}`);
        }
        
        data = await dataResponse.json();
        console.log(`Poll attempt ${attempts + 1}: status = ${data.status}`);
        
        // Update status display with detailed progress
        if (data.status.startsWith("loading_maps:")) {
          setLoadingStatus(data.status.replace("loading_maps: ", ""));
        } else if (data.status.startsWith("failed:")) {
          throw new Error(data.status.replace("failed: ", ""));
        } else if (data.status === "maps_loaded") {
          setLoadingStatus("Maps loaded successfully!");
          break;
        } else {
          setLoadingStatus(`Status: ${data.status}`);
        }
        
        attempts++;
      }
      
      if (!data || data.status !== "maps_loaded") {
        throw new Error("Map loading timed out - please try again");
      }
      
      // Check for cached analysis after maps are loaded
      const hasCachedAnalysis = await checkCachedAnalysis(coordinates);
      
      if (!hasCachedAnalysis) {
        setAnalysisData(data);
        toast({
          title: "Maps Loaded",
          description: "Satellite imagery ready for boat detection"
        });
      } else {
        // Merge cached analysis with map data to show both images and cached results
        setAnalysisData(prevData => ({
          ...prevData,
          ...data, // Include map data (tileUrls, mapImageUrl, etc.)
          // Keep cached analysis data
          detections: prevData?.detections || [],
          stats: prevData?.stats || {
            totalVessels: 0,
            vesselTypes: { small: 0, medium: 0, large: 0 },
            avgConfidence: 0,
            processingTime: "0s",
            tileCount: 0
          }
        }));
        toast({
          title: "Cached Analysis Found",
          description: "Using previously analyzed results for this area"
        });
      }
    } catch (error) {
      console.error('Load maps error:', error);
      setLoadingStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      toast({
        title: "Error",
        description: `Failed to load maps: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
      // Clear status after a delay
      setTimeout(() => setLoadingStatus(""), 3000);
    }
  };

  const loadDefaultPolygon = () => {
    const defaultPolygonText = JSON.stringify(defaultPolygon, null, 2);
    setPolygonInput(defaultPolygonText);
    handlePolygonChange(defaultPolygonText);
  };

  const performExport = async () => {
    if (!analysisData?.detections || analysisData.detections.length === 0) {
      toast({
        title: "No Data",
        description: "No detection results available to export.",
        variant: "destructive",
      });
      return;
    }

    if (!recordId.trim() || !formattedAddress.trim()) {
      toast({
        title: "Missing Information",
        description: "Please provide both Record ID and Formatted Address.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Get AOI polygon from current input
      let aoiPolygon = null;
      if (polygonInput.trim()) {
        try {
          aoiPolygon = JSON.parse(polygonInput);
        } catch (e) {
          console.warn("Could not parse AOI polygon for filtering");
        }
      }

      // Cache the analysis result when exporting
      try {
        await fetch('/api/cache-analysis-result', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recordId: recordId.trim(),
            formattedAddress: formattedAddress.trim(),
            topLeftLat: coordinates.topLeftLat,
            topLeftLng: coordinates.topLeftLng,
            bottomRightLat: coordinates.bottomRightLat,
            bottomRightLng: coordinates.bottomRightLng,
            zoomLevel: coordinates.zoomLevel,
            detections: analysisData.detections,
            stats: analysisData.stats
          })
        });
        console.log('Analysis result cached successfully');
      } catch (error) {
        console.warn('Failed to cache analysis result:', error);
      }

      // First filter by AOI polygon (only boats at least 70% inside)
      const allDetections = analysisData.detections;
      const aoiFilteredDetections = filterDetectionsByAOI(allDetections, aoiPolygon);
      
      // Then deduplicate the AOI-filtered detections
      const deduplicatedDetections = deduplicateDetections(aoiFilteredDetections);
      
      // Show filtering stats
      console.log(`AOI Filtering: ${allDetections.length} → ${aoiFilteredDetections.length} boats (${allDetections.length - aoiFilteredDetections.length} filtered out)`);
      console.log(`Deduplication: ${aoiFilteredDetections.length} → ${deduplicatedDetections.length} boats (${aoiFilteredDetections.length - deduplicatedDetections.length} duplicates removed)`);
      
      toast({
        title: "Filtering Applied",
        description: `AOI: ${allDetections.length}→${aoiFilteredDetections.length} | Dedupe: ${aoiFilteredDetections.length}→${deduplicatedDetections.length}`,
      });
      
      // Format data for Excel export
      const exportData = deduplicatedDetections.map((detection, index) => {
        const polygonCoords = detection.geoPolygon ? 
          `TL: ${detection.geoPolygon.topLeft.lat.toFixed(15)},${detection.geoPolygon.topLeft.lng.toFixed(15)} | ` +
          `TR: ${detection.geoPolygon.topRight.lat.toFixed(15)},${detection.geoPolygon.topRight.lng.toFixed(15)} | ` +
          `BR: ${detection.geoPolygon.bottomRight.lat.toFixed(15)},${detection.geoPolygon.bottomRight.lng.toFixed(15)} | ` +
          `BL: ${detection.geoPolygon.bottomLeft.lat.toFixed(15)},${detection.geoPolygon.bottomLeft.lng.toFixed(15)}`
          : 'N/A';
        
        return {
          'RecordID': recordId,
          'Address': formattedAddress,
          'Type': detection.subType || 'vessel',
          'Latitude': detection.lat.toFixed(15),
          'Longitude': detection.lng.toFixed(15),
          'Length (m)': detection.length.toFixed(3),
          'Width (m)': detection.width.toFixed(3),
          'Polygon Coords': polygonCoords
        };
      });

      // Create workbook and worksheet
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      
      // Auto-size columns
      const columnWidths = [
        { wch: 15 }, // RecordID
        { wch: 30 }, // Address
        { wch: 10 }, // Type
        { wch: 20 }, // Latitude
        { wch: 20 }, // Longitude
        { wch: 12 }, // Length
        { wch: 12 }, // Width
        { wch: 80 }, // Polygon Coords
      ];
      worksheet['!cols'] = columnWidths;
      
      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Deduplicated Vessels');
      
      // Get AOI polygon coordinates for filename
      let topLeftCoords = "";
      let bottomRightCoords = "";
      
      if (aoiPolygon && aoiPolygon.length > 0) {
        // Find top-left (max lat, min lng) and bottom-right (min lat, max lng)
        const lats = aoiPolygon.map((p: any) => p.lat);
        const lngs = aoiPolygon.map((p: any) => p.lng);
        
        const maxLat = Math.max(...lats);
        const minLat = Math.min(...lats);
        const minLng = Math.min(...lngs);
        const maxLng = Math.max(...lngs);
        
        topLeftCoords = `${maxLat}_${minLng}`;
        bottomRightCoords = `${minLat}_${maxLng}`;
      } else {
        // Fallback to current coordinates
        topLeftCoords = `${coordinates.topLeftLat}_${coordinates.topLeftLng}`;
        bottomRightCoords = `${coordinates.bottomRightLat}_${coordinates.bottomRightLng}`;
      }

      // Construct filename: RecordID_FormattedAddress_TopLeft_BottomRight.xlsx
      const cleanAddress = formattedAddress.replace(/[^a-zA-Z0-9]/g, '_');
      const fileName = `${recordId}_${cleanAddress}_${topLeftCoords}_${bottomRightCoords}.xlsx`;
      
      // Save Excel file
      XLSX.writeFile(workbook, fileName);
      
      toast({
        title: "Export Complete",
        description: `Exported ${deduplicatedDetections.length} boats to ${fileName}`,
      });
      
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Export Failed",
        description: "Failed to export detection results.",
        variant: "destructive",
      });
    }
  };

  const handleExport = () => {
    if (!analysisData?.detections || analysisData.detections.length === 0) {
      toast({
        title: "No Data",
        description: "No detection results available to export.",
        variant: "destructive",
      });
      return;
    }
    
    if (!recordId.trim() || !formattedAddress.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter both Record ID and Formatted Address before exporting.",
        variant: "destructive",
      });
      return;
    }
    
    performExport();
  }

  const handleExportNewDetections = () => {
    if (!analysisData?.detections || analysisData.detections.length === 0) {
      toast({
        title: "No Data",
        description: "No fresh detection results available to export.",
        variant: "destructive",
      });
      return;
    }
    
    if (!recordId.trim() || !formattedAddress.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter both Record ID and Formatted Address before exporting.",
        variant: "destructive",
      });
      return;
    }
    
    performExport();
  };

  const generateTileVisualization = async () => {
    if (!analysisData || !analysisData.analysisId) {
      toast({
        title: "No Analysis Available",
        description: "Please run object detection first",
        variant: "destructive"
      });
      return;
    }

    setIsGeneratingVisualization(true);
    try {
      const response = await fetch(`/api/visualize-tile/${analysisData.analysisId}/${selectedTile}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`Failed to generate visualization: ${response.status}`);
      }

      const result = await response.json();
      
      setVisualizationUrl(result.visualizationUrl);
      setShowVisualizationModal(true);
      
      toast({
        title: "Visualization Generated",
        description: `${result.detectionsCount} final detections shown for tile ${selectedTile + 1}`
      });

    } catch (error) {
      console.error("Visualization error:", error);
      toast({
        title: "Visualization Failed",
        description: error instanceof Error ? error.message : "Failed to generate visualization",
        variant: "destructive"
      });
    } finally {
      setIsGeneratingVisualization(false);
    }
  };

  const runDetection = async (scope: 'current' | 'all') => {
    if (!analysisData) return;
    
    setLoading(true);
    try {
      await fetch('/api/run-detection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysisId: analysisData.analysisId,
          detectionScope: scope,
          selectedTileIndex: scope === 'current' ? selectedTile : undefined
        })
      });

      toast({
        title: "Running Detection",
        description: `Analyzing ${scope === 'current' ? 'current image' : 'all images'}...`
      });

      // Poll for detection completion with extended timeout for large areas
      let attempts = 0;
      const maxAttempts = 300; // 10 minutes for large areas (24 tiles * ~25 seconds each)
      let updatedData = null;
      
      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const dataResponse = await fetch(`/api/analysis/${analysisData.analysisId}?t=${Date.now()}`);
        
        if (!dataResponse.ok) {
          console.error(`API error: ${dataResponse.status}`);
          attempts++;
          continue;
        }
        
        updatedData = await dataResponse.json();
        
        console.log(`Detection poll attempt ${attempts + 1}: status = ${updatedData.status}, detections = ${updatedData.detections?.length || 0}, annotated = ${updatedData.annotatedImageUrls?.length || 0}`);
        
        // Always update UI with latest data for real-time progress
        setAnalysisData({
          ...updatedData,
          _timestamp: Date.now()
        });
        
        // Handle real-time progress updates for individual tiles
        if (updatedData.status?.includes('tile_') && updatedData.status?.includes('_completed_')) {
          const statusMatch = updatedData.status.match(/tile_(\d+)_of_(\d+)_completed_(\d+)_boats/);
          if (statusMatch) {
            const [, completedTiles, totalTiles, boatCount] = statusMatch;
            
            // Update loading status to show progress
            setLoadingStatus(`Processing tile ${completedTiles}/${totalTiles} - ${boatCount} boats found so far`);
            
            // Only show toast every 5 tiles to reduce spam
            if (parseInt(completedTiles) % 5 === 0 || parseInt(completedTiles) === parseInt(totalTiles)) {
              toast({
                title: `Tile ${completedTiles}/${totalTiles} Complete`,
                description: `Found ${boatCount} boats total so far`
              });
            }
          }
        }
        
        // Handle processing status messages
        if (updatedData.status?.startsWith('processing_')) {
          const tileName = updatedData.status.replace('processing_', '');
          toast({
            title: "Processing Image",
            description: `Analyzing ${tileName}...`
          });
        }
        
        if (updatedData.status === "completed") {
          // Validate detection data integrity
          const detectionCount = updatedData.detections?.length || 0;
          const annotatedCount = updatedData.annotatedImageUrls?.length || 0;
          
          console.log(`Detection validation: ${detectionCount} detections, ${annotatedCount} annotated images`);
          
          // Ensure we have valid detection data before updating state
          if (detectionCount === 0 && scope === 'all') {
            console.warn("Zero detections returned for 'all' scope - this may indicate a data consistency issue");
          }
          
          // Force re-render by creating new object with timestamp to prevent stale data
          const validatedData = {
            ...updatedData,
            _timestamp: Date.now(),
            detections: updatedData.detections || []
          };
          
          setAnalysisData(validatedData);
          break;
        } else if (updatedData.status?.includes("failed")) {
          throw new Error(`Detection processing failed: ${updatedData.status}`);
        }
        
        attempts++;
      }
      
      if (attempts >= maxAttempts && (!updatedData || updatedData.status !== 'completed')) {
        toast({
          title: "Detection Still Running",
          description: "Processing continues. Use refresh button to check progress.",
          variant: "default"
        });
        return; // Don't treat as error, just stop polling
      }
      
      if (!updatedData || updatedData.status !== "completed") {
        throw new Error("Detection timed out or failed to complete");
      }
      toast({
        title: "Object Detection Complete",
        description: `Total: ${updatedData?.detections?.length || 0} boats detected across all tiles`
      });
      
      // Force refresh of boat list display
      setSelectedTile(selectedTile);
    } catch (error) {
      toast({
        title: "Error",
        description: "Detection failed",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
      setLoadingStatus("");
    }
  };



  return (
    <div className="flex h-screen bg-gray-50">
      {/* Left Sidebar - Analysis Setup */}
      <div className="w-80 bg-white border-r border-gray-200 p-6 overflow-y-auto">
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-blue-600" />
            <h2 className="text-xl font-semibold">Area of Interest (AOI)</h2>
          </div>

          {/* AOI Polygon Input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="polygon" className="text-sm font-medium text-gray-700">
                AOI Polygon (Optional)
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={loadDefaultPolygon}
                className="text-xs px-2 py-1 h-6"
              >
                Load Default
              </Button>
            </div>
            <Textarea
              id="polygon"
              placeholder='[{"lat":43.06023818380331,"lng":-86.19938224554063},{"lat":43.06014999637569,"lng":-86.19924008846284},{"lat":43.060224465767334,"lng":-86.19913816452028},{"lat":43.06029501563392,"lng":-86.19926691055299}]'
              value={polygonInput}
              onChange={(e) => handlePolygonChange(e.target.value)}
              className="min-h-[80px] text-xs font-mono"
            />
            <p className="text-xs text-gray-500">
              Enter polygon coordinates as JSON array. Coordinates will be auto-calculated below.
            </p>
          </div>

          {/* Export Information */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="font-medium">Export Information</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="recordId" className="text-xs text-gray-600">Record ID</Label>
                <Input
                  id="recordId"
                  type="text"
                  value={recordId}
                  onChange={(e) => setRecordId(e.target.value)}
                  placeholder="Enter record ID"
                  className="text-xs"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="formattedAddress" className="text-xs text-gray-600">Formatted Address</Label>
                <Input
                  id="formattedAddress"
                  type="text"
                  value={formattedAddress}
                  onChange={(e) => setFormattedAddress(e.target.value)}
                  placeholder="Enter formatted address"
                  className="text-xs"
                />
              </div>
            </div>
          </div>

          <div className="text-sm text-gray-600 text-center">
            — OR —
          </div>
          
          {/* Manual Coordinates */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span className="font-medium">Manual Coordinates</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="topLeftLat" className="text-xs text-gray-600">Top-Left Lat</Label>
                <Input
                  id="topLeftLat"
                  type="number"
                  step="0.000000001"
                  value={coordinates.topLeftLat}
                  onChange={(e) => setCoordinates(prev => ({
                    ...prev,
                    topLeftLat: parseFloat(e.target.value) || 0
                  }))}
                  className="text-xs font-mono"
                  disabled={!!polygonInput.trim()}
                />
                <Label htmlFor="topLeftLng" className="text-xs text-gray-600">Top-Left Lng</Label>
                <Input
                  id="topLeftLng"
                  type="number"
                  step="0.000000001"
                  value={coordinates.topLeftLng}
                  onChange={(e) => setCoordinates(prev => ({
                    ...prev,
                    topLeftLng: parseFloat(e.target.value) || 0
                  }))}
                  className="text-xs font-mono"
                  disabled={!!polygonInput.trim()}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bottomRightLat" className="text-xs text-gray-600">Bottom-Right Lat</Label>
                <Input
                  id="bottomRightLat"
                  type="number"
                  step="0.000000001"
                  value={coordinates.bottomRightLat}
                  onChange={(e) => setCoordinates(prev => ({
                    ...prev,
                    bottomRightLat: parseFloat(e.target.value) || 0
                  }))}
                  className="text-xs font-mono"
                  disabled={!!polygonInput.trim()}
                />
                <Label htmlFor="bottomRightLng" className="text-xs text-gray-600">Bottom-Right Lng</Label>
                <Input
                  id="bottomRightLng"
                  type="number"
                  step="0.000000001"
                  value={coordinates.bottomRightLng}
                  onChange={(e) => setCoordinates(prev => ({
                    ...prev,
                    bottomRightLng: parseFloat(e.target.value) || 0
                  }))}
                  className="text-xs font-mono"
                  disabled={!!polygonInput.trim()}
                />
              </div>
            </div>
          </div>

          {/* Zoom Level */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span className="font-medium">Zoom Level</span>
            </div>
            <Select 
              value={coordinates.zoomLevel.toString()} 
              onValueChange={(value) => setCoordinates(prev => ({
                ...prev,
                zoomLevel: parseInt(value)
              }))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select zoom level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="18">18 - Slip Detail</SelectItem>
                <SelectItem value="19">19 - High Detail</SelectItem>
                <SelectItem value="20">20 - Maximum Detail</SelectItem>
              </SelectContent>
            </Select>
          </div>

          

          {/* Maps Status */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${analysisData ? 'bg-green-500' : 'bg-gray-300'}`}></div>
              <span className="font-medium">Maps Loaded {analysisData ? '✓' : ''}</span>
            </div>
            
            {/* Cached Analysis Message */}
            {cachedAnalysisAvailable && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="text-sm text-green-800">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-4 h-4 bg-green-600 rounded-full"></div>
                    <span className="font-medium">Analysis Available</span>
                  </div>
                  <div className="text-xs text-green-700 bg-green-100 p-2 rounded">
                    {cachedAnalysisMessage}
                  </div>
                  <div className="text-xs text-green-600 mt-2">
                    Export button is ready to use. You can still run object detection below to get fresh results.
                  </div>
                </div>
              </div>
            )}

            {/* Loading Status Display */}
            {(loading || loadingStatus) && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="text-sm text-blue-800">
                  {loading && <div className="flex items-center gap-2 mb-2">
                    <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    <span className="font-medium">Loading Maps...</span>
                  </div>}
                  {loadingStatus && (
                    <div className="text-xs text-blue-700 font-mono bg-blue-100 p-2 rounded">
                      {loadingStatus}
                    </div>
                  )}
                </div>
              </div>
            )}
            
            <div className="flex gap-2">
              <Button 
                onClick={loadMaps} 
                disabled={loading}
                className="flex-1"
              >
                {loading ? "Loading..." : "Load Maps"}
              </Button>
              <Button 
                onClick={async () => {
                  if (!analysisData?.analysisId) {
                    toast({
                      title: "No Analysis", 
                      description: "Load maps first to refresh analysis data",
                      variant: "destructive"
                    });
                    return;
                  }
                  try {
                    setLoading(true);
                    const response = await fetch(`/api/analysis/${analysisData.analysisId}?t=${Date.now()}`);
                    if (response.ok) {
                      const data = await response.json();
                      setAnalysisData(data);
                      toast({
                        title: "Refreshed",
                        description: `Loaded ${data.detections?.length || 0} detections`
                      });
                    }
                  } catch (error) {
                    toast({
                      title: "Refresh Failed", 
                      description: "Could not refresh analysis data",
                      variant: "destructive"
                    });
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={loading || !analysisData?.analysisId}
                variant="outline"
                size="sm"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
            <Button 
              onClick={() => loadMaps()} 
              disabled={loading}
              variant="outline" 
              className="w-full"
            >
              Force Refresh
            </Button>
          </div>

          {/* Detection and Export Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${(analysisData?.detections && analysisData.detections.length > 0) || cachedAnalysisAvailable ? 'bg-green-500' : 'bg-gray-300'}`}></div>
              <span className="font-medium">Analysis & Export</span>
            </div>
            
            {/* Export Button - Always visible when analysis is available */}
            {((analysisData?.detections && analysisData.detections.length > 0) || cachedAnalysisAvailable) && (
              <Button 
                onClick={handleExport} 
                disabled={!recordId.trim() || !formattedAddress.trim()}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                📊 Export Cached Detections
              </Button>
            )}
            
            {/* Detection Buttons - Always available when maps are loaded */}
            {analysisData && (
              <div className="space-y-2">
                <Button 
                  onClick={() => runDetection('current')} 
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  🎯 Run Object Detection on Current Image
                </Button>
                <Button 
                  onClick={() => runDetection('all')} 
                  disabled={loading}
                  variant="outline"
                  className="w-full"
                >
                  ⚡ Run Object Detection on All Images
                </Button>
              </div>
            )}
            
            {/* Status Messages */}
            {cachedAnalysisAvailable && (
              <div className="text-xs text-green-600 bg-green-50 p-2 rounded">
                Cached analysis available. Run detection to get fresh results or export current data.
              </div>
            )}
            
            {/* Export Fresh Detections Button - Only appears after detection completes */}
            {analysisData && analysisData.analysisId && analysisData.analysisId > 0 && (
              <Button 
                onClick={handleExportNewDetections} 
                disabled={!recordId.trim() || !formattedAddress.trim()}
                className="w-full bg-orange-600 hover:bg-orange-700"
              >
                📤 Export New Detections
              </Button>
            )}
          </div>

          {/* Coordinate Conversion Testing */}
          {analysisData && analysisData.tileUrls && analysisData.tileUrls.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                <span className="font-medium">Coordinate Testing</span>
              </div>
              <CoordinateConversionTest analysisId={analysisData.analysisId} />
            </div>
          )}

        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <h1 className="text-2xl font-semibold">Satellite Imagery Analysis</h1>
              {loading && analysisData?.status?.includes('tile_') && (
                <div className="text-sm text-blue-600 mt-1">
                  {analysisData.status.includes('_completed_') ? (
                    (() => {
                      const match = analysisData.status.match(/tile_(\d+)_of_(\d+)_completed_(\d+)_boats/);
                      return match ? `Processing complete: ${match[1]}/${match[2]} tiles • ${match[3]} boats found` : 'Processing...';
                    })()
                  ) : analysisData.status.startsWith('processing_') ? (
                    `Processing ${analysisData.status.replace('processing_', '')}...`
                  ) : 'Processing...'}
                </div>
              )}
            </div>
            {analysisData?.tileUrls && (
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-600">
                  Tile {selectedTile + 1} of {analysisData.tileUrls.length}
                </span>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedTile(Math.max(0, selectedTile - 1))}
                    disabled={selectedTile === 0}
                  >
                    ‹
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedTile(Math.min(analysisData.tileUrls!.length - 1, selectedTile + 1))}
                    disabled={selectedTile === analysisData.tileUrls!.length - 1}
                  >
                    ›
                  </Button>
                  {analysisData?.detections && analysisData.detections.length > 0 && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={generateTileVisualization}
                      disabled={isGeneratingVisualization}
                      className="bg-purple-600 hover:bg-purple-700 text-white ml-2"
                    >
                      {isGeneratingVisualization ? (
                        <>🔄 Generating...</>
                      ) : (
                        <>🎯 Visualize Results</>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Content Grid */}
        <div className="flex-1 grid grid-cols-2 gap-6 p-6">
          {/* Original Satellite Tile */}
          <Card className="flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Original Satellite Tile</CardTitle>
            </CardHeader>
            <CardContent className="flex-1">
              {analysisData?.tileUrls ? (
                <div className="relative w-full h-full">
                  <div className="w-full h-full bg-gray-100 rounded-lg flex items-center justify-center">
                    <img
                      src={(() => {
                        const filename = analysisData.tileUrls[selectedTile].split('/').pop();
                        return `/api/test-image/${filename}`;
                      })()}
                      alt={`Satellite tile ${selectedTile + 1}`}
                      className="w-full h-full object-cover rounded-lg"
                    />
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full bg-gray-100 rounded-lg">
                  <div className="text-center text-gray-500">
                    <div className="text-4xl mb-2">📍</div>
                    <div>No satellite imagery loaded</div>
                    <div className="text-sm">Click "Load Sample Marina" to start</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Boat Detection Results */}
          <Card className="flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Boat Detection Results</CardTitle>
            </CardHeader>
            <CardContent className="flex-1">
              {analysisData?.annotatedImageUrls && analysisData.annotatedImageUrls.length > 0 ? (
                <div className="relative w-full h-full">
                  <img
                    src={analysisData.annotatedImageUrls[selectedTile] || analysisData.annotatedImageUrls[0]}
                    alt={`Boat detection results for tile ${selectedTile + 1}`}
                    className="w-full h-full object-cover rounded-lg"
                    onLoad={() => console.log('Annotated image loaded:', analysisData.annotatedImageUrls[selectedTile] || analysisData.annotatedImageUrls[0])}
                    onError={(e) => {
                      console.error('Annotated image failed to load:', analysisData.annotatedImageUrls[selectedTile] || analysisData.annotatedImageUrls[0], e);
                    }}
                    crossOrigin="anonymous"
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center text-gray-500">
                    <div className="text-4xl mb-2">🔍</div>
                    <div>No detection results</div>
                    <div className="text-sm">Run boat analysis to see results</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* All Tiles Section */}
        {analysisData?.tileUrls && analysisData.tileUrls.length > 1 && (
          <div className="border-t border-gray-200 p-6">
            <div className="mb-4">
              <h3 className="font-medium">All Tiles ({analysisData.tileUrls.length} total)</h3>
            </div>
            <div className="grid grid-cols-6 gap-2">
              {analysisData.tileUrls.map((url, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedTile(index)}
                  className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                    selectedTile === index ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <img
                    src={(() => {
                      const filename = url.split('/').pop();
                      return `/api/test-image/${filename}`;
                    })()}
                    alt={`Tile ${index + 1}`}
                    className="w-full h-full object-cover"
                    onLoad={() => console.log(`Thumbnail tile ${index + 1} loaded successfully via test endpoint`)}
                    onError={(e) => {
                      console.error(`Thumbnail tile ${index + 1} failed to load via test endpoint`);
                    }}
                    style={{ 
                      backgroundColor: '#f5f5f5',
                      minHeight: '50px'
                    }}
                  />
                  <div className="absolute bottom-0 left-0 bg-black bg-opacity-50 text-white text-xs px-1">
                    {index + 1}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Boat List with Geographic Coordinates */}
        {analysisData?.detections && analysisData.detections.length > 0 && (
          <div className="px-6 pb-6">
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-600">
                Total boats detected: <span className="font-semibold text-gray-900">{analysisData.detections.length}</span>
              </div>
              <div className="text-sm text-gray-600">
                Boats in current tile ({selectedTile + 1}): <span className="font-semibold text-gray-900">
                  {analysisData.detections.filter(d => d.tileIndex === selectedTile).length}
                </span>
              </div>
              {analysisData.detections.filter(d => d.tileIndex === selectedTile).length === 0 && 
               analysisData.detections.length > 0 && (
                <div className="text-sm text-amber-600 mt-2 flex items-center justify-between">
                  <span>This tile has no boats. Use the arrow buttons above to navigate to tiles with detections.</span>
                  <button 
                    className="ml-4 px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
                    onClick={() => {
                      // Find first tile with boats
                      const tileWithBoats = analysisData.detections.find(d => d.tileIndex !== undefined);
                      if (tileWithBoats) setSelectedTile(tileWithBoats.tileIndex || 0);
                    }}
                  >
                    Go to first tile with boats
                  </button>
                </div>
              )}
            </div>
            <BoatList 
              detections={analysisData.detections.filter(detection => 
                detection.tileIndex === selectedTile
              )} 
              onExportCSV={() => {
                // CSV export is handled within BoatList component
              }}
            />
          </div>
        )}

        {/* Export Button - Bottom Left - Only show after object detection is completed */}
        {analysisData?.detections && analysisData.detections.length > 0 && analysisData.status === 'completed' && analysisData.analysisId > 0 && (
          <div className="fixed bottom-6 left-6">
            <Button
              onClick={handleExport}
              className="bg-green-600 hover:bg-green-700 text-white shadow-lg"
              size="lg"
            >
              📊 Export New Detections
            </Button>
          </div>
        )}
        
        {/* Analysis Statistics Component */}
        {analysisData?.analysisId && (
          <AnalysisStatistics
            analysisId={analysisData.analysisId}
            isVisible={showStatistics}
            onToggle={() => setShowStatistics(!showStatistics)}
          />
        )}

        {/* Tile Visualization Modal */}
        <Dialog open={showVisualizationModal} onOpenChange={setShowVisualizationModal}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
            <DialogHeader>
              <DialogTitle>Tile {selectedTile + 1} Final Detection Results</DialogTitle>
            </DialogHeader>
            <div className="mt-4">
              {visualizationUrl ? (
                <div className="relative w-full">
                  <img
                    src={visualizationUrl}
                    alt={`Final detection results for tile ${selectedTile + 1}`}
                    className="w-full h-auto rounded-lg"
                  />
                  <div className="mt-4 text-sm text-gray-600 text-center">
                    This visualization shows only the final detections after deduplication for tile {selectedTile + 1}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-64">
                  <div className="text-center">
                    <div className="text-4xl mb-2">🔄</div>
                    <div>Generating visualization...</div>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}