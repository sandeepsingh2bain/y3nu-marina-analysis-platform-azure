import { useState } from "react";
import { Anchor, Settings, HelpCircle, User } from "lucide-react";
import CoordinateInput from "@/components/coordinate-input";
import TileComparison from "@/components/tile-comparison";
import DetectionResultsPanel from "@/components/detection-results-panel";
import { useMarinaAnalysis } from "@/hooks/use-marina-analysis";

export default function MarinaAnalysis() {
  const {
    analysisData,
    isAnalyzing,
    loadMaps,
    runObjectDetection,
    runObjectDetectionAll,
    exportToCsv,
    loadSampleCoordinates,
    error
  } = useMarinaAnalysis();

  const [showBoats, setShowBoats] = useState(true);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                <Anchor className="text-white text-lg" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Marina Analysis</h1>
                <p className="text-xs text-gray-500">Vessel Detection Platform</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button className="text-gray-500 hover:text-gray-700 transition-colors">
                <Settings className="text-lg" />
              </button>
              <button className="text-gray-500 hover:text-gray-700 transition-colors">
                <HelpCircle className="text-lg" />
              </button>
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <User className="text-blue-600 text-sm" />
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-4rem)]">
        {/* Sidebar */}
        <aside className="w-80 bg-white shadow-lg border-r border-gray-200 flex flex-col">
          <CoordinateInput
            onLoadMaps={loadMaps}
            onRunDetection={runObjectDetection}
            onRunDetectionAll={runObjectDetectionAll}
            onLoadSample={loadSampleCoordinates}
            isAnalyzing={isAnalyzing}
            analysisStatus={analysisData?.status}
            error={error || undefined}
          />



          {/* Quick Actions */}
          <div className="p-6 flex-1">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Quick Actions</h3>
            <div className="space-y-2">
              <button
                onClick={exportToCsv}
                disabled={!analysisData}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <i className="fas fa-download text-gray-400 mr-3"></i>
                Export CSV
              </button>
              <button
                onClick={loadSampleCoordinates}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-md transition-colors"
              >
                <i className="fas fa-map text-gray-400 mr-3"></i>
                Load Sample Marina
              </button>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex">
          <TileComparison
            tileUrls={analysisData?.tileUrls}
            annotatedImageUrls={analysisData?.annotatedImageUrls}
            detections={analysisData?.detections || []}
            isAnalyzing={isAnalyzing}
            analysisStatus={analysisData?.status}
            showBoats={showBoats}
          />

          <DetectionResultsPanel
            detections={analysisData?.detections || []}
            onExport={exportToCsv}
            stats={analysisData?.stats}
          />
        </main>
      </div>
    </div>
  );
}
