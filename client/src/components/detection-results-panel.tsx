import { Download, Ship } from "lucide-react";

interface DetectionResultsPanelProps {
  detections: any[];
  onExport: () => void;
  stats?: {
    totalVessels: number;
    vesselTypes: {
      small: number;
      medium: number;
      large: number;
    };
    avgConfidence: number;
    processingTime: string;
    tileCount: number;
  };
}

export default function DetectionResultsPanel({ 
  detections, 
  onExport, 
  stats 
}: DetectionResultsPanelProps) {
  const getTypeColor = (subType?: string | null) => {
    switch (subType) {
      case "small":
        return "bg-green-100 text-green-800";
      case "medium":
        return "bg-blue-100 text-blue-800";
      case "large":
        return "bg-purple-100 text-purple-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getTypeIcon = (subType?: string | null) => {
    switch (subType) {
      case "small":
        return "🚤";
      case "medium":
        return "🚢";
      case "large":
        return "🛥️";
      default:
        return "⛵";
    }
  };

  return (
    <div className="w-80 bg-white border-l border-gray-200 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <Ship className="w-5 h-5 mr-2 text-blue-600" />
            Detection Results
          </h3>
          <button
            onClick={onExport}
            disabled={!detections || detections.length === 0}
            className="flex items-center px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4 mr-1" />
            Export
          </button>
        </div>
      </div>

      {/* Stats Summary */}
      {stats && (
        <div className="p-4 bg-gray-50 border-b border-gray-100">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.totalVessels}</div>
              <div className="text-xs text-gray-500">Total Boats</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{stats.avgConfidence}%</div>
              <div className="text-xs text-gray-500">Avg Confidence</div>
            </div>
          </div>
          
          <div className="mt-3 space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-gray-600">Small (&lt;12m):</span>
              <span className="font-medium">{stats.vesselTypes.small}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-600">Medium (12-20m):</span>
              <span className="font-medium">{stats.vesselTypes.medium}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-600">Large (&gt;20m):</span>
              <span className="font-medium">{stats.vesselTypes.large}</span>
            </div>
          </div>
        </div>
      )}

      {/* Detection List */}
      <div className="flex-1 overflow-auto">
        {detections && detections.length > 0 ? (
          <div className="p-2 space-y-2">
            {detections.map((detection, index) => (
              <div
                key={detection.id || index}
                className="bg-white border border-gray-200 rounded-lg p-3 hover:shadow-sm transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">{getTypeIcon(detection.subType)}</span>
                    <div>
                      <div className="font-medium text-sm text-gray-900">
                        {detection.objectId}
                      </div>
                      <div className="text-xs text-gray-500">
                        {detection.length}m × {detection.width}m
                      </div>
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(detection.subType)}`}>
                    {detection.subType}
                  </span>
                </div>
                
                <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                  <span>Confidence: {detection.confidence}%</span>
                  <span>{detection.status}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center text-gray-500">
              <Ship className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <div className="text-sm font-medium">No boats detected</div>
              <div className="text-xs">Run analysis to see results</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}