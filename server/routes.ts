import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { analyzeAreaSchema, type AnalyzeAreaRequest, type AnalysisResult, type AnalysisRequest, csvAOISchema, type CSVAOIRow } from "@shared/schema";
import { AzureMapsService } from "./azure-maps";
import { tileCache } from "./tile-cache";
import { analysisCache } from "./analysis-cache";
import express from "express";
import path from "path";
import multer from "multer";
import csv from "csv-parser";
import fs from "fs";
import { Readable } from "stream";
import * as XLSX from "xlsx";
import { db } from "./db";
import { batchAOIs, tileMappings as tileMappingsTable, analysisRequests } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { promisify } from "util";
import { exec } from "child_process";

const execAsync = promisify(exec);

export async function registerRoutes(app: Express): Promise<Server> {
  // Serve static files (annotated images) with CORS headers
  // Use correct static path for deployment vs development
  const staticPath = process.env.NODE_ENV === 'production' 
    ? path.join(process.cwd(), 'server', 'static')
    : path.join(import.meta.dirname, 'static');
  
  app.use('/api/static', (req, res, next) => {
    console.log('Static file request:', req.path);
    console.log('Static file full path:', path.join(staticPath, req.path));
    console.log('Static path being used:', staticPath);
    
    // Add CORS headers for static files to prevent deployment issues
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    
    // Set proper cache headers
    res.header('Cache-Control', 'public, max-age=31536000');
    
    // Force content type for image files
    if (req.path.endsWith('.jpg') || req.path.endsWith('.jpeg')) {
      res.type('image/jpeg');
    }
    
    next();
  }, express.static(staticPath));

  // Add debug endpoint to show server environment info
  app.get('/api/debug/paths', (req, res) => {
    const info = {
      cwd: process.cwd(),
      dirname: import.meta.dirname,
      __dirname: typeof __dirname !== 'undefined' ? __dirname : 'undefined',
      staticPath: path.join(import.meta.dirname, 'static'),
      tilesPath: path.join(import.meta.dirname, 'static', 'cached_tiles'),
      cwdTilesPath: path.join(process.cwd(), 'server', 'static', 'cached_tiles'),
      env: process.env.NODE_ENV,
    };
    
    // Check if directories exist
    info.staticExists = fs.existsSync(info.staticPath);
    info.tilesExists = fs.existsSync(info.tilesPath);
    info.cwdTilesExists = fs.existsSync(info.cwdTilesPath);
    
    // List tile files if directory exists
    if (info.cwdTilesExists) {
      try {
        info.tileFiles = fs.readdirSync(info.cwdTilesPath).slice(0, 5);
      } catch (e) {
        info.tileFilesError = e.message;
      }
    }
    
    res.json(info);
  });

  // Add a test endpoint to serve images directly
  app.get('/api/test-image/:filename', async (req, res) => {
    try {
      const filename = req.params.filename;
      
      // Use the correct path based on environment  
      // In deployment: files are in /home/runner/workspace/server/static/cached_tiles/
      // In development: files are in import.meta.dirname/static/cached_tiles/
      const possiblePaths = [
        path.join(process.cwd(), 'server', 'static', 'cached_tiles', filename), // Primary deployment path
        path.join(import.meta.dirname, 'static', 'cached_tiles', filename),    // Development path
        path.join('/home/runner/workspace/server/static/cached_tiles', filename), // Explicit deployment path
      ];
      
      console.log('Test image endpoint - requested:', filename);
      console.log('Test image endpoint - working directory:', process.cwd());
      console.log('Test image endpoint - dirname:', import.meta.dirname);
      
      let imagePath = null;
      let imageExists = false;
      
      for (const testPath of possiblePaths) {
        console.log('Testing path:', testPath);
        if (fs.existsSync(testPath)) {
          imagePath = testPath;
          imageExists = true;
          console.log('Found image at:', testPath);
          break;
        }
      }
      
      if (!imageExists) {
        console.log('Image not found in any of the paths:', possiblePaths);
        // List contents of directories to debug
        try {
          const serverDir = path.join(process.cwd(), 'server');
          if (fs.existsSync(serverDir)) {
            console.log('Server directory contents:', fs.readdirSync(serverDir));
          }
          const staticDir = path.join(process.cwd(), 'server', 'static');
          if (fs.existsSync(staticDir)) {
            console.log('Static directory contents:', fs.readdirSync(staticDir));
          }
          const tilesDir = path.join(process.cwd(), 'server', 'static', 'cached_tiles');
          if (fs.existsSync(tilesDir)) {
            console.log('Cached tiles directory exists, file count:', fs.readdirSync(tilesDir).length);
            console.log('First few files:', fs.readdirSync(tilesDir).slice(0, 3));
          }
        } catch (e) {
          console.log('Error listing directories:', e);
        }
        return res.status(404).json({ error: 'Image not found', paths_tried: possiblePaths });
      }
      
      // Read the file and send it as a buffer
      const imageBuffer = fs.readFileSync(imagePath);
      
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      res.setHeader('Content-Length', imageBuffer.length.toString());
      
      res.send(imageBuffer);
    } catch (error) {
      console.error('Error serving test image:', error);
      res.status(500).json({ error: 'Failed to serve image', details: error.message });
    }
  });

  const azureMapsService = new AzureMapsService(process.env.AZURE_MAPS_SUBSCRIPTION_KEY!);
  console.log("AzureMapsService initialized with API key:", process.env.AZURE_MAPS_SUBSCRIPTION_KEY ? "present" : "missing");

  // Configure multer for CSV file uploads
  const upload = multer({
    storage: multer.memoryStorage(),
    fileFilter: (req, file, cb) => {
      if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
        cb(null, true);
      } else {
        cb(new Error('Only CSV files are allowed'));
      }
    },
    limits: {
      fileSize: 10 * 1024 * 1024 // 10MB limit
    }
  });

  // Check if analysis is already cached
  app.post("/api/check-cached-analysis", async (req, res) => {
    try {
      const { recordId, formattedAddress, topLeftLat, topLeftLng, bottomRightLat, bottomRightLng, zoomLevel } = req.body;
      
      if (!recordId || !formattedAddress || !topLeftLat || !topLeftLng || !bottomRightLat || !bottomRightLng || !zoomLevel) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const isCached = analysisCache.isCached(
        recordId,
        formattedAddress,
        topLeftLat,
        topLeftLng,
        bottomRightLat,
        bottomRightLng,
        zoomLevel
      );

      if (isCached) {
        const cachedResult = analysisCache.getCached(
          recordId,
          formattedAddress,
          topLeftLat,
          topLeftLng,
          bottomRightLat,
          bottomRightLng,
          zoomLevel
        );

        if (cachedResult) {
          console.log(`Found cached analysis for ${recordId} - ${formattedAddress} (${cachedResult.detections.length} detections)`);
          return res.json({
            isCached: true,
            analysisResult: {
              detections: cachedResult.detections,
              stats: cachedResult.stats,
              cachedAt: cachedResult.cachedAt
            }
          });
        }
      }

      res.json({ isCached: false });
    } catch (error) {
      console.error("Error checking cached analysis:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Cache analysis result for future use
  app.post("/api/cache-analysis-result", async (req, res) => {
    try {
      const { recordId, formattedAddress, topLeftLat, topLeftLng, bottomRightLat, bottomRightLng, zoomLevel, detections, stats } = req.body;
      
      if (!recordId || !formattedAddress || !topLeftLat || !topLeftLng || !bottomRightLat || !bottomRightLng || !zoomLevel || !detections || !stats) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      await analysisCache.setCached(
        recordId,
        formattedAddress,
        topLeftLat,
        topLeftLng,
        bottomRightLat,
        bottomRightLng,
        zoomLevel,
        detections,
        stats
      );

      console.log(`Cached analysis result for ${recordId} - ${formattedAddress} (${detections.length} detections)`);
      res.json({ success: true, message: "Analysis result cached successfully" });
    } catch (error) {
      console.error("Error caching analysis result:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // === BATCH PROCESSING ROUTES ===
  
  // Upload CSV and create batch job
  app.post("/api/batch/upload", upload.single('csvFile'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No CSV file uploaded" });
      }

      const { batchName } = req.body;
      if (!batchName) {
        return res.status(400).json({ error: "Batch name is required" });
      }

      // Parse CSV data
      const csvData: CSVAOIRow[] = [];
      const duplicates: string[] = [];
      const errors: string[] = [];
      const seenAOIs = new Set<string>();

      return new Promise((resolve, reject) => {
        const stream = Readable.from(req.file!.buffer.toString());
        
        stream
          .pipe(csv())
          .on('data', (row) => {
            try {
              // Validate row data
              const validatedRow = csvAOISchema.parse(row);
              
              // Create unique key for deduplication
              const uniqueKey = `${validatedRow.RecordID}|${validatedRow["Formatted Address"]}|${validatedRow["Polygon Coordinates"]}`;
              
              if (seenAOIs.has(uniqueKey)) {
                duplicates.push(`Record ID: ${validatedRow.RecordID}, Address: ${validatedRow["Formatted Address"]}`);
              } else {
                seenAOIs.add(uniqueKey);
                csvData.push(validatedRow);
              }
            } catch (error) {
              errors.push(`Row with Record ID ${row.RecordID || 'unknown'}: ${error.message}`);
            }
          })
          .on('end', async () => {
            try {
              if (csvData.length === 0) {
                return resolve(res.status(400).json({ 
                  error: "No valid AOI records found in CSV",
                  errors,
                  duplicates
                }));
              }

              // Create batch job
              const batchJob = await storage.createBatchJob({ name: batchName });
              
              // Create batch AOIs
              const createdAOIs = [];
              for (const row of csvData) {
                try {
                  // Parse polygon coordinates
                  const polygonCoordinates = JSON.parse(row["Polygon Coordinates"]);
                  
                  const aoi = await storage.createBatchAOI({
                    batchJobId: batchJob.id,
                    recordId: row.RecordID,
                    formattedAddress: row["Formatted Address"],
                    polygonCoordinates: polygonCoordinates
                  });
                  createdAOIs.push(aoi);
                } catch (error) {
                  errors.push(`Failed to create AOI for Record ID ${row.RecordID}: ${error.message}`);
                }
              }

              // Update batch job with total count
              await storage.updateBatchJobTotalAOIs(batchJob.id, createdAOIs.length);
              await storage.updateBatchJobProgress(batchJob.id, 0, 0);

              console.log(`Created batch job "${batchName}" with ${createdAOIs.length} AOIs`);
              
              resolve(res.json({
                success: true,
                batchJobId: batchJob.id,
                totalAOIs: createdAOIs.length,
                duplicates: duplicates.length,
                errors: errors.length,
                duplicateDetails: duplicates,
                errorDetails: errors
              }));
            } catch (error) {
              console.error("Error creating batch job:", error);
              resolve(res.status(500).json({ error: "Failed to create batch job" }));
            }
          })
          .on('error', (error) => {
            console.error("CSV parsing error:", error);
            resolve(res.status(400).json({ error: "Failed to parse CSV file" }));
          });
      });
    } catch (error) {
      console.error("Error processing CSV upload:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get all batch jobs
  app.get("/api/batch/jobs", async (req, res) => {
    try {
      const jobs = await storage.getAllBatchJobs();
      
      // Prevent caching for real-time updates
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      
      res.json(jobs);
    } catch (error) {
      console.error("Error fetching batch jobs:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get batch progress
  app.get("/api/batch/:id/progress", async (req, res) => {
    try {
      const batchJobId = parseInt(req.params.id);
      const progress = await storage.getBatchProgress(batchJobId);
      
      if (!progress) {
        return res.status(404).json({ error: "Batch job not found" });
      }
      
      // Prevent caching for real-time progress updates
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      
      res.json(progress);
    } catch (error) {
      console.error("Error fetching batch progress:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Start batch processing
  app.post("/api/batch/:id/start", async (req, res) => {
    try {
      const batchJobId = parseInt(req.params.id);
      const job = await storage.getBatchJob(batchJobId);
      
      if (!job) {
        return res.status(404).json({ error: "Batch job not found" });
      }

      if (job.status !== "pending") {
        return res.status(400).json({ error: "Batch job is not in pending status" });
      }

      // Update job status to processing
      await storage.updateBatchJobStatus(batchJobId, "processing");
      
      // Start processing in background
      processBatchJob(batchJobId, azureMapsService).catch(error => {
        console.error(`Batch job ${batchJobId} failed:`, error);
        storage.updateBatchJobStatus(batchJobId, "failed", new Date());
      });

      res.json({ success: true, message: "Batch processing started" });
    } catch (error) {
      console.error("Error starting batch processing:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Delete batch job
  app.delete("/api/batch/:id", async (req, res) => {
    try {
      const batchJobId = parseInt(req.params.id);
      await storage.deleteBatchJob(batchJobId);
      res.json({ success: true, message: "Batch job deleted" });
    } catch (error) {
      console.error("Error deleting batch job:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Pause batch processing
  app.post("/api/batch/:batchJobId/pause", async (req, res) => {
    try {
      const batchJobId = parseInt(req.params.batchJobId);
      
      console.log(`Pausing batch job ${batchJobId}`);
      
      // Update batch job status to paused
      await storage.updateBatchJobStatus(batchJobId, "paused", undefined);
      
      res.json({ success: true, message: "Batch processing paused" });
    } catch (error) {
      console.error("Error pausing batch job:", error);
      res.status(500).json({ error: "Failed to pause batch processing" });
    }
  });

  // Resume batch processing for stuck jobs
  app.post("/api/batch/:batchJobId/resume", async (req, res) => {
    try {
      const batchJobId = parseInt(req.params.batchJobId);
      
      console.log(`Resuming batch job ${batchJobId}`);
      
      // Update batch job status back to processing
      await storage.updateBatchJobStatus(batchJobId, "processing", undefined);
      
      // Start processing in background
      processBatchJob(batchJobId, azureMapsService).catch(error => {
        console.error(`Error resuming batch job ${batchJobId}:`, error);
      });
      
      res.json({ success: true, message: "Batch processing resumed" });
    } catch (error) {
      console.error("Error resuming batch job:", error);
      res.status(500).json({ error: "Failed to resume batch processing" });
    }
  });

  // Delete AOI detections
  app.delete("/api/analysis/:analysisId/detections", async (req, res) => {
    try {
      const analysisId = parseInt(req.params.analysisId);
      if (isNaN(analysisId)) {
        return res.status(400).json({ error: "Invalid analysis ID" });
      }

      // Get analysis data before deletion to clear cache
      const analysisRequest = await storage.getAnalysisRequest(analysisId);
      
      await storage.deleteDetectionsByAnalysisId(analysisId);
      
      // Update analysis status to indicate detections were cleared
      await storage.updateAnalysisStatus(analysisId, "maps_loaded");
      
      // Clear analysis cache if analysis data exists
      if (analysisRequest && analysisRequest.recordId && analysisRequest.formattedAddress) {
        const cacheCleared = analysisCache.clearSpecific(
          analysisRequest.recordId,
          analysisRequest.formattedAddress,
          analysisRequest.topLeftLat,
          analysisRequest.topLeftLng,
          analysisRequest.bottomRightLat,
          analysisRequest.bottomRightLng,
          analysisRequest.zoomLevel
        );
        console.log(`Analysis cache ${cacheCleared ? 'cleared' : 'not found'} for analysis ${analysisId}`);
      }
      
      // Find and reset the batch AOI statistics if this analysis is part of a batch
      const allBatchJobs = await storage.getAllBatchJobs();
      for (const batchJob of allBatchJobs) {
        const batchAOIs = await storage.getBatchAOIsByJobId(batchJob.id);
        const targetAOI = batchAOIs.find(aoi => aoi.analysisId === analysisId);
        
        if (targetAOI) {
          // Reset the AOI statistics to indicate no detections
          await storage.updateBatchAOIStatistics(targetAOI.id, {
            rawDetections: 0,
            filteredDetections: 0,
            finalDetections: 0
          });
          break;
        }
      }
      
      res.json({ success: true, message: "AOI detections deleted successfully" });
    } catch (error) {
      console.error("Error deleting AOI detections:", error);
      res.status(500).json({ error: "Failed to delete AOI detections" });
    }
  });

  // Export batch results
  app.get("/api/batch/:id/export", async (req, res) => {
    try {
      const batchJobId = parseInt(req.params.id);
      const batchJob = await storage.getBatchJob(batchJobId);
      
      if (!batchJob) {
        return res.status(404).json({ error: "Batch job not found" });
      }

      if (batchJob.status !== "completed") {
        return res.status(400).json({ error: "Batch job not completed yet" });
      }

      // Get all AOIs for this batch job
      const aois = await storage.getBatchAOIsByJobId(batchJobId);
      const completedAOIs = aois.filter(aoi => aoi.status === "completed" && aoi.analysisId);

      if (completedAOIs.length === 0) {
        return res.status(404).json({ error: "No completed AOI results found" });
      }

      // Collect detections from all completed AOIs with filtering and deduplication
      let allDetections: any[] = [];
      let totalRawDetections = 0;
      let totalFilteredDetections = 0;
      
      for (const aoi of completedAOIs) {
        if (aoi.analysisId) {
          // Calculate bounds from polygon for cache lookup
          const polygon = aoi.polygonCoordinates as any[];
          if (!polygon || polygon.length < 3) {
            continue;
          }

          let minLat = polygon[0].lat;
          let maxLat = polygon[0].lat;
          let minLng = polygon[0].lng;
          let maxLng = polygon[0].lng;

          for (const point of polygon) {
            minLat = Math.min(minLat, point.lat);
            maxLat = Math.max(maxLat, point.lat);
            minLng = Math.min(minLng, point.lng);
            maxLng = Math.max(maxLng, point.lng);
          }

          let rawDetections: any[] = [];
          
          // First try to get from cache
          const cachedResult = analysisCache.getCached(
            aoi.recordId || "", aoi.formattedAddress || "",
            maxLat, minLng, minLat, maxLng, 19
          );
          
          if (cachedResult) {
            // Use cached detections
            rawDetections = cachedResult.detections;
          } else {
            // Fallback to database
            rawDetections = await storage.getDetectionsByAnalysisId(aoi.analysisId);
          }

          console.log(`[AOI ${aoi.recordId}] Raw detections: ${rawDetections.length}`);
          totalRawDetections += rawDetections.length;

          // Step 1: Filter detections by AOI polygon (70% inside requirement)
          const aoiFilteredDetections = filterDetectionsByAOI(rawDetections, polygon);
          console.log(`[AOI ${aoi.recordId}] After AOI filtering: ${aoiFilteredDetections.length} (${rawDetections.length - aoiFilteredDetections.length} filtered out)`);

          // Step 2: Deduplicate within this AOI (70% overlap threshold)
          const deduplicatedDetections = deduplicateDetections(aoiFilteredDetections);
          console.log(`[AOI ${aoi.recordId}] After deduplication: ${deduplicatedDetections.length} (${aoiFilteredDetections.length - deduplicatedDetections.length} duplicates removed)`);
          
          totalFilteredDetections += deduplicatedDetections.length;

          // Step 3: Format for export
          const formattedDetections = deduplicatedDetections.map(detection => ({
            RecordID: aoi.recordId,
            Address: aoi.formattedAddress,
            Type: detection.subType || detection.objectType,
            Latitude: detection.lat,
            Longitude: detection.lng,
            Length: detection.length?.toFixed(2) || "0.00",
            Width: detection.width?.toFixed(2) || "0.00",
            "Polygon Coordinates": detection.geoPolygon ? JSON.stringify(detection.geoPolygon) : ""
          }));
          
          allDetections = allDetections.concat(formattedDetections);
        }
      }

      console.log(`Batch filtering summary: ${totalRawDetections} raw → ${totalFilteredDetections} filtered detections across ${completedAOIs.length} AOIs`);

      if (allDetections.length === 0) {
        return res.status(404).json({ error: "No detection results found" });
      }

      // Generate filename with current date and time
      const now = new Date();
      const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const filename = `${batchJob.name}_${timestamp}.xlsx`;

      // Convert CSV to Excel
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(allDetections);
      XLSX.utils.book_append_sheet(workbook, worksheet, "Batch Results");

      // Write Excel file
      const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(excelBuffer);

      console.log(`Exported batch results: ${allDetections.length} filtered detections from ${completedAOIs.length} AOIs (${totalRawDetections} raw → ${totalFilteredDetections} after AOI filtering & deduplication)`);

    } catch (error) {
      console.error("Error exporting batch results:", error);
      res.status(500).json({ error: "Failed to export batch results" });
    }
  });

  // === TILE VISUALIZATION ROUTES ===

  // Generate visualization for selected tile with final detections only
  app.post("/api/visualize-tile/:analysisId/:tileIndex", async (req, res) => {
    try {
      const analysisId = parseInt(req.params.analysisId);
      const tileIndex = parseInt(req.params.tileIndex);

      // Get analysis request and tile mapping
      const analysisRequest = await storage.getAnalysisRequest(analysisId);
      if (!analysisRequest) {
        return res.status(404).json({ message: "Analysis not found" });
      }

      // Get tile mappings for this analysis
      const tileMappings = await storage.getTileMappingsByAnalysisId(analysisId);
      const currentTileMapping = tileMappings.find(tm => tm.tileIndex === tileIndex);
      
      if (!currentTileMapping) {
        return res.status(404).json({ message: "Tile mapping not found" });
      }

      // Get raw detections from database
      const rawDetections = await storage.getDetectionsByAnalysisId(analysisId);
      
      // Apply the same filtering pipeline as the export functions
      // Step 1: Get AOI polygon for filtering
      let aoiPolygon: Array<{lat: number, lng: number}> | undefined;
      
      // Check if analysis request has polygon stored
      if (analysisRequest.polygon) {
        try {
          // Handle both string and object cases for polygon data
          if (typeof analysisRequest.polygon === 'string') {
            aoiPolygon = JSON.parse(analysisRequest.polygon) as Array<{lat: number, lng: number}>;
          } else if (Array.isArray(analysisRequest.polygon)) {
            aoiPolygon = analysisRequest.polygon as Array<{lat: number, lng: number}>;
          }
          
          if (aoiPolygon && aoiPolygon.length > 0) {
            console.log(`Found AOI polygon with ${aoiPolygon.length} points for visualization filtering`);
          }
        } catch (e) {
          console.warn("Could not parse AOI polygon for visualization:", e);
        }
      }
      
      // Step 2: Apply AOI filtering if polygon exists
      let filteredDetections = rawDetections;
      if (aoiPolygon && aoiPolygon.length >= 3) {
        console.log(`[Visualization] Applying AOI filtering for tile ${tileIndex}: ${rawDetections.length} raw detections`);
        filteredDetections = filterDetectionsByAOI(rawDetections, aoiPolygon);
        console.log(`[Visualization] After AOI filtering: ${filteredDetections.length} detections remain`);
      }
      
      // Step 3: Apply deduplication
      console.log(`[Visualization] Applying deduplication for tile ${tileIndex}: ${filteredDetections.length} detections`);
      const deduplicatedDetections = deduplicateDetections(filteredDetections);
      console.log(`[Visualization] After deduplication: ${deduplicatedDetections.length} detections remain`);
      
      // Step 4: Filter to show only detections that were originally detected in this specific tile
      // Use the stored tileIndex to maintain original tile associations
      const rawTileDetections = await storage.getDetectionsByAnalysisIdAndTile(analysisId, tileIndex);
      console.log(`[Visualization] Found ${rawTileDetections.length} raw detections originally from tile ${tileIndex}`);
      
      // Filter the deduplicated detections to only include those originally from this tile
      const tileDetections = deduplicatedDetections.filter((detection: any) => {
        const wasFromThisTile = rawTileDetections.some(rawDetection => rawDetection.id === detection.id);
        
        if (wasFromThisTile) {
          console.log(`[Visualization] ✓ Detection ${detection.id} (${detection.objectId}) was originally from tile ${tileIndex} and survived filtering pipeline`);
        } else {
          console.log(`[Visualization] ✗ Detection ${detection.id} (${detection.objectId}) was NOT originally from tile ${tileIndex}`);
        }
        
        return wasFromThisTile;
      });
      console.log(`[Visualization] Final detections for tile ${tileIndex}: ${tileDetections.length} (IDs: ${tileDetections.map(d => d.id).join(', ')})`);

      // Prepare detection data with original bounding box coordinates for visualization
      const visualizationDetections = tileDetections.map((detection: any) => {
        console.log(`[Visualization] Detection ID: ${detection.id}, ObjectID: ${detection.objectId || detection.object_id}`);
        return {
          id: detection.id, // Include database ID for debugging
          objectId: detection.objectId || detection.object_id,
          objectType: detection.objectType || detection.object_type,
          subType: detection.subType || detection.sub_type,
          confidence: detection.confidence,
          length: detection.length,
          width: detection.width,
          lat: detection.lat,
          lng: detection.lng,
          tileIndex: detection.tileIndex,
          // Use the original bounding box from the vision detection
          bounding_box: detection.boundingBox || detection.bounding_box
        };
      });

      // Generate visualization using Python script
      const pythonScript = path.join(process.cwd(), 'server', 'visualize_tile.py');
      const outputDir = path.join(process.cwd(), 'server', 'static', 'visualizations');
      
      // Ensure output directory exists
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const visualizationData = {
        tileUrl: currentTileMapping.tileUrl,
        detections: visualizationDetections,
        tileIndex: tileIndex,
        analysisId: analysisId
      };

      // Write visualization data to temporary file
      const tempDataFile = path.join(outputDir, `temp_viz_${analysisId}_${tileIndex}.json`);
      fs.writeFileSync(tempDataFile, JSON.stringify(visualizationData, null, 2));

      // Execute Python visualization script
      const pythonCommand = `python3 "${pythonScript}" "${tempDataFile}" "${outputDir}"`;
      
      const { stdout, stderr } = await execAsync(pythonCommand, {
        cwd: process.cwd(),
        timeout: 30000,
        env: {
          ...process.env,
          VISION_AGENT_API_KEY: process.env.VISION_AGENT_API_KEY
        }
      });

      // Clean up temp file
      fs.unlinkSync(tempDataFile);

      if (stderr && stderr.length > 0) {
        console.error("Python visualization stderr:", stderr);
      }

      console.log("Python visualization output:", stdout);

      // Parse Python script output
      const lines = stdout.trim().split('\n');
      const resultLine = lines.find(line => line.startsWith('RESULT:'));
      
      if (!resultLine) {
        throw new Error("No result from visualization script");
      }

      const result = JSON.parse(resultLine.replace('RESULT:', ''));

      res.json({
        message: "Tile visualization generated successfully",
        tileIndex: tileIndex,
        detectionsCount: visualizationDetections.length,
        visualizationUrl: result.annotated_image_path.replace(/.*server\/static\//, '/api/static/'),
        tileBounds: {
          topLeft: { lat: currentTileMapping.topLeftLat, lng: currentTileMapping.topLeftLng },
          bottomRight: { lat: currentTileMapping.bottomRightLat, lng: currentTileMapping.bottomRightLng }
        }
      });

    } catch (error) {
      console.error("Error generating tile visualization:", error);
      res.status(500).json({ 
        message: "Failed to generate tile visualization",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // === COORDINATE CONVERSION TEST ROUTES ===
  
  // Simple Azure Maps coordinate conversion test
  app.get("/api/test-azure-conversion", async (req, res) => {
    try {
      const { pixelX, pixelY, centerLat, centerLng, zoomLevel, imageWidth, imageHeight } = req.query;
      
      if (!pixelX || !pixelY || !centerLat || !centerLng || !zoomLevel) {
        return res.status(400).json({ error: 'Missing required parameters' });
      }
      
      const imgWidth = parseInt(imageWidth as string) || 512;
      const imgHeight = parseInt(imageHeight as string) || 512;
      const zoom = parseInt(zoomLevel as string);
      
      // Create test analysis request for coordinate conversion
      const testRequest = {
        topLeftLat: parseFloat(centerLat as string) + 0.01,
        topLeftLng: parseFloat(centerLng as string) - 0.01,
        bottomRightLat: parseFloat(centerLat as string) - 0.01,
        bottomRightLng: parseFloat(centerLng as string) + 0.01,
        zoomLevel: zoom
      };
      
      // Calculate meters per pixel using the same logic as detection
      // Note: meters per pixel should be constant for same zoom level regardless of image size
      const metersPerPixel = getMetersPerPixel(testRequest);
      
      // Use the same conversion logic as the main detection system
      const EARTH_RADIUS = 6378137;
      const ORIGIN_SHIFT = 2 * Math.PI * EARTH_RADIUS / 2.0;
      
      const latLngToMercator = (lat: number, lng: number) => {
        const x = lng * ORIGIN_SHIFT / 180.0;
        let y = Math.log(Math.tan((90 + lat) * Math.PI / 360.0)) / (Math.PI / 180.0);
        y = y * ORIGIN_SHIFT / 180.0;
        return { x, y };
      };
      
      const mercatorToLatLng = (x: number, y: number) => {
        const lng = (x / ORIGIN_SHIFT) * 180.0;
        let lat = (y / ORIGIN_SHIFT) * 180.0;
        lat = 180 / Math.PI * (2 * Math.atan(Math.exp(lat * Math.PI / 180.0)) - Math.PI / 2.0);
        return { lat, lng };
      };
      
      // Convert pixel coordinates to lat/lng
      const tileCenterLat = parseFloat(centerLat as string);
      const tileCenterLng = parseFloat(centerLng as string);
      const centerMercator = latLngToMercator(tileCenterLat, tileCenterLng);
      
      const offsetX = parseInt(pixelX as string) - (imgWidth / 2);
      const offsetY = parseInt(pixelY as string) - (imgHeight / 2);
      
      const meterX = offsetX * metersPerPixel;
      const meterY = -offsetY * metersPerPixel; // Y is inverted
      
      const newMercatorX = centerMercator.x + meterX;
      const newMercatorY = centerMercator.y + meterY;
      
      const result = mercatorToLatLng(newMercatorX, newMercatorY);
      
      res.json({
        pixel: { x: parseInt(pixelX as string), y: parseInt(pixelY as string) },
        coordinates: result,
        resolution: {
          metersPerPixel: metersPerPixel,
          imageSize: `${imgWidth}x${imgHeight}`,
          zoomLevel: zoom,
          tileSystem: 'Azure Maps Web Mercator'
        },
        calculation: {
          centerMercator: centerMercator,
          pixelOffset: { x: offsetX, y: offsetY },
          meterOffset: { x: meterX, y: meterY },
          newMercator: { x: newMercatorX, y: newMercatorY }
        },
        message: `Pixel (${pixelX}, ${pixelY}) converts to (${result.lat.toFixed(8)}, ${result.lng.toFixed(8)})`
      });
    } catch (error) {
      res.status(500).json({ error: 'Coordinate conversion failed', details: error.message });
    }
  });

  app.post("/api/test-coordinate-conversion", async (req, res) => {
    try {
      const { analysisId, tileIndex, testPoints } = req.body;
      
      if (!analysisId || tileIndex === undefined) {
        return res.status(400).json({ error: "analysisId and tileIndex are required" });
      }
      
      // Get analysis data
      const analysis = await storage.getAnalysisRequest(analysisId);
      if (!analysis) {
        return res.status(404).json({ error: "Analysis not found" });
      }
      
      // Get tile mapping from storage (for comparison with precise calculations)
      const tileMappings = await storage.getTileMappingsByAnalysisId(analysisId);
      const currentTileMapping = tileMappings.find(tm => tm.tileIndex === tileIndex);
      if (!currentTileMapping) {
        return res.status(404).json({ error: "Tile mapping not found in storage" });
      }

      // Calculate PRECISE tile bounds using Google Maps tile system
      const request = {
        topLeftLat: analysis.topLeftLat!,
        topLeftLng: analysis.topLeftLng!,
        bottomRightLat: analysis.bottomRightLat!,
        bottomRightLng: analysis.bottomRightLng!,
        zoomLevel: analysis.zoomLevel!
      };

      // Calculate tile grid to find the specific tile
      const tileGrid = azureMapsService.calculateTileGrid(request);
      
      if (tileIndex >= tileGrid.length) {
        return res.status(404).json({ error: `Tile index ${tileIndex} out of range (0-${tileGrid.length - 1})` });
      }
      
      const tileInfo = tileGrid[tileIndex];
      
      // Calculate precise tile bounds using Web Mercator projection
      const latLngToTile = (lat: number, lng: number, zoom: number) => {
        const n = Math.pow(2, zoom);
        const x = Math.floor(((lng + 180) / 360) * n);
        const latRad = (lat * Math.PI) / 180;
        const y = Math.floor(((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2) * n);
        return { x, y };
      };

      const tileToBounds = (x: number, y: number, zoom: number) => {
        const n = Math.pow(2, zoom);
        const lng_deg_west = (x / n) * 360.0 - 180.0;
        const lng_deg_east = ((x + 1) / n) * 360.0 - 180.0;
        const lat_rad_north = Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n)));
        const lat_rad_south = Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + 1) / n)));
        const lat_deg_north = (lat_rad_north * 180.0) / Math.PI;
        const lat_deg_south = (lat_rad_south * 180.0) / Math.PI;
        
        return {
          north: lat_deg_north,
          south: lat_deg_south,
          west: lng_deg_west,
          east: lng_deg_east
        };
      };
      
      // Get the precise tile coordinates for this tile
      const tileCoords = latLngToTile(tileInfo.centerLat, tileInfo.centerLng, request.zoomLevel);
      const preciseBounds = tileToBounds(tileCoords.x, tileCoords.y, request.zoomLevel);
      
      console.log(`Tile ${tileIndex} precise bounds:`, preciseBounds);
      console.log(`Tile ${tileIndex} center from grid:`, { lat: tileInfo.centerLat, lng: tileInfo.centerLng });
      
      // Helper functions using Web Mercator projection with center-based calculations (exact Python script logic)
      const EARTH_RADIUS = 6378137;
      const ORIGIN_SHIFT = 2 * Math.PI * EARTH_RADIUS / 2.0;
      
      const latLngToMercator = (lat: number, lng: number) => {
        const x = lng * ORIGIN_SHIFT / 180.0;
        let y = Math.log(Math.tan((90 + lat) * Math.PI / 360.0)) / (Math.PI / 180.0);
        y = y * ORIGIN_SHIFT / 180.0;
        return { x, y };
      };
      
      const mercatorToLatLng = (x: number, y: number) => {
        const lng = (x / ORIGIN_SHIFT) * 180.0;
        let lat = (y / ORIGIN_SHIFT) * 180.0;
        lat = 180 / Math.PI * (2 * Math.atan(Math.exp(lat * Math.PI / 180.0)) - Math.PI / 2.0);
        return { lat, lng };
      };
      
      // Use exact center coordinates - check for custom test coordinates first
      let tileCenterLat, tileCenterLng;
      if (req.body.testCenterCoords) {
        tileCenterLat = req.body.testCenterCoords.lat;
        tileCenterLng = req.body.testCenterCoords.lng;
      } else {
        // Use precise coordinates from Google Static Maps URL if available
        const urlMatch = tileInfo.url?.match(/center=([^&]+)/);
        if (urlMatch) {
          const [lat, lng] = urlMatch[1].split(',').map(Number);
          tileCenterLat = lat;
          tileCenterLng = lng;
        } else {
          // Fallback to grid calculated center (rounded to match Google Static Maps precision)
          tileCenterLat = parseFloat(tileInfo.centerLat.toFixed(6));
          tileCenterLng = parseFloat(tileInfo.centerLng.toFixed(6));
        }
      }
      
      console.log(`Using center coordinates for conversion: ${tileCenterLat}, ${tileCenterLng}`);
      const centerMercator = latLngToMercator(tileCenterLat, tileCenterLng);
      const tileMetersPerPixel = 0.298; // Fixed resolution for zoom 19
      
      const pixelToLatLngForTile = (pixelX: number, pixelY: number, imageWidth = 640, imageHeight = 640) => {
        // Calculate offset from center in pixels
        const offsetX = pixelX - (imageWidth / 2);
        const offsetY = pixelY - (imageHeight / 2);
        
        // Convert pixel offset to meters (Y is inverted)
        const meterX = offsetX * tileMetersPerPixel;
        const meterY = -offsetY * tileMetersPerPixel;
        
        // Calculate new mercator coordinates
        const newMercatorX = centerMercator.x + meterX;
        const newMercatorY = centerMercator.y + meterY;
        
        // Convert back to lat/lng
        return mercatorToLatLng(newMercatorX, newMercatorY);
      };
      
      const latLngToPixelForTile = (lat: number, lng: number, imageWidth = 640, imageHeight = 640) => {
        // Convert to mercator
        const mercator = latLngToMercator(lat, lng);
        
        // Calculate offset in meters from center
        const meterOffsetX = mercator.x - centerMercator.x;
        const meterOffsetY = mercator.y - centerMercator.y;
        
        // Convert to pixel offset (Y is inverted)
        const pixelOffsetX = meterOffsetX / tileMetersPerPixel;
        const pixelOffsetY = -meterOffsetY / tileMetersPerPixel;
        
        // Calculate final pixel coordinates
        const pixelX = (imageWidth / 2) + pixelOffsetX;
        const pixelY = (imageHeight / 2) + pixelOffsetY;
        
        const inBounds = pixelX >= 0 && pixelX <= imageWidth && pixelY >= 0 && pixelY <= imageHeight;
        
        return { x: Math.round(pixelX), y: Math.round(pixelY), inBounds };
      };
      
      // Test predefined points
      const predefinedTests = [
        { x: 0, y: 0, desc: "Top-left corner" },
        { x: 640, y: 0, desc: "Top-right corner" },
        { x: 0, y: 640, desc: "Bottom-left corner" },
        { x: 640, y: 640, desc: "Bottom-right corner" },
        { x: 320, y: 320, desc: "Center" }
      ];
      
      const pixelToCoordResults = predefinedTests.map(test => {
        const coords = pixelToLatLngForTile(test.x, test.y);
        return {
          description: test.desc,
          pixel: { x: test.x, y: test.y },
          coordinates: coords
        };
      });
      
      // Test coordinate bounds using PRECISE tile bounds
      const boundsTests = [
        { lat: preciseBounds.north, lng: preciseBounds.west, desc: "Precise tile top-left" },
        { lat: preciseBounds.north, lng: preciseBounds.east, desc: "Precise tile top-right" },
        { lat: preciseBounds.south, lng: preciseBounds.west, desc: "Precise tile bottom-left" },
        { lat: preciseBounds.south, lng: preciseBounds.east, desc: "Precise tile bottom-right" },
        { lat: (preciseBounds.north + preciseBounds.south) / 2, 
          lng: (preciseBounds.west + preciseBounds.east) / 2, desc: "Precise tile center" }
      ];
      
      const coordToPixelResults = boundsTests.map(test => {
        const pixel = latLngToPixelForTile(test.lat, test.lng);
        return {
          description: test.desc,
          coordinates: { lat: test.lat, lng: test.lng },
          pixel: pixel,
          inBounds: pixel.inBounds
        };
      });
      
      // Test image size independence - all center pixels should convert to same coordinates
      const imageSizeTests = [
        { description: "640x640 center", pixel: { x: 320, y: 320 }, imageWidth: 640, imageHeight: 640 },
        { description: "1280x1280 center", pixel: { x: 640, y: 640 }, imageWidth: 1280, imageHeight: 1280 },
        { description: "512x512 center", pixel: { x: 256, y: 256 }, imageWidth: 512, imageHeight: 512 },
        { description: "800x600 center", pixel: { x: 400, y: 300 }, imageWidth: 800, imageHeight: 600 },
        { description: "1024x768 center", pixel: { x: 512, y: 384 }, imageWidth: 1024, imageHeight: 768 }
      ];
      
      const imageSizeTestResults = imageSizeTests.map(test => {
        const coords = pixelToLatLngForTile(test.pixel.x, test.pixel.y, test.imageWidth, test.imageHeight);
        return {
          description: test.description,
          imageSize: `${test.imageWidth}x${test.imageHeight}`,
          centerPixel: test.pixel,
          coordinates: coords,
          // Test round-trip conversion
          backToPixel: latLngToPixelForTile(coords.lat, coords.lng, test.imageWidth, test.imageHeight)
        };
      });

      // Test custom points if provided
      let customTestResults: any[] = [];
      if (testPoints && Array.isArray(testPoints)) {
        customTestResults = testPoints.map((point: any, index: number) => {
          if (point.type === 'pixel') {
            const coords = pixelToLatLngForTile(point.x, point.y);
            return {
              test: `Custom pixel test ${index + 1}`,
              input: { type: 'pixel', x: point.x, y: point.y },
              output: { type: 'coordinates', lat: coords.lat, lng: coords.lng }
            };
          } else if (point.type === 'coordinates') {
            const pixel = latLngToPixelForTile(point.lat, point.lng);
            return {
              test: `Custom coordinate test ${index + 1}`,
              input: { type: 'coordinates', lat: point.lat, lng: point.lng },
              output: { type: 'pixel', x: pixel.x, y: pixel.y, inBounds: pixel.inBounds }
            };
          }
          return null;
        }).filter(Boolean);
      }
      
      // Calculate precision metrics using precise bounds
      const metersPerPixel = getMetersPerPixel(request);
      const preciseTileLatRange = preciseBounds.north - preciseBounds.south;
      const preciseTileLngRange = preciseBounds.east - preciseBounds.west;
      
      res.json({
        analysisId,
        tileIndex,
        tileInfo: {
          bounds: {
            topLeft: { lat: preciseBounds.north, lng: preciseBounds.west },
            bottomRight: { lat: preciseBounds.south, lng: preciseBounds.east }
          },
          center: {
            lat: (preciseBounds.north + preciseBounds.south) / 2,
            lng: (preciseBounds.west + preciseBounds.east) / 2
          },
          size: {
            latRange: preciseTileLatRange,
            lngRange: preciseTileLngRange
          },
          preciseWebMercatorBounds: preciseBounds,
          gridTileInfo: tileInfo
        },
        precisionMetrics: {
          metersPerPixel: metersPerPixel,
          latDegreesPerPixel: preciseTileLatRange / 640,
          lngDegreesPerPixel: preciseTileLngRange / 640,
          zoomLevel: analysis.zoomLevel,
          correctedResolution: metersPerPixel === 0.298 ? "Using exact 0.298m/pixel for zoom 19" : "Using calculated resolution"
        },
        tests: {
          pixelToCoordinates: pixelToCoordResults,
          coordinatesToPixel: coordToPixelResults,
          customTests: customTestResults,
          imageSizeIndependence: imageSizeTestResults
        }
      });
      
    } catch (error) {
      console.error("Error testing coordinate conversion:", error);
      res.status(500).json({ 
        error: "Failed to test coordinate conversion",
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // === END COORDINATE CONVERSION TEST ROUTES ===
  
  // === END TILE VISUALIZATION ROUTES ===

  // === END BATCH PROCESSING ROUTES ===

  // Stage 1: Load map tiles
  app.post("/api/load-maps", async (req, res) => {
    try {
      console.log("Request body:", JSON.stringify(req.body, null, 2));
      const validatedRequest = analyzeAreaSchema.parse(req.body);
    
    // If polygon is provided, calculate bounds from polygon
    let finalRequest = validatedRequest;
    if (validatedRequest.polygon && validatedRequest.polygon.length >= 3) {
      const polygon = validatedRequest.polygon;
      let minLat = polygon[0].lat;
      let maxLat = polygon[0].lat;
      let minLng = polygon[0].lng;
      let maxLng = polygon[0].lng;
      
      polygon.forEach(point => {
        minLat = Math.min(minLat, point.lat);
        maxLat = Math.max(maxLat, point.lat);
        minLng = Math.min(minLng, point.lng);
        maxLng = Math.max(maxLng, point.lng);
      });
      
      finalRequest = {
        ...validatedRequest,
        topLeftLat: maxLat,
        topLeftLng: minLng,
        bottomRightLat: minLat,
        bottomRightLng: maxLng
      };
      
      console.log('Polygon bounds calculated:', {
        polygon: polygon.length + ' points',
        bounds: `${maxLat.toFixed(6)}, ${minLng.toFixed(6)} to ${minLat.toFixed(6)}, ${maxLng.toFixed(6)}`
      });
    }
      console.log("Validation passed:", validatedRequest);
      const forceRefresh = req.body.forceRefresh === true;

      // Get actual tile count from GoogleMapsService
      console.log("Calling calculateTileGrid...");
      const tiles = azureMapsService.calculateTileGrid(finalRequest);
      const tileCount = tiles.length;
      console.log(`Calculated ${tileCount} tiles`);
      if (tileCount > 400) {
        return res.status(200).json({ 
          error: "Area too large",
          message: `Area too large. Requires ${tileCount} tiles, maximum is 400.`,
          tileCount,
          maxTiles: 400
        });
      }

      // Create analysis request
      const analysisRequest = await storage.createAnalysisRequest({
        topLeftLat: finalRequest.topLeftLat!,
        topLeftLng: finalRequest.topLeftLng!,
        bottomRightLat: finalRequest.bottomRightLat!,
        bottomRightLng: finalRequest.bottomRightLng!,
        zoomLevel: finalRequest.zoomLevel,
        recordId: validatedRequest.recordId || null,
        formattedAddress: validatedRequest.formattedAddress || null,
        polygon: finalRequest.polygon || null
      });

      // Load map tiles from Google Static Maps API (run asynchronously)
      console.log(`About to call loadMapTiles for analysis ${analysisRequest.id}`);
      loadMapTiles(analysisRequest.id, finalRequest, azureMapsService, forceRefresh).catch(error => {
        console.error('Async map loading failed:', error);
      });
      console.log(`loadMapTiles call initiated for analysis ${analysisRequest.id}`);

      res.json({ 
        analysisId: analysisRequest.id,
        status: "loading_maps",
        estimatedTime: forceRefresh ? "Refreshing from Google Maps..." : "2-3 seconds",
        tileCount
      });
    } catch (error) {
      console.error("Map loading error:", error);
      res.status(400).json({ 
        message: "Invalid request parameters",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Stage 2: Run object detection
  app.post("/api/analyze/:id", async (req, res) => {
    try {
      const analysisId = parseInt(req.params.id);
      const analysisRequest = await storage.getAnalysisRequest(analysisId);
      const { detectOnCurrentImage, detectOnAllImages, selectedTileIndex } = req.body;

      if (!analysisRequest) {
        return res.status(404).json({ message: "Analysis not found" });
      }

      if (analysisRequest.status !== "maps_loaded" && analysisRequest.status !== "completed") {
        return res.status(400).json({ 
          message: "Maps must be loaded before running analysis" 
        });
      }

      const detectionScope = detectOnCurrentImage ? 'current' : 
                           detectOnAllImages ? 'all' : 'all'; // Default to all

      console.log(`Starting ${detectionScope} image boat detection for analysis ${analysisId}`);

      // Start object detection processing with scope
      setTimeout(() => processObjectDetection(analysisId, analysisRequest, detectionScope), 100);

      res.json({ 
        analysisId,
        status: "processing",
        message: `Object detection started for ${detectionScope} image${detectionScope === 'all' ? 's' : ''}`
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to start object detection" });
    }
  });

  // Run object detection with scope
  app.post("/api/run-detection", async (req, res) => {
    try {
      const { analysisId, detectionScope, selectedTileIndex } = req.body;
      
      if (!analysisId) {
        return res.status(400).json({ message: "Analysis ID is required" });
      }

      if (!detectionScope || !['current', 'all'].includes(detectionScope)) {
        return res.status(400).json({ message: "Detection scope must be 'current' or 'all'" });
      }

      const analysisRequest = await storage.getAnalysisRequest(analysisId);
      if (!analysisRequest) {
        return res.status(404).json({ message: "Analysis not found" });
      }

      if (analysisRequest.status !== "maps_loaded" && analysisRequest.status !== "completed") {
        return res.status(400).json({ 
          message: "Maps must be loaded before running analysis" 
        });
      }

      // Check for cached analysis results before running detection
      if (detectionScope === 'all' && analysisRequest.recordId && analysisRequest.formattedAddress) {
        const isCached = analysisCache.isCached(
          analysisRequest.recordId,
          analysisRequest.formattedAddress,
          analysisRequest.topLeftLat!,
          analysisRequest.topLeftLng!,
          analysisRequest.bottomRightLat!,
          analysisRequest.bottomRightLng!,
          analysisRequest.zoomLevel
        );

        if (isCached) {
          const cachedResult = analysisCache.getCached(
            analysisRequest.recordId,
            analysisRequest.formattedAddress,
            analysisRequest.topLeftLat!,
            analysisRequest.topLeftLng!,
            analysisRequest.bottomRightLat!,
            analysisRequest.bottomRightLng!,
            analysisRequest.zoomLevel
          );

          if (cachedResult) {
            console.log(`Found cached analysis for ${analysisRequest.recordId} - ${analysisRequest.formattedAddress} (${cachedResult.detections.length} detections)`);
            
            // Clear existing detections and load cached ones
            await storage.deleteDetectionsByAnalysisId(analysisId);
            
            // Import cached detections
            for (const detection of cachedResult.detections) {
              await storage.createDetection({
                analysisId,
                objectId: detection.objectId,
                objectType: detection.objectType,
                subType: detection.subType,
                lat: detection.lat,
                lng: detection.lng,
                length: detection.length,
                width: detection.width,
                area: detection.area,
                confidence: detection.confidence,
                status: detection.status,
                boundingBox: detection.boundingBox,
                geoPolygon: detection.geoPolygon,
                tileIndex: detection.tileIndex
              });
            }

            // Update analysis status to completed
            await storage.updateAnalysisStatus(analysisId, "completed");

            return res.json({
              analysisId,
              status: "completed",
              message: `Loaded ${cachedResult.detections.length} boats from cached analysis (${new Date(cachedResult.cachedAt).toLocaleDateString()})`
            });
          }
        }
      }

      console.log(`Starting ${detectionScope} image boat detection for analysis ${analysisId}${selectedTileIndex !== undefined ? ` (tile ${selectedTileIndex})` : ''}`);

      // Start object detection processing with scope and selected tile
      setTimeout(() => processObjectDetection(analysisId, analysisRequest, detectionScope, selectedTileIndex), 100);

      res.json({ 
        analysisId,
        status: "processing",
        message: `Object detection started for ${detectionScope} image${detectionScope === 'all' ? 's' : ''}`
      });
    } catch (error) {
      console.error("Failed to start object detection:", error);
      res.status(500).json({ message: "Failed to start object detection" });
    }
  });

  // Get analysis results
  // Diagnostic endpoint to check environment configuration
  app.get("/api/health", async (req, res) => {
    const health = {
      status: "ok",
      timestamp: new Date().toISOString(),
      environment: {
        nodeEnv: process.env.NODE_ENV,
        hasGoogleMapsKey: !!process.env.GOOGLE_MAPS_API_KEY,
        hasVisionAgentKey: !!process.env.VISION_AGENT_API_KEY,
        hasDatabaseUrl: !!process.env.DATABASE_URL
      }
    };
    res.json(health);
  });

  app.get("/api/analysis/:id", async (req, res) => {
    try {
      const analysisId = parseInt(req.params.id);
      const analysisRequest = await storage.getAnalysisRequest(analysisId);

      if (!analysisRequest) {
        return res.status(404).json({ message: "Analysis not found" });
      }

      const detections = await storage.getDetectionsByAnalysisId(analysisId);

      // Log detection count for debugging
      console.log(`API /analysis/${analysisId}: returning ${detections.length} detections, status: ${analysisRequest.status}`);

      const result: AnalysisResult = {
        analysisId,
        status: analysisRequest.status,
        mapImageUrl: analysisRequest.mapImageUrl || undefined,
        tileUrls: analysisRequest.tileUrls as string[] || undefined,
        annotatedImageUrls: analysisRequest.annotatedImageUrls as string[] || undefined,
        detections,
        stats: calculateStats(detections, analysisRequest),
        polygon: analysisRequest.polygon as Array<{lat: number, lng: number}> || undefined,
      };

      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to retrieve analysis results" });
    }
  });

  // Get analysis statistics breakdown
  app.get("/api/analysis/:id/statistics", async (req, res) => {
    try {
      const analysisId = parseInt(req.params.id);
      const analysisRequest = await storage.getAnalysisRequest(analysisId);

      if (!analysisRequest) {
        return res.status(404).json({ message: "Analysis not found" });
      }

      const detections = await storage.getDetectionsByAnalysisId(analysisId);

      // Get raw detection counts by type
      const rawStats = {
        total: detections.length,
        byType: {
          small: detections.filter(d => d.subType === 'small').length,
          medium: detections.filter(d => d.subType === 'medium').length,
          large: detections.filter(d => d.subType === 'large').length
        },
        avgConfidence: detections.length > 0 ? 
          Math.round((detections.reduce((sum, d) => sum + (d.confidence || 0), 0) / detections.length) * 10) / 10 : 0
      };

      // Get AOI filtering and deduplication stats if available
      let aoiStats = null;
      let finalStats = null;

      // First check if this analysis has batch processing data
      try {
        const batchAOIResults = await db.select().from(batchAOIs).where(eq(batchAOIs.analysisId, analysisId)).limit(1);
        
        if (batchAOIResults.length > 0) {
          const batchAOI = batchAOIResults[0];
          
          // Get AOI polygon for filtering simulation
          let aoiPolygon: Array<{lat: number, lng: number}> | undefined;
          
          if (batchAOI.polygonCoordinates) {
            const polygonData = batchAOI.polygonCoordinates;
            if (typeof polygonData === 'string') {
              aoiPolygon = JSON.parse(polygonData) as Array<{lat: number, lng: number}>;
            } else if (Array.isArray(polygonData)) {
              aoiPolygon = polygonData as Array<{lat: number, lng: number}>;
            }
          }

          // If we have AOI polygon, calculate filtered results
          if (aoiPolygon) {
            const aoiFilteredDetections = filterDetectionsByAOI(detections, aoiPolygon);
            const deduplicatedDetections = deduplicateDetections(aoiFilteredDetections);

            aoiStats = {
              total: aoiFilteredDetections.length,
              byType: {
                small: aoiFilteredDetections.filter(d => d.subType === 'small').length,
                medium: aoiFilteredDetections.filter(d => d.subType === 'medium').length,
                large: aoiFilteredDetections.filter(d => d.subType === 'large').length
              },
              filteredOut: detections.length - aoiFilteredDetections.length
            };

            finalStats = {
              total: deduplicatedDetections.length,
              byType: {
                small: deduplicatedDetections.filter(d => d.subType === 'small').length,
                medium: deduplicatedDetections.filter(d => d.subType === 'medium').length,
                large: deduplicatedDetections.filter(d => d.subType === 'large').length
              },
              duplicatesRemoved: aoiFilteredDetections.length - deduplicatedDetections.length
            };
          }

          // Use batch processing stored stats if available
          if (batchAOI.rawDetections !== null) {
            rawStats.total = batchAOI.rawDetections;
          }
          if (batchAOI.filteredDetections !== null && batchAOI.finalDetections !== null) {
            aoiStats = {
              total: batchAOI.filteredDetections,
              byType: aoiStats?.byType || { small: 0, medium: 0, large: 0 },
              filteredOut: batchAOI.rawDetections - batchAOI.filteredDetections
            };
            finalStats = {
              total: batchAOI.finalDetections,
              byType: finalStats?.byType || { small: 0, medium: 0, large: 0 },
              duplicatesRemoved: batchAOI.filteredDetections - batchAOI.finalDetections
            };
          }
        } else {
          // No batch processing data - check if this is a regular single analysis with polygon
          // Check if the analysis request has polygon coordinates stored
          if (analysisRequest.polygon && Array.isArray(analysisRequest.polygon) && analysisRequest.polygon.length > 0) {
            const aoiPolygon = analysisRequest.polygon as Array<{lat: number, lng: number}>;
            
            // Calculate AOI filtering and deduplication for single analysis
            const aoiFilteredDetections = filterDetectionsByAOI(detections, aoiPolygon);
            const deduplicatedDetections = deduplicateDetections(aoiFilteredDetections);

            aoiStats = {
              total: aoiFilteredDetections.length,
              byType: {
                small: aoiFilteredDetections.filter(d => d.subType === 'small').length,
                medium: aoiFilteredDetections.filter(d => d.subType === 'medium').length,
                large: aoiFilteredDetections.filter(d => d.subType === 'large').length
              },
              filteredOut: detections.length - aoiFilteredDetections.length
            };

            finalStats = {
              total: deduplicatedDetections.length,
              byType: {
                small: deduplicatedDetections.filter(d => d.subType === 'small').length,
                medium: deduplicatedDetections.filter(d => d.subType === 'medium').length,
                large: deduplicatedDetections.filter(d => d.subType === 'large').length
              },
              duplicatesRemoved: aoiFilteredDetections.length - deduplicatedDetections.length
            };
          }
        }
      } catch (error) {
        console.error("Error fetching analysis stats:", error);
      }

      // Get actual tiles processed (optimized count) from tile URLs
      const actualTileCount = analysisRequest.tileUrls ? (analysisRequest.tileUrls as string[]).length : 0;
      
      const response = {
        analysisId,
        recordId: analysisRequest.recordId,
        formattedAddress: analysisRequest.formattedAddress,
        status: analysisRequest.status,
        createdAt: analysisRequest.createdAt,
        tilesProcessed: actualTileCount, // This shows the actual optimized tile count
        rawDetections: rawStats,
        aoiFiltered: aoiStats,
        finalDetections: finalStats
      };

      res.json(response);
    } catch (error) {
      console.error("Error fetching analysis statistics:", error);
      res.status(500).json({ message: "Failed to retrieve analysis statistics" });
    }
  });

  // Export analysis results as CSV
  app.get("/api/analysis/:id/export", async (req, res) => {
    try {
      const analysisId = parseInt(req.params.id);
      const detections = await storage.getDetectionsByAnalysisId(analysisId);

      if (detections.length === 0) {
        return res.status(404).json({ message: "No data to export" });
      }

      const csvContent = generateCSV(detections);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="marina_analysis_${analysisId}.csv"`);
      res.send(csvContent);
    } catch (error) {
      res.status(500).json({ message: "Failed to export data" });
    }
  });

  // Export analysis results with AOI filtering and deduplication as Excel
  app.get("/api/analysis/:id/export-filtered", async (req, res) => {
    try {
      const analysisId = parseInt(req.params.id);
      const analysisRequest = await storage.getAnalysisRequest(analysisId);
      
      if (!analysisRequest) {
        return res.status(404).json({ message: "Analysis not found" });
      }

      const detections = await storage.getDetectionsByAnalysisId(analysisId);

      // Allow zero detections - we'll handle this case by creating an empty Excel file

      // Get AOI polygon from batch AOI or single analysis request
      let aoiPolygon: Array<{lat: number, lng: number}> | undefined;
      
      // First check batch_aois table for polygon data
      try {
        const batchAOIResults = await db.select().from(batchAOIs).where(eq(batchAOIs.analysisId, analysisId)).limit(1);
        if (batchAOIResults.length > 0 && batchAOIResults[0].polygonCoordinates) {
          const polygonData = batchAOIResults[0].polygonCoordinates;
          
          // Handle both string and object cases
          if (typeof polygonData === 'string') {
            aoiPolygon = JSON.parse(polygonData) as Array<{lat: number, lng: number}>;
          } else if (Array.isArray(polygonData)) {
            aoiPolygon = polygonData as Array<{lat: number, lng: number}>;
          } else {
            console.warn("Unexpected polygon data format:", typeof polygonData);
          }
          
          if (aoiPolygon) {
            console.log(`Found AOI polygon from batch data with ${aoiPolygon.length} points`);
          }
        }
      } catch (e) {
        console.warn("Could not parse AOI polygon from batch data:", e);
      }

      // If no batch polygon found, check analysis_requests.polygon for single analysis
      if (!aoiPolygon && analysisRequest.polygon) {
        try {
          let polygonData = analysisRequest.polygon;
          
          // Handle both string and object cases
          if (typeof polygonData === 'string') {
            aoiPolygon = JSON.parse(polygonData) as Array<{lat: number, lng: number}>;
          } else if (Array.isArray(polygonData)) {
            aoiPolygon = polygonData as Array<{lat: number, lng: number}>;
          }
          
          if (aoiPolygon) {
            console.log(`Found AOI polygon from single analysis request with ${aoiPolygon.length} points`);
          }
        } catch (e) {
          console.warn("Could not parse AOI polygon from analysis request:", e);
        }
      }

      let filteredDetections = detections;
      let aoiFilteredCount = detections.length;

      // Apply AOI filtering if polygon is available
      if (aoiPolygon && aoiPolygon.length >= 3) {
        filteredDetections = filterDetectionsByAOI(detections, aoiPolygon);
        aoiFilteredCount = filteredDetections.length;
        console.log(`AOI filtering: ${detections.length} → ${aoiFilteredCount} detections`);
      }

      // Apply deduplication
      const deduplicatedDetections = deduplicateDetections(filteredDetections);
      console.log(`Deduplication: ${aoiFilteredCount} → ${deduplicatedDetections.length} detections`);

      // Format detections for Excel export
      const exportData = deduplicatedDetections.map(detection => ({
        RecordID: analysisRequest.recordId || "",
        Address: analysisRequest.formattedAddress || "",
        Type: detection.subType || detection.objectType,
        Latitude: detection.lat,
        Longitude: detection.lng,
        Length: detection.length?.toFixed(2) || "0.00",
        Width: detection.width?.toFixed(2) || "0.00",
        "Polygon Coordinates": detection.geoPolygon ? JSON.stringify(detection.geoPolygon) : ""
      }));

      // Handle zero detection case - create empty Excel with headers
      let finalData = exportData;
      if (exportData.length === 0) {
        // Create empty row with headers for zero detection case
        finalData = [{
          RecordID: analysisRequest.recordId || "",
          Address: analysisRequest.formattedAddress || "",
          Type: "No detections found",
          Latitude: "",
          Longitude: "",
          Length: "",
          Width: "",
          "Polygon Coordinates": ""
        }];
      }

      // Create Excel file
      const XLSX = await import('xlsx');
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(finalData);
      XLSX.utils.book_append_sheet(workbook, worksheet, "Filtered Results");

      // Generate filename
      const recordId = analysisRequest.recordId || "analysis";
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const filename = `${recordId}_filtered_${timestamp}.xlsx`;

      // Write Excel file
      const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(excelBuffer);

      console.log(`Exported filtered analysis ${analysisId}: ${exportData.length} detections after AOI filtering and deduplication`);

    } catch (error) {
      console.error("Error exporting filtered analysis results:", error);
      res.status(500).json({ message: "Failed to export filtered data" });
    }
  });

  // Get sample marina coordinates
  app.get("/api/sample-coordinates", (req, res) => {
    const sampleLocations = [
      {
        name: "Newport Marina, RI",
        topLeftLat: 41.62932013181398,
        topLeftLng: -71.21881192032785,
        bottomRightLat: 41.62822755280231,
        bottomRightLng: -71.21756690031927,
      },
      {
        name: "Marina del Rey, CA",
        topLeftLat: 33.9806,
        topLeftLng: -118.4532,
        bottomRightLat: 33.9756,
        bottomRightLng: -118.4482,
      },
      {
        name: "San Francisco Marina, CA",
        topLeftLat: 37.8075,
        topLeftLng: -122.4475,
        bottomRightLat: 37.8025,
        bottomRightLng: -122.4425,
      },
    ];

    res.json(sampleLocations);
  });

  // Cache management endpoints
  app.get("/api/cache/stats", (req, res) => {
    try {
      const stats = tileCache.getCacheStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to get cache stats" });
    }
  });

  app.post("/api/cache/clear", (req, res) => {
    try {
      tileCache.clearAll();
      res.json({ message: "Cache cleared successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to clear cache" });
    }
  });

  app.post("/api/cache/cleanup", (req, res) => {
    try {
      const cleared = tileCache.clearExpired();
      res.json({ message: `Cleared ${cleared} expired entries` });
    } catch (error) {
      res.status(500).json({ message: "Failed to cleanup cache" });
    }
  });

  // Clear all system data and cache
  app.post("/api/system/clear-all", async (req, res) => {
    try {
      console.log("Starting complete system cleanup...");
      
      // For simplicity, just clear without counting
      const counts = {
        detections: "cleared",
        tileMappings: "cleared", 
        batchAOIs: "cleared",
        analysisRequests: "cleared",
        batchJobs: "cleared"
      };

      // Clear all database records
      await db.execute("DELETE FROM detections");
      await db.execute("DELETE FROM tile_mappings");
      await db.execute("DELETE FROM batch_aois");
      await db.execute("DELETE FROM batch_jobs");
      await db.execute("DELETE FROM analysis_requests");
      
      // Clear in-memory cache
      tileCache.clearAll();
      analysisCache.clearAll();
      
      // Clear file system cache
      const staticPath = process.env.NODE_ENV === 'production' 
        ? path.join(process.cwd(), 'server', 'static')
        : path.join(import.meta.dirname, 'static');
      
      const cacheDirs = ['cached_analysis', 'cached_tiles', 'tiles', 'annotated', 'visualizations'];
      
      for (const dir of cacheDirs) {
        const dirPath = path.join(staticPath, dir);
        try {
          if (fs.existsSync(dirPath)) {
            const files = fs.readdirSync(dirPath);
            for (const file of files) {
              fs.unlinkSync(path.join(dirPath, file));
            }
            console.log(`Cleared ${files.length} files from ${dir}`);
          }
        } catch (error) {
          console.warn(`Failed to clear ${dir}:`, error);
        }
      }
      
      console.log("Complete system cleanup finished");
      
      res.json({
        message: "System completely cleared",
        cleared: {
          database: counts,
          cache: "All file caches cleared",
          memory: "All in-memory caches cleared"
        }
      });
      
    } catch (error) {
      console.error("Failed to clear system:", error);
      res.status(500).json({ 
        message: "Failed to clear system", 
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

function calculateTileCount(request: AnalyzeAreaRequest): number {
  // Use the same tile calculation logic as the GoogleMapsService
  const latLngToTile = (lat: number, lng: number, zoom: number) => {
    const n = Math.pow(2, zoom);
    const x = Math.floor(((lng + 180) / 360) * n);
    const latRad = (lat * Math.PI) / 180;
    const y = Math.floor(((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2) * n);
    return { x, y };
  };

  const topLeftTile = latLngToTile(request.topLeftLat, request.topLeftLng, request.zoomLevel);
  const bottomRightTile = latLngToTile(request.bottomRightLat, request.bottomRightLng, request.zoomLevel);

  // Calculate grid dimensions to match row-major scanning
  const tilesX = Math.abs(bottomRightTile.x - topLeftTile.x) + 1;
  const tilesY = Math.abs(bottomRightTile.y - topLeftTile.y) + 1;

  return tilesX * tilesY;
}

async function loadMapTiles(analysisId: number, request: AnalyzeAreaRequest, azureMapsService: AzureMapsService, forceRefresh = false) {
  try {
    console.log(`[${analysisId}] Starting map tile loading`);

    // Update status to loading maps with coordinates
    await storage.updateAnalysisStatus(analysisId, `loading_maps: Preparing tiles for area ${request.topLeftLat.toFixed(6)}, ${request.topLeftLng.toFixed(6)} to ${request.bottomRightLat.toFixed(6)}, ${request.bottomRightLng.toFixed(6)} at zoom ${request.zoomLevel}`);
    console.log(`[${analysisId}] Status updated: preparing tiles`);

    // Calculate tile grid
    const tiles = azureMapsService.calculateTileGrid(request);
    console.log(`[${analysisId}] Calculated ${tiles.length} tiles`);
    
    await storage.updateAnalysisStatus(analysisId, `loading_maps: Requesting ${tiles.length} tiles from Azure Maps API...`);
    console.log(`[${analysisId}] Status updated: requesting tiles`);

    // Fetch map tiles from Azure Maps API
    console.log(`[${analysisId}] Calling azureMapsService.fetchMapTiles...`);
    const mapResponse = await azureMapsService.fetchMapTiles(request, forceRefresh);
    console.log(`[${analysisId}] Map tiles fetched successfully: ${mapResponse.tileCount} tiles`);

    await storage.updateAnalysisStatus(analysisId, `loading_maps: Successfully downloaded ${mapResponse.tileCount} tiles, stitching image...`);
    console.log(`[${analysisId}] Status updated: stitching`);

    // Store map data
    await storage.updateAnalysisMapData(analysisId, mapResponse.stitchedImageUrl, mapResponse.tileUrls, mapResponse.wasFromCache);
    console.log(`[${analysisId}] Map data stored successfully`);

    // Store tile mapping data for visualization
    for (let i = 0; i < tiles.length; i++) {
      const tile = tiles[i];
      const tileUrl = mapResponse.tileUrls[i];
      
      if (tileUrl) {
        // Calculate precise tile bounds using Web Mercator projection
        const zoomLevel = tiles[0].zoom;
        const tileSize = 256; // Google Maps tile size
        const earthRadius = 6378137; // Earth radius in meters
        const earthCircumference = 2 * Math.PI * earthRadius;
        const metersPerPixel = earthCircumference * Math.cos(tile.centerLat * Math.PI / 180) / Math.pow(2, zoomLevel + 8);
        
        // Calculate precise bounds based on 640x640 pixel tile at this zoom level
        const latDegreesPerPixel = 360 / Math.pow(2, zoomLevel) / 256;
        const lngDegreesPerPixel = 360 / Math.pow(2, zoomLevel) / 256 * Math.cos(tile.centerLat * Math.PI / 180);
        
        const halfTileLatDegrees = (320 * latDegreesPerPixel);
        const halfTileLngDegrees = (320 * lngDegreesPerPixel);

        await storage.createTileMapping({
          analysisId: analysisId,
          tileIndex: i, // Sequential index for processed tiles
          actualTileIndex: tile.originalGridIndex || i, // Original grid index before optimization
          tileUrl: tileUrl,
          centerLat: tile.centerLat,
          centerLng: tile.centerLng,
          topLeftLat: tile.centerLat + halfTileLatDegrees,
          topLeftLng: tile.centerLng - halfTileLngDegrees,
          bottomRightLat: tile.centerLat - halfTileLatDegrees,
          bottomRightLng: tile.centerLng + halfTileLngDegrees,
          imageWidth: 640,
          imageHeight: 640
        });
      }
    }
    console.log(`[${analysisId}] Tile mapping data stored for ${tiles.length} tiles`);

    // Update status to maps loaded
    await storage.updateAnalysisStatus(analysisId, "maps_loaded");
    console.log(`[${analysisId}] Map loading completed - status: maps_loaded`);
    
    return { tileCount: mapResponse.tileCount };

  } catch (error) {
    console.error(`[${analysisId}] Failed to load map tiles:`, error);
    await storage.updateAnalysisStatus(analysisId, `failed: ${error instanceof Error ? error.message : String(error)}`);
    console.log(`[${analysisId}] Status updated to failed`);
    throw error;
  }
}

async function processObjectDetection(analysisId: number, request: AnalysisRequest, detectionScope: string = 'all', selectedTileIndex?: number) {
  try {
    // Clear existing detections for this analysis at the very start
    await storage.deleteDetectionsByAnalysisId(analysisId);
    console.log(`Cleared existing detections for analysis ${analysisId}`);

    // Update status to processing
    await storage.updateAnalysisStatus(analysisId, "processing");

    // Get the latest analysis data from storage to ensure we have tile URLs
    const analysisData = await storage.getAnalysisRequest(analysisId);
    if (!analysisData) {
      throw new Error("Analysis request not found");
    }

    // Check if we have either a stitched image or tile URLs for detection
    if (!analysisData.mapImageUrl && !analysisData.tileUrls) {
      throw new Error("No map image or tiles available for detection");
    }

    console.log(`Running authentic boat detection for analysis ${analysisId} (scope: ${detectionScope}) with ${analysisData.tileUrls?.length || 0} tiles`);

    let imagesToProcess = [];
    
    if (detectionScope === 'current') {
      // Process only the selected tile
      const tileUrls = Array.isArray(analysisData.tileUrls) ? analysisData.tileUrls as string[] : [];
      if (selectedTileIndex !== undefined && selectedTileIndex >= 0 && selectedTileIndex < tileUrls.length) {
        // Use the selected tile
        imagesToProcess = [{ url: tileUrls[selectedTileIndex], name: `tile_${selectedTileIndex + 1}` }];
      } else {
        // Fallback to main stitched image if no valid tile selected
        if (!analysisData.mapImageUrl) {
          throw new Error("No map image available for current image detection");
        }
        imagesToProcess = [{ url: analysisData.mapImageUrl, name: 'current' }];
      }
    } else {
      // Process all individual tiles
      const tileUrls = Array.isArray(analysisData.tileUrls) ? analysisData.tileUrls as string[] : [];
      if (tileUrls.length === 0) {
        throw new Error("No tile images available for all images detection");
      }
      
      // Get tile mappings to preserve actual tile indices from optimization
      const tileMappings = await storage.getTileMappingsByAnalysisId(analysisId);
      
      imagesToProcess = tileUrls.map((url, index) => {
        // Find the corresponding tile mapping to get the actual tile index
        const mapping = tileMappings[index];
        const actualTileIndex = mapping ? mapping.actualTileIndex : index;
        
        return {
          url,
          name: `tile_${index + 1}`,
          actualTileIndex: actualTileIndex  // Preserve the actual tile index from optimization
        };
      });
    }

    console.log(`Processing ${imagesToProcess.length} image(s) for boat detection`);

    // Download and process each image
    const fs = await import('fs');
    let allDetections: any[] = [];
  let allAnnotatedImagePaths: string[] = [];
    
    for (let i = 0; i < imagesToProcess.length; i++) {
      const { url, name } = imagesToProcess[i];
      
      console.log(`[${analysisId}] Processing ${name} (${i + 1}/${imagesToProcess.length})`);
      
      // Store progress update for real-time tracking
      await storage.updateAnalysisStatus(analysisId, `processing: ${name} (${i + 1}/${imagesToProcess.length})`);
      
      let imageBuffer: ArrayBuffer;
      
      // Handle cached tiles by reading directly from filesystem
      if (url.startsWith('/api/static/cached_tiles/')) {
        const filePath = path.join(process.cwd(), 'server', 'static', 'cached_tiles', path.basename(url));
        try {
          const fileBuffer = await fs.promises.readFile(filePath);
          imageBuffer = fileBuffer.buffer.slice(fileBuffer.byteOffset, fileBuffer.byteOffset + fileBuffer.byteLength);
          console.log(`Read cached tile from filesystem: ${filePath}`);
        } catch (error) {
          console.warn(`Failed to read cached tile ${filePath}:`, error);
          continue;
        }
      } else {
        // Fetch from URL for non-cached images
        const imageResponse = await fetch(url);
        if (!imageResponse.ok) {
          console.warn(`Failed to fetch ${name}: ${imageResponse.statusText}`);
          continue;
        }
        imageBuffer = await imageResponse.arrayBuffer();
      }
      
      // Ensure tiles directory exists
      await fs.promises.mkdir('server/static/tiles', { recursive: true });
      
      const imagePath = `server/static/tiles/analysis_${analysisId}_${name}_input.jpg`;
      
      // Write image to disk for Python processing
      await fs.promises.writeFile(imagePath, Buffer.from(imageBuffer));

        // Try authentic vision-based detection for this image
        try {
          const { spawn } = await import('child_process');
          
          // Ensure annotated directory exists
          await fs.promises.mkdir('server/static/annotated', { recursive: true });
          
          const pythonProcess = spawn('python3', [
            'server/working_detection.py',
            imagePath,
            `server/static/annotated/analysis_${analysisId}_${name}_output`
          ]);

          let pythonOutput = '';
          let pythonError = '';

          pythonProcess.stdout.on('data', (data) => {
            pythonOutput += data.toString();
          });

          pythonProcess.stderr.on('data', (data) => {
            pythonError += data.toString();
          });

          await new Promise((resolve, reject) => {
            pythonProcess.on('close', (code) => {
              if (code === 0) {
                resolve(undefined);
              } else {
                console.error(`Vision detection failed for ${name}: ${pythonError}`);
                reject(new Error(`Vision detection failed with code ${code}: ${pythonError}`));
              }
            });
          });

          console.log(`Python output for ${name}:`, pythonOutput);

          // Parse detection results from vision-agent
          // Extract JSON from the output (it might be mixed with other text)
          let detectionResults;
          try {
            // Split output by lines and find the JSON line
            const lines = pythonOutput.split('\n');
            let jsonLine = '';
            
            // Look for a line that starts with { and contains the expected JSON structure
            for (const line of lines) {
              const trimmed = line.trim();
              if (trimmed.startsWith('{') && trimmed.includes('"status"') && trimmed.includes('"detections"')) {
                jsonLine = trimmed;
                break;
              }
            }
            
            if (!jsonLine) {
              // Fallback: try to extract JSON using regex
              const jsonMatch = pythonOutput.match(/\{[^{}]*"status"[^{}]*"detections"[\s\S]*?\}/);
              if (jsonMatch) {
                jsonLine = jsonMatch[0];
              }
            }
            
            if (!jsonLine) {
              throw new Error("No valid JSON found in Python output");
            }
            
            detectionResults = JSON.parse(jsonLine);
          } catch (error) {
            console.error(`Failed to parse detection results for ${name}:`, pythonOutput);
            console.error(`Parse error:`, error);
            throw new Error("Invalid detection results from vision model");
          }

          if (detectionResults.status !== "success") {
            throw new Error(`Vision detection failed: ${detectionResults.error || 'Unknown error'}`);
          }

          // Store the annotated image path from Vision Agent
          if (detectionResults.annotated_image_path) {
            const annotatedPath = detectionResults.annotated_image_path.replace('server/static/', '/api/static/');
            allAnnotatedImagePaths.push(annotatedPath);
            console.log(`Annotated image saved at: ${annotatedPath}`);
          }

          // Get actual image dimensions for accurate calculations
          const tileImageWidth = detectionResults.image_width || 640;
          const tileImageHeight = detectionResults.image_height || 640;
          
          // Convert vision detections to our format with dimension-based categorization
          const imageDetections = detectionResults.detections.map((det: any, index: number) => {
            const lengthMeters = det.boat_length_pixels * getMetersPerPixel(request);
            const globalIndex = allDetections.length + index + 1;
            
            // Use the actual tile index from optimization instead of parsing from name
            const currentImage = imagesToProcess.find(img => img.name === name);
            const tileIndex = currentImage?.actualTileIndex !== undefined ? currentImage.actualTileIndex : 
                             (name.includes('tile_') ? parseInt(name.split('_')[1]) - 1 : 0);
            
            // Convert normalized bbox (0.0-1.0) to pixel coordinates for accurate geographic conversion
            const normalizedBbox = det.bbox; // [x_min, y_min, x_max, y_max] in 0.0-1.0 range
            const pixelBbox = [
              normalizedBbox[0] * tileImageWidth,   // x_min in pixels
              normalizedBbox[1] * tileImageHeight,  // y_min in pixels  
              normalizedBbox[2] * tileImageWidth,   // x_max in pixels
              normalizedBbox[3] * tileImageHeight   // y_max in pixels
            ];
            
            // Convert bounding box to lat/lng coordinates using actual tile URL and image dimensions for precision
            const tileUrl = imagesToProcess.find(img => img.name === name)?.url;
            const geoCoords = convertBboxToLatLng(pixelBbox, tileIndex, analysisData, tileUrl, tileImageWidth, tileImageHeight);
            
            // Calculate center point for display
            const centerLat = (geoCoords.topLeft.lat + geoCoords.bottomRight.lat) / 2;
            const centerLng = (geoCoords.topLeft.lng + geoCoords.bottomRight.lng) / 2;

            return {
              analysisId,
              objectId: `B${globalIndex.toString().padStart(3, '0')}`,
              objectType: "boat",
              subType: categorizeBoatByLength(lengthMeters),
              lat: centerLat,
              lng: centerLng,
              length: Math.round(lengthMeters * 10) / 10,
              width: Math.round(lengthMeters * 0.4 * 10) / 10,
              area: Math.round(lengthMeters * lengthMeters * 0.4 * 10) / 10,
              confidence: Math.round(det.confidence * 100 * 10) / 10,
              status: "detected",
              boundingBox: {
                x: Math.round(det.bbox[0] * tileImageWidth),
                y: Math.round(det.bbox[1] * tileImageHeight),
                width: Math.round((det.bbox[2] - det.bbox[0]) * tileImageWidth),
                height: Math.round((det.bbox[3] - det.bbox[1]) * tileImageHeight)
              },
              geoPolygon: geoCoords,
              tileIndex: tileIndex
            };
          });

          // Store detections for this tile immediately
          console.log(`[${analysisId}] Found ${imageDetections.length} boats in ${name} - storing to database`);
          
          for (const detection of imageDetections) {
            try {
              await storage.createDetection(detection);
            } catch (detectionError) {
              console.error(`Failed to store detection ${detection.objectId}:`, detectionError);
              throw new Error(`Failed to store detection data: ${detectionError}`);
            }
          }

          allDetections.push(...imageDetections);
          console.log(`Authentic boat detection for ${name}: ${imageDetections.length} boats found`);

          // Update status with current progress including running total
          const currentTotal = allDetections.length;
          const completedTiles = imagesToProcess.findIndex(img => img.name === name) + 1;
          const totalTiles = imagesToProcess.length;
          await storage.updateAnalysisStatus(analysisId, `tile_${completedTiles}_of_${totalTiles}_completed_${currentTotal}_boats`, undefined);

          // Update annotated images incrementally
          if (allAnnotatedImagePaths.length > 0) {
            await storage.updateAnalysisAnnotatedImages(analysisId, allAnnotatedImagePaths);
          }

          // Add delay between tiles to prevent API rate limiting
          if (imagesToProcess.length > 1 && imagesToProcess.findIndex(img => img.name === name) < imagesToProcess.length - 1) {
            console.log(`[${analysisId}] Adding 3-second delay between tiles to prevent rate limiting...`);
            await new Promise(resolve => setTimeout(resolve, 3000));
          }

        } catch (visionError) {
          console.error(`Vision-agent failed for ${name}:`, visionError);
          // Check if this is a rate limit error
          const errorMessage = visionError instanceof Error ? visionError.message.toLowerCase() : String(visionError).toLowerCase();
          if (errorMessage.includes('rate limit') || errorMessage.includes('quota') || errorMessage.includes('429')) {
            console.log(`[${analysisId}] Rate limit detected for ${name}, adding extended delay before retry...`);
            await new Promise(resolve => setTimeout(resolve, 10000)); // 10 second delay for rate limits
          }
          throw visionError; // Don't fall back to mock data, show the actual error
        }
      }

    // Final update of annotated images
    if (allAnnotatedImagePaths.length > 0) {
      await storage.updateAnalysisAnnotatedImages(analysisId, allAnnotatedImagePaths);
    }

    console.log(`Boat detection completed: ${allDetections.length} total boats found across ${imagesToProcess.length} image(s)`);

    // Update status to completed with final verification
    await storage.updateAnalysisStatus(analysisId, "completed", new Date());
    
    // Verify detections were stored correctly
    const finalDetections = await storage.getDetectionsByAnalysisId(analysisId);
    console.log(`Final verification: ${finalDetections.length} detections stored in database for analysis ${analysisId}`);

    // Automatically cache analysis results for future use if this was a full analysis
    if (detectionScope === 'all' && request.recordId && request.formattedAddress) {
      try {
        const stats = calculateStats(finalDetections, request);
        await analysisCache.setCached(
          request.recordId,
          request.formattedAddress,
          request.topLeftLat!,
          request.topLeftLng!,
          request.bottomRightLat!,
          request.bottomRightLng!,
          request.zoomLevel,
          finalDetections,
          stats
        );
        console.log(`Cached analysis results for ${request.recordId} - ${request.formattedAddress} (${finalDetections.length} detections)`);
      } catch (cacheError) {
        console.warn('Failed to cache analysis results:', cacheError);
      }
    }

  } catch (error) {
    console.error("Failed to process authentic boat detection:", error);
    await storage.updateAnalysisStatus(analysisId, "failed");
  }
}

function categorizeBoatByLength(lengthMeters: number): string {
  if (lengthMeters < 12) return "small";
  if (lengthMeters < 20) return "medium";
  return "large";
}

function getMetersPerPixel(request: AnalysisRequest, imageSize: number = 512): number {
  // Web Mercator projection calculation - meters per pixel should be constant for same zoom level
  // regardless of image size, since each tile represents the same geographic area
  // User reference: 0.298 m/pixel at zoom 19
  
  const earthRadius = 6378137; // Earth radius in meters
  const representativeLat = request.topLeftLat ? (request.topLeftLat + request.bottomRightLat) / 2 : 41.5;
  const latitudeRadians = representativeLat * Math.PI / 180;
  
  // Standard Web Mercator formula: meters per pixel = (cos(lat) * 2 * π * R) / (2^(zoom + 8))
  // The +8 accounts for the fact that at zoom 0, there's 1 tile of 256x256 pixels
  const baseResolution = (Math.cos(latitudeRadians) * 2 * Math.PI * earthRadius) / Math.pow(2, request.zoomLevel + 8);
  
  // Apply correction factor to match user's expected 0.298 m/pixel at zoom 19
  const referenceResolution = 0.298; // m/pixel at zoom 19
  const referenceZoom = 19;
  const referenceLat = 41.5;
  
  // Calculate what the base formula gives for the reference case
  const referenceLatRadians = referenceLat * Math.PI / 180;
  const referenceBaseResolution = (Math.cos(referenceLatRadians) * 2 * Math.PI * earthRadius) / Math.pow(2, referenceZoom + 8);
  
  // Apply correction factor to match user's expected resolution
  const correctionFactor = referenceResolution / referenceBaseResolution;
  
  // Return corrected resolution - same for all image sizes at same zoom level
  return baseResolution * correctionFactor;
}

function convertBboxToLatLng(bbox: number[], tileIndex: number, request: AnalysisRequest, tileUrl?: string, imageWidth: number = 512, imageHeight: number = 512): {
  topLeft: { lat: number; lng: number };
  topRight: { lat: number; lng: number };
  bottomLeft: { lat: number; lng: number };
  bottomRight: { lat: number; lng: number };
} {
  const [x_min, y_min, x_max, y_max] = bbox;
  
  // Get tile center coordinates from Azure Maps tile grid calculation
  const tempAzureMapsService = new AzureMapsService(process.env.AZURE_MAPS_SUBSCRIPTION_KEY!);
  const analyzeRequest = {
    topLeftLat: request.topLeftLat!,
    topLeftLng: request.topLeftLng!,
    bottomRightLat: request.bottomRightLat!,
    bottomRightLng: request.bottomRightLng!,
    zoomLevel: request.zoomLevel!
  };
  
  const tileGrid = tempAzureMapsService.calculateTileGrid(analyzeRequest);
  
  let tileCenterLat, tileCenterLng;
  if (tileIndex < tileGrid.length) {
    const tileInfo = tileGrid[tileIndex];
    tileCenterLat = tileInfo.centerLat;
    tileCenterLng = tileInfo.centerLng;
  } else {
    // Fallback - use approximate center of the analysis area
    tileCenterLat = (request.topLeftLat + request.bottomRightLat) / 2;
    tileCenterLng = (request.topLeftLng + request.bottomRightLng) / 2;
  }
  
  // Azure Maps Web Mercator projection functions
  const EARTH_RADIUS = 6378137;
  const ORIGIN_SHIFT = 2 * Math.PI * EARTH_RADIUS / 2.0;
  
  const latLngToMercator = (lat: number, lng: number) => {
    const x = lng * ORIGIN_SHIFT / 180.0;
    let y = Math.log(Math.tan((90 + lat) * Math.PI / 360.0)) / (Math.PI / 180.0);
    y = y * ORIGIN_SHIFT / 180.0;
    return { x, y };
  };
  
  const mercatorToLatLng = (x: number, y: number) => {
    const lng = (x / ORIGIN_SHIFT) * 180.0;
    let lat = (y / ORIGIN_SHIFT) * 180.0;
    lat = 180 / Math.PI * (2 * Math.atan(Math.exp(lat * Math.PI / 180.0)) - Math.PI / 2.0);
    return { lat, lng };
  };
  
  const pixelToLatLng = (pixelX: number, pixelY: number) => {
    // Use actual tile center coordinates
    const centerMercator = latLngToMercator(tileCenterLat!, tileCenterLng!);
    
    // Calculate meters per pixel for this specific analysis area and image size
    const metersPerPixel = getMetersPerPixel(request, imageWidth);
    
    // Calculate offset from center in pixels
    const offsetX = pixelX - (imageWidth / 2);
    const offsetY = pixelY - (imageHeight / 2);
    
    // Convert pixel offset to meters (Y is inverted for screen coordinates)
    const meterX = offsetX * metersPerPixel;
    const meterY = -offsetY * metersPerPixel;
    
    // Calculate new mercator coordinates
    const newMercatorX = centerMercator.x + meterX;
    const newMercatorY = centerMercator.y + meterY;
    
    // Convert back to lat/lng
    return mercatorToLatLng(newMercatorX, newMercatorY);
  };
  
  // Convert bbox pixel coordinates to lat/lng using Web Mercator
  const topLeft = pixelToLatLng(x_min, y_min);
  const topRight = pixelToLatLng(x_max, y_min);
  const bottomLeft = pixelToLatLng(x_min, y_max);
  const bottomRight = pixelToLatLng(x_max, y_max);
  
  return {
    topLeft,
    topRight,
    bottomLeft,
    bottomRight
  };
}

// Legacy coordinate conversion functions removed - now using Web Mercator projection in convertBboxToLatLng and coordinate test API

// Mock detection function removed - using only authentic detection

function calculateStats(detections: any[], analysisRequest: any, actualTileCount?: number) {
  const boats = detections.filter(d => d.objectType === "boat");

  const vesselTypes = {
    small: boats.filter(b => b.subType === "small").length,
    medium: boats.filter(b => b.subType === "medium").length,
    large: boats.filter(b => b.subType === "large").length,
  };

  const avgConfidence = boats.length > 0 
    ? Math.round((boats.reduce((sum, d) => sum + d.confidence, 0) / boats.length) * 10) / 10
    : 0;

  return {
    totalVessels: boats.length,
    vesselTypes,
    avgConfidence,
    processingTime: "2.8s",
    tileCount: actualTileCount || calculateTileCount(analysisRequest), // Use actual tile count if provided
  };
}

// AOI Polygon filtering and deduplication functions for batch processing
function isPointInPolygon(point: {lat: number, lng: number}, polygon: Array<{lat: number, lng: number}>): boolean {
  const x = point.lng;
  const y = point.lat;
  let inside = false;
  
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng;
    const yi = polygon[i].lat;
    const xj = polygon[j].lng;
    const yj = polygon[j].lat;
    
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  
  return inside;
}

function isBoatInAOI(geoPolygon: any, aoiPolygon: Array<{lat: number, lng: number}>): boolean {
  if (!geoPolygon || !aoiPolygon || aoiPolygon.length < 3) {
    return false;
  }
  
  // Check if boat's corners are in AOI polygon
  const corners = [
    { lat: geoPolygon.topLeft.lat, lng: geoPolygon.topLeft.lng },
    { lat: geoPolygon.topRight.lat, lng: geoPolygon.topRight.lng },
    { lat: geoPolygon.bottomRight.lat, lng: geoPolygon.bottomRight.lng },
    { lat: geoPolygon.bottomLeft.lat, lng: geoPolygon.bottomLeft.lng }
  ];
  
  const cornersInside = corners.filter(corner => isPointInPolygon(corner, aoiPolygon)).length;
  const percentageInside = cornersInside / corners.length;
  

  
  // Return true if at least 70% of boat is inside AOI
  return percentageInside >= 0.7;
}

function filterDetectionsByAOI(detections: any[], aoiPolygon?: Array<{lat: number, lng: number}>): any[] {
  if (!aoiPolygon || aoiPolygon.length < 3) {
    return detections; // Return all detections if no AOI polygon
  }
  
  return detections.filter(detection => {
    if (!detection.geoPolygon) return false; // Skip detections without geo polygon
    return isBoatInAOI(detection.geoPolygon, aoiPolygon);
  });
}

function calculatePolygonOverlap(polygon1: any, polygon2: any): number {
  if (!polygon1 || !polygon2) return 0;
  
  // Simple bounding box overlap calculation
  const box1 = {
    left: Math.min(polygon1.topLeft.lng, polygon1.bottomRight.lng),
    right: Math.max(polygon1.topLeft.lng, polygon1.bottomRight.lng),
    top: Math.max(polygon1.topLeft.lat, polygon1.bottomRight.lat),
    bottom: Math.min(polygon1.topLeft.lat, polygon1.bottomRight.lat)
  };
  
  const box2 = {
    left: Math.min(polygon2.topLeft.lng, polygon2.bottomRight.lng),
    right: Math.max(polygon2.topLeft.lng, polygon2.bottomRight.lng),
    top: Math.max(polygon2.topLeft.lat, polygon2.bottomRight.lat),
    bottom: Math.min(polygon2.topLeft.lat, polygon2.bottomRight.lat)
  };
  
  // Calculate overlap area
  const overlapLeft = Math.max(box1.left, box2.left);
  const overlapRight = Math.min(box1.right, box2.right);
  const overlapTop = Math.min(box1.top, box2.top);
  const overlapBottom = Math.max(box1.bottom, box2.bottom);
  
  if (overlapLeft >= overlapRight || overlapBottom >= overlapTop) {
    return 0; // No overlap
  }
  
  const overlapArea = (overlapRight - overlapLeft) * (overlapTop - overlapBottom);
  const area1 = (box1.right - box1.left) * (box1.top - box1.bottom);
  const area2 = (box2.right - box2.left) * (box2.top - box2.bottom);
  
  // Return overlap as percentage of smaller polygon
  const smallerArea = Math.min(area1, area2);
  return overlapArea / smallerArea;
}

function deduplicateDetections(detections: any[]): any[] {
  const OVERLAP_THRESHOLD = 0.7; // 70% overlap threshold
  const deduplicated: any[] = [];
  const markedForRemoval = new Set<number>();
  
  for (let i = 0; i < detections.length; i++) {
    if (markedForRemoval.has(i)) continue;
    
    const detection1 = detections[i];
    let isDuplicate = false;
    
    for (let j = i + 1; j < detections.length; j++) {
      if (markedForRemoval.has(j)) continue;
      
      const detection2 = detections[j];
      const overlap = calculatePolygonOverlap(detection1.geoPolygon, detection2.geoPolygon);
      
      if (overlap >= OVERLAP_THRESHOLD) {
        // Mark the detection with lower confidence for removal
        if (detection1.confidence >= detection2.confidence) {
          markedForRemoval.add(j);
        } else {
          markedForRemoval.add(i);
          isDuplicate = true;
          break;
        }
      }
    }
    
    if (!isDuplicate) {
      deduplicated.push(detection1);
    }
  }
  
  return deduplicated;
}

function generateCSV(detections: any[]): string {
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

  const rows = detections.map(d => [
    d.objectId,
    d.objectType,
    d.subType || "",
    d.lat.toFixed(6),
    d.lng.toFixed(6),
    d.length.toString(),
    d.width.toString(),
    d.area.toString(),
    d.status || "",
    d.confidence.toString()
  ]);

  return [headers, ...rows].map(row => row.join(",")).join("\n");
}

// Batch processing function
async function processBatchJob(batchJobId: number, azureMapsService: AzureMapsService) {
  console.log(`Starting batch processing for job ${batchJobId}`);
  
  try {
    const job = await storage.getBatchJob(batchJobId);
    if (!job) {
      throw new Error("Batch job not found");
    }

    const aois = await storage.getBatchAOIsByJobId(batchJobId);
    // Only process AOIs that haven't been completed or failed yet
    const unprocessedAOIs = aois.filter(aoi => aoi.status === 'pending');
    console.log(`Processing ${unprocessedAOIs.length} unprocessed AOIs out of ${aois.length} total for batch job ${batchJobId}`);

    let processedCount = 0;
    let failedCount = 0;

    for (const aoi of unprocessedAOIs) {
      try {
        // Check if batch job has been paused
        const currentJob = await storage.getBatchJob(batchJobId);
        if (currentJob?.status === "paused") {
          console.log(`Batch job ${batchJobId} has been paused, stopping processing`);
          return;
        }
        
        console.log(`Processing AOI ${aoi.id}: ${aoi.recordId} - ${aoi.formattedAddress}`);
        
        // Update AOI status to processing
        await storage.updateBatchAOIStatus(aoi.id, "processing");

        // Calculate bounds from polygon
        let polygon: Array<{lat: number, lng: number}>;
        try {
          // Parse the polygon coordinates (stored as JSON string)
          const polygonStr = typeof aoi.polygonCoordinates === 'string' 
            ? aoi.polygonCoordinates 
            : JSON.stringify(aoi.polygonCoordinates);
          polygon = JSON.parse(polygonStr);
          console.log(`[${aoi.id}] Parsed polygon with ${polygon.length} points`);
        } catch (e) {
          console.error(`[${aoi.id}] Failed to parse polygon coordinates:`, e);
          throw new Error("Invalid polygon coordinates format");
        }
        
        if (!polygon || polygon.length < 3) {
          throw new Error("Invalid polygon coordinates - need at least 3 points");
        }

        let minLat = polygon[0].lat;
        let maxLat = polygon[0].lat;
        let minLng = polygon[0].lng;
        let maxLng = polygon[0].lng;

        for (const point of polygon) {
          minLat = Math.min(minLat, point.lat);
          maxLat = Math.max(maxLat, point.lat);
          minLng = Math.min(minLng, point.lng);
          maxLng = Math.max(maxLng, point.lng);
        }

        // Create analysis request for this AOI
        const analysisRequest = await storage.createAnalysisRequest({
          topLeftLat: maxLat,
          topLeftLng: minLng,
          bottomRightLat: minLat,
          bottomRightLng: maxLng,
          zoomLevel: 19, // Default zoom level for batch processing
          recordId: aoi.recordId,
          formattedAddress: aoi.formattedAddress
        });

        console.log(`Created analysis request ${analysisRequest.id} for AOI ${aoi.id}`);

        // Check if analysis is already cached with actual detections
        const cachedResult = analysisCache.getCached(
          aoi.recordId || "", aoi.formattedAddress || "",
          maxLat, minLng, minLat, maxLng, 19
        );
        
        // Also check database for existing analysis with same RecordID and FormattedAddress
        let existingAnalysis = null;
        if (!cachedResult || !cachedResult.detections || cachedResult.detections.length === 0) {
          console.log(`[${aoi.id}] No filesystem cache found, checking database for existing analysis...`);
          
          // Check for existing completed analysis with same record ID and address
          const existingAnalyses = await db.select()
            .from(analysisRequests)
            .where(
              and(
                eq(analysisRequests.recordId, aoi.recordId || ""),
                eq(analysisRequests.formattedAddress, aoi.formattedAddress || ""),
                eq(analysisRequests.status, "completed")
              )
            )
            .orderBy(desc(analysisRequests.id))
            .limit(1);
            
          if (existingAnalyses.length > 0) {
            existingAnalysis = existingAnalyses[0];
            console.log(`[${aoi.id}] Found existing analysis ${existingAnalysis.id} for AOI ${aoi.recordId}`);
          }
        }
        
        if ((cachedResult && cachedResult.detections && cachedResult.detections.length > 0) || existingAnalysis) {
          if (cachedResult && cachedResult.detections && cachedResult.detections.length > 0) {
            console.log(`[${aoi.id}] Using filesystem cached analysis for AOI ${aoi.recordId} (${cachedResult.detections.length} boats)`);
            
            // Check if detections already exist for this analysis
            const existingDetections = await storage.getDetectionsByAnalysisId(analysisRequest.id);
            
            if (existingDetections.length === 0) {
              // Store cached detections in database for this analysis with new IDs
              for (const detection of cachedResult.detections) {
                await storage.createDetection({
                  analysisId: analysisRequest.id,
                  objectId: detection.objectId,
                  objectType: detection.objectType,
                  subType: detection.subType,
                  lat: detection.lat,
                  lng: detection.lng,
                  length: detection.length,
                  width: detection.width,
                  area: detection.area,
                  confidence: detection.confidence,
                  status: detection.status,
                  boundingBox: detection.boundingBox,
                  geoPolygon: detection.geoPolygon,
                  tileIndex: detection.tileIndex
                });
              }
              console.log(`[${aoi.id}] Stored ${cachedResult.detections.length} cached detections for analysis ${analysisRequest.id}`);
            } else {
              console.log(`[${aoi.id}] Detections already exist for analysis ${analysisRequest.id}, skipping insertion`);
            }
            
            // Update analysis with cached data
            await storage.updateAnalysisStatus(analysisRequest.id, "completed", new Date());
            
            // Update AOI statistics for cached result
            await storage.updateBatchAOIStatistics(aoi.id, {
              tilesProcessed: cachedResult.stats?.tileCount || 0,
              rawDetections: cachedResult.detections.length,
              filteredDetections: cachedResult.detections.length,
              finalDetections: cachedResult.detections.length,
              processingDuration: 0 // Cached results don't require processing time
            });
            
          } else if (existingAnalysis) {
            console.log(`[${aoi.id}] Using database cached analysis ${existingAnalysis.id} for AOI ${aoi.recordId}`);
            
            // Get detections from existing analysis
            const sourceDetections = await storage.getDetectionsByAnalysisId(existingAnalysis.id);
            console.log(`[${aoi.id}] Found ${sourceDetections.length} detections in existing analysis ${existingAnalysis.id}`);
            
            // Check if detections already exist for this analysis
            const existingDetections = await storage.getDetectionsByAnalysisId(analysisRequest.id);
            
            if (existingDetections.length === 0) {
              // Bulk copy detections using direct SQL for performance
              const startTime = Date.now();
              await db.execute(`
                INSERT INTO detections (analysis_id, object_id, object_type, sub_type, lat, lng, length, width, area, confidence, status, bounding_box, geo_polygon, tile_index)
                SELECT ${analysisRequest.id}, object_id, object_type, sub_type, lat, lng, length, width, area, confidence, status, bounding_box, geo_polygon, tile_index
                FROM detections 
                WHERE analysis_id = ${existingAnalysis.id}
              `);
              const copyTime = Date.now() - startTime;
              console.log(`[${aoi.id}] Bulk copied ${sourceDetections.length} detections from analysis ${existingAnalysis.id} to analysis ${analysisRequest.id} in ${copyTime}ms`);
            } else {
              console.log(`[${aoi.id}] Detections already exist for analysis ${analysisRequest.id}, skipping copy`);
            }
            
            // Update analysis with cached data
            await storage.updateAnalysisStatus(analysisRequest.id, "completed", new Date());
            
            // Update AOI statistics based on existing analysis
            const existingBatchAOI = await db.select()
              .from(batchAOIs)
              .where(eq(batchAOIs.analysisId, existingAnalysis.id))
              .limit(1);
              
            const tilesProcessed = existingBatchAOI.length > 0 ? existingBatchAOI[0].tilesProcessed || sourceDetections.length : sourceDetections.length;
            
            await storage.updateBatchAOIStatistics(aoi.id, {
              tilesProcessed: tilesProcessed,
              rawDetections: sourceDetections.length,
              filteredDetections: sourceDetections.length,
              finalDetections: sourceDetections.length,
              processingDuration: 0 // Cached results don't require processing time
            });
          }
          
          // Mark AOI as completed
          await storage.updateBatchAOIStatus(aoi.id, "completed", analysisRequest.id, undefined, new Date());
        } else {
          if (cachedResult) {
            console.log(`[${aoi.id}] Cached analysis found but no detections - running fresh analysis`);
          } else {
            console.log(`[${aoi.id}] No cache found - running fresh analysis`);
          }
          // Process the AOI using existing pipeline
          const request: AnalyzeAreaRequest = {
            topLeftLat: maxLat,
            topLeftLng: minLng,
            bottomRightLat: minLat,
            bottomRightLng: maxLng,
            zoomLevel: 19,
            polygon: polygon,
            recordId: aoi.recordId,
            formattedAddress: aoi.formattedAddress
          };

          console.log(`[${aoi.id}] Starting tile loading for ${aoi.recordId}`);
          const processingStartTime = new Date();
          await storage.updateBatchAOIStatus(aoi.id, "processing", analysisRequest.id, undefined, undefined);
          await storage.updateBatchAOIStatistics(aoi.id, { processingStartedAt: processingStartTime });
          
          // Load map tiles
          const mapResult = await loadMapTiles(analysisRequest.id, request, azureMapsService);
          const tileCount = mapResult?.tileCount || 0;
          console.log(`[${aoi.id}] Tile loading completed (${tileCount} tiles), starting object detection`);
          
          // Clear any existing detections for this analysis (in case of restart)
          await storage.deleteDetectionsByAnalysisId(analysisRequest.id);
          console.log(`[${aoi.id}] Cleared existing detections for analysis ${analysisRequest.id}`);
          
          // Run object detection on all tiles
          await processObjectDetection(analysisRequest.id, request, 'all');
          console.log(`[${aoi.id}] Object detection completed`);
          
          // Update analysis status to completed
          await storage.updateAnalysisStatus(analysisRequest.id, "completed", new Date());
          
          // Get all detections for statistics
          const allDetections = await storage.getDetectionsByAnalysisId(analysisRequest.id);
          
          // Apply AOI filtering if polygon is provided
          let filteredDetections = allDetections;
          if (polygon && polygon.length >= 3) {
            console.log(`[${aoi.id}] Applying AOI filtering with polygon of ${polygon.length} points`);
            filteredDetections = allDetections.filter(detection => {
              if (!detection.geoPolygon) return false;
              try {
                let detGeoPolygon;
                // Handle both string and object cases for geoPolygon
                if (typeof detection.geoPolygon === 'string') {
                  detGeoPolygon = JSON.parse(detection.geoPolygon);
                } else {
                  detGeoPolygon = detection.geoPolygon;
                }
                const isInside = isBoatInAOI(detGeoPolygon, polygon);
                return isInside;
              } catch (e) {
                console.log(`[${aoi.id}] Error parsing detection geoPolygon:`, e);
                return false;
              }
            });
            console.log(`[${aoi.id}] AOI filtering: ${allDetections.length} → ${filteredDetections.length} detections`);
          } else {
            console.log(`[${aoi.id}] No valid polygon provided, skipping AOI filtering`);
          }
          
          // Apply deduplication
          console.log(`[${aoi.id}] Applying deduplication to ${filteredDetections.length} detections`);
          const finalDetections = deduplicateDetections(filteredDetections);
          console.log(`[${aoi.id}] Deduplication: ${filteredDetections.length} → ${finalDetections.length} detections`);
          
          // Calculate processing duration
          const processingEndTime = new Date();
          const processingDuration = Math.floor((processingEndTime.getTime() - processingStartTime.getTime()) / 1000);
          
          // Update statistics
          await storage.updateBatchAOIStatistics(aoi.id, {
            tilesProcessed: tileCount,
            rawDetections: allDetections.length,
            filteredDetections: filteredDetections.length,
            finalDetections: finalDetections.length,
            processingDuration: processingDuration
          });
          
          // Cache the analysis results with actual tile count
          const stats = calculateStats(allDetections, request, tileCount);
          
          await analysisCache.setCached(
            aoi.recordId || "", aoi.formattedAddress || "",
            maxLat, minLng, minLat, maxLng, 19,
            allDetections, stats
          );
          
          console.log(`[${aoi.id}] Analysis completed: ${allDetections.length} raw → ${filteredDetections.length} filtered → ${finalDetections.length} final detections (${processingDuration}s)`);
        }

        // Update AOI status to completed
        await storage.updateBatchAOIStatus(aoi.id, "completed", analysisRequest.id, undefined, new Date());
        processedCount++;

        console.log(`Successfully processed AOI ${aoi.id}: ${aoi.recordId}`);

      } catch (error) {
        console.error(`Failed to process AOI ${aoi.id}:`, error);
        
        // Update AOI status to failed
        await storage.updateBatchAOIStatus(aoi.id, "failed", undefined, error.message, new Date());
        failedCount++;
      }

      // Update batch job progress
      await storage.updateBatchJobProgress(batchJobId, processedCount, failedCount);
    }

    // Check if all AOIs have been processed before marking batch as completed
    const allAOIs = await storage.getBatchAOIsByJobId(batchJobId);
    const pendingAOIs = allAOIs.filter(aoi => aoi.status === 'pending' || aoi.status === 'processing');
    
    if (pendingAOIs.length === 0) {
      // All AOIs have been processed (either completed or failed)
      await storage.updateBatchJobStatus(batchJobId, "completed", new Date());
      console.log(`Batch job ${batchJobId} completed: ${processedCount} processed, ${failedCount} failed`);
    } else {
      // Still have pending AOIs, keep status as processing
      console.log(`Batch job ${batchJobId} processing paused: ${processedCount} processed, ${failedCount} failed, ${pendingAOIs.length} remaining`);
    }

  } catch (error) {
    console.error(`Batch job ${batchJobId} failed:`, error);
    await storage.updateBatchJobStatus(batchJobId, "failed", new Date());
    throw error;
  }
}