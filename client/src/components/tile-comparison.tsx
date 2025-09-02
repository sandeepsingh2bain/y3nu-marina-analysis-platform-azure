import { useState } from "react";
import { ChevronLeft, ChevronRight, ZoomIn } from "lucide-react";

interface TileComparisonProps {
  tileUrls?: string[];
  annotatedImageUrls?: string[];
  detections: any[];
  isAnalyzing: boolean;
  analysisStatus?: string;
  showBoats?: boolean;
}

export default function TileComparison({
  tileUrls,
  annotatedImageUrls,
  detections,
  isAnalyzing,
  analysisStatus,
  showBoats = true,
}: TileComparisonProps) {
  const [selectedTileIndex, setSelectedTileIndex] = useState(0);
  const [imageLoadErrors, setImageLoadErrors] = useState<{[key: string]: boolean}>({});

  const handleImageError = (imageType: string, index: number) => {
    setImageLoadErrors(prev => ({
      ...prev,
      [`${imageType}_${index}`]: true
    }));
  };

  const handleImageLoad = (imageType: string, index: number) => {
    setImageLoadErrors(prev => ({
      ...prev,
      [`${imageType}_${index}`]: false
    }));
  };

  if (isAnalyzing) {
    return (
      <div className="flex-1 bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-lg font-medium text-gray-700">
            {analysisStatus || "Processing boat detection..."}
          </p>
        </div>
      </div>
    );
  }

  if (!tileUrls || tileUrls.length === 0) {
    return (
      <div className="flex-1 bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center">
        <div className="text-center text-gray-600">
          <div className="text-lg font-medium">No satellite imagery available</div>
          <div className="text-sm">Load satellite maps to see tile comparison</div>
        </div>
      </div>
    );
  }

  const hasAnnotatedImages = annotatedImageUrls && annotatedImageUrls.length > 0;
  const currentTileUrl = tileUrls[selectedTileIndex];
  const currentAnnotatedUrl = hasAnnotatedImages ? annotatedImageUrls[0] : null; // Use first annotated image

  return (
    <div className="flex-1 flex flex-col bg-gray-50">
      {/* Tile Navigation */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Satellite Imagery Analysis
            </h3>
            <span className="text-sm text-gray-500">
              Tile {selectedTileIndex + 1} of {tileUrls.length}
            </span>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setSelectedTileIndex(Math.max(0, selectedTileIndex - 1))}
              disabled={selectedTileIndex === 0}
              className="p-2 rounded-md border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setSelectedTileIndex(Math.min(tileUrls.length - 1, selectedTileIndex + 1))}
              disabled={selectedTileIndex === tileUrls.length - 1}
              className="p-2 rounded-md border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Side by Side Image Comparison */}
      <div className="flex-1 flex">
        {/* Original Tile */}
        <div className="flex-1 p-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
              <h4 className="text-sm font-medium text-gray-700">Original Satellite Tile</h4>
            </div>
            <div className="aspect-square relative">
              {imageLoadErrors[`original_${selectedTileIndex}`] ? (
                <div className="w-full h-full bg-red-50 flex items-center justify-center">
                  <div className="text-center text-red-600">
                    <div className="text-sm font-medium">Failed to load image</div>
                    <div className="text-xs">Satellite tile unavailable</div>
                  </div>
                </div>
              ) : (
                <>
                  <img
                    src={currentTileUrl}
                    alt={`Satellite tile ${selectedTileIndex + 1}`}
                    className="w-full h-full object-cover"
                    onError={() => handleImageError('original', selectedTileIndex)}
                    onLoad={() => handleImageLoad('original', selectedTileIndex)}
                  />
                  {/* Detection Overlays */}
                  {showBoats && detections.length > 0 && (
                    <div className="absolute inset-0">
                      {detections.map((detection) => {
                        const bbox = detection.boundingBox as any;
                        return (
                          <div
                            key={detection.objectId}
                            className="absolute border-2 border-green-500 bg-green-500 bg-opacity-20 cursor-pointer transition-all duration-200"
                            style={{
                              top: `${(bbox.y || 0) / 640 * 100}%`,
                              left: `${(bbox.x || 0) / 640 * 100}%`,
                              width: `${Math.max(bbox.width || 20, 20)}px`,
                              height: `${Math.max(bbox.height || 15, 15)}px`,
                            }}
                          >
                            <div className="absolute -top-6 left-0 bg-green-600 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                              {detection.objectId} ({detection.confidence}%)
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Annotated Tile */}
        <div className="flex-1 p-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex items-center justify-between">
              <h4 className="text-sm font-medium text-gray-700">Boat Detection Results</h4>
              {hasAnnotatedImages && (
                <div className="flex items-center text-xs text-green-600">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
                  AI Analysis Complete
                </div>
              )}
            </div>
            <div className="aspect-square relative">
              {currentAnnotatedUrl && !imageLoadErrors[`annotated_0`] ? (
                <img
                  src={currentAnnotatedUrl}
                  alt="Boat detection results"
                  className="w-full h-full object-cover"
                  onError={() => handleImageError('annotated', 0)}
                  onLoad={() => handleImageLoad('annotated', 0)}
                />
              ) : (
                <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                  <div className="text-center text-gray-500">
                    {hasAnnotatedImages ? (
                      <div>
                        <div className="text-sm font-medium">Loading detection results...</div>
                        <div className="text-xs">Processing annotated imagery</div>
                      </div>
                    ) : (
                      <div>
                        <ZoomIn className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                        <div className="text-sm font-medium">No detection results</div>
                        <div className="text-xs">Run boat analysis to see results</div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tile Thumbnails Scrollable List */}
      <div className="bg-white border-t border-gray-200 p-4">
        <div className="flex items-center space-x-2 mb-2">
          <h4 className="text-sm font-medium text-gray-700">All Tiles</h4>
          <span className="text-xs text-gray-500">({tileUrls.length} total)</span>
        </div>
        <div className="flex space-x-3 overflow-x-auto pb-2">
          {tileUrls.map((tileUrl, index) => (
            <button
              key={index}
              onClick={() => setSelectedTileIndex(index)}
              className={`flex-shrink-0 w-20 h-20 rounded-md border-2 overflow-hidden transition-all ${
                selectedTileIndex === index
                  ? 'border-blue-500 shadow-md'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <img
                src={tileUrl}
                alt={`Tile ${index + 1}`}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs font-medium text-white bg-black bg-opacity-50 px-1 rounded">
                  {index + 1}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}