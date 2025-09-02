import { useState, useRef, useEffect } from "react";
import { ZoomIn, ZoomOut, Maximize2, ChevronLeft, ChevronRight, Database, Wifi, Grid3X3, Image } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Detection } from "@shared/schema";

interface MapDisplayProps {
  detections: Detection[];
  isAnalyzing: boolean;
  analysisStatus?: string;
  showBoats: boolean;
  showEmptySlips: boolean;
  showOccupiedSlips: boolean;
  mapImageUrl?: string;
  tileUrls?: string[];
  stats?: any;
  wasFromCache?: boolean;
}

export default function MapDisplay({
  detections,
  isAnalyzing,
  analysisStatus,
  showBoats,
  showEmptySlips,
  showOccupiedSlips,
  mapImageUrl,
  tileUrls,
  stats,
  wasFromCache
}: MapDisplayProps) {
  const [selectedDetection, setSelectedDetection] = useState<string | null>(null);
  const [currentTileIndex, setCurrentTileIndex] = useState(0);
  const [imageLoadError, setImageLoadError] = useState(false);
  const [showGridView, setShowGridView] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);

  const filteredDetections = detections.filter(detection => {
    if (detection.objectType === "boat" && !showBoats) return false;
    if (detection.objectType === "empty-slip" && !showEmptySlips) return false;
    if (detection.objectType === "occupied-slip" && !showOccupiedSlips) return false;
    return true;
  });

  const getDetectionColor = (detection: Detection) => {
    // All detections are boats with different size categories
    switch (detection.subType) {
      case "small":
        return "border-green-400 bg-green-400";
      case "medium":
        return "border-blue-400 bg-blue-400";
      case "large":
        return "border-purple-400 bg-purple-400";
      default:
        return "border-gray-400 bg-gray-400";
    }
  };

  const getDetectionLabel = (detection: Detection) => {
    const typeLabel = detection.subType || detection.objectType;
    return `${typeLabel} ${detection.length}m`;
  };

  const handleDetectionClick = (detectionId: string) => {
    setSelectedDetection(detectionId === selectedDetection ? null : detectionId);
  };

  const handlePrevTile = () => {
    if (tileUrls && currentTileIndex > 0) {
      setCurrentTileIndex(currentTileIndex - 1);
      setImageLoadError(false);
    }
  };

  const handleNextTile = () => {
    if (tileUrls && currentTileIndex < tileUrls.length - 1) {
      setCurrentTileIndex(currentTileIndex + 1);
      setImageLoadError(false);
    }
  };

  const handleImageError = () => {
    setImageLoadError(true);
  };

  const handleImageLoad = () => {
    setImageLoadError(false);
  };

  // Extract lat/lng from Google Static Maps URL
  const extractCoordinatesFromUrl = (url: string) => {
    const centerMatch = url.match(/center=([^&]+)/);
    if (centerMatch) {
      const [lat, lng] = centerMatch[1].split(',').map(coord => parseFloat(coord));
      return { lat, lng };
    }
    return null;
  };

  // Reset tile index when new tiles are loaded
  useEffect(() => {
    setCurrentTileIndex(0);
    setImageLoadError(false);
    // Auto-enable grid view for multiple tiles
    if (tileUrls && tileUrls.length > 1) {
      setShowGridView(true);
    }
  }, [tileUrls]);

  // Determine which image to display
  const displayImageUrl = tileUrls && tileUrls.length > 0 
    ? tileUrls[currentTileIndex] 
    : mapImageUrl;
  const displayImages = tileUrls || [];

  return (
    <div className="flex-1 relative">
      {/* Map Container */}
      <div 
        ref={mapRef}
        className="absolute inset-0 bg-gray-100"
      >
        {/* Grid View - Show all tiles */}
        {showGridView && tileUrls && tileUrls.length > 1 ? (
          <div className="w-full h-full grid gap-1 p-2">
            {(() => {
              const tileCount = tileUrls.length;
              const cols = Math.ceil(Math.sqrt(tileCount));
              const rows = Math.ceil(tileCount / cols);

              return (
                <div 
                  className="grid gap-1 h-full"
                  style={{ 
                    gridTemplateColumns: `repeat(${cols}, 1fr)`,
                    gridTemplateRows: `repeat(${rows}, 1fr)`
                  }}
                >
                  {tileUrls.map((tileUrl, index) => {
                    const coords = extractCoordinatesFromUrl(tileUrl);
                    return (
                      <div key={index} className="relative bg-gray-200 rounded overflow-hidden">
                        <img
                          src={tileUrl}
                          alt={`Satellite tile ${index + 1}`}
                          className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => {
                            setCurrentTileIndex(index);
                            setShowGridView(false);
                          }}
                          onError={() => setImageLoadError(true)}
                        />
                        {/* Tile coordinate overlay */}
                        <div className="absolute top-1 left-1 bg-black bg-opacity-75 text-white text-xs px-1.5 py-0.5 rounded font-mono">
                          <div className="text-yellow-300 font-semibold">#{index + 1}</div>
                          {coords && (
                            <>
                              <div>{coords.lat.toFixed(4)}</div>
                              <div>{coords.lng.toFixed(4)}</div>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        ) : (
          /* Single Tile View */
          <>
            {displayImageUrl ? (
              <img
                src={mapImageUrl || (displayImages.length > 0 ? displayImages[currentTileIndex] : "/placeholder-map.jpg")}
                alt={""}
                className="w-full h-full object-cover"
                onError={handleImageError}
                onLoad={handleImageLoad}
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center">
                <div className="text-center text-gray-600">
                  <div className="text-lg font-medium">No map data available</div>
                  <div className="text-sm">Load satellite maps to begin analysis</div>
                </div>
              </div>
            )}

            {imageLoadError && (
              <div className="absolute inset-0 bg-red-50 flex items-center justify-center">
                <div className="text-center text-red-600">
                  <div className="text-lg font-medium">Failed to load image</div>
                  <div className="text-sm">The satellite image could not be loaded</div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Single tile coordinate display */}
        {!showGridView && tileUrls && tileUrls.length === 1 && (
          <div className="absolute top-4 left-4 bg-black bg-opacity-70 text-white text-sm px-3 py-2 rounded font-mono border border-white border-opacity-30 pointer-events-none">
            {(() => {
              const coords = extractCoordinatesFromUrl(tileUrls[0]);
              return coords ? (
                <>
                  <div className="text-yellow-300 font-semibold">Tile Center</div>
                  <div>Lat: {coords.lat.toFixed(6)}</div>
                  <div>Lng: {coords.lng.toFixed(6)}</div>
                </>
              ) : (
                <div>Coordinates unavailable</div>
              );
            })()}
          </div>
        )}

        {/* Current tile coordinate display for single tile view */}
        {!showGridView && tileUrls && tileUrls.length > 1 && (
          <div className="absolute top-4 left-4 bg-blue-600 bg-opacity-90 text-white text-sm px-3 py-2 rounded font-mono border border-white border-opacity-30 pointer-events-none">
            {(() => {
              const coords = extractCoordinatesFromUrl(tileUrls[currentTileIndex]);
              return coords ? (
                <>
                  <div className="text-yellow-300 font-semibold">Tile {currentTileIndex + 1}/{tileUrls.length}</div>
                  <div>Lat: {coords.lat.toFixed(6)}</div>
                  <div>Lng: {coords.lng.toFixed(6)}</div>
                </>
              ) : (
                <div>Coordinates unavailable</div>
              );
            })()}
          </div>
        )}

        {/* Detection Overlays */}
        <div className="absolute inset-0">
          {filteredDetections.map((detection) => {
            const bbox = detection.boundingBox as any;
            const isSelected = selectedDetection === detection.objectId;

            return (
              <div
                key={detection.objectId}
                className={`absolute border-2 bg-opacity-20 cursor-pointer transition-all duration-200 ${
                  getDetectionColor(detection)
                } ${isSelected ? 'ring-4 ring-yellow-400' : ''}`}
                style={{
                  top: `${(bbox.y || 0) / 640 * 100}%`,
                  left: `${(bbox.x || 0) / 640 * 100}%`,
                  width: `${Math.max(bbox.width || 20, 20)}px`,
                  height: `${Math.max(bbox.height || 15, 15)}px`,
                }}
                onClick={() => handleDetectionClick(detection.objectId)}
              >
                <div className={`absolute -top-6 left-0 text-white text-xs px-2 py-1 rounded whitespace-nowrap ${
                  detection.objectType === "boat" ? "bg-green-600" :
                  detection.objectType === "empty-slip" ? "bg-red-600" : "bg-blue-600"
                }`}>
                  {getDetectionLabel(detection)}
                </div>
              </div>
            );
          })}
        </div>

        {/* Cache Indicator */}
        {mapImageUrl && (
          <div className="absolute top-4 left-4">
            <Badge 
              variant={wasFromCache ? "secondary" : "default"} 
              className="bg-white bg-opacity-95 backdrop-blur-sm shadow-lg"
            >
              {wasFromCache ? (
                <>
                  <Database className="w-3 h-3 mr-1" />
                  Cached
                </>
              ) : (
                <>
                  <Wifi className="w-3 h-3 mr-1" />
                  Fresh
                </>
              )}
            </Badge>
          </div>
        )}

        {/* Tile Navigation */}
        {tileUrls && tileUrls.length > 1 && (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
            <div className="bg-white bg-opacity-95 backdrop-blur-sm rounded-lg p-2 shadow-lg flex items-center space-x-2">
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-8 h-8 p-0"
                disabled={displayImages.length <= 1 || currentTileIndex === 0}
                onClick={() => setCurrentTileIndex(prev => Math.max(0, prev - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              {displayImages.length > 1 && (
                <span className="text-sm font-medium px-2">
                  {currentTileIndex + 1} / {displayImages.length}
                </span>
              )}

              <Button 
                variant="ghost" 
                size="sm" 
                className="w-8 h-8 p-0"
                disabled={displayImages.length <= 1 || currentTileIndex >= displayImages.length - 1}
                onClick={() => setCurrentTileIndex(prev => Math.min(displayImages.length - 1, prev + 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Map Controls */}
        <div className="absolute top-4 right-4 flex flex-col space-y-2">
          {/* View Toggle Controls */}
          {tileUrls && tileUrls.length > 1 && (
            <div className="bg-white bg-opacity-95 backdrop-blur-sm rounded-lg p-2 shadow-lg">
              <Button 
                variant={showGridView ? "default" : "ghost"} 
                size="sm" 
                className="w-10 h-10 p-0"
                onClick={() => setShowGridView(true)}
                title="Grid View - Show all tiles"
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
              <Button 
                variant={!showGridView ? "default" : "ghost"} 
                size="sm" 
                className="w-10 h-10 p-0"
                onClick={() => setShowGridView(false)}
                title="Single View - Navigate tiles one by one"
              >
                <Image className="h-4 w-4" />
              </Button>
            </div>
          )}

          <div className="bg-white bg-opacity-95 backdrop-blur-sm rounded-lg p-2 shadow-lg">
            <Button variant="ghost" size="sm" className="w-10 h-10 p-0">
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="w-10 h-10 p-0">
              <ZoomOut className="h-4 w-4" />
            </Button>
          </div>
          <div className="bg-white bg-opacity-95 backdrop-blur-sm rounded-lg p-2 shadow-lg">
            <Button variant="ghost" size="sm" className="w-10 h-10 p-0">
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Loading Overlay */}
        {isAnalyzing && (
          <div className="absolute inset-0 bg-white bg-opacity-90 flex items-center justify-center">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
              {analysisStatus === "loading_maps" ? (
                <>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Loading Satellite Maps...</h3>
                  <p className="text-sm text-gray-600">Fetching high-resolution imagery from Google Static Maps</p>
                  <div className="mt-4 w-64 bg-gray-200 rounded-full h-2">
                    <div className="bg-blue-500 h-2 rounded-full transition-all duration-500 animate-pulse" style={{width: "35%"}}></div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Step 1 of 2: Map Loading</p>
                </>
              ) : analysisStatus === "processing" ? (
                <>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Analyzing Marina...</h3>
                  <p className="text-sm text-gray-600">Processing satellite imagery and detecting vessels</p>
                  <div className="mt-4 w-64 bg-gray-200 rounded-full h-2">
                    <div className="bg-blue-500 h-2 rounded-full transition-all duration-500 animate-pulse" style={{width: "75%"}}></div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Step 2 of 2: Object Detection</p>
                </>
              ) : (
                <>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Processing...</h3>
                  <p className="text-sm text-gray-600">Please wait while we process your request</p>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-400 rounded"></div>
              <span className="text-sm text-gray-600">
                Boats: <span className="font-medium">{stats?.totalVessels || 0}</span>
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-red-400 rounded"></div>
              <span className="text-sm text-gray-600">
                Empty Slips: <span className="font-medium">{stats?.emptySlips || 0}</span>
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-blue-400 rounded"></div>
              <span className="text-sm text-gray-600">
                Occupied Slips: <span className="font-medium">{stats?.occupiedSlips || 0}</span>
              </span>
            </div>
          </div>
          <div className="text-sm text-gray-500">
            <span className="font-mono">
              Last updated: {new Date().toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}