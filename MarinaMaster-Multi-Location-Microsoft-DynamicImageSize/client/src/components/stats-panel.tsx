import { Ship, Square, PieChart } from "lucide-react";

interface StatsPanelProps {
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

export default function StatsPanel({ stats }: StatsPanelProps) {
  if (!stats) {
    return (
      <aside className="w-72 bg-white border-l border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">Analysis Summary</h2>
        <div className="text-center text-gray-500 mt-8">
          <p>No analysis data available</p>
          <p className="text-sm">Run an analysis to see statistics</p>
        </div>
      </aside>
    );
  }

  const totalBoats = stats.totalVessels;
  const sizeDistribution = [
    { 
      label: "Small (<12m)", 
      percentage: totalBoats > 0 ? Math.round((stats.vesselTypes.small / totalBoats) * 100) : 0,
      color: "bg-green-400"
    },
    { 
      label: "Medium (12-20m)", 
      percentage: totalBoats > 0 ? Math.round((stats.vesselTypes.medium / totalBoats) * 100) : 0,
      color: "bg-blue-400"
    },
    { 
      label: "Large (>20m)", 
      percentage: totalBoats > 0 ? Math.round((stats.vesselTypes.large / totalBoats) * 100) : 0,
      color: "bg-purple-400"
    },
  ];

  return (
    <aside className="w-72 bg-white border-l border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-6">Analysis Summary</h2>
      
      {/* Key Metrics */}
      <div className="space-y-4 mb-8">
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-600 font-medium">Total Vessels</p>
              <p className="text-2xl font-bold text-blue-700">{stats.totalVessels}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Ship className="text-blue-600 text-xl" />
            </div>
          </div>
        </div>

        <div className="bg-green-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-600 font-medium">Avg Confidence</p>
              <p className="text-2xl font-bold text-green-600">{stats.avgConfidence}%</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <PieChart className="text-green-600 text-xl" />
            </div>
          </div>
        </div>
      </div>

      {/* Vessel Types Breakdown */}
      <div className="mb-8">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Vessel Types</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-3 h-3 bg-green-400 rounded-full mr-3"></div>
              <span className="text-sm text-gray-600">Small (&lt;12m)</span>
            </div>
            <span className="text-sm font-semibold text-gray-900">{stats.vesselTypes.small}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-3 h-3 bg-blue-400 rounded-full mr-3"></div>
              <span className="text-sm text-gray-600">Medium (12-20m)</span>
            </div>
            <span className="text-sm font-semibold text-gray-900">{stats.vesselTypes.medium}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-3 h-3 bg-purple-400 rounded-full mr-3"></div>
              <span className="text-sm text-gray-600">Large (&gt;20m)</span>
            </div>
            <span className="text-sm font-semibold text-gray-900">{stats.vesselTypes.large}</span>
          </div>
        </div>
      </div>

      {/* Size Distribution */}
      <div className="mb-8">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Size Distribution</h3>
        <div className="space-y-2">
          {sizeDistribution.map((item, index) => (
            <div key={index}>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600">{item.label}</span>
                <span className="font-semibold">{item.percentage}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-400 h-2 rounded-full transition-all duration-300" 
                  style={{width: `${item.percentage}%`}}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Analysis Quality */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Analysis Quality</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Avg. Confidence</span>
            <span className="text-sm font-semibold text-gray-900">{stats.avgConfidence}%</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Processing Time</span>
            <span className="text-sm font-semibold text-gray-900">{stats.processingTime}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Tiles Processed</span>
            <span className="text-sm font-semibold text-gray-900">{stats.tileCount}</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
