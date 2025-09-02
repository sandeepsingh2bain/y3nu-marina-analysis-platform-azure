import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';

interface CachedTile {
  url: string;
  cachedAt: Date;
  expiresAt: Date;
  filePath?: string; // Path to cached image file
}

interface TileCacheEntry {
  stitchedImageUrl: string;
  tileUrls: string[];
  tileCount: number;
  cachedAt: Date;
  expiresAt: Date;
}

export class TileCache {
  private cache = new Map<string, TileCacheEntry>();
  private tileCache = new Map<string, CachedTile>();
  private readonly CACHE_DURATION_HOURS = 24 * 365; // Cache tiles indefinitely (1 year)
  private readonly CACHE_DIR = path.join(process.cwd(), 'server', 'static', 'cached_tiles');

  constructor() {
    // Create cache directory if it doesn't exist
    if (!fs.existsSync(this.CACHE_DIR)) {
      fs.mkdirSync(this.CACHE_DIR, { recursive: true });
    }
  }

  // Generate a cache key based on area coordinates and zoom level
  private generateAreaKey(topLeftLat: number, topLeftLng: number, 
                         bottomRightLat: number, bottomRightLng: number, 
                         zoomLevel: number): string {
    const key = `${topLeftLat}_${topLeftLng}_${bottomRightLat}_${bottomRightLng}_${zoomLevel}`;
    return createHash('md5').update(key).digest('hex');
  }

  // Generate a cache key for individual tile
  private generateTileKey(centerLat: number, centerLng: number, zoomLevel: number): string {
    const key = `${centerLat}_${centerLng}_${zoomLevel}`;
    return createHash('md5').update(key).digest('hex');
  }

  // Generate file path for cached tile image
  private getTileFilePath(centerLat: number, centerLng: number, zoomLevel: number): string {
    const key = this.generateTileKey(centerLat, centerLng, zoomLevel);
    return path.join(this.CACHE_DIR, `tile_${key}.jpg`);
  }

  // Check if cached area data is still valid
  isCached(topLeftLat: number, topLeftLng: number, 
           bottomRightLat: number, bottomRightLng: number, 
           zoomLevel: number): boolean {
    const key = this.generateAreaKey(topLeftLat, topLeftLng, bottomRightLat, bottomRightLng, zoomLevel);
    const cached = this.cache.get(key);
    
    if (!cached) return false;
    
    const now = new Date();
    if (now > cached.expiresAt) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  // Get cached area data
  getCached(topLeftLat: number, topLeftLng: number, 
            bottomRightLat: number, bottomRightLng: number, 
            zoomLevel: number): TileCacheEntry | null {
    const key = this.generateAreaKey(topLeftLat, topLeftLng, bottomRightLat, bottomRightLng, zoomLevel);
    const cached = this.cache.get(key);
    
    if (!cached) return null;
    
    const now = new Date();
    if (now > cached.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    
    return cached;
  }

  // Cache area data
  setCached(topLeftLat: number, topLeftLng: number, 
            bottomRightLat: number, bottomRightLng: number, 
            zoomLevel: number, data: Omit<TileCacheEntry, 'cachedAt' | 'expiresAt'>): void {
    const key = this.generateAreaKey(topLeftLat, topLeftLng, bottomRightLat, bottomRightLng, zoomLevel);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.CACHE_DURATION_HOURS * 60 * 60 * 1000);
    
    this.cache.set(key, {
      ...data,
      cachedAt: now,
      expiresAt
    });
    
    console.log(`Cached area data for key: ${key}, expires at: ${expiresAt.toISOString()}`);
  }

  // Check if individual tile is cached
  isTileCached(centerLat: number, centerLng: number, zoomLevel: number): boolean {
    const key = this.generateTileKey(centerLat, centerLng, zoomLevel);
    const cached = this.tileCache.get(key);
    
    if (!cached) return false;
    
    const now = new Date();
    if (now > cached.expiresAt) {
      this.tileCache.delete(key);
      // Clean up cached file if it exists
      if (cached.filePath && fs.existsSync(cached.filePath)) {
        fs.unlinkSync(cached.filePath);
      }
      return false;
    }
    
    // Verify file still exists if we have a cached file path
    if (cached.filePath && !fs.existsSync(cached.filePath)) {
      this.tileCache.delete(key);
      return false;
    }
    
    return true;
  }

  // Get cached tile URL
  getCachedTile(centerLat: number, centerLng: number, zoomLevel: number): string | null {
    const key = this.generateTileKey(centerLat, centerLng, zoomLevel);
    const cached = this.tileCache.get(key);
    
    if (!cached) return null;
    
    const now = new Date();
    if (now > cached.expiresAt) {
      this.tileCache.delete(key);
      if (cached.filePath && fs.existsSync(cached.filePath)) {
        fs.unlinkSync(cached.filePath);
      }
      return null;
    }
    
    // If we have a cached file, return the local path URL
    if (cached.filePath && fs.existsSync(cached.filePath)) {
      const fileName = path.basename(cached.filePath);
      // Always use the same URL format regardless of environment
      return `/api/static/cached_tiles/${fileName}`;
    }
    
    return cached.url;
  }

  // Cache individual tile
  setCachedTile(centerLat: number, centerLng: number, zoomLevel: number, url: string): void {
    const key = this.generateTileKey(centerLat, centerLng, zoomLevel);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.CACHE_DURATION_HOURS * 60 * 60 * 1000);
    
    this.tileCache.set(key, {
      url,
      cachedAt: now,
      expiresAt
    });
  }

  // Cache tile image data to file system
  async cacheImageTile(centerLat: number, centerLng: number, zoomLevel: number, imageData: Buffer): Promise<string> {
    const filePath = this.getTileFilePath(centerLat, centerLng, zoomLevel);
    const key = this.generateTileKey(centerLat, centerLng, zoomLevel);
    
    try {
      await fs.promises.writeFile(filePath, imageData);
      
      const now = new Date();
      const expiresAt = new Date(now.getTime() + (this.CACHE_DURATION_HOURS * 60 * 60 * 1000));
      
      this.tileCache.set(key, {
        url: '', // We'll generate the URL when retrieving
        cachedAt: now,
        expiresAt,
        filePath
      });
      
      const fileName = path.basename(filePath);
      // Always use the same URL format regardless of environment
      return `/api/static/cached_tiles/${fileName}`;
    } catch (error) {
      console.error('Error caching tile image:', error);
      throw error;
    }
  }

  // Get cached image file path if available
  getCachedImageTile(centerLat: number, centerLng: number, zoomLevel: number): string | null {
    if (!this.isTileCached(centerLat, centerLng, zoomLevel)) {
      return null;
    }
    
    const key = this.generateTileKey(centerLat, centerLng, zoomLevel);
    const cached = this.tileCache.get(key);
    
    if (cached?.filePath && fs.existsSync(cached.filePath)) {
      const fileName = path.basename(cached.filePath);
      // Always use the same URL format regardless of environment
      return `/api/static/cached_tiles/${fileName}`;
    }
    
    return null;
  }

  // Get cache statistics
  getCacheStats(): { areaCount: number, tileCount: number, oldestEntry: Date | null } {
    const areaCount = this.cache.size;
    const tileCount = this.tileCache.size;
    
    let oldestEntry: Date | null = null;
    
    // Use Array.from to convert iterators
    const areaEntries = Array.from(this.cache.values());
    for (const entry of areaEntries) {
      if (!oldestEntry || entry.cachedAt < oldestEntry) {
        oldestEntry = entry.cachedAt;
      }
    }
    
    const tileEntries = Array.from(this.tileCache.values());
    for (const entry of tileEntries) {
      if (!oldestEntry || entry.cachedAt < oldestEntry) {
        oldestEntry = entry.cachedAt;
      }
    }
    
    return { areaCount, tileCount, oldestEntry };
  }

  // Clear expired entries
  clearExpired(): number {
    const now = new Date();
    let cleared = 0;
    
    // Use Array.from to convert iterators
    const areaEntries = Array.from(this.cache.entries());
    for (const [key, entry] of areaEntries) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleared++;
      }
    }
    
    const tileEntries = Array.from(this.tileCache.entries());
    for (const [key, entry] of tileEntries) {
      if (now > entry.expiresAt) {
        this.tileCache.delete(key);
        cleared++;
      }
    }
    
    return cleared;
  }

  // Clear all cache
  clearAll(): void {
    this.cache.clear();
    this.tileCache.clear();
    console.log('All tile cache cleared');
  }
}

// Global cache instance
export const tileCache = new TileCache();