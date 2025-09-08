import { users, analysisRequests, detections, batchJobs, batchAOIs, tileMappings, type User, type InsertUser, type AnalysisRequest, type InsertAnalysisRequest, type Detection, type InsertDetection, type BatchJob, type InsertBatchJob, type BatchAOI, type InsertBatchAOI, type BatchProgress, type TileMapping, type InsertTileMapping } from "@shared/schema";
import { db } from "./db";
import { eq, and } from "drizzle-orm";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEntraId(entraId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserLastLogin(userId: number): Promise<void>;

  createAnalysisRequest(request: InsertAnalysisRequest): Promise<AnalysisRequest>;
  getAnalysisRequest(id: number): Promise<AnalysisRequest | undefined>;
  getAnalysisRequestsByRecordId(recordId: string): Promise<AnalysisRequest[]>;
  updateAnalysisStatus(id: number, status: string, completedAt?: Date): Promise<void>;
  updateAnalysisMapData(id: number, mapImageUrl: string, tileUrls: string[], wasFromCache?: boolean): Promise<void>;
  updateAnalysisAnnotatedImages(id: number, annotatedImagePaths: string[]): Promise<void>;

  createDetection(detection: InsertDetection): Promise<Detection>;
  getDetectionsByAnalysisId(analysisId: number): Promise<Detection[]>;
  getDetectionsByAnalysisIdAndTile(analysisId: number, tileIndex: number): Promise<Detection[]>;
  deleteDetectionsByAnalysisId(analysisId: number): Promise<void>;

  // Tile mapping methods
  createTileMapping(tileMapping: InsertTileMapping): Promise<TileMapping>;
  getTileMappingsByAnalysisId(analysisId: number): Promise<TileMapping[]>;

  // Batch processing methods
  createBatchJob(job: InsertBatchJob): Promise<BatchJob>;
  getBatchJob(id: number): Promise<BatchJob | undefined>;
  getAllBatchJobs(): Promise<BatchJob[]>;
  updateBatchJobStatus(id: number, status: string, completedAt?: Date): Promise<void>;
  updateBatchJobProgress(id: number, processedAOIs: number, failedAOIs: number): Promise<void>;
  updateBatchJobTotalAOIs(id: number, totalAOIs: number): Promise<void>;
  deleteBatchJob(id: number): Promise<void>;

  createBatchAOI(aoi: InsertBatchAOI): Promise<BatchAOI>;
  getBatchAOIsByJobId(batchJobId: number): Promise<BatchAOI[]>;
  updateBatchAOIStatus(id: number, status: string, analysisId?: number, errorMessage?: string, completedAt?: Date): Promise<void>;
  updateBatchAOIStatistics(id: number, stats: {
    tilesProcessed?: number;
    rawDetections?: number;
    filteredDetections?: number;
    finalDetections?: number;
    processingStartedAt?: Date;
    processingDuration?: number;
  }): Promise<void>;
  getBatchProgress(batchJobId: number): Promise<BatchProgress | undefined>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private analysisRequests: Map<number, AnalysisRequest>;
  private detections: Map<number, Detection>;
  private batchJobs: Map<number, BatchJob>;
  private batchAOIs: Map<number, BatchAOI>;
  private currentUserId: number;
  private currentAnalysisId: number;
  private currentDetectionId: number;
  private currentBatchJobId: number;
  private tileMappings: Map<number, TileMapping>;
  private currentBatchAOIId: number;
  private currentTileMappingId: number;

  constructor() {
    this.users = new Map();
    this.analysisRequests = new Map();
    this.detections = new Map();
    this.batchJobs = new Map();
    this.batchAOIs = new Map();
    this.tileMappings = new Map();
    this.currentUserId = 1;
    this.currentAnalysisId = 1;
    this.currentDetectionId = 1;
    this.currentBatchJobId = 1;
    this.currentBatchAOIId = 1;
    this.currentTileMappingId = 1;
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async getUserByEntraId(entraId: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.entraId === entraId,
    );
  }

  async updateUserLastLogin(userId: number): Promise<void> {
    const user = this.users.get(userId);
    if (user) {
      user.lastLogin = new Date();
      this.users.set(userId, user);
    }
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { 
      id,
      username: insertUser.username,
      displayName: insertUser.displayName || null,
      email: insertUser.email || null,
      entraId: insertUser.entraId || null,
      role: insertUser.role || null,
      password: insertUser.password || null,
      lastLogin: null
    };
    this.users.set(id, user);
    return user;
  }

  async createAnalysisRequest(insertRequest: InsertAnalysisRequest): Promise<AnalysisRequest> {
    const id = this.currentAnalysisId++;
    const request: AnalysisRequest = {
      ...insertRequest,
      id,
      recordId: insertRequest.recordId || null,
      formattedAddress: insertRequest.formattedAddress || null,
      polygon: insertRequest.polygon || null,
      status: "pending",
      mapImageUrl: null,
      tileUrls: null,
      annotatedImageUrls: null,
      createdAt: new Date(),
      completedAt: null,
    };
    this.analysisRequests.set(id, request);
    return request;
  }

  async getAnalysisRequest(id: number): Promise<AnalysisRequest | undefined> {
    return this.analysisRequests.get(id);
  }

  async getAnalysisRequestsByRecordId(recordId: string): Promise<AnalysisRequest[]> {
    return Array.from(this.analysisRequests.values()).filter(request => request.recordId === recordId);
  }

  async updateAnalysisStatus(id: number, status: string, completedAt?: Date): Promise<void> {
    const request = this.analysisRequests.get(id);
    if (request) {
      request.status = status;
      if (completedAt) {
        request.completedAt = completedAt;
      }
      this.analysisRequests.set(id, request);
    }
  }

  async updateAnalysisMapData(id: number, mapImageUrl: string, tileUrls: string[], wasFromCache = false): Promise<void> {
    const request = this.analysisRequests.get(id);
    if (request) {
      request.mapImageUrl = mapImageUrl;
      request.tileUrls = tileUrls as any;
      this.analysisRequests.set(id, request);
    }
  }

  async updateAnalysisAnnotatedImages(id: number, annotatedImagePaths: string[]): Promise<void> {
    const request = this.analysisRequests.get(id);
    if (request) {
      request.annotatedImageUrls = annotatedImagePaths;
      this.analysisRequests.set(id, request);
    }
  }

  async createDetection(insertDetection: InsertDetection): Promise<Detection> {
    const id = this.currentDetectionId++;
    const detection: Detection = { 
      ...insertDetection, 
      id,
      status: insertDetection.status || null,
      subType: insertDetection.subType || null,
      geoPolygon: insertDetection.geoPolygon || null,
      tileIndex: insertDetection.tileIndex || null
    };
    this.detections.set(id, detection);
    return detection;
  }

  async getDetectionsByAnalysisId(analysisId: number): Promise<Detection[]> {
    return Array.from(this.detections.values()).filter(
      (detection) => detection.analysisId === analysisId
    );
  }

  async getDetectionsByAnalysisIdAndTile(analysisId: number, tileIndex: number): Promise<Detection[]> {
    return Array.from(this.detections.values()).filter(
      (detection) => detection.analysisId === analysisId && detection.tileIndex === tileIndex
    );
  }

  async deleteDetectionsByAnalysisId(analysisId: number): Promise<void> {
    const detectionsToDelete = Array.from(this.detections.entries())
      .filter(([_, detection]) => detection.analysisId === analysisId)
      .map(([id]) => id);

    detectionsToDelete.forEach(id => this.detections.delete(id));
  }

  async createTileMapping(insertTileMapping: InsertTileMapping): Promise<TileMapping> {
    const id = this.currentTileMappingId++;
    const tileMapping: TileMapping = {
      id,
      analysisId: insertTileMapping.analysisId,
      tileIndex: insertTileMapping.tileIndex,
      tileUrl: insertTileMapping.tileUrl,
      centerLat: insertTileMapping.centerLat,
      centerLng: insertTileMapping.centerLng,
      topLeftLat: insertTileMapping.topLeftLat,
      topLeftLng: insertTileMapping.topLeftLng,
      bottomRightLat: insertTileMapping.bottomRightLat,
      bottomRightLng: insertTileMapping.bottomRightLng,
      imageWidth: insertTileMapping.imageWidth || 640,
      imageHeight: insertTileMapping.imageHeight || 640,
      createdAt: new Date(),
    };
    this.tileMappings.set(id, tileMapping);
    return tileMapping;
  }

  async getTileMappingsByAnalysisId(analysisId: number): Promise<TileMapping[]> {
    return Array.from(this.tileMappings.values()).filter(
      (tileMapping) => tileMapping.analysisId === analysisId
    );
  }

  // Batch processing methods
  async createBatchJob(job: InsertBatchJob): Promise<BatchJob> {
    const id = this.currentBatchJobId++;
    const batchJob: BatchJob = {
      ...job,
      id,
      status: "pending",
      totalAOIs: 0,
      processedAOIs: 0,
      failedAOIs: 0,
      createdAt: new Date(),
      completedAt: null,
    };
    this.batchJobs.set(id, batchJob);
    return batchJob;
  }

  async getBatchJob(id: number): Promise<BatchJob | undefined> {
    return this.batchJobs.get(id);
  }

  async getAllBatchJobs(): Promise<BatchJob[]> {
    return Array.from(this.batchJobs.values());
  }

  async updateBatchJobStatus(id: number, status: string, completedAt?: Date): Promise<void> {
    const job = this.batchJobs.get(id);
    if (job) {
      job.status = status;
      if (completedAt) job.completedAt = completedAt;
      this.batchJobs.set(id, job);
    }
  }

  async updateBatchJobProgress(id: number, processedAOIs: number, failedAOIs: number): Promise<void> {
    const job = this.batchJobs.get(id);
    if (job) {
      job.processedAOIs = processedAOIs;
      job.failedAOIs = failedAOIs;
      this.batchJobs.set(id, job);
    }
  }

  async updateBatchJobTotalAOIs(id: number, totalAOIs: number): Promise<void> {
    const job = this.batchJobs.get(id);
    if (job) {
      job.totalAOIs = totalAOIs;
      this.batchJobs.set(id, job);
    }
  }

  async deleteBatchJob(id: number): Promise<void> {
    // Delete associated AOIs first
    const aoisToDelete = Array.from(this.batchAOIs.entries())
      .filter(([_, aoi]) => aoi.batchJobId === id)
      .map(([aoiId]) => aoiId);
    
    aoisToDelete.forEach(aoiId => this.batchAOIs.delete(aoiId));
    
    // Delete the batch job
    this.batchJobs.delete(id);
  }

  async createBatchAOI(aoi: InsertBatchAOI): Promise<BatchAOI> {
    const id = this.currentBatchAOIId++;
    const batchAOI: BatchAOI = {
      ...aoi,
      id,
      status: "pending",
      analysisId: null,
      errorMessage: null,
      tilesProcessed: null,
      rawDetections: null,
      filteredDetections: null,
      finalDetections: null,
      processingStartedAt: null,
      processingDuration: null,
      createdAt: new Date(),
      completedAt: null,
    };
    this.batchAOIs.set(id, batchAOI);
    return batchAOI;
  }

  async getBatchAOIsByJobId(batchJobId: number): Promise<BatchAOI[]> {
    return Array.from(this.batchAOIs.values()).filter(
      (aoi) => aoi.batchJobId === batchJobId
    );
  }

  async updateBatchAOIStatus(id: number, status: string, analysisId?: number, errorMessage?: string, completedAt?: Date): Promise<void> {
    const aoi = this.batchAOIs.get(id);
    if (aoi) {
      aoi.status = status;
      if (analysisId !== undefined) aoi.analysisId = analysisId;
      if (errorMessage !== undefined) aoi.errorMessage = errorMessage;
      if (completedAt) aoi.completedAt = completedAt;
      this.batchAOIs.set(id, aoi);
    }
  }

  async updateBatchAOIStatistics(id: number, stats: {
    tilesProcessed?: number;
    rawDetections?: number;
    filteredDetections?: number;
    finalDetections?: number;
    processingStartedAt?: Date;
    processingDuration?: number;
  }): Promise<void> {
    const aoi = this.batchAOIs.get(id);
    if (aoi) {
      if (stats.tilesProcessed !== undefined) aoi.tilesProcessed = stats.tilesProcessed;
      if (stats.rawDetections !== undefined) aoi.rawDetections = stats.rawDetections;
      if (stats.filteredDetections !== undefined) aoi.filteredDetections = stats.filteredDetections;
      if (stats.finalDetections !== undefined) aoi.finalDetections = stats.finalDetections;
      if (stats.processingStartedAt !== undefined) aoi.processingStartedAt = stats.processingStartedAt;
      if (stats.processingDuration !== undefined) aoi.processingDuration = stats.processingDuration;
      this.batchAOIs.set(id, aoi);
    }
  }

  async getBatchProgress(batchJobId: number): Promise<BatchProgress | undefined> {
    const job = this.batchJobs.get(batchJobId);
    if (!job) return undefined;

    const aois = await this.getBatchAOIsByJobId(batchJobId);
    
    return {
      batchJobId: job.id,
      name: job.name,
      status: job.status as any,
      totalAOIs: job.totalAOIs,
      processedAOIs: job.processedAOIs,
      failedAOIs: job.failedAOIs,
      aois: aois.map(aoi => ({
        id: aoi.id,
        recordId: aoi.recordId,
        formattedAddress: aoi.formattedAddress,
        status: aoi.status as any,
        analysisId: aoi.analysisId || undefined,
        errorMessage: aoi.errorMessage || undefined,
        completedAt: aoi.completedAt || undefined,
        tilesProcessed: aoi.tilesProcessed || undefined,
        rawDetections: aoi.rawDetections || undefined,
        filteredDetections: aoi.filteredDetections || undefined,
        finalDetections: aoi.finalDetections || undefined,
        processingStartedAt: aoi.processingStartedAt || undefined,
        processingDuration: aoi.processingDuration || undefined,
      }))
    };
  }
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async getUserByEntraId(entraId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.entraId, entraId));
    return user || undefined;
  }

  async updateUserLastLogin(userId: number): Promise<void> {
    await db
      .update(users)
      .set({ lastLogin: new Date() })
      .where(eq(users.id, userId));
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async createAnalysisRequest(insertRequest: InsertAnalysisRequest): Promise<AnalysisRequest> {
    const [request] = await db
      .insert(analysisRequests)
      .values(insertRequest)
      .returning();
    return request;
  }

  async getAnalysisRequest(id: number): Promise<AnalysisRequest | undefined> {
    const [request] = await db.select().from(analysisRequests).where(eq(analysisRequests.id, id));
    return request || undefined;
  }

  async getAnalysisRequestsByRecordId(recordId: string): Promise<AnalysisRequest[]> {
    return await db.select().from(analysisRequests).where(eq(analysisRequests.recordId, recordId));
  }

  async updateAnalysisStatus(id: number, status: string, completedAt?: Date): Promise<void> {
    await db
      .update(analysisRequests)
      .set({ 
        status, 
        completedAt: completedAt || null 
      })
      .where(eq(analysisRequests.id, id));
  }

  async createDetection(insertDetection: InsertDetection): Promise<Detection> {
    const [detection] = await db
      .insert(detections)
      .values(insertDetection)
      .returning();
    return detection;
  }

  async getDetectionsByAnalysisId(analysisId: number): Promise<Detection[]> {
    return await db
      .select()
      .from(detections)
      .where(eq(detections.analysisId, analysisId));
  }

  async getDetectionsByAnalysisIdAndTile(analysisId: number, tileIndex: number): Promise<Detection[]> {
    return await db
      .select()
      .from(detections)
      .where(
        and(
          eq(detections.analysisId, analysisId),
          eq(detections.tileIndex, tileIndex)
        )
      );
  }

  async deleteDetectionsByAnalysisId(analysisId: number): Promise<void> {
    await db
      .delete(detections)
      .where(eq(detections.analysisId, analysisId));
  }

  async createTileMapping(insertTileMapping: InsertTileMapping): Promise<TileMapping> {
    const [tileMapping] = await db
      .insert(tileMappings)
      .values(insertTileMapping)
      .returning();
    return tileMapping;
  }

  async getTileMappingsByAnalysisId(analysisId: number): Promise<TileMapping[]> {
    return await db
      .select()
      .from(tileMappings)
      .where(eq(tileMappings.analysisId, analysisId));
  }

  async updateAnalysisMapData(id: number, mapImageUrl: string, tileUrls: string[]): Promise<void> {
    await db
      .update(analysisRequests)
      .set({ 
        mapImageUrl,
        tileUrls: tileUrls as any
      })
      .where(eq(analysisRequests.id, id));
  }
  async updateAnalysisAnnotatedImages(id: number, annotatedImagePaths: string[]): Promise<void> {
    await db.update(analysisRequests)
      .set({ 
        annotatedImageUrls: JSON.stringify(annotatedImagePaths.map(path => 
          path.replace('server/static/', '/api/static/')
        ))
      })
      .where(eq(analysisRequests.id, id));
  }

  // Batch processing methods
  async createBatchJob(job: InsertBatchJob): Promise<BatchJob> {
    const [batchJob] = await db
      .insert(batchJobs)
      .values(job)
      .returning();
    return batchJob;
  }

  async getBatchJob(id: number): Promise<BatchJob | undefined> {
    const [job] = await db.select().from(batchJobs).where(eq(batchJobs.id, id));
    return job || undefined;
  }

  async getAllBatchJobs(): Promise<BatchJob[]> {
    const jobs = await db.select().from(batchJobs);
    
    // Calculate real-time counts for each batch job
    const jobsWithRealCounts = await Promise.all(jobs.map(async (job) => {
      // Get all AOIs for this batch job to calculate actual counts
      const aois = await db
        .select()
        .from(batchAOIs)
        .where(eq(batchAOIs.batchJobId, job.id));
      
      // Calculate actual current counts from AOI status
      const completedCount = aois.filter(aoi => aoi.status === 'completed').length;
      const failedCount = aois.filter(aoi => aoi.status === 'failed').length;
      
      return {
        ...job,
        processedAOIs: completedCount,
        failedAOIs: failedCount
      };
    }));
    
    return jobsWithRealCounts;
  }

  async updateBatchJobStatus(id: number, status: string, completedAt?: Date): Promise<void> {
    await db
      .update(batchJobs)
      .set({ 
        status, 
        completedAt: completedAt || null 
      })
      .where(eq(batchJobs.id, id));
  }

  async updateBatchJobProgress(id: number, processedAOIs: number, failedAOIs: number): Promise<void> {
    await db
      .update(batchJobs)
      .set({ 
        processedAOIs,
        failedAOIs
      })
      .where(eq(batchJobs.id, id));
  }

  async updateBatchJobTotalAOIs(id: number, totalAOIs: number): Promise<void> {
    await db
      .update(batchJobs)
      .set({ totalAOIs })
      .where(eq(batchJobs.id, id));
  }

  async deleteBatchJob(id: number): Promise<void> {
    // Delete associated AOIs first
    await db.delete(batchAOIs).where(eq(batchAOIs.batchJobId, id));
    
    // Delete the batch job
    await db.delete(batchJobs).where(eq(batchJobs.id, id));
  }

  async createBatchAOI(aoi: InsertBatchAOI): Promise<BatchAOI> {
    const [batchAOI] = await db
      .insert(batchAOIs)
      .values(aoi)
      .returning();
    return batchAOI;
  }

  async getBatchAOIsByJobId(batchJobId: number): Promise<BatchAOI[]> {
    return await db
      .select()
      .from(batchAOIs)
      .where(eq(batchAOIs.batchJobId, batchJobId));
  }

  async updateBatchAOIStatus(id: number, status: string, analysisId?: number, errorMessage?: string, completedAt?: Date): Promise<void> {
    await db
      .update(batchAOIs)
      .set({ 
        status,
        analysisId: analysisId || null,
        errorMessage: errorMessage || null,
        completedAt: completedAt || null
      })
      .where(eq(batchAOIs.id, id));
  }

  async updateBatchAOIStatistics(id: number, stats: {
    tilesProcessed?: number;
    rawDetections?: number;
    filteredDetections?: number;
    finalDetections?: number;
    processingStartedAt?: Date;
    processingDuration?: number;
  }): Promise<void> {
    const updateData: any = {};
    if (stats.tilesProcessed !== undefined) updateData.tilesProcessed = stats.tilesProcessed;
    if (stats.rawDetections !== undefined) updateData.rawDetections = stats.rawDetections;
    if (stats.filteredDetections !== undefined) updateData.filteredDetections = stats.filteredDetections;
    if (stats.finalDetections !== undefined) updateData.finalDetections = stats.finalDetections;
    if (stats.processingStartedAt !== undefined) updateData.processingStartedAt = stats.processingStartedAt;
    if (stats.processingDuration !== undefined) updateData.processingDuration = stats.processingDuration;

    await db
      .update(batchAOIs)
      .set(updateData)
      .where(eq(batchAOIs.id, id));
  }

  async getBatchProgress(batchJobId: number): Promise<BatchProgress | undefined> {
    const job = await this.getBatchJob(batchJobId);
    if (!job) return undefined;

    const aois = await this.getBatchAOIsByJobId(batchJobId);
    
    // Calculate real-time counts from actual AOI status
    const completedCount = aois.filter(aoi => aoi.status === 'completed').length;
    const failedCount = aois.filter(aoi => aoi.status === 'failed').length;
    
    return {
      batchJobId: job.id,
      name: job.name,
      status: job.status as any,
      totalAOIs: job.totalAOIs,
      processedAOIs: completedCount, // Use real-time count
      failedAOIs: failedCount, // Use real-time count
      aois: aois.map(aoi => ({
        id: aoi.id,
        recordId: aoi.recordId,
        formattedAddress: aoi.formattedAddress,
        status: aoi.status as any,
        analysisId: aoi.analysisId || undefined,
        errorMessage: aoi.errorMessage || undefined,
        completedAt: aoi.completedAt || undefined,
        tilesProcessed: aoi.tilesProcessed || undefined,
        rawDetections: aoi.rawDetections || undefined,
        filteredDetections: aoi.filteredDetections || undefined,
        finalDetections: aoi.finalDetections || undefined,
        processingStartedAt: aoi.processingStartedAt || undefined,
        processingDuration: aoi.processingDuration || undefined,
      }))
    };
  }
}

export const storage = new DatabaseStorage();