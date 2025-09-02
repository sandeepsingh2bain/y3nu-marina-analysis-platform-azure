import type { Detection } from "@shared/schema";

export function generateCSV(detections: Detection[]): string {
  const headers = [
    "Object ID",
    "Type",
    "Sub Type",
    "Latitude",
    "Longitude",
    "Length (m)",
    "Width (m)",
    "Area (m²)",
    "Status",
    "Confidence (%)"
  ];

  const rows = detections.map(detection => [
    detection.objectId,
    detection.objectType,
    detection.subType || "",
    detection.lat.toFixed(6),
    detection.lng.toFixed(6),
    detection.length.toString(),
    detection.width.toString(),
    detection.area.toString(),
    detection.status || "",
    detection.confidence.toString()
  ]);

  return [headers, ...rows].map(row => row.join(",")).join("\n");
}

export function downloadCSV(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

export function exportDetectionsToCSV(detections: Detection[], analysisId?: number): void {
  if (detections.length === 0) {
    throw new Error("No detections to export");
  }

  const csvContent = generateCSV(detections);
  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `marina_analysis_${analysisId || 'export'}_${timestamp}.csv`;
  
  downloadCSV(csvContent, filename);
}

export function formatDetectionForExport(detection: Detection): Record<string, any> {
  return {
    "Object ID": detection.objectId,
    "Type": detection.objectType,
    "Sub Type": detection.subType || "",
    "Latitude": detection.lat,
    "Longitude": detection.lng,
    "Length (m)": detection.length,
    "Width (m)": detection.width,
    "Area (m²)": detection.area,
    "Status": detection.status || "",
    "Confidence (%)": detection.confidence
  };
}

export function exportToJSON(detections: Detection[], analysisId?: number): void {
  if (detections.length === 0) {
    throw new Error("No detections to export");
  }

  const exportData = {
    analysisId: analysisId || null,
    timestamp: new Date().toISOString(),
    totalDetections: detections.length,
    detections: detections.map(formatDetectionForExport)
  };

  const jsonContent = JSON.stringify(exportData, null, 2);
  const blob = new Blob([jsonContent], { type: "application/json;charset=utf-8;" });
  const link = document.createElement("a");
  
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `marina_analysis_${analysisId || 'export'}_${timestamp}.json`;
    
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
