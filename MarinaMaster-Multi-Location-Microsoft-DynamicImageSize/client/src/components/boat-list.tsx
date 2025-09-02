import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Download, MapPin, Ruler, Gauge } from "lucide-react";

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

interface BoatListProps {
  detections: Detection[];
  onExportCSV: () => void;
}

export default function BoatList({ detections, onExportCSV }: BoatListProps) {
  if (detections.length === 0) {
    return null;
  }

  const getTypeColor = (subType: string) => {
    switch (subType) {
      case 'small': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'large': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  const formatCoordinate = (coord: number) => {
    return coord.toPrecision(15);
  };

  const exportBoatData = () => {
    const csvContent = [
      ['Boat ID', 'Type', 'Latitude', 'Longitude', 'Length (m)', 'Width (m)', 'Area (m²)', 'Confidence (%)', 'Tile Index'].join(','),
      ...detections.map(boat => [
        boat.objectId,
        boat.subType,
        boat.lat.toPrecision(15),
        boat.lng.toPrecision(15),
        boat.length,
        boat.width,
        boat.area,
        boat.confidence,
        boat.tileIndex || 0
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `boat-detections-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="w-full mt-6">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-lg font-semibold">
          Detected Boats ({detections.length})
        </CardTitle>
        <Button 
          onClick={exportBoatData}
          variant="outline" 
          size="sm"
          className="flex items-center gap-2"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-96 w-full">
          <div className="space-y-3">
            {detections.map((boat) => (
              <div 
                key={boat.objectId} 
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-medium">{boat.objectId}</span>
                    <Badge className={`text-xs ${getTypeColor(boat.subType)}`}>
                      {boat.subType}
                    </Badge>
                    {boat.tileIndex !== undefined && (
                      <Badge variant="outline" className="text-xs">
                        Tile {boat.tileIndex + 1}
                      </Badge>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                    <div className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      <span className="font-mono">
                        {formatCoordinate(boat.lat)}, {formatCoordinate(boat.lng)}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <Ruler className="h-3 w-3" />
                      <span>{boat.length}m × {boat.width}m</span>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <Gauge className="h-3 w-3" />
                      <span>{boat.confidence}%</span>
                    </div>
                  </div>

                  {boat.geoPolygon && (
                    <details className="mt-2">
                      <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300">
                        Geographic Polygon
                      </summary>
                      <div className="mt-1 text-xs font-mono text-gray-500 dark:text-gray-400 pl-2">
                        <div>TL: {boat.geoPolygon.topLeft.lat.toPrecision(15)}, {boat.geoPolygon.topLeft.lng.toPrecision(15)}</div>
                        <div>TR: {boat.geoPolygon.topRight.lat.toPrecision(15)}, {boat.geoPolygon.topRight.lng.toPrecision(15)}</div>
                        <div>BL: {boat.geoPolygon.bottomLeft.lat.toPrecision(15)}, {boat.geoPolygon.bottomLeft.lng.toPrecision(15)}</div>
                        <div>BR: {boat.geoPolygon.bottomRight.lat.toPrecision(15)}, {boat.geoPolygon.bottomRight.lng.toPrecision(15)}</div>
                      </div>
                    </details>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}