import React from "react";
import { BatchProcessing } from "@/components/batch-processing";

export default function BatchProcessingPage() {
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Batch Processing</h1>
        <p className="text-muted-foreground">
          Upload CSV files with multiple AOI polygons for automated batch analysis of marina areas.
        </p>
      </div>
      
      <BatchProcessing />
    </div>
  );
}