import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { BarChart3, TrendingUp, Filter, Users, Calendar, MapPin, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

interface AnalysisStatisticsProps {
  analysisId: number;
  isVisible: boolean;
  onToggle: () => void;
}

interface DetectionStats {
  total: number;
  byType: {
    small: number;
    medium: number;
    large: number;
  };
  avgConfidence?: number;
  filteredOut?: number;
  duplicatesRemoved?: number;
}

interface AnalysisStatisticsData {
  analysisId: number;
  recordId: string;
  formattedAddress: string;
  status: string;
  createdAt: string;
  tilesProcessed: number;
  rawDetections: DetectionStats;
  aoiFiltered: DetectionStats | null;
  finalDetections: DetectionStats | null;
}

export function AnalysisStatistics({ analysisId, isVisible, onToggle }: AnalysisStatisticsProps) {
  const { data: statistics, isLoading, error } = useQuery({
    queryKey: ['analysis-statistics', analysisId],
    queryFn: async (): Promise<AnalysisStatisticsData> => {
      const response = await fetch(`/api/analysis/${analysisId}/statistics`);
      if (!response.ok) {
        throw new Error('Failed to fetch analysis statistics');
      }
      return response.json();
    },
    enabled: isVisible && analysisId > 0
  });

  if (!isVisible) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          onClick={onToggle}
          variant="outline"
          size="sm"
          className="shadow-lg"
        >
          <BarChart3 className="w-4 h-4 mr-2" />
          View Statistics
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-96">
      <Card className="shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center">
              <BarChart3 className="w-5 h-5 mr-2" />
              Analysis Statistics
            </CardTitle>
            <Button
              onClick={onToggle}
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
            >
              ×
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="ml-2">Loading statistics...</span>
            </div>
          )}

          {error && (
            <div className="text-center py-8 text-muted-foreground">
              Failed to load statistics
            </div>
          )}

          {statistics && (
            <div className="space-y-4">
              {/* Analysis Info */}
              <div className="space-y-2">
                <div className="flex items-center text-sm text-muted-foreground">
                  <MapPin className="w-4 h-4 mr-1" />
                  Record ID: {statistics.recordId}
                </div>
                <div className="flex items-center text-sm text-muted-foreground">
                  <Calendar className="w-4 h-4 mr-1" />
                  {new Date(statistics.createdAt).toLocaleDateString()}
                </div>
                <div className="flex items-center text-sm text-muted-foreground">
                  <TrendingUp className="w-4 h-4 mr-1" />
                  {statistics.tilesProcessed} tiles processed
                </div>
              </div>

              <Separator />

              {/* Raw Detections */}
              <div>
                <h4 className="font-semibold mb-2 flex items-center">
                  <Users className="w-4 h-4 mr-2" />
                  Raw Detections
                </h4>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Total Boats</span>
                    <Badge variant="secondary">{statistics.rawDetections.total}</Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div className="text-center">
                      <div className="text-xs text-muted-foreground">Small</div>
                      <div className="font-medium">{statistics.rawDetections.byType.small}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-muted-foreground">Medium</div>
                      <div className="font-medium">{statistics.rawDetections.byType.medium}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-muted-foreground">Large</div>
                      <div className="font-medium">{statistics.rawDetections.byType.large}</div>
                    </div>
                  </div>
                  {statistics.rawDetections.avgConfidence && (
                    <div className="flex justify-between items-center text-sm">
                      <span>Avg Confidence</span>
                      <span className="font-medium">{statistics.rawDetections.avgConfidence}%</span>
                    </div>
                  )}
                </div>
              </div>

              {/* AOI Filtered */}
              {statistics.aoiFiltered && (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-semibold mb-2 flex items-center">
                      <Filter className="w-4 h-4 mr-2" />
                      AOI Filtered
                    </h4>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Inside AOI</span>
                        <Badge variant="outline">{statistics.aoiFiltered.total}</Badge>
                      </div>
                      <div className="flex justify-between items-center text-sm text-muted-foreground">
                        <span>Filtered Out</span>
                        <span>{statistics.aoiFiltered.filteredOut}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div className="text-center">
                          <div className="text-xs text-muted-foreground">Small</div>
                          <div className="font-medium">{statistics.aoiFiltered.byType.small}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-muted-foreground">Medium</div>
                          <div className="font-medium">{statistics.aoiFiltered.byType.medium}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-muted-foreground">Large</div>
                          <div className="font-medium">{statistics.aoiFiltered.byType.large}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Final Results */}
              {statistics.finalDetections && (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-semibold mb-2 flex items-center text-green-600">
                      <TrendingUp className="w-4 h-4 mr-2" />
                      Final Results
                    </h4>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Final Count</span>
                        <Badge variant="default" className="bg-green-600">{statistics.finalDetections.total}</Badge>
                      </div>
                      <div className="flex justify-between items-center text-sm text-muted-foreground">
                        <span>Duplicates Removed</span>
                        <span>{statistics.finalDetections.duplicatesRemoved}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div className="text-center">
                          <div className="text-xs text-muted-foreground">Small</div>
                          <div className="font-medium">{statistics.finalDetections.byType.small}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-muted-foreground">Medium</div>
                          <div className="font-medium">{statistics.finalDetections.byType.medium}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-muted-foreground">Large</div>
                          <div className="font-medium">{statistics.finalDetections.byType.large}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Processing Efficiency */}
              {statistics.aoiFiltered && statistics.finalDetections && (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-semibold mb-2 text-sm">Processing Efficiency</h4>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <div>AOI Filter: {((statistics.aoiFiltered.total / statistics.rawDetections.total) * 100).toFixed(1)}% retained</div>
                      <div>Deduplication: {((statistics.finalDetections.total / statistics.aoiFiltered.total) * 100).toFixed(1)}% retained</div>
                      <div>Overall: {((statistics.finalDetections.total / statistics.rawDetections.total) * 100).toFixed(1)}% final retention</div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}