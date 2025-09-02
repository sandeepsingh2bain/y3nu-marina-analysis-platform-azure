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
  tileSize: number; // Azure Maps tiles can be different sizes
}

export interface MapTileResponse {
  stitchedImageUrl: string;
  tileUrls: string[];
  tileCount: number;
  wasFromCache: boolean;
}

export class AzureMapsService {
  private subscriptionKey: string;
  private defaultTileSize: number = 512; // Azure Maps default tile size

  constructor(subscriptionKey: string) {
    this.subscriptionKey = subscriptionKey;
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

  // Check if tile intersects with polygon
  private tileIntersectsPolygon(tileBounds: {north: number, south: number, east: number, west: number}, polygon: Array<{lat: number, lng: number}>): boolean {
    // Check if any polygon vertex is inside the tile bounds
    for (const point of polygon) {
      if (point.lat >= tileBounds.south && point.lat <= tileBounds.north &&
          point.lng >= tileBounds.west && point.lng <= tileBounds.east) {
        return true;
      }
    }
    
    // Check if any tile corner is inside the polygon
    const tileCorners = [
      {lat: tileBounds.north, lng: tileBounds.west},
      {lat: tileBounds.north, lng: tileBounds.east},
      {lat: tileBounds.south, lng: tileBounds.east},
      {lat: tileBounds.south, lng: tileBounds.west}
    ];
    
    for (const corner of tileCorners) {
      if (this.isPointInPolygon(corner, polygon)) {
        return true;
      }
    }
    
    // Check if any polygon edges intersect with tile edges
    return this.polygonEdgesIntersectTile(tileBounds, polygon);
  }

  // Check if polygon edges intersect with tile bounds
  private polygonEdgesIntersectTile(tileBounds: {north: number, south: number, east: number, west: number}, polygon: Array<{lat: number, lng: number}>): boolean {
    const tileEdges = [
      [{lat: tileBounds.north, lng: tileBounds.west}, {lat: tileBounds.north, lng: tileBounds.east}], // top edge
      [{lat: tileBounds.north, lng: tileBounds.east}, {lat: tileBounds.south, lng: tileBounds.east}], // right edge
      [{lat: tileBounds.south, lng: tileBounds.east}, {lat: tileBounds.south, lng: tileBounds.west}], // bottom edge
      [{lat: tileBounds.south, lng: tileBounds.west}, {lat: tileBounds.north, lng: tileBounds.west}]  // left edge
    ];
    
    for (let i = 0; i < polygon.length; i++) {
      const polygonEdge = [polygon[i], polygon[(i + 1) % polygon.length]];
      
      for (const tileEdge of tileEdges) {
        if (this.lineSegmentsIntersect(polygonEdge[0], polygonEdge[1], tileEdge[0], tileEdge[1])) {
          return true;
        }
      }
    }
    
    return false;
  }

  // Check if two line segments intersect
  private lineSegmentsIntersect(p1: {lat: number, lng: number}, p2: {lat: number, lng: number}, p3: {lat: number, lng: number}, p4: {lat: number, lng: number}): boolean {
    const o1 = this.orientation(p1, p2, p3);
    const o2 = this.orientation(p1, p2, p4);
    const o3 = this.orientation(p3, p4, p1);
    const o4 = this.orientation(p3, p4, p2);
    
    // General case
    if (o1 !== o2 && o3 !== o4) {
      return true;
    }
    
    // Special cases
    if (o1 === 0 && this.onSegment(p1, p3, p2)) return true;
    if (o2 === 0 && this.onSegment(p1, p4, p2)) return true;
    if (o3 === 0 && this.onSegment(p3, p1, p4)) return true;
    if (o4 === 0 && this.onSegment(p3, p2, p4)) return true;
    
    return false;
  }

  // Find orientation of ordered triplet (p, q, r)
  private orientation(p: {lat: number, lng: number}, q: {lat: number, lng: number}, r: {lat: number, lng: number}): number {
    const val = (q.lng - p.lng) * (r.lat - q.lat) - (q.lat - p.lat) * (r.lng - q.lng);
    if (val === 0) return 0; // collinear
    return (val > 0) ? 1 : 2; // clock or counterclock wise
  }

  // Check if point q lies on segment pr
  private onSegment(p: {lat: number, lng: number}, q: {lat: number, lng: number}, r: {lat: number, lng: number}): boolean {
    return q.lat <= Math.max(p.lat, r.lat) && q.lat >= Math.min(p.lat, r.lat) &&
           q.lng <= Math.max(p.lng, r.lng) && q.lng >= Math.min(p.lng, r.lng);
  }

  // Point-in-polygon test using ray casting algorithm
  private isPointInPolygon(point: {lat: number, lng: number}, polygon: Array<{lat: number, lng: number}>): boolean {
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

  // Calculate tile grid for analysis
  calculateTileGrid(request: AnalyzeAreaRequest): TileInfo[] {
    const { topLeftLat, topLeftLng, bottomRightLat, bottomRightLng, zoomLevel } = request;
    
    if (!topLeftLat || !topLeftLng || !bottomRightLat || !bottomRightLng || !zoomLevel) {
      throw new Error("Missing required coordinates or zoom level");
    }
    
    console.log(`Calculating tile grid for Azure Maps:
      - Top Left: ${topLeftLat}, ${topLeftLng}
      - Bottom Right: ${bottomRightLat}, ${bottomRightLng}
      - Zoom: ${zoomLevel}`);
    
    // Add a small buffer to ensure coverage with tile overlap
    const latBuffer = Math.abs(topLeftLat - bottomRightLat) * 0.25;
    const lngBuffer = Math.abs(topLeftLng - bottomRightLng) * 0.25;
    
    // Calculate extended bounds
    const extendedTopLeftLat = Math.max(-85, topLeftLat + latBuffer);
    const extendedTopLeftLng = Math.max(-180, topLeftLng - lngBuffer);
    const extendedBottomRightLat = Math.min(85, bottomRightLat - latBuffer);
    const extendedBottomRightLng = Math.min(180, bottomRightLng + lngBuffer);
    
    console.log(`Extended bounds with buffer:
      - Top Left: ${extendedTopLeftLat}, ${extendedTopLeftLng}
      - Bottom Right: ${extendedBottomRightLat}, ${extendedBottomRightLng}`);
    
    // Convert to tile coordinates
    const extendedTopLeftTile = this.latLngToTile(extendedTopLeftLat, extendedTopLeftLng, zoomLevel);
    const extendedBottomRightTile = this.latLngToTile(extendedBottomRightLat, extendedBottomRightLng, zoomLevel);
    
    const startX = Math.max(0, Math.min(extendedTopLeftTile.x, extendedBottomRightTile.x));
    const endX = Math.min(Math.pow(2, zoomLevel) - 1, Math.max(extendedTopLeftTile.x, extendedBottomRightTile.x));
    const startY = Math.max(0, Math.min(extendedTopLeftTile.y, extendedBottomRightTile.y));
    const endY = Math.min(Math.pow(2, zoomLevel) - 1, Math.max(extendedTopLeftTile.y, extendedBottomRightTile.y));
    
    const tiles: TileInfo[] = [];
    const allTiles: TileInfo[] = [];
    let filteredCount = 0;
    let originalGridIndex = 0;
    
    // Generate tiles in row-major order with overlap
    for (let tileY = startY; tileY <= endY; tileY++) {
      for (let tileX = startX; tileX <= endX; tileX++) {
        // Convert tile coordinates back to lat/lng bounds
        const bounds = this.tileToBounds(tileX, tileY, zoomLevel);
        
        // Calculate center point for the tile
        const centerLat = (bounds.north + bounds.south) / 2;
        const centerLng = (bounds.east + bounds.west) / 2;
        
        const url = this.generateAzureMapsUrl(tileX, tileY, zoomLevel);
        
        const tileInfo: TileInfo = {
          url,
          x: tileX,
          y: tileY,
          zoom: zoomLevel,
          centerLat,
          centerLng,
          originalGridIndex: originalGridIndex,
          tileSize: this.defaultTileSize
        };
        
        allTiles.push(tileInfo);
        
        // Filter tiles based on AOI polygon intersection (if polygon is provided)
        if (request.polygon && Array.isArray(request.polygon) && request.polygon.length >= 3) {
          if (this.tileIntersectsPolygon(bounds, request.polygon)) {
            tiles.push(tileInfo);
          } else {
            filteredCount++;
          }
        } else {
          tiles.push(tileInfo);
        }
        
        originalGridIndex++;
      }
    }
    
    console.log(`Azure Maps tile grid calculated:
      - Total theoretical tiles: ${allTiles.length}
      - Tiles after polygon filtering: ${tiles.length}
      - Tiles filtered out: ${filteredCount}
      - Tile coverage: ${startX}-${endX} x ${startY}-${endY}`);
    
    return tiles;
  }

  // Get meters per pixel for a given zoom level
  private getMetersPerPixel(zoomLevel: number): number {
    // Azure Maps uses the same Web Mercator projection as Google Maps
    // At zoom level 0, the world is 256x256 pixels
    // Earth's circumference at equator is approximately 40,075,017 meters
    const earthCircumference = 40075017;
    const tileSize = this.defaultTileSize;
    return earthCircumference / (tileSize * Math.pow(2, zoomLevel));
  }

  // Convert lat/lng to tile coordinates
  private latLngToTile(lat: number, lng: number, zoom: number): { x: number; y: number } {
    const latRad = (lat * Math.PI) / 180;
    const n = Math.pow(2, zoom);
    const x = Math.floor(((lng + 180) / 360) * n);
    const y = Math.floor(((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2) * n);
    return { x, y };
  }

  // Convert tile coordinates to lat/lng bounds
  private tileToBounds(x: number, y: number, zoom: number): {
    north: number;
    south: number;
    east: number;
    west: number;
  } {
    const n = Math.pow(2, zoom);
    const west = (x / n) * 360 - 180;
    const east = ((x + 1) / n) * 360 - 180;
    const north = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * (180 / Math.PI);
    const south = Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 1)) / n))) * (180 / Math.PI);
    
    return { north, south, east, west };
  }

  // Generate Azure Maps tile URL
  private generateAzureMapsUrl(x: number, y: number, zoom: number, tileSize: number = 512): string {
    return `https://atlas.microsoft.com/map/tile?subscription-key=${this.subscriptionKey}&api-version=2.0&tilesetId=microsoft.imagery&zoom=${zoom}&x=${x}&y=${y}&tileSize=${tileSize}`;
  }

  // Fetch map tiles and return URLs
  async fetchMapTiles(request: AnalyzeAreaRequest, forceRefresh = false): Promise<MapTileResponse> {
    const startTime = performance.now();
    
    try {
      console.log(`Starting Azure Maps tile fetch for analysis with parameters:
        - Area: ${request.topLeftLat}, ${request.topLeftLng} to ${request.bottomRightLat}, ${request.bottomRightLng}
        - Zoom Level: ${request.zoomLevel}
        - Force Refresh: ${forceRefresh}`);
      
      const tiles = this.calculateTileGrid(request);
      
      if (tiles.length === 0) {
        throw new Error("No tiles calculated for the specified area");
      }
      
      if (tiles.length > 400) {
        throw new Error(`Too many tiles calculated (${tiles.length}). Please reduce the area or increase zoom level.`);
      }
      
      const tileUrls: string[] = [];
      let cacheHitCount = 0;
      let cacheMissCount = 0;
      
      // Process tiles in parallel batches
      const batchSize = 10;
      const batches: TileInfo[][] = [];
      for (let i = 0; i < tiles.length; i += batchSize) {
        batches.push(tiles.slice(i, i + batchSize));
      }
      
      for (const batch of batches) {
        const batchPromises = batch.map(async (tile, index) => {
          const globalIndex = batches.indexOf(batch) * batchSize + index;
          
          // Check cache first
          if (!forceRefresh && tileCache.isTileCached(tile.centerLat, tile.centerLng, tile.zoom)) {
            console.log(`Cache HIT for tile ${globalIndex + 1}/${tiles.length}: ${tile.x}, ${tile.y}, zoom ${tile.zoom}`);
            const cachedUrl = tileCache.getCachedTile(tile.centerLat, tile.centerLng, tile.zoom);
            if (cachedUrl) {
              tileUrls[globalIndex] = cachedUrl;
              cacheHitCount++;
              return;
            }
          }
          
          // Fetch from Azure Maps
          console.log(`Fetching tile ${globalIndex + 1}/${tiles.length} from Azure Maps: ${tile.x}, ${tile.y}, zoom ${tile.zoom}`);
          try {
            const imageBuffer = await this.fetchImageData(tile.url);
            const localUrl = await tileCache.cacheImageTile(tile.centerLat, tile.centerLng, tile.zoom, imageBuffer);
            tileUrls[globalIndex] = localUrl;
            cacheMissCount++;
          } catch (error) {
            console.error(`Failed to fetch tile ${globalIndex + 1}/${tiles.length}:`, error);
            throw new Error(`Failed to fetch tile at ${tile.x}, ${tile.y}: ${error}`);
          }
        });
        
        await Promise.all(batchPromises);
      }
      
      const processingTime = ((performance.now() - startTime) / 1000).toFixed(2);
      
      console.log(`Azure Maps tile fetch completed:
        - Total tiles: ${tiles.length}
        - Cache hits: ${cacheHitCount}
        - Cache misses: ${cacheMissCount}
        - Processing time: ${processingTime}s`);
      
      return {
        stitchedImageUrl: '', // We don't stitch images anymore
        tileUrls,
        tileCount: tiles.length,
        wasFromCache: cacheHitCount > cacheMissCount
      };
      
    } catch (error) {
      console.error('Azure Maps tile fetch failed:', error);
      throw error;
    }
  }

  // Validate Azure Maps subscription key
  async validateApiKey(): Promise<boolean> {
    try {
      const testUrl = this.generateAzureMapsUrl(0, 0, 0);
      const response = await this.fetchImageData(testUrl);
      return response.length > 0;
    } catch (error) {
      console.error('Azure Maps API key validation failed:', error);
      return false;
    }
  }
}