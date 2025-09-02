import { useState } from "react";
import { MapPin, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";

interface CoordinateInputProps {
  onLoadMaps: (coordinates: any, forceRefresh?: boolean) => void;
  onRunDetection: () => void;
  onRunDetectionAll: () => void;
  onLoadSample: () => void;
  isAnalyzing: boolean;
  analysisStatus?: string;
  error?: string;
  onMetadataChange?: (metadata: { recordId: string; formattedAddress: string }) => void;
}

export default function CoordinateInput({ 
  onLoadMaps, 
  onRunDetection,
  onRunDetectionAll,
  onLoadSample, 
  isAnalyzing,
  analysisStatus,
  error,
  onMetadataChange 
}: CoordinateInputProps) {
  const [coordinates, setCoordinates] = useState({
    topLeftLat: "41.62932013181398",
    topLeftLng: "-71.21881192032785",
    bottomRightLat: "41.62822755280231",
    bottomRightLng: "-71.21756690031927",
  });
  const [zoomLevel, setZoomLevel] = useState("19");
  const [polygonInput, setPolygonInput] = useState("");
  const [validationError, setValidationError] = useState("");
  const [recordId, setRecordId] = useState("");
  const [formattedAddress, setFormattedAddress] = useState("");

  const handleCoordinateChange = (field: string, value: string) => {
    const newCoords = { ...coordinates, [field]: value };
    setCoordinates(newCoords);
    setValidationError("");
  };

  const handleMetadataChange = (field: 'recordId' | 'formattedAddress', value: string) => {
    if (field === 'recordId') {
      setRecordId(value);
    } else {
      setFormattedAddress(value);
    }
    
    // Notify parent component of metadata changes
    if (onMetadataChange) {
      const updatedMetadata = {
        recordId: field === 'recordId' ? value : recordId,
        formattedAddress: field === 'formattedAddress' ? value : formattedAddress
      };
      onMetadataChange(updatedMetadata);
    }
  };

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
      topLeftLat: maxLat.toString(),
      topLeftLng: minLng.toString(),
      bottomRightLat: minLat.toString(),
      bottomRightLng: maxLng.toString()
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

  const handleZoomChange = (value: string) => {
    setZoomLevel(value);
  };

  const handleLoadMaps = (forceRefresh = false) => {
    // Validate input
    const hasPolygon = polygonInput.trim();
    const hasCoordinates = coordinates.topLeftLat && coordinates.topLeftLng && 
                          coordinates.bottomRightLat && coordinates.bottomRightLng;
    
    if (!hasPolygon && !hasCoordinates) {
      setValidationError("Please provide either a polygon or all coordinate fields. Polygon format: [{'lat':43.06,'lng':-86.19},{'lat':43.06,'lng':-86.19}]");
      return;
    }

    let payload: any = {
      zoomLevel: parseInt(zoomLevel)
    };

    if (hasPolygon) {
      try {
        const polygon = JSON.parse(polygonInput);
        payload.polygon = polygon;
        
        // Also include the calculated bounds for backward compatibility
        payload.topLeftLat = parseFloat(coordinates.topLeftLat);
        payload.topLeftLng = parseFloat(coordinates.topLeftLng);
        payload.bottomRightLat = parseFloat(coordinates.bottomRightLat);
        payload.bottomRightLng = parseFloat(coordinates.bottomRightLng);
      } catch (e) {
        setValidationError("Invalid polygon JSON format.");
        return;
      }
    } else {
      payload.topLeftLat = parseFloat(coordinates.topLeftLat);
      payload.topLeftLng = parseFloat(coordinates.topLeftLng);
      payload.bottomRightLat = parseFloat(coordinates.bottomRightLat);
      payload.bottomRightLng = parseFloat(coordinates.bottomRightLng);
    }
    
    onLoadMaps(payload, forceRefresh);
  };

  return (
    <div className="space-y-6 bg-white dark:bg-gray-900 border dark:border-gray-700 rounded-lg p-6">
      <div className="flex items-center gap-2">
        <MapPin className="h-5 w-5 text-blue-600" />
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Area of Interest (AOI)</h2>
      </div>

      {/* Export Metadata */}
      <div className="space-y-4">
        <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Export Information
        </Label>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="recordId" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Record ID
            </Label>
            <Input
              id="recordId"
              type="text"
              value={recordId}
              onChange={(e) => handleMetadataChange('recordId', e.target.value)}
              placeholder="Enter record ID"
              className="text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="formattedAddress" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Formatted Address
            </Label>
            <Input
              id="formattedAddress"
              type="text"
              value={formattedAddress}
              onChange={(e) => handleMetadataChange('formattedAddress', e.target.value)}
              placeholder="Enter formatted address"
              className="text-sm"
            />
          </div>
        </div>
      </div>

      {/* AOI Polygon Input */}
      <div className="space-y-2">
        <Label htmlFor="polygon" className="text-sm font-medium text-gray-700 dark:text-gray-300">
          AOI Polygon (Optional)
        </Label>
        <Textarea
          id="polygon"
          placeholder='[{"lat":43.06023818380331,"lng":-86.19938224554063},{"lat":43.06014999637569,"lng":-86.19924008846284},{"lat":43.060224465767334,"lng":-86.19913816452028},{"lat":43.06029501563392,"lng":-86.19926691055299}]'
          value={polygonInput}
          onChange={(e) => handlePolygonChange(e.target.value)}
          className="min-h-[80px] text-xs font-mono"
        />
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Enter polygon coordinates as JSON array. Coordinates will be auto-calculated below.
        </p>
      </div>

      <div className="text-sm text-gray-600 dark:text-gray-400 text-center">
        — OR —
      </div>

      {/* Manual Coordinate Input */}
      <div className="space-y-4">
        <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Manual Coordinates
        </Label>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="topLeftLat" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Top Left Latitude
            </Label>
            <Input
              id="topLeftLat"
              type="number"
              step="any"
              value={coordinates.topLeftLat}
              onChange={(e) => handleCoordinateChange('topLeftLat', e.target.value)}
              className="font-mono text-sm"
              disabled={!!polygonInput.trim()}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="topLeftLng" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Top Left Longitude
            </Label>
            <Input
              id="topLeftLng"
              type="number"
              step="any"
              value={coordinates.topLeftLng}
              onChange={(e) => handleCoordinateChange('topLeftLng', e.target.value)}
              className="font-mono text-sm"
              disabled={!!polygonInput.trim()}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bottomRightLat" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Bottom Right Latitude
            </Label>
            <Input
              id="bottomRightLat"
              type="number"
              step="any"
              value={coordinates.bottomRightLat}
              onChange={(e) => handleCoordinateChange('bottomRightLat', e.target.value)}
              className="font-mono text-sm"
              disabled={!!polygonInput.trim()}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bottomRightLng" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Bottom Right Longitude
            </Label>
            <Input
              id="bottomRightLng"
              type="number"
              step="any"
              value={coordinates.bottomRightLng}
              onChange={(e) => handleCoordinateChange('bottomRightLng', e.target.value)}
              className="font-mono text-sm"
              disabled={!!polygonInput.trim()}
            />
          </div>
        </div>
      </div>

      {/* Zoom Level */}
      <div className="space-y-2">
        <Label htmlFor="zoomLevel" className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Zoom Level
        </Label>
        <Select value={zoomLevel} onValueChange={handleZoomChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select zoom level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="16">16 - Harbor Overview</SelectItem>
            <SelectItem value="17">17 - Marina Detail</SelectItem>
            <SelectItem value="18">18 - Slip Detail</SelectItem>
            <SelectItem value="19">19 - Vessel Detail</SelectItem>
            <SelectItem value="20">20 - Maximum Detail</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Error Messages */}
      {(error || validationError) && (
        <Alert variant="destructive">
          <AlertDescription>{error || validationError}</AlertDescription>
        </Alert>
      )}

      {/* Action Buttons */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <Button
            onClick={() => handleLoadMaps(false)}
            disabled={isAnalyzing && analysisStatus !== "maps_loaded"}
            className="flex-1"
            variant={analysisStatus === "maps_loaded" ? "outline" : "default"}
          >
            {isAnalyzing && analysisStatus === "loading_maps" ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Loading Maps...
              </>
            ) : analysisStatus === "maps_loaded" ? (
              <>
                <MapPin className="w-4 h-4 mr-2" />
                Maps Loaded ✓
              </>
            ) : (
              <>
                <MapPin className="w-4 h-4 mr-2" />
                Load Maps
              </>
            )}
          </Button>
          
          <Button
            onClick={() => handleLoadMaps(true)}
            disabled={isAnalyzing && analysisStatus !== "maps_loaded"}
            variant="outline"
            className="px-3"
            title="Force refresh maps (bypass cache)"
          >
            ↻
          </Button>
        </div>

        <div className="space-y-2">
          <Button
            onClick={onRunDetection}
            disabled={analysisStatus !== "maps_loaded" || isAnalyzing}
            className="w-full"
            variant={analysisStatus === "completed" ? "outline" : "default"}
          >
            {isAnalyzing && analysisStatus === "processing" ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Detecting Objects...
              </>
            ) : analysisStatus === "completed" ? (
              <>
                <Zap className="w-4 h-4 mr-2" />
                Current Image Complete ✓
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 mr-2" />
                Run Object Detection on Current Image
              </>
            )}
          </Button>
          
          <Button
            onClick={onRunDetectionAll}
            disabled={analysisStatus !== "maps_loaded" || isAnalyzing}
            className="w-full"
            variant="outline"
          >
            {isAnalyzing && analysisStatus === "processing" ? (
              <>
                <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin mr-2" />
                Processing All Images...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 mr-2" />
                Run Object Detection on All Images
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}