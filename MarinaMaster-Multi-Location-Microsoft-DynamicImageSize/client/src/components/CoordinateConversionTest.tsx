import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Calculator, Target } from "lucide-react";

interface CoordinateConversionTestProps {
  analysisId: number;
}

interface ConversionResult {
  analysisId: number;
  tileIndex: number;
  tileInfo: {
    bounds: {
      topLeft: { lat: number; lng: number };
      bottomRight: { lat: number; lng: number };
    };
    center: { lat: number; lng: number };
    size: {
      latRange: number;
      lngRange: number;
    };
  };
  precisionMetrics: {
    metersPerPixel: number;
    latDegreesPerPixel: number;
    lngDegreesPerPixel: number;
    zoomLevel: number;
  };
  tests: {
    pixelToCoordinates: Array<{
      description: string;
      pixel: { x: number; y: number };
      coordinates: { lat: number; lng: number };
    }>;
    coordinatesToPixel: Array<{
      description: string;
      coordinates: { lat: number; lng: number };
      pixel: { x: number; y: number; inBounds: boolean };
      inBounds: boolean;
    }>;
    customTests: Array<{
      test: string;
      input: any;
      output: any;
    }>;
    imageSizeIndependence?: Array<{
      description: string;
      imageSize: string;
      centerPixel: { x: number; y: number };
      coordinates: { lat: number; lng: number };
      backToPixel: { x: number; y: number };
    }>;
  };
}

export default function CoordinateConversionTest({ analysisId }: CoordinateConversionTestProps) {
  const [selectedTile, setSelectedTile] = useState(0);
  const [testMode, setTestMode] = useState<'pixel' | 'coordinate'>('pixel');
  const [testInput, setTestInput] = useState({ x: '', y: '', lat: '', lng: '' });
  const [result, setResult] = useState<ConversionResult | null>(null);
  const [loading, setLoading] = useState(false);

  const runConversionTest = async () => {
    if (!analysisId) {
      toast({
        title: "Error",
        description: "No analysis ID available",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const testPoints = [];
      
      // Add custom test point based on mode
      if (testMode === 'pixel' && testInput.x && testInput.y) {
        testPoints.push({
          type: 'pixel',
          x: parseFloat(testInput.x),
          y: parseFloat(testInput.y)
        });
      } else if (testMode === 'coordinate' && testInput.lat && testInput.lng) {
        testPoints.push({
          type: 'coordinates',
          lat: parseFloat(testInput.lat),
          lng: parseFloat(testInput.lng)
        });
      }

      const response = await fetch('/api/test-coordinate-conversion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          analysisId,
          tileIndex: selectedTile,
          testPoints
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to test coordinates');
      }

      const conversionResult = await response.json();
      setResult(conversionResult);
      
      toast({
        title: "Conversion Test Complete",
        description: `Tested tile ${selectedTile} with precision ${conversionResult.precisionMetrics.metersPerPixel.toFixed(3)}m/pixel`
      });

    } catch (error) {
      console.error('Coordinate conversion test failed:', error);
      toast({
        title: "Test Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Calculator className="h-4 w-4" />
          Coordinate Conversion Test
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Tile Selection */}
        <div className="space-y-2">
          <Label className="text-xs">Tile Index</Label>
          <Select value={selectedTile.toString()} onValueChange={(value) => setSelectedTile(parseInt(value))}>
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 8 }, (_, i) => (
                <SelectItem key={i} value={i.toString()}>
                  Tile {i}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Test Mode Selection */}
        <div className="space-y-2">
          <Label className="text-xs">Test Mode</Label>
          <Select value={testMode} onValueChange={(value) => setTestMode(value as 'pixel' | 'coordinate')}>
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pixel">Pixel → Coordinates</SelectItem>
              <SelectItem value="coordinate">Coordinates → Pixel</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Input Fields */}
        {testMode === 'pixel' ? (
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Pixel X</Label>
              <Input
                type="number"
                placeholder="0-640"
                value={testInput.x}
                onChange={(e) => setTestInput({ ...testInput, x: e.target.value })}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Pixel Y</Label>
              <Input
                type="number"
                placeholder="0-640"
                value={testInput.y}
                onChange={(e) => setTestInput({ ...testInput, y: e.target.value })}
                className="h-8 text-xs"
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Latitude</Label>
              <Input
                type="number"
                step="0.000001"
                placeholder="38.972"
                value={testInput.lat}
                onChange={(e) => setTestInput({ ...testInput, lat: e.target.value })}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Longitude</Label>
              <Input
                type="number"
                step="0.000001"
                placeholder="-76.485"
                value={testInput.lng}
                onChange={(e) => setTestInput({ ...testInput, lng: e.target.value })}
                className="h-8 text-xs"
              />
            </div>
          </div>
        )}

        {/* Test Button */}
        <Button
          onClick={runConversionTest}
          disabled={loading}
          size="sm"
          className="w-full"
        >
          <Target className="h-3 w-3 mr-1" />
          {loading ? "Testing..." : "Run Test"}
        </Button>

        {/* Results Display */}
        {result && (
          <div className="mt-4 space-y-3">
            <div className="text-xs font-medium text-gray-700">Test Results</div>
            
            {/* Tile Info */}
            <div className="bg-gray-50 p-2 rounded text-xs space-y-1">
              <div className="font-medium">Tile {result.tileIndex} Info:</div>
              <div>Center: {result.tileInfo.center.lat.toFixed(6)}, {result.tileInfo.center.lng.toFixed(6)}</div>
              <div>Precision: {result.precisionMetrics.metersPerPixel.toFixed(3)}m/pixel</div>
            </div>

            {/* Custom Test Results */}
            {result.tests.customTests.length > 0 && (
              <div className="bg-blue-50 p-3 rounded text-xs space-y-2">
                <div className="font-medium text-blue-800">Your Test:</div>
                {result.tests.customTests.map((test, index) => (
                  <div key={index} className="space-y-2">
                    <div className="font-medium text-blue-700">{test.test}</div>
                    
                    {/* Input Display */}
                    <div className="bg-white p-2 rounded border">
                      <div className="font-medium mb-1">Input:</div>
                      {test.input.type === 'pixel' ? (
                        <div className="font-mono">
                          Pixel: ({test.input.x}, {test.input.y})
                        </div>
                      ) : (
                        <div className="font-mono">
                          Coordinates: {test.input.lat}, {test.input.lng}
                        </div>
                      )}
                    </div>

                    {/* Output Display */}
                    <div className="bg-white p-2 rounded border">
                      <div className="font-medium mb-1">Output:</div>
                      {test.output.type === 'coordinates' ? (
                        <div className="space-y-1">
                          <div className="font-mono text-green-700">
                            <div>Latitude: {test.output.lat}</div>
                            <div>Longitude: {test.output.lng}</div>
                          </div>
                          <div className="text-xs text-gray-500 mt-2">
                            <div className="font-mono bg-gray-100 p-1 rounded select-all">
                              {test.output.lat}, {test.output.lng}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="font-mono text-green-700">
                          Pixel: ({test.output.x}, {test.output.y})
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Image Size Independence Test */}
            {result.tests.imageSizeIndependence && result.tests.imageSizeIndependence.length > 0 && (
              <div className="bg-purple-50 p-3 rounded text-xs space-y-2">
                <div className="font-medium text-purple-800">Image Size Independence Test:</div>
                <div className="text-xs text-purple-600 mb-2">
                  All center pixels should convert to the same coordinates regardless of image size:
                </div>
                {result.tests.imageSizeIndependence.map((test, index) => (
                  <div key={index} className="bg-white p-2 rounded border space-y-1">
                    <div className="font-medium">{test.description}</div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-gray-600">Center Pixel:</span> ({test.centerPixel.x}, {test.centerPixel.y})
                      </div>
                      <div>
                        <span className="text-gray-600">Image Size:</span> {test.imageSize}
                      </div>
                    </div>
                    <div className="bg-gray-50 p-1 rounded">
                      <div className="font-mono text-green-700">
                        {test.coordinates.lat.toFixed(10)}, {test.coordinates.lng.toFixed(10)}
                      </div>
                    </div>
                    <div className="text-xs text-gray-500">
                      Round-trip: ({test.backToPixel.x.toFixed(1)}, {test.backToPixel.y.toFixed(1)})
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Bounds Test Results */}
            <div className="bg-green-50 p-2 rounded text-xs space-y-1">
              <div className="font-medium">Bounds Tests:</div>
              {result.tests.coordinatesToPixel.map((test, index) => (
                <div key={index} className="flex justify-between">
                  <span>{test.description}:</span>
                  <span className={test.inBounds ? "text-green-600" : "text-red-600"}>
                    ({test.pixel.x.toFixed(1)}, {test.pixel.y.toFixed(1)}) {test.inBounds ? "✓" : "✗"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}