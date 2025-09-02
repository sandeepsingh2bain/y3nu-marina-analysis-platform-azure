import React, { useState, useCallback, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Upload, Play, Pause, Trash2, Download, AlertCircle, CheckCircle2, Loader2, Clock, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface BatchJob {
  id: number;
  name: string;
  status: 'pending' | 'processing' | 'paused' | 'completed' | 'failed' | 'cancelled';
  totalAOIs: number;
  processedAOIs: number;
  failedAOIs: number;
  createdAt: string;
  completedAt?: string;
}

interface BatchAOIStatus {
  id: number;
  recordId: string;
  formattedAddress: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  analysisId?: number;
  errorMessage?: string;
  completedAt?: string;
  // Processing statistics
  tilesProcessed?: number;
  rawDetections?: number;
  filteredDetections?: number;
  finalDetections?: number;
  processingStartedAt?: string;
  processingDuration?: number;
}

interface BatchProgress {
  batchJobId: number;
  name: string;
  status: 'pending' | 'processing' | 'paused' | 'completed' | 'failed' | 'cancelled';
  totalAOIs: number;
  processedAOIs: number;
  failedAOIs: number;
  aois: BatchAOIStatus[];
}

export function BatchProcessing() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [batchName, setBatchName] = useState("");
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Function to download batch results
  const downloadBatchResults = async (batchId: number, batchName: string) => {
    try {
      const response = await fetch(`/api/batch/${batchId}/export`, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        const error = await response.json();
        // Check if it's a "no detections" error
        if (error.error === "No detection results found") {
          toast({
            title: "No Detections Found",
            description: `Batch "${batchName}" completed successfully but found no boats across all AOIs. This typically means the locations are not marinas or boat storage facilities.`,
            variant: "default",
            duration: 5000,
          });
          return;
        }
        throw new Error(error.error || 'Failed to download batch results');
      }

      // Get the filename from the response headers or use default
      const contentDisposition = response.headers.get('content-disposition');
      let filename = `${batchName}_results.xlsx`;
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Download Complete",
        description: `Batch results downloaded as ${filename}`,
      });

    } catch (error: any) {
      toast({
        title: "Download Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Function to export single AOI results  
  const handleSingleAOIExport = async (aoi: BatchAOIStatus) => {
    try {
      // Check if AOI has zero detections
      if (aoi.rawDetections === 0) {
        toast({
          title: "No Detections Found",
          description: `AOI ${aoi.recordId} completed successfully but found no boats in this area. This typically means the location is not a marina or boat storage facility.`,
          variant: "default",
          duration: 5000, // Show for 5 seconds
        });
        return;
      }

      const response = await fetch(`/api/analysis/${aoi.analysisId}/export-filtered`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to export AOI results');
      }

      // Get the filename from the response headers or use default
      const contentDisposition = response.headers.get('content-disposition');
      let filename = `${aoi.recordId}_filtered_results.xlsx`;
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Export Complete",
        description: `AOI results downloaded as ${filename}`,
      });

    } catch (error: any) {
      toast({
        title: "Export Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Query to fetch all batch jobs
  const { data: batchJobs = [], isLoading: isLoadingJobs } = useQuery({
    queryKey: ["/api/batch/jobs"],
    refetchInterval: 2000, // Poll every 2 seconds for updates
  });

  // Auto-select first batch job when loaded, and reset if selected job no longer exists
  useEffect(() => {
    if (batchJobs.length > 0) {
      // Check if currently selected batch still exists
      const selectedBatchExists = selectedBatchId && batchJobs.some(job => job.id === selectedBatchId);
      
      if (!selectedBatchExists) {
        // Select the first available batch job
        setSelectedBatchId(batchJobs[0].id);
      }
    } else if (batchJobs.length === 0) {
      // No batch jobs available, clear selection
      setSelectedBatchId(null);
    }
  }, [batchJobs, selectedBatchId]);

  // Query to fetch batch progress for selected batch
  const { data: batchProgress, isLoading: isLoadingProgress, error: progressError } = useQuery({
    queryKey: [`/api/batch/${selectedBatchId}/progress`],
    enabled: !!selectedBatchId,
    refetchInterval: (data) => {
      // Stop polling if batch is completed/failed
      if (data?.status && ['completed', 'failed', 'cancelled'].includes(data.status)) {
        return false;
      }
      return 1000; // Poll every second when viewing progress
    },
    retry: (failureCount, error: any) => {
      // Don't retry if it's a 404 (batch not found)
      if (error?.status === 404) {
        return false;
      }
      return failureCount < 3;
    },
  });

  // Upload CSV mutation
  const uploadMutation = useMutation({
    mutationFn: async (data: { file: File; name: string }) => {
      const formData = new FormData();
      formData.append('csvFile', data.file);
      formData.append('batchName', data.name);
      
      const response = await fetch('/api/batch/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "CSV Upload Successful",
        description: `Created batch job with ${data.totalAOIs} AOIs. ${data.duplicates} duplicates ignored.`,
      });
      setSelectedFile(null);
      setBatchName("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      queryClient.invalidateQueries({ queryKey: ["/api/batch/jobs"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Start batch processing mutation
  const startBatchMutation = useMutation({
    mutationFn: async (batchId: number) => {
      const response = await fetch(`/api/batch/${batchId}/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to start batch');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Batch Processing Started",
        description: "The batch job is now processing AOIs sequentially.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/batch/jobs"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Start Batch",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Pause batch processing mutation
  const pauseBatchMutation = useMutation({
    mutationFn: async (batchId: number) => {
      const response = await fetch(`/api/batch/${batchId}/pause`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to pause batch');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Batch Processing Paused",
        description: "The batch job has been paused and can be resumed later.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/batch/jobs"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Pause Batch",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Resume batch processing mutation
  const resumeBatchMutation = useMutation({
    mutationFn: async (batchId: number) => {
      const response = await fetch(`/api/batch/${batchId}/resume`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to resume batch');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Batch Processing Resumed",
        description: "The batch job is now processing remaining AOIs.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/batch/jobs"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Resume Batch",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete batch mutation
  const deleteBatchMutation = useMutation({
    mutationFn: async (batchId: number) => {
      const response = await fetch(`/api/batch/${batchId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete batch');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Batch Job Deleted",
        description: "The batch job and all associated data have been removed.",
      });
      setSelectedBatchId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/batch/jobs"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Delete Batch",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete AOI detections mutation
  const deleteAOIDetectionsMutation = useMutation({
    mutationFn: async (analysisId: number) => {
      const response = await fetch(`/api/analysis/${analysisId}/detections`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete AOI detections');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "AOI Detections Deleted",
        description: "All boat detections for this AOI have been removed.",
      });
      // Refresh batch progress to update the UI
      queryClient.invalidateQueries({ queryKey: [`/api/batch/${selectedBatchId}/progress`] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Delete Detections",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Clear all system data and cache mutation
  const clearAllMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/system/clear-all', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to clear system');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Cache Cleared Successfully",
        description: "All database records, batch jobs, and cached files have been cleared.",
        duration: 5000,
      });
      // Reset all state and refresh data
      setSelectedBatchId(null);
      setSelectedFile(null);
      setBatchName("");
      queryClient.invalidateQueries({ queryKey: ["/api/batch/jobs"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Clear System",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.csv')) {
        toast({
          title: "Invalid File Type",
          description: "Please select a CSV file.",
          variant: "destructive",
        });
        return;
      }
      setSelectedFile(file);
    }
  }, [toast]);

  const handleUpload = useCallback(() => {
    if (!selectedFile || !batchName.trim()) {
      toast({
        title: "Missing Information",
        description: "Please select a CSV file and enter a batch name.",
        variant: "destructive",
      });
      return;
    }
    
    uploadMutation.mutate({ file: selectedFile, name: batchName.trim() });
  }, [selectedFile, batchName, uploadMutation, toast]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'processing': return 'bg-blue-500';
      case 'paused': return 'bg-yellow-500';
      case 'failed': return 'bg-red-500';
      case 'pending': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="w-4 h-4" />;
      case 'processing': return <Loader2 className="w-4 h-4 animate-spin" />;
      case 'paused': return <Pause className="w-4 h-4" />;
      case 'pending': return <Clock className="w-4 h-4" />;
      case 'failed': return <AlertCircle className="w-4 h-4" />;
      default: return null;
    }
  };

  const filteredAOIs = batchProgress?.aois.filter(aoi => {
    if (statusFilter === "all") return true;
    return aoi.status === statusFilter;
  }) || [];

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Upload CSV for Batch Processing
          </CardTitle>
          <CardDescription>
            Upload a CSV file containing AOI polygon coordinates, Record IDs, and formatted addresses for batch analysis.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="batch-name">Batch Name</Label>
              <Input
                id="batch-name"
                value={batchName}
                onChange={(e) => setBatchName(e.target.value)}
                placeholder="Enter batch job name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="csv-file">CSV File</Label>
              <Input
                id="csv-file"
                type="file"
                accept=".csv"
                ref={fileInputRef}
                onChange={handleFileSelect}
              />
            </div>
          </div>
          {selectedFile && (
            <div className="text-sm text-muted-foreground">
              Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
            </div>
          )}
          <Button 
            onClick={handleUpload}
            disabled={uploadMutation.isPending || !selectedFile || !batchName.trim()}
            className="w-full md:w-auto"
          >
            {uploadMutation.isPending ? "Uploading..." : "Upload & Create Batch Job"}
          </Button>
        </CardContent>
      </Card>

      {/* Batch Jobs List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Batch Jobs</CardTitle>
              <CardDescription>
                Manage and monitor your batch processing jobs.
              </CardDescription>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => clearAllMutation.mutate()}
              disabled={clearAllMutation.isPending}
              className="flex items-center gap-2"
            >
              {clearAllMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              {clearAllMutation.isPending ? "Clearing..." : "Clear Cache"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingJobs ? (
            <div className="flex items-center justify-center gap-2 py-8">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
              <span className="text-muted-foreground animate-pulse">Loading batch jobs...</span>
            </div>
          ) : batchJobs.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              No batch jobs found. Upload a CSV file to get started.
            </div>
          ) : (
            <div className="space-y-4">
              {batchJobs.map((job: BatchJob) => (
                <div
                  key={job.id}
                  className={`border rounded-lg p-4 cursor-pointer transition-all duration-300 ${
                    selectedBatchId === job.id ? 'border-primary bg-primary/5' : 'hover:bg-gray-50'
                  } ${job.status === 'processing' ? 'animate-pulse border-blue-300 bg-blue-50/50' : ''}`}
                  onClick={() => setSelectedBatchId(job.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{job.name}</h3>
                        <Badge className={`${getStatusColor(job.status)} ${
                          job.status === 'processing' ? 'animate-pulse' : ''
                        }`}>
                          {getStatusIcon(job.status)}
                          <span className="ml-1">{job.status}</span>
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {job.processedAOIs}/{job.totalAOIs} AOIs processed
                        {job.failedAOIs > 0 && ` • ${job.failedAOIs} failed`}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {job.status === 'pending' && (
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            startBatchMutation.mutate(job.id);
                          }}
                          disabled={startBatchMutation.isPending}
                        >
                          <Play className="w-4 h-4 mr-1" />
                          Start
                        </Button>
                      )}
                      {job.status === 'processing' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            pauseBatchMutation.mutate(job.id);
                          }}
                          disabled={pauseBatchMutation.isPending}
                        >
                          <Pause className="w-4 h-4 mr-1" />
                          Pause
                        </Button>
                      )}
                      {job.status === 'paused' && (
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            resumeBatchMutation.mutate(job.id);
                          }}
                          disabled={resumeBatchMutation.isPending}
                        >
                          <Play className="w-4 h-4 mr-1" />
                          Resume
                        </Button>
                      )}
                      {job.status === 'completed' && (
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            downloadBatchResults(job.id, job.name);
                          }}
                        >
                          <Download className="w-4 h-4 mr-1" />
                          Download
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteBatchMutation.mutate(job.id);
                        }}
                        disabled={deleteBatchMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  {job.totalAOIs > 0 && (
                    <div className="mt-2 space-y-1">
                      <Progress 
                        value={(job.processedAOIs / job.totalAOIs) * 100}
                        className={`h-2 ${job.status === 'processing' ? 'animate-pulse' : ''}`}
                      />
                      {job.status === 'processing' && (
                        <div className="text-xs text-blue-600 animate-pulse">
                          Processing AOIs...
                        </div>
                      )}
                      {job.status === 'paused' && (
                        <div className="text-xs text-yellow-600">
                          Processing paused
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Batch Progress Detail */}
      {selectedBatchId && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Batch Progress Detail</span>
              <div className="flex items-center gap-2">
                <Label htmlFor="status-filter" className="text-sm">Filter:</Label>
                <select
                  id="status-filter"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="text-sm border rounded px-2 py-1"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="processing">Processing</option>
                  <option value="completed">Completed</option>
                  <option value="failed">Failed</option>
                </select>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingProgress ? (
              <div className="flex items-center justify-center gap-2 py-8">
                <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                <span className="text-muted-foreground animate-pulse">Loading batch progress...</span>
              </div>
            ) : batchProgress ? (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-green-600">{batchProgress.processedAOIs}</div>
                    <div className="text-sm text-muted-foreground">Completed</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-red-600">{batchProgress.failedAOIs}</div>
                    <div className="text-sm text-muted-foreground">Failed</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-600">
                      {batchProgress.totalAOIs - batchProgress.processedAOIs - batchProgress.failedAOIs}
                    </div>
                    <div className="text-sm text-muted-foreground">Remaining</div>
                  </div>
                </div>
                
                <Separator />
                
                <ScrollArea className="h-96">
                  <div className="space-y-2">
                    {filteredAOIs.map((aoi) => (
                      <div
                        key={aoi.id}
                        className={`border rounded-lg p-4 space-y-3 transition-all duration-300 ${
                          aoi.status === 'processing' 
                            ? 'border-blue-300 bg-blue-50/30 animate-pulse' 
                            : aoi.status === 'completed'
                            ? 'border-green-300 bg-green-50/30'
                            : aoi.status === 'failed'
                            ? 'border-red-300 bg-red-50/30'
                            : 'border-gray-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{aoi.recordId}</span>
                            <Badge className={getStatusColor(aoi.status)}>
                              {getStatusIcon(aoi.status)}
                              <span className="ml-1">{aoi.status}</span>
                            </Badge>
                          </div>
                          {aoi.analysisId && (
                            <div className="flex gap-2">
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => handleSingleAOIExport(aoi)}
                              >
                                <Download className="w-4 h-4 mr-1" />
                                Export
                              </Button>
                              {aoi.status === 'completed' && aoi.rawDetections !== undefined && aoi.rawDetections !== null && aoi.rawDetections > 0 && (
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => deleteAOIDetectionsMutation.mutate(aoi.analysisId!)}
                                  disabled={deleteAOIDetectionsMutation.isPending}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  {deleteAOIDetectionsMutation.isPending ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <X className="w-4 h-4" />
                                  )}
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                        
                        <div className="text-sm text-muted-foreground">
                          {aoi.formattedAddress}
                        </div>

                        {aoi.status === 'processing' && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm text-blue-600">
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span className="animate-pulse">Analyzing satellite imagery...</span>
                            </div>
                            <div className="w-full bg-blue-100 rounded-full h-1">
                              <div className="bg-blue-500 h-1 rounded-full animate-pulse" style={{ width: '70%' }}></div>
                            </div>
                          </div>
                        )}

                        {aoi.status === 'completed' && aoi.rawDetections !== undefined && (
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <div className="font-medium text-blue-600">{aoi.tilesProcessed}</div>
                              <div className="text-muted-foreground">Tiles Processed</div>
                            </div>
                            <div>
                              <div className="font-medium text-gray-600">{aoi.rawDetections || 0}</div>
                              <div className="text-muted-foreground">Raw Detections</div>
                            </div>
                          </div>
                        )}

                        {aoi.status === 'completed' && aoi.processingStartedAt && aoi.processingDuration && (
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>Started: {new Date(aoi.processingStartedAt).toLocaleTimeString()}</span>
                            <span>Duration: {Math.floor(aoi.processingDuration / 60)}m {aoi.processingDuration % 60}s</span>
                            {aoi.completedAt && (
                              <span>Completed: {new Date(aoi.completedAt).toLocaleTimeString()}</span>
                            )}
                          </div>
                        )}

                        {aoi.errorMessage && (
                          <div className="text-sm text-red-600">
                            Error: {aoi.errorMessage}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            ) : (
              <div>No batch selected</div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}