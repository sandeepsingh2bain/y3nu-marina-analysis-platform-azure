# Marina & Vessel Analysis Platform

A comprehensive full-stack web application that uses satellite imagery and AI-powered computer vision to detect and analyze boats in marina areas. The platform combines Google Maps satellite imagery with advanced object detection to provide detailed vessel analytics with spatial filtering and deduplication capabilities.

## 🚀 Key Features

- **Polygon-Based Area Selection**: Define custom areas of interest (AOI) using coordinate polygons
- **Satellite Imagery Integration**: Fetches high-resolution satellite tiles from Google Static Maps API
- **AI-Powered Boat Detection**: Uses Vision Agent with OwlV2 object detection models
- **Spatial Filtering**: Filters boats to keep only those 70%+ inside AOI polygons
- **Smart Deduplication**: Removes duplicate detections with 70% overlap threshold
- **Comprehensive Export**: Excel export with detailed boat measurements and coordinates
- **Real-time Progress Tracking**: Live updates during detection processing
- **Tile-based Processing**: Optimized tiling system with 25% overlap for efficient coverage

## 📋 System Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │    │     Backend      │    │   External      │
│   (React/TS)    │    │   (Express/TS)   │    │   Services      │
├─────────────────┤    ├──────────────────┤    ├─────────────────┤
│ • Coordinate    │◄──►│ • API Routes     │◄──►│ • Google Maps   │
│   Input         │    │ • Map Tiles      │    │   Static API    │
│ • Map Display   │    │ • Tile Cache     │    │ • PostgreSQL    │
│ • Results View  │    │ • Storage Layer  │    │   Database      │
│ • Export Tools  │    │ • Python Bridge  │    │ • Vision Agent  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │   AI Processing  │
                       │   (Python)       │
                       ├──────────────────┤
                       │ • Vision Agent   │
                       │ • OwlV2 Model    │
                       │ • Image Analysis │
                       │ • Bbox Detection │
                       └──────────────────┘
```

## 🔄 Complete Workflow

### 1. Area Definition
```
User Input → Polygon Coordinates → Bounds Calculation → Validation
```

### 2. Map Processing
```
Coordinates → Tile Grid Calculation → Google Maps API → Tile Caching → Storage
```

### 3. AI Detection
```
Satellite Tiles → Vision Agent → OwlV2 Model → Boat Detection → Coordinate Conversion
```

### 4. Data Processing
```
Raw Detections → AOI Spatial Filtering → Deduplication → Export Preparation
```

### 5. Export Pipeline
```
Filtered Data → Excel Format → Download → Statistics Report
```

## 🎯 Detection Flow Diagram

```
┌─────────────────┐
│ AOI Polygon     │
│ Definition      │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│ Tile Grid       │
│ Calculation     │
│ (25% overlap)   │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│ Satellite       │
│ Image Fetch     │
│ (Google Maps)   │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│ AI Detection    │
│ (Vision Agent)  │
│ Per Tile        │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐    ┌─────────────────┐
│ Coordinate      │    │ All Detections  │
│ Conversion      │───►│ Collected       │
│ (Pixel→LatLng)  │    │ (411 boats)     │
└─────────────────┘    └─────────┬───────┘
                                 │
                                 ▼
                       ┌─────────────────┐
                       │ AOI Spatial     │
                       │ Filtering       │
                       │ (70% inside)    │
                       └─────────┬───────┘
                                 │
                                 ▼
                       ┌─────────────────┐
                       │ Deduplication   │
                       │ (70% overlap)   │
                       └─────────┬───────┘
                                 │
                                 ▼
                       ┌─────────────────┐
                       │ Excel Export    │
                       │ with Statistics │
                       └─────────────────┘
```

## 🛠️ Technical Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for build tooling
- **TailwindCSS** + **shadcn/ui** for styling
- **TanStack Query** for state management
- **Wouter** for routing

### Backend
- **Express.js** with TypeScript
- **Drizzle ORM** with PostgreSQL
- **tsx** for TypeScript execution
- **Google Static Maps API** integration

### AI/ML
- **Vision Agent** library
- **OwlV2** object detection model
- **Python 3.11** runtime
- **Pillow** for image processing

### Database
- **PostgreSQL** with Neon hosting
- **Drizzle ORM** for type-safe queries
- **Real-time data storage**

## 📊 Data Model

### Analysis Request
```typescript
interface AnalysisRequest {
  id: number;
  topLeftLat: number;
  topLeftLng: number;
  bottomRightLat: number;
  bottomRightLng: number;
  zoomLevel: number;
  polygon?: Coordinate[];
  status: string;
  mapImageUrl?: string;
  tileUrls?: string[];
}
```

### Detection Result
```typescript
interface Detection {
  objectId: string;
  objectType: string;
  subType: string;
  lat: number;
  lng: number;
  length: number;
  width: number;
  area: number;
  confidence: number;
  boundingBox: BoundingBox;
  geoPolygon: GeoPolygon;
  tileIndex: number;
}
```

## 🔧 Setup & Installation

### Prerequisites
- Node.js 20+
- PostgreSQL database
- Google Static Maps API key
- Python 3.11 with Vision Agent

### Environment Variables
```bash
DATABASE_URL=postgresql://user:pass@host:port/db
GOOGLE_MAPS_API_KEY=your_api_key_here
```

### Installation
```bash
# Install dependencies
npm install

# Install Python dependencies
pip install vision-agent pillow-heif numpy

# Set up database
npm run db:push

# Start development server
npm run dev
```

## 🎮 Usage Guide

### 1. Define Area of Interest
- Enter polygon coordinates in the AOI Polygon field
- Use the default Newport Marina coordinates as a starting point
- Click "Load Default" to restore default coordinates

### 2. Load Satellite Maps
- Click "Load Maps" to fetch satellite imagery
- System automatically calculates optimal tile grid
- Tiles are cached for performance

### 3. Run Boat Detection
- Click "Run Detection on All Images" after maps are loaded
- AI processes each tile individually
- Real-time progress updates show detection status

### 4. Review Results
- View detected boats on annotated tile images
- Navigate between tiles using tile selection controls
- Check detection statistics and confidence scores

### 5. Export Filtered Data
- Click "Export AOI Filtered Results" for final dataset
- System applies spatial filtering (70% inside AOI)
- Removes duplicates with 70% overlap threshold
- Downloads Excel file with comprehensive boat data

## 📈 Performance Metrics

### Optimization Features
- **Tile Caching**: 24-hour cache duration for repeated requests
- **Overlap Optimization**: 25% tile overlap for coverage without redundancy
- **Batch Processing**: Parallel tile processing for faster detection
- **Memory Management**: Efficient storage and retrieval patterns

### Typical Performance
- **8-tile grid**: Covers ~153m × 306m area
- **Detection Rate**: ~50-60 boats per tile average
- **Processing Time**: 2-3 minutes for complete analysis
- **Export Speed**: Instant Excel generation with filtering

## 🔍 Filtering Pipeline

### Spatial Filtering (AOI)
1. Parse AOI polygon coordinates
2. Check each boat's bounding box corners
3. Use ray-casting algorithm for point-in-polygon test
4. Require 75% of corners (3 out of 4) inside AOI
5. Filter out boats not meeting threshold

### Deduplication Process
1. Sort detections by confidence score (highest first)
2. Calculate polygon overlap between boat bounding boxes
3. Remove boats with >70% overlap with higher-confidence detections
4. Preserve unique boats across tile boundaries

## 📋 Export Data Format

### Excel Columns
- **Type**: Vessel classification
- **Latitude**: Precise GPS latitude (15 decimal places)
- **Longitude**: Precise GPS longitude (15 decimal places)
- **Length (m)**: Boat length in meters
- **Width (m)**: Boat width in meters
- **Polygon Coords**: Complete bounding box coordinates

### Statistics Included
- Total detections before filtering
- AOI filtered count
- Deduplicated final count
- Processing time and tile coverage

## 🚀 Deployment

The application is configured for Replit deployment with:
- Automatic workflow management
- Environment variable configuration
- PostgreSQL database integration
- Static file serving for processed images

## 🔐 Security & API Keys

### Google Maps API
- Requires Static Maps API access
- Implements rate limiting and caching
- Validates API key on startup

### Database Security
- Uses connection pooling
- Prepared statements prevent SQL injection
- Environment-based configuration

## 📝 Recent Updates

- **June 25, 2025**: Complete spatial filtering implementation
- **June 25, 2025**: Optimized tiling system (25% overlap)
- **June 25, 2025**: Enhanced export pipeline with statistics
- **June 25, 2025**: Polygon input functionality with validation
- **June 25, 2025**: Real-time detection progress tracking

## 🤝 Contributing

This platform provides a robust foundation for marina analysis and can be extended with additional features like:
- Multi-temporal analysis
- Vessel classification refinement
- Integration with marine databases
- Advanced analytics dashboards

## 📊 Sample Results

**Newport Marina Analysis**:
- **Area**: 6-point polygon coverage
- **Tiles**: 8 optimized tiles with 25% overlap
- **Detections**: 411 boats identified
- **Processing**: Complete pipeline with filtering and deduplication
- **Export**: Comprehensive Excel dataset with coordinates and measurements

The platform successfully demonstrates end-to-end marina analysis capabilities with high accuracy and performance optimization.