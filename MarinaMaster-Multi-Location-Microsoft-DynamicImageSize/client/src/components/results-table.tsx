import { useState } from "react";
import { Download, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { Detection } from "@shared/schema";

interface ResultsTableProps {
  detections: Detection[];
  onExport: () => void;
}

export default function ResultsTable({ detections, onExport }: ResultsTableProps) {
  const [selectedRow, setSelectedRow] = useState<string | null>(null);

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

  const formatCoordinates = (lat: number, lng: number) => {
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  };

  const formatDimensions = (length: number, width: number) => {
    return `${length} × ${width}m`;
  };

  return (
    <div className="h-80 bg-white border-t border-gray-200">
      <div className="h-full flex flex-col">
        {/* Results Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center space-x-4">
            <h3 className="text-lg font-semibold text-gray-900">Detection Results</h3>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-500">Total Objects:</span>
              <span className="font-semibold text-blue-600">{detections.length}</span>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm">
              <Filter className="w-4 h-4 mr-2" />
              Filter
            </Button>
            <Button onClick={onExport} size="sm" disabled={detections.length === 0}>
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* Results Table */}
        <div className="flex-1 overflow-auto">
          {detections.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              <div className="text-center">
                <p className="text-lg font-medium">No detections available</p>
                <p className="text-sm">Run an analysis to see results</p>
              </div>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Object ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Coordinates
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Dimensions
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Area (m²)
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Confidence
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {detections.map((detection) => (
                  <tr
                    key={detection.objectId}
                    className={`hover:bg-gray-50 cursor-pointer transition-colors ${
                      selectedRow === detection.objectId ? 'bg-blue-50' : ''
                    }`}
                    onClick={() => setSelectedRow(detection.objectId)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                      {detection.objectId}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge className={getTypeColor(detection.subType)}>
                        <span className="mr-1">{getTypeIcon(detection.subType)}</span>
                        {detection.subType || "boat"}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500">
                      {formatCoordinates(detection.lat, detection.lng)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                      {formatDimensions(detection.length, detection.width)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                      {detection.area}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {detection.status || "Unknown"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Progress value={detection.confidence} className="w-12 mr-2" />
                        <span className="text-sm font-mono text-gray-600">
                          {detection.confidence}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
