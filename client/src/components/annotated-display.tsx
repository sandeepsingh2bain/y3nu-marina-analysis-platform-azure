import { useState } from "react";

interface AnnotatedDisplayProps {
  mapImageUrl?: string;
  annotatedImageUrls?: string[];
  detections: any[];
  isAnalyzing: boolean;
  analysisStatus?: string;
}

export default function AnnotatedDisplay({
  mapImageUrl,
  annotatedImageUrls,
  detections,
  isAnalyzing,
  analysisStatus,
}: AnnotatedDisplayProps) {
  const [imageLoadError, setImageLoadError] = useState(false);

  // Use annotated image if available, otherwise use map image
  const displayImageUrl = annotatedImageUrls && annotatedImageUrls.length > 0 
    ? annotatedImageUrls[0] 
    : mapImageUrl;

  const handleImageError = () => {
    setImageLoadError(true);
  };

  const handleImageLoad = () => {
    setImageLoadError(false);
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

  return (
    <div className="flex-1 bg-gray-100 relative">
      {displayImageUrl ? (
        <div className="w-full h-full relative">
          <img
            src={displayImageUrl}
            alt="Boat Detection Analysis"
            className="w-full h-full object-contain bg-gray-900"
            onError={handleImageError}
            onLoad={handleImageLoad}
          />
          
          {/* Detection overlay info */}
          <div className="absolute top-4 left-4 bg-black bg-opacity-75 text-white p-3 rounded-lg">
            <div className="text-sm font-medium">
              Boats Detected: {detections.length}
            </div>
            {annotatedImageUrls && annotatedImageUrls.length > 0 && (
              <div className="text-xs text-green-400 mt-1">
                Annotated Output
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="absolute top-4 right-4 bg-black bg-opacity-75 text-white p-3 rounded-lg">
            <div className="text-sm font-medium mb-2">Boat Categories</div>
            <div className="space-y-1 text-xs">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-green-400 rounded mr-2"></div>
                Small (&lt;12m)
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-blue-400 rounded mr-2"></div>
                Medium (12-20m)
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-purple-400 rounded mr-2"></div>
                Large (&gt;20m)
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center">
          <div className="text-center text-gray-600">
            <div className="text-lg font-medium">No boat detection data available</div>
            <div className="text-sm">Load satellite maps and run analysis to see results</div>
          </div>
        </div>
      )}

      {imageLoadError && (
        <div className="absolute inset-0 bg-red-50 flex items-center justify-center">
          <div className="text-center text-red-600">
            <div className="text-lg font-medium">Failed to load image</div>
            <div className="text-sm">The detection image could not be loaded</div>
          </div>
        </div>
      )}
    </div>
  );
}