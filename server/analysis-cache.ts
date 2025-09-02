import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';
import type { Detection } from '@shared/schema';

interface CachedAnalysisResult {
  recordId: string;
  formattedAddress: string;
  topLeftLat: number;
  topLeftLng: number;
  bottomRightLat: number;
  bottomRightLng: number;
  zoomLevel: number;
  detections: Detection[];
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
  cachedAt: Date;
  expiresAt: Date;
}

export class AnalysisCache {
  private cache = new Map<string, CachedAnalysisResult>();
  private readonly CACHE_DURATION_HOURS = 24 * 30; // Cache for 30 days
  private readonly CACHE_DIR = path.join(process.cwd(), 'server', 'static', 'cached_analysis');

  constructor() {
    // Create cache directory if it doesn't exist
    if (!fs.existsSync(this.CACHE_DIR)) {
      fs.mkdirSync(this.CACHE_DIR, { recursive: true });
    }
    this.loadCacheFromDisk();
  }

  // Generate cache key based on coordinates, zoom level, recordId, and formatted address
  private generateCacheKey(
    recordId: string,
    formattedAddress: string,
    topLeftLat: number,
    topLeftLng: number,
    bottomRightLat: number,
    bottomRightLng: number,
    zoomLevel: number
  ): string {
    // Normalize coordinates to 6 decimal places for consistent caching
    const normalizedTlLat = parseFloat(topLeftLat.toFixed(6));
    const normalizedTlLng = parseFloat(topLeftLng.toFixed(6));
    const normalizedBrLat = parseFloat(bottomRightLat.toFixed(6));
    const normalizedBrLng = parseFloat(bottomRightLng.toFixed(6));
    
    const key = `${recordId}_${formattedAddress}_${normalizedTlLat}_${normalizedTlLng}_${normalizedBrLat}_${normalizedBrLng}_${zoomLevel}`;
    return createHash('md5').update(key).digest('hex');
  }

  // Generate file path for cached analysis
  private getCacheFilePath(cacheKey: string): string {
    return path.join(this.CACHE_DIR, `analysis_${cacheKey}.json`);
  }

  // Check if analysis is cached and still valid
  isCached(
    recordId: string,
    formattedAddress: string,
    topLeftLat: number,
    topLeftLng: number,
    bottomRightLat: number,
    bottomRightLng: number,
    zoomLevel: number
  ): boolean {
    const cacheKey = this.generateCacheKey(recordId, formattedAddress, topLeftLat, topLeftLng, bottomRightLat, bottomRightLng, zoomLevel);
    const cached = this.cache.get(cacheKey);
    
    if (!cached) return false;
    
    const now = new Date();
    if (now > cached.expiresAt) {
      this.cache.delete(cacheKey);
      // Clean up cached file
      const filePath = this.getCacheFilePath(cacheKey);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      return false;
    }
    
    return true;
  }

  // Get cached analysis result
  getCached(
    recordId: string,
    formattedAddress: string,
    topLeftLat: number,
    topLeftLng: number,
    bottomRightLat: number,
    bottomRightLng: number,
    zoomLevel: number
  ): CachedAnalysisResult | null {
    const cacheKey = this.generateCacheKey(recordId, formattedAddress, topLeftLat, topLeftLng, bottomRightLat, bottomRightLng, zoomLevel);
    const cached = this.cache.get(cacheKey);
    
    if (!cached) return null;
    
    const now = new Date();
    if (now > cached.expiresAt) {
      this.cache.delete(cacheKey);
      const filePath = this.getCacheFilePath(cacheKey);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      return null;
    }
    
    return cached;
  }

  // Cache analysis result
  async setCached(
    recordId: string,
    formattedAddress: string,
    topLeftLat: number,
    topLeftLng: number,
    bottomRightLat: number,
    bottomRightLng: number,
    zoomLevel: number,
    detections: Detection[],
    stats: any
  ): Promise<void> {
    const cacheKey = this.generateCacheKey(recordId, formattedAddress, topLeftLat, topLeftLng, bottomRightLat, bottomRightLng, zoomLevel);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + (this.CACHE_DURATION_HOURS * 60 * 60 * 1000));
    
    const cacheEntry: CachedAnalysisResult = {
      recordId,
      formattedAddress,
      topLeftLat,
      topLeftLng,
      bottomRightLat,
      bottomRightLng,
      zoomLevel,
      detections,
      stats,
      cachedAt: now,
      expiresAt
    };
    
    // Store in memory cache
    this.cache.set(cacheKey, cacheEntry);
    
    // Store to disk for persistence
    try {
      const filePath = this.getCacheFilePath(cacheKey);
      await fs.promises.writeFile(filePath, JSON.stringify(cacheEntry, null, 2));
      console.log(`Analysis cached for ${recordId} - ${formattedAddress} (${detections.length} detections)`);
    } catch (error) {
      console.error('Error saving analysis cache to disk:', error);
    }
  }

  // Load cache from disk on startup
  private loadCacheFromDisk(): void {
    if (!fs.existsSync(this.CACHE_DIR)) return;
    
    try {
      const files = fs.readdirSync(this.CACHE_DIR);
      let loadedCount = 0;
      
      for (const file of files) {
        if (file.startsWith('analysis_') && file.endsWith('.json')) {
          try {
            const filePath = path.join(this.CACHE_DIR, file);
            const content = fs.readFileSync(filePath, 'utf-8');
            const cacheEntry: CachedAnalysisResult = JSON.parse(content);
            
            // Convert date strings back to Date objects
            cacheEntry.cachedAt = new Date(cacheEntry.cachedAt);
            cacheEntry.expiresAt = new Date(cacheEntry.expiresAt);
            
            // Check if still valid
            const now = new Date();
            if (now <= cacheEntry.expiresAt) {
              const cacheKey = file.replace('analysis_', '').replace('.json', '');
              this.cache.set(cacheKey, cacheEntry);
              loadedCount++;
            } else {
              // Remove expired file
              fs.unlinkSync(filePath);
            }
          } catch (error) {
            console.error(`Error loading cache file ${file}:`, error);
          }
        }
      }
      
      if (loadedCount > 0) {
        console.log(`Loaded ${loadedCount} cached analysis results from disk`);
      }
    } catch (error) {
      console.error('Error loading analysis cache from disk:', error);
    }
  }

  // Get cache statistics
  getCacheStats(): { count: number, oldestEntry: Date | null, newestEntry: Date | null } {
    const entries = Array.from(this.cache.values());
    
    return {
      count: entries.length,
      oldestEntry: entries.length > 0 ? new Date(Math.min(...entries.map(e => e.cachedAt.getTime()))) : null,
      newestEntry: entries.length > 0 ? new Date(Math.max(...entries.map(e => e.cachedAt.getTime()))) : null
    };
  }

  // Clear expired entries
  clearExpired(): number {
    const now = new Date();
    let removedCount = 0;
    
    const keysToDelete: string[] = [];
    this.cache.forEach((entry, key) => {
      if (now > entry.expiresAt) {
        keysToDelete.push(key);
      }
    });
    
    for (const key of keysToDelete) {
      this.cache.delete(key);
      const filePath = this.getCacheFilePath(key);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      removedCount++;
    }
    
    return removedCount;
  }

  // Clear specific cache entry
  clearSpecific(
    recordId: string,
    formattedAddress: string,
    topLeftLat: number,
    topLeftLng: number,
    bottomRightLat: number,
    bottomRightLng: number,
    zoomLevel: number
  ): boolean {
    const cacheKey = this.generateCacheKey(recordId, formattedAddress, topLeftLat, topLeftLng, bottomRightLat, bottomRightLng, zoomLevel);
    const removed = this.cache.delete(cacheKey);
    
    // Remove file from disk
    const filePath = this.getCacheFilePath(cacheKey);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    return removed;
  }

  // Clear all cache entries
  clearAll(): void {
    this.cache.clear();
    
    // Remove all files from disk
    if (fs.existsSync(this.CACHE_DIR)) {
      const files = fs.readdirSync(this.CACHE_DIR);
      for (const file of files) {
        if (file.startsWith('analysis_') && file.endsWith('.json')) {
          fs.unlinkSync(path.join(this.CACHE_DIR, file));
        }
      }
    }
  }
}

export const analysisCache = new AnalysisCache();