import { AnalyzeAreaRequest } from "@shared/schema";
import { tileCache } from "./tile-cache";
import https from 'https';
import http from 'http';

export interface TileInfo {
  url: string;
  x: number;
  y: number;
  zoom: number;
  centerLat: number;
  centerLng: number;
  originalGridIndex?: number; // Track original index before optimization filtering
}

export interface MapTileResponse {
  stitchedImageUrl: string;
  tileUrls: string[];
  tileCount: number;
  wasFromCache: boolean;
}

export class GoogleMapsService {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  // Fetch image data from a URL
  private async fetchImageData(url: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const request = url.startsWith('https') ? https : http;
      
      request.get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
          return;
        }

        const chunks: Buffer[] = [];
        response.on('data', (chunk) => {
          chunks.push(chunk);
        });

        response.on('end', () => {
          resolve(Buffer.concat(chunks));
        });
      }).on('error', (error) => {
        reject(error);
      });
    });
  }

  // Check if a rectangular tile intersects with a polygon (AOI)
  private tileIntersectsPolygon(tileBounds: {north: number, south: number, east: number, west: number}, polygon: Array<{lat: number, lng: number}>): boolean {
    // Convert tile bounds to polygon corners
    const tileCorners = [
      { lat: tileBounds.north, lng: tileBounds.west },  // top-left
      { lat: tileBounds.north, lng: tileBounds.east },  // top-right
      { lat: tileBounds.south, lng: tileBounds.east },  // bottom-right
      { lat: tileBounds.south, lng: tileBounds.west }   // bottom-left
    ];
    
    // Check if any tile corner is inside the AOI polygon
    for (const corner of tileCorners) {
      if (this.isPointInPolygon(corner, polygon)) {
        return true;
      }
    }
    
    // Check if any AOI polygon vertex is inside the tile
    for (const vertex of polygon) {
      if (vertex.lat >= tileBounds.south && vertex.lat <= tileBounds.north &&
          vertex.lng >= tileBounds.west && vertex.lng <= tileBounds.east) {
        return true;
      }
    }
    
    // Check if any polygon edge intersects with tile edges
    return this.polygonEdgesIntersectTile(tileBounds, polygon);
  }
  
  // Check if any polygon edges intersect with tile boundaries
  private polygonEdgesIntersectTile(tileBounds: {north: number, south: number, east: number, west: number}, polygon: Array<{lat: number, lng: number}>): boolean {
    const tileEdges = [
      { start: { lat: tileBounds.north, lng: tileBounds.west }, end: { lat: tileBounds.north, lng: tileBounds.east } }, // top edge
      { start: { lat: tileBounds.north, lng: tileBounds.east }, end: { lat: tileBounds.south, lng: tileBounds.east } }, // right edge
      { start: { lat: tileBounds.south, lng: tileBounds.east }, end: { lat: tileBounds.south, lng: tileBounds.west } }, // bottom edge
      { start: { lat: tileBounds.south, lng: tileBounds.west }, end: { lat: tileBounds.north, lng: tileBounds.west } }  // left edge
    ];
    
    // Check each polygon edge against each tile edge
    for (let i = 0; i < polygon.length; i++) {
      const polyStart = polygon[i];
      const polyEnd = polygon[(i + 1) % polygon.length];
      
      for (const tileEdge of tileEdges) {
        if (this.lineSegmentsIntersect(polyStart, polyEnd, tileEdge.start, tileEdge.end)) {
          return true;
        }
      }
    }
    
    return false;
  }
  
  // Check if two line segments intersect
  private lineSegmentsIntersect(p1: {lat: number, lng: number}, p2: {lat: number, lng: number}, p3: {lat: number, lng: number}, p4: {lat: number, lng: number}): boolean {
    const d1 = this.orientation(p3, p4, p1);
    const d2 = this.orientation(p3, p4, p2);
    const d3 = this.orientation(p1, p2, p3);
    const d4 = this.orientation(p1, p2, p4);
    
    // General case
    if (d1 !== d2 && d3 !== d4) {
      return true;
    }
    
    // Special cases for collinear points
    if (d1 === 0 && this.onSegment(p3, p1, p4)) return true;
    if (d2 === 0 && this.onSegment(p3, p2, p4)) return true;
    if (d3 === 0 && this.onSegment(p1, p3, p2)) return true;
    if (d4 === 0 && this.onSegment(p1, p4, p2)) return true;
    
    return false;
  }
  
  // Find orientation of ordered triplet (p, q, r)
  private orientation(p: {lat: number, lng: number}, q: {lat: number, lng: number}, r: {lat: number, lng: number}): number {
    const val = (q.lng - p.lng) * (r.lat - q.lat) - (q.lat - p.lat) * (r.lng - q.lng);
    if (Math.abs(val) < 1e-10) return 0; // collinear
    return val > 0 ? 1 : 2; // clockwise or counterclockwise
  }
  
  // Check if point q lies on line segment pr
  private onSegment(p: {lat: number, lng: number}, q: {lat: number, lng: number}, r: {lat: number, lng: number}): boolean {
    return q.lat <= Math.max(p.lat, r.lat) && q.lat >= Math.min(p.lat, r.lat) &&
           q.lng <= Math.max(p.lng, r.lng) && q.lng >= Math.min(p.lng, r.lng);
  }
  
  // Point-in-polygon algorithm using ray casting
  private isPointInPolygon(point: {lat: number, lng: number}, polygon: Array<{lat: number, lng: number}>): boolean {
    let inside = false;
    
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      if (((polygon[i].lat > point.lat) !== (polygon[j].lat > point.lat)) &&
          (point.lng < (polygon[j].lng - polygon[i].lng) * (point.lat - polygon[i].lat) / (polygon[j].lat - polygon[i].lat) + polygon[i].lng)) {
        inside = !inside;
      }
    }
    
    return inside;
  }

  // Calculate the tile grid for a given bounding box and zoom level using Web Mercator projection
  calculateTileGrid(request: AnalyzeAreaRequest): TileInfo[] {
    const { topLeftLat, topLeftLng, bottomRightLat, bottomRightLng, zoomLevel } = request;
    
    // Ensure coordinates are defined
    if (!topLeftLat || !topLeftLng || !bottomRightLat || !bottomRightLng || !zoomLevel) {
      throw new Error('All coordinate fields and zoom level must be provided');
    }
    
    // Validate bounds
    if (topLeftLat <= bottomRightLat || topLeftLng >= bottomRightLng) {
      throw new Error("Invalid bounds: top-left must be northwest of bottom-right");
    }
    
    // Convert geographic bounds to tile coordinates
    const topLeftTile = this.latLngToTile(topLeftLat as number, topLeftLng as number, zoomLevel as number);
    const bottomRightTile = this.latLngToTile(bottomRightLat as number, bottomRightLng as number, zoomLevel as number);
    
    // Calculate the tile range (inclusive)
    const minTileX = Math.min(topLeftTile.x, bottomRightTile.x);
    const maxTileX = Math.max(topLeftTile.x, bottomRightTile.x);
    const minTileY = Math.min(topLeftTile.y, bottomRightTile.y);
    const maxTileY = Math.max(topLeftTile.y, bottomRightTile.y);
    
    // Add overlap buffer (25% overlap with adjacent tiles)
    // For 25% overlap, we need to extend the area by 25% of tile size on each side
    // This is achieved by calculating fractional tile coordinates
    const overlapPercent = 0.25;
    
    // Calculate the geographic bounds of the core tiles
    const coreTopLeftBounds = this.tileToBounds(minTileX, minTileY, zoomLevel);
    const coreBottomRightBounds = this.tileToBounds(maxTileX, maxTileY, zoomLevel);
    
    // Calculate the size of one tile in degrees
    const tileLatSize = coreTopLeftBounds.north - coreTopLeftBounds.south;
    const tileLngSize = coreTopLeftBounds.east - coreTopLeftBounds.west;
    
    // Extend the geographic bounds by 25% of a tile size
    const extendedTopLeftLat = Math.min(topLeftLat, coreTopLeftBounds.north + (tileLatSize * overlapPercent));
    const extendedTopLeftLng = Math.max(topLeftLng, coreTopLeftBounds.west - (tileLngSize * overlapPercent));
    const extendedBottomRightLat = Math.max(bottomRightLat, coreBottomRightBounds.south - (tileLatSize * overlapPercent));
    const extendedBottomRightLng = Math.min(bottomRightLng, coreBottomRightBounds.east + (tileLngSize * overlapPercent));
    
    // Convert extended bounds back to tile coordinates
    const extendedTopLeftTile = this.latLngToTile(extendedTopLeftLat, extendedTopLeftLng, zoomLevel);
    const extendedBottomRightTile = this.latLngToTile(extendedBottomRightLat, extendedBottomRightLng, zoomLevel);
    
    const startX = Math.max(0, Math.min(extendedTopLeftTile.x, extendedBottomRightTile.x));
    const endX = Math.min(Math.pow(2, zoomLevel) - 1, Math.max(extendedTopLeftTile.x, extendedBottomRightTile.x));
    const startY = Math.max(0, Math.min(extendedTopLeftTile.y, extendedBottomRightTile.y));
    const endY = Math.min(Math.pow(2, zoomLevel) - 1, Math.max(extendedTopLeftTile.y, extendedBottomRightTile.y));
    
    const tiles: TileInfo[] = [];
    const allTiles: TileInfo[] = [];  // For logging purposes
    let filteredCount = 0;
    let originalGridIndex = 0; // Track original position in the complete grid
    
    // Generate tiles in row-major order with overlap
    for (let tileY = startY; tileY <= endY; tileY++) {
      for (let tileX = startX; tileX <= endX; tileX++) {
        // Convert tile coordinates back to lat/lng bounds
        const bounds = this.tileToBounds(tileX, tileY, zoomLevel);
        
        // Calculate center point for the tile
        const centerLat = (bounds.north + bounds.south) / 2;
        const centerLng = (bounds.east + bounds.west) / 2;
        
        const url = this.generateStaticMapUrl(bounds, zoomLevel);
        
        const tileInfo: TileInfo = {
          url,
          x: tileX,
          y: tileY,
          zoom: zoomLevel,
          centerLat,
          centerLng,
          originalGridIndex: originalGridIndex // Track the original position before filtering
        };
        
        allTiles.push(tileInfo);
        
        // Filter tiles based on AOI polygon intersection (if polygon is provided)
        if (request.polygon && Array.isArray(request.polygon) && request.polygon.length >= 3) {
          // Check if this tile intersects with the AOI polygon
          if (this.tileIntersectsPolygon(bounds, request.polygon)) {
            tiles.push(tileInfo);
          } else {
            filteredCount++;
          }
        } else {
          // No polygon provided, include all tiles (legacy behavior)
          tiles.push(tileInfo);
        }
        
        originalGridIndex++; // Increment for every tile in the complete grid
      }
    }
    
    // Log the tile grid information with efficiency metrics
    const tilesX = endX - startX + 1;
    const tilesY = endY - startY + 1;
    const totalPossibleTiles = allTiles.length;
    const actualTiles = tiles.length;
    const efficiencyGain = totalPossibleTiles > 0 ? ((totalPossibleTiles - actualTiles) / totalPossibleTiles * 100) : 0;
    
    console.log(`Web Mercator tile grid calculation:`);
    console.log(`  Requested area: ${(topLeftLat as number).toFixed(6)}, ${(topLeftLng as number).toFixed(6)} to ${(bottomRightLat as number).toFixed(6)}, ${(bottomRightLng as number).toFixed(6)}`);
    console.log(`  Zoom level: ${zoomLevel as number}`);
    console.log(`  Core tile range: X[${minTileX}-${maxTileX}], Y[${minTileY}-${maxTileY}]`);
    console.log(`  With 25% overlap buffer: X[${startX}-${endX}], Y[${startY}-${endY}]`);
    console.log(`  Grid size: ${tilesX}x${tilesY} (${totalPossibleTiles} total tiles)`);
    
    if (request.polygon && Array.isArray(request.polygon) && request.polygon.length >= 3) {
      console.log(`  AOI Polygon Filtering: ${actualTiles} tiles intersect AOI (${filteredCount} filtered out)`);
      console.log(`  Efficiency gain: ${efficiencyGain.toFixed(1)}% reduction in tiles to process`);
      console.log(`  Cost savings: ${filteredCount} fewer Google Maps API calls`);
    } else {
      console.log(`  No AOI polygon provided - processing all ${totalPossibleTiles} tiles`);
    }
    
    console.log(`  Tile coverage: ~${(tilesX * 256 * this.getMetersPerPixel(zoomLevel as number)).toFixed(0)}m x ${(tilesY * 256 * this.getMetersPerPixel(zoomLevel as number)).toFixed(0)}m`);
    
    return tiles;
  }
  
  // Calculate meters per pixel at given zoom level (at equator)
  private getMetersPerPixel(zoomLevel: number): number {
    const earthCircumference = 40075017; // meters at equator
    const tileSize = 256; // pixels
    return earthCircumference / (tileSize * Math.pow(2, zoomLevel));
  }

  // Convert lat/lng to tile coordinates using Web Mercator projection
  private latLngToTile(lat: number, lng: number, zoom: number): { x: number; y: number } {
    const n = Math.pow(2, zoom);
    const latRad = (lat * Math.PI) / 180;
    
    const x = Math.floor(((lng + 180) / 360) * n);
    const y = Math.floor(((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2) * n);
    
    // Clamp to valid tile bounds
    const clampedX = Math.max(0, Math.min(n - 1, x));
    const clampedY = Math.max(0, Math.min(n - 1, y));
    
    return { x: clampedX, y: clampedY };
  }

  // Convert tile coordinates back to lat/lng bounds using Web Mercator projection
  private tileToBounds(x: number, y: number, zoom: number): {
    north: number;
    south: number;
    east: number;
    west: number;
  } {
    const n = Math.pow(2, zoom);
    
    // Calculate longitude bounds (simple linear transformation)
    const west = (x / n) * 360 - 180;
    const east = ((x + 1) / n) * 360 - 180;
    
    // Calculate latitude bounds using inverse Web Mercator projection
    const northRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n)));
    const southRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 1)) / n)));
    
    const north = (northRad * 180) / Math.PI;
    const south = (southRad * 180) / Math.PI;
    
    return { north, south, east, west };
  }

  // Generate Google Static Maps API URL for a tile with proper bounds
  private generateStaticMapUrl(bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  }, zoomLevel: number): string {
    const centerLat = (bounds.north + bounds.south) / 2;
    const centerLng = (bounds.east + bounds.west) / 2;
    
    // Use 640x640 for maximum resolution (Google's limit for free tier)
    const size = "640x640";
    const maptype = "satellite";
    const format = "jpg";
    
    return `https://maps.googleapis.com/maps/api/staticmap?` +
      `center=${centerLat.toFixed(8)},${centerLng.toFixed(8)}&` +
      `zoom=${zoomLevel}&` +
      `size=${size}&` +
      `maptype=${maptype}&` +
      `format=${format}&` +
      `key=${this.apiKey}`;
  }

  // Fetch and process map tiles
  async fetchMapTiles(request: AnalyzeAreaRequest, forceRefresh = false): Promise<MapTileResponse> {
    // Validate required coordinates
    if (!request.topLeftLat || !request.topLeftLng || !request.bottomRightLat || !request.bottomRightLng || !request.zoomLevel) {
      throw new Error('All coordinate fields and zoom level must be provided');
    }

    const tlLat = request.topLeftLat;
    const tlLng = request.topLeftLng; 
    const brLat = request.bottomRightLat;
    const brLng = request.bottomRightLng;
    const zoom = request.zoomLevel;

    // Check if this area is already cached (unless force refresh is requested)
    if (!forceRefresh) {
      const cached = tileCache.getCached(tlLat, tlLng, brLat, brLng, zoom);
      
      if (cached) {
        console.log("Using cached tile data for this area");
        return {
          stitchedImageUrl: cached.stitchedImageUrl,
          tileUrls: cached.tileUrls,
          tileCount: cached.tileCount,
          wasFromCache: true
        };
      }
    } else {
      console.log("Force refresh requested - bypassing cache");
    }

    console.log("Cache miss - calculating tile grid for new area...");
    const tiles = this.calculateTileGrid(request);
    console.log(`Calculated ${tiles.length} tiles for the area`);
    
    if (tiles.length > 400) {
      throw new Error(`Area too large. Requires ${tiles.length} tiles, maximum is 400.`);
    }

    // Process individual tiles with caching
    console.log("Processing tiles with image caching...");
    const tileUrls: string[] = [];
    let cacheHits = 0;
    let apiCalls = 0;

    for (const tile of tiles) {
      // Check if this specific tile is cached
      const cachedImageUrl = tileCache.getCachedImageTile(tile.centerLat, tile.centerLng, tile.zoom);
      
      if (cachedImageUrl && !forceRefresh) {
        // Use cached tile
        tileUrls.push(cachedImageUrl);
        cacheHits++;
        console.log(`Tile ${tile.x},${tile.y} (${tile.centerLat.toFixed(4)}, ${tile.centerLng.toFixed(4)}): Using cached image`);
      } else {
        // Fetch tile from Google Maps API and cache it
        try {
          console.log(`Tile ${tile.x},${tile.y} (${tile.centerLat.toFixed(4)}, ${tile.centerLng.toFixed(4)}): Fetching from Google Maps API`);
          const imageData = await this.fetchImageData(tile.url);
          const cachedUrl = await tileCache.cacheImageTile(tile.centerLat, tile.centerLng, tile.zoom, imageData);
          tileUrls.push(cachedUrl);
          apiCalls++;
          
          // Add small delay between API calls to avoid rate limiting
          if (apiCalls > 0 && apiCalls % 5 === 0) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        } catch (error) {
          console.error(`Failed to fetch tile ${tile.x},${tile.y}:`, error);
          // Fallback to original Google Maps URL if caching fails
          tileUrls.push(tile.url);
        }
      }
    }

    console.log(`Tile processing complete: ${cacheHits} cached, ${apiCalls} API calls`);
    console.log(`Generated ${tileUrls.length} tile URLs`);
    
    // Image stitching disabled - using first tile as representative image
    const stitchedImageUrl = tileUrls[0] || "";
    console.log("Image stitching disabled - returning individual tiles only");
    
    // Cache the area results (for overall area caching)
    tileCache.setCached(
      tlLat,
      tlLng,
      brLat,
      brLng,
      zoom,
      {
        stitchedImageUrl,
        tileUrls,
        tileCount: tiles.length
      }
    );
    
    console.log(`Map tiles processing completed: ${cacheHits} cached tiles, ${apiCalls} new fetches`);
    return {
      stitchedImageUrl,
      tileUrls,
      tileCount: tiles.length,
      wasFromCache: cacheHits === tiles.length // All tiles were from cache
    };
  }




  // Validate API key by making a test request
  async validateApiKey(): Promise<boolean> {
    try {
      const testUrl = `https://maps.googleapis.com/maps/api/staticmap?` +
        `center=0,0&zoom=1&size=100x100&maptype=satellite&key=${this.apiKey}`;
      
      const response = await fetch(testUrl);
      return response.ok;
    } catch (error) {
      return false;
    }
  }
}