import { pgTable, text, serial, real, integer, timestamp, jsonb, boolean, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  displayName: text("display_name"),
  email: text("email"),
  entraId: text("entra_id").unique(),
  role: text("role").default("PROJECT_USER"),
  lastLogin: timestamp("last_login"),
  password: text("password"), // Optional for Entra ID users
});

export const analysisRequests = pgTable("analysis_requests", {
  id: serial("id").primaryKey(),
  topLeftLat: doublePrecision("top_left_lat").notNull(),
  topLeftLng: doublePrecision("top_left_lng").notNull(),
  bottomRightLat: doublePrecision("bottom_right_lat").notNull(),
  bottomRightLng: doublePrecision("bottom_right_lng").notNull(),
  zoomLevel: integer("zoom_level").notNull(),
  recordId: text("record_id"), // User-provided record identifier for caching
  formattedAddress: text("formatted_address"), // User-provided address for caching
  polygon: jsonb("polygon"), // AOI polygon coordinates for filtering
  status: text("status").notNull().default("pending"), // pending, maps_loaded, processing, completed, failed
  mapImageUrl: text("map_image_url"), // URL to the stitched map image
  tileUrls: jsonb("tile_urls"), // Array of individual tile URLs for debugging
  annotatedImageUrls: jsonb("annotated_image_urls"), // Array of annotated image URLs

  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const detections = pgTable("detections", {
  id: serial("id").primaryKey(),
  analysisId: integer("analysis_id").notNull(),
  objectId: text("object_id").notNull(),
  objectType: text("object_type").notNull(), // boat, empty-slip, occupied-slip
  subType: text("sub_type"), // sailboat, motorboat, yacht, finger-pier, side-tie
  lat: doublePrecision("lat").notNull(),
  lng: doublePrecision("lng").notNull(),
  length: doublePrecision("length").notNull(), // in meters
  width: doublePrecision("width").notNull(), // in meters
  area: doublePrecision("area").notNull(), // in square meters
  confidence: doublePrecision("confidence").notNull(), // 0-100
  status: text("status"), // moored, available, etc.
  boundingBox: jsonb("bounding_box").notNull(), // {x, y, width, height} in pixels
  geoPolygon: jsonb("geo_polygon"), // Geographic polygon coordinates
  tileIndex: integer("tile_index") // Index of the tile where this detection was found
});

export const tileMappings = pgTable("tile_mappings", {
  id: serial("id").primaryKey(),
  analysisId: integer("analysis_id").notNull(),
  tileIndex: integer("tile_index").notNull(), // Sequential index (0, 1, 2, ...) for processed tiles
  actualTileIndex: integer("actual_tile_index"), // Original grid index from optimization (temporarily nullable)
  tileUrl: text("tile_url").notNull(),
  centerLat: doublePrecision("center_lat").notNull(),
  centerLng: doublePrecision("center_lng").notNull(),
  topLeftLat: doublePrecision("top_left_lat").notNull(),
  topLeftLng: doublePrecision("top_left_lng").notNull(),
  bottomRightLat: doublePrecision("bottom_right_lat").notNull(),
  bottomRightLng: doublePrecision("bottom_right_lng").notNull(),
  imageWidth: integer("image_width").notNull().default(640),
  imageHeight: integer("image_height").notNull().default(640),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const batchJobs = pgTable("batch_jobs", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(), // User-friendly name for the batch
  status: text("status").notNull().default("pending"), // pending, processing, paused, completed, failed, cancelled
  totalAOIs: integer("total_aois").notNull().default(0),
  processedAOIs: integer("processed_aois").notNull().default(0),
  failedAOIs: integer("failed_aois").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const batchAOIs = pgTable("batch_aois", {
  id: serial("id").primaryKey(),
  batchJobId: integer("batch_job_id").notNull(),
  recordId: text("record_id").notNull(),
  formattedAddress: text("formatted_address").notNull(),
  polygonCoordinates: jsonb("polygon_coordinates").notNull(), // Array of {lat, lng} points
  status: text("status").notNull().default("pending"), // pending, processing, completed, failed
  analysisId: integer("analysis_id"), // Reference to the completed analysis
  errorMessage: text("error_message"),
  // Processing statistics
  tilesProcessed: integer("tiles_processed").default(0),
  rawDetections: integer("raw_detections").default(0),
  filteredDetections: integer("filtered_detections").default(0),
  finalDetections: integer("final_detections").default(0),
  processingStartedAt: timestamp("processing_started_at"),
  processingDuration: integer("processing_duration_seconds"), // Duration in seconds
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

// Define relations
export const usersRelations = relations(users, ({ many }) => ({
  analysisRequests: many(analysisRequests),
}));

export const analysisRequestsRelations = relations(analysisRequests, ({ many }) => ({
  detections: many(detections),
  tileMappings: many(tileMappings),
}));

export const detectionsRelations = relations(detections, ({ one }) => ({
  analysisRequest: one(analysisRequests, {
    fields: [detections.analysisId],
    references: [analysisRequests.id],
  }),
}));

export const tileMappingsRelations = relations(tileMappings, ({ one }) => ({
  analysisRequest: one(analysisRequests, {
    fields: [tileMappings.analysisId],
    references: [analysisRequests.id],
  }),
}));

export const batchJobsRelations = relations(batchJobs, ({ many }) => ({
  batchAOIs: many(batchAOIs),
}));

export const batchAOIsRelations = relations(batchAOIs, ({ one }) => ({
  batchJob: one(batchJobs, {
    fields: [batchAOIs.batchJobId],
    references: [batchJobs.id],
  }),
  analysisRequest: one(analysisRequests, {
    fields: [batchAOIs.analysisId],
    references: [analysisRequests.id],
  }),
}));

export const insertAnalysisRequestSchema = createInsertSchema(analysisRequests).pick({
  topLeftLat: true,
  topLeftLng: true,
  bottomRightLat: true,
  bottomRightLng: true,
  zoomLevel: true,
  recordId: true,
  formattedAddress: true,
  polygon: true,
});

export const insertDetectionSchema = createInsertSchema(detections).pick({
  analysisId: true,
  objectId: true,
  objectType: true,
  subType: true,
  lat: true,
  lng: true,
  length: true,
  width: true,
  area: true,
  confidence: true,
  status: true,
  boundingBox: true,
  geoPolygon: true,
  tileIndex: true,
});

export const insertBatchJobSchema = createInsertSchema(batchJobs).pick({
  name: true,
});

export const insertBatchAOISchema = createInsertSchema(batchAOIs).pick({
  batchJobId: true,
  recordId: true,
  formattedAddress: true,
  polygonCoordinates: true,
});

export const insertTileMappingSchema = createInsertSchema(tileMappings).pick({
  analysisId: true,
  tileIndex: true,
  actualTileIndex: true,
  tileUrl: true,
  centerLat: true,
  centerLng: true,
  topLeftLat: true,
  topLeftLng: true,
  bottomRightLat: true,
  bottomRightLng: true,
  imageWidth: true,
  imageHeight: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertAnalysisRequest = z.infer<typeof insertAnalysisRequestSchema>;
export type AnalysisRequest = typeof analysisRequests.$inferSelect;
export type InsertDetection = z.infer<typeof insertDetectionSchema>;
export type Detection = typeof detections.$inferSelect;
export type InsertBatchJob = z.infer<typeof insertBatchJobSchema>;
export type BatchJob = typeof batchJobs.$inferSelect;
export type InsertBatchAOI = z.infer<typeof insertBatchAOISchema>;
export type BatchAOI = typeof batchAOIs.$inferSelect;
export type InsertTileMapping = z.infer<typeof insertTileMappingSchema>;
export type TileMapping = typeof tileMappings.$inferSelect;

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  displayName: true,
  email: true,
  entraId: true,
  role: true,
  password: true,
});

// Request/Response schemas for API
export const analyzeAreaSchema = z.object({
  topLeftLat: z.number().min(-90).max(90).optional(),
  topLeftLng: z.number().min(-180).max(180).optional(),
  bottomRightLat: z.number().min(-90).max(90).optional(),
  bottomRightLng: z.number().min(-180).max(180).optional(),
  zoomLevel: z.number().min(16).max(20),
  recordId: z.string().optional(),
  formattedAddress: z.string().optional(),
  polygon: z.array(z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180)
  })).optional(),
}).refine(data => {
  // Either polygon or all coordinate fields must be provided
  const hasPolygon = data.polygon && data.polygon.length >= 3;
  const hasCoordinates = data.topLeftLat !== undefined && 
                         data.topLeftLng !== undefined && 
                         data.bottomRightLat !== undefined && 
                         data.bottomRightLng !== undefined;
  return hasPolygon || hasCoordinates;
}, {
  message: "Either polygon or all coordinate fields (topLeftLat, topLeftLng, bottomRightLat, bottomRightLng) must be provided"
});

export type AnalyzeAreaRequest = z.infer<typeof analyzeAreaSchema>;

export interface AnalysisResult {
  analysisId: number;
  status: string;
  mapImageUrl?: string;
  tileUrls?: string[];
  annotatedImageUrls?: string[];
  detections: Detection[];
  wasFromCache?: boolean;
  polygon?: Array<{lat: number, lng: number}>;
  stats: {
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

// CSV AOI parsing schema
export const csvAOISchema = z.object({
  RecordID: z.string().min(1, "Record ID is required"),
  "Formatted Address": z.string().min(1, "Formatted Address is required"),
  "Polygon Coordinates": z.string().min(1, "Polygon Coordinates is required"),
});

export type CSVAOIRow = z.infer<typeof csvAOISchema>;

// Batch processing interfaces
export interface BatchProgress {
  batchJobId: number;
  name: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  totalAOIs: number;
  processedAOIs: number;
  failedAOIs: number;
  aois: BatchAOIStatus[];
}

export interface BatchAOIStatus {
  id: number;
  recordId: string;
  formattedAddress: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  analysisId?: number;
  errorMessage?: string;
  completedAt?: Date;
  // Processing statistics
  tilesProcessed?: number;
  rawDetections?: number;
  filteredDetections?: number;
  finalDetections?: number;
  processingStartedAt?: Date;
  processingDuration?: number;
}