import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { exportDetectionsToCSV } from "@/lib/csv-export";
import type { AnalyzeAreaRequest, AnalysisResult } from "@shared/schema";

interface SampleLocation {
  name: string;
  topLeftLat: number;
  topLeftLng: number;
  bottomRightLat: number;
  bottomRightLng: number;
}

export function useMarinaAnalysis() {
  const [currentAnalysisId, setCurrentAnalysisId] = useState<number | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Query for analysis results - NO automatic polling to prevent freezing
  const { data: analysisData, refetch } = useQuery<AnalysisResult>({
    queryKey: [`/api/analysis/${currentAnalysisId}`],
    enabled: false, // Disable automatic fetching
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  // Query for sample coordinates
  const { data: sampleLocations } = useQuery<SampleLocation[]>({
    queryKey: ['/api/sample-coordinates'],
  });



  const loadMaps = async (coordinates: AnalyzeAreaRequest, forceRefresh = false) => {
    try {
      setError(null);
      setIsAnalyzing(true);

      const requestBody = { ...coordinates, forceRefresh };
      const response = await apiRequest("POST", "/api/load-maps", requestBody);
      const result = await response.json();

      // Check for area too large error
      if (result.error === "Area too large") {
        throw new Error(result.message);
      }

      setCurrentAnalysisId(result.analysisId);

      toast({
        title: forceRefresh ? "Force Refreshing Maps" : "Loading Maps", 
        description: `Fetching ${result.tileCount} satellite tiles. ${result.estimatedTime}`,
      });

      // Wait for maps to load, then fetch the result
      const checkMapStatus = async () => {
        await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds
        const statusResponse = await apiRequest("GET", `/api/analysis/${result.analysisId}`);
        const statusData = await statusResponse.json();
        
        if (statusData.status === "maps_loaded") {
          await refetch(); // Manually fetch the data once
          setIsAnalyzing(false);
          toast({
            title: "Maps Loaded Successfully",
            description: "Satellite imagery ready for boat detection",
          });
        }
      };
      
      checkMapStatus();

    } catch (err: any) {
      const errorMessage = err.message || "Failed to load maps";
      setError(errorMessage);
      setIsAnalyzing(false);

      toast({
        title: "Map Loading Failed",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const runObjectDetection = async () => {
    if (!currentAnalysisId) {
      toast({
        title: "No Analysis",
        description: "Please load maps first",
        variant: "destructive",
      });
      return;
    }

    try {
      setError(null);
      setIsAnalyzing(true);

      const response = await apiRequest("POST", `/api/run-detection`, {
        analysisId: currentAnalysisId,
        detectionScope: "current"
      });
      const result = await response.json();

      toast({
        title: "Object Detection Started",
        description: "Analyzing current satellite image for boats",
      });

      // Wait for detection to complete, then fetch results
      await new Promise(resolve => setTimeout(resolve, 8000));
      await refetch();
      setIsAnalyzing(false);

      toast({
        title: "Detection Complete",
        description: "Boat detection finished successfully",
      });

    } catch (err: any) {
      const errorMessage = err.message || "Failed to start object detection";
      setError(errorMessage);
      setIsAnalyzing(false);

      toast({
        title: "Detection Failed",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const runObjectDetectionAll = async () => {
    if (!currentAnalysisId) {
      toast({
        title: "No Analysis",
        description: "Please load maps first",
        variant: "destructive",
      });
      return;
    }

    try {
      setError(null);
      setIsAnalyzing(true);

      const response = await apiRequest("POST", `/api/run-detection`, {
        analysisId: currentAnalysisId,
        detectionScope: "all"
      });
      const result = await response.json();

      toast({
        title: "Object Detection Started",
        description: "Analyzing all satellite images for boats",
      });

      // Wait for detection to complete, then fetch results
      await new Promise(resolve => setTimeout(resolve, 12000));
      await refetch();
      setIsAnalyzing(false);

      toast({
        title: "Detection Complete",
        description: "Boat detection finished on all images",
      });

    } catch (err: any) {
      const errorMessage = err.message || "Failed to start object detection";
      setError(errorMessage);
      setIsAnalyzing(false);

      toast({
        title: "Detection Failed",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };



  const exportToCsv = async () => {
    if (!analysisData || !currentAnalysisId) {
      toast({
        title: "Export Failed",
        description: "No analysis data available to export",
        variant: "destructive",
      });
      return;
    }

    try {
      // Try server-side export first
      const response = await fetch(`/api/analysis/${currentAnalysisId}/export`);

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `marina_analysis_${currentAnalysisId}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);

        toast({
          title: "Export Successful",
          description: "CSV file has been downloaded",
        });
      } else {
        // Fallback to client-side export
        exportDetectionsToCSV(analysisData.detections, currentAnalysisId);

        toast({
          title: "Export Successful",
          description: "CSV file has been downloaded",
        });
      }
    } catch (err) {
      // Fallback to client-side export
      try {
        exportDetectionsToCSV(analysisData.detections, currentAnalysisId);

        toast({
          title: "Export Successful",
          description: "CSV file has been downloaded",
        });
      } catch (exportErr) {
        toast({
          title: "Export Failed",
          description: "Could not export analysis results",
          variant: "destructive",
        });
      }
    }
  };

  const loadSampleCoordinates = () => {
    if (!sampleLocations || sampleLocations.length === 0) {
      toast({
        title: "No Sample Data",
        description: "Sample coordinates are not available",
        variant: "destructive",
      });
      return null;
    }

    // Return the first sample location (Marina del Rey)
    const sample = sampleLocations[0];

    toast({
      title: "Sample Loaded",
      description: `${sample.name} coordinates loaded`,
    });

    return {
      topLeftLat: sample.topLeftLat,
      topLeftLng: sample.topLeftLng,
      bottomRightLat: sample.bottomRightLat,
      bottomRightLng: sample.bottomRightLng,
    };
  };

  // Calculate derived state based on analysis data
  const actualIsAnalyzing = analysisData ? 
    (analysisData.status === "loading_maps" || analysisData.status === "processing") : 
    isAnalyzing;

  return {
    analysisData,
    isAnalyzing: actualIsAnalyzing,
    error,
    loadMaps,
    runObjectDetection,
    runObjectDetectionAll,
    exportToCsv,
    loadSampleCoordinates,
    sampleLocations,
  };
}