# Required Screenshots for Marina Analysis Platform User Guide

This document lists all screenshots needed for the Marina Analysis Platform (Google Maps) User Guide. Place each screenshot in this folder with the exact filename specified below.

## Screenshot List

### 1. Main Interface
- **Filename**: `01-main-interface.png`
- **Description**: Main application interface with navigation tabs
- **Content to capture**:
  - Header with "Marina Analysis Platform" title
  - Navigation tabs: Single Analysis, Batch Processing, File System, System Cleanup
  - Main content area showing Single Analysis page
  - Empty state or loaded AOI polygon
- **Recommended resolution**: Minimum 1920px width
- **Map state**: Initial screen or with default coordinates

---

### 2. AOI Polygon Input
- **Filename**: `02-aoi-polygon-input.png`
- **Description**: AOI Polygon input field with coordinates
- **Content to capture**:
  - Large text area with polygon coordinates (JSON array format)
  - "Load Default" button
  - "Load Maps" button
  - Zoom level selector (showing 19)
  - Sample coordinates visible in text area
- **Recommended resolution**: Minimum 1200px width
- **State**: Text area filled with polygon coordinates

---

### 3. Zoom Level Selection
- **Filename**: `03-zoom-level.png`
- **Description**: Zoom level dropdown/slider
- **Content to capture**:
  - Zoom level selector showing options 18, 19, 20
  - Currently selected: 19
  - Resolution information (e.g., "~1.19m per pixel")
- **Recommended resolution**: Minimum 800px width
- **State**: Zoom level selection interface

---

### 4. Load Maps Button
- **Filename**: `04-load-maps.png`
- **Description**: Load Maps button ready to fetch satellite imagery
- **Content to capture**:
  - "Load Maps" button prominently displayed
  - AOI polygon coordinates visible in background
  - Zoom level set
  - Button in enabled/ready state
- **Recommended resolution**: Minimum 1200px width
- **State**: Before clicking Load Maps

---

### 5. Satellite Tiles Display
- **Filename**: `05-satellite-tiles.png`
- **Description**: Grid of satellite tiles after loading
- **Content to capture**:
  - 8-tile grid (or similar) showing satellite imagery
  - Each tile numbered (Tile 1, Tile 2, etc.)
  - Google Maps satellite imagery visible
  - Tiles showing marina area (boats visible)
  - Tile grid layout clearly visible
- **Recommended resolution**: Minimum 1920px width
- **State**: After successful map loading, before detection

---

### 6. Run Detection Button
- **Filename**: `06-run-detection.png`
- **Description**: Run Detection button ready to start AI analysis
- **Content to capture**:
  - "Run Detection on All Images" button
  - Satellite tiles loaded in background
  - Button in enabled state
  - Detection controls visible
- **Recommended resolution**: Minimum 1200px width
- **State**: After maps loaded, before detection starts

---

### 7. Detection Progress
- **Filename**: `07-detection-progress.png`
- **Description**: Real-time progress during detection
- **Content to capture**:
  - Progress bar or percentage indicator
  - Current tile being processed (e.g., "Processing Tile 3/8")
  - Number of boats detected so far
  - Status messages
  - Partial results if available
- **Recommended resolution**: Minimum 1200px width
- **State**: During detection process (mid-way through)

---

### 8. Annotated Detection Results
- **Filename**: `08-annotated-results.png`
- **Description**: Detection results with green bounding boxes
- **Content to capture**:
  - Annotated satellite tile image
  - Green bounding boxes around detected boats
  - Labels showing boat dimensions (length x width)
  - Multiple detections visible
  - Tile selector/navigation showing which tile is displayed
- **Recommended resolution**: Minimum 1200px width
- **State**: After detection completes, showing annotated image

---

### 9. Detection Statistics
- **Filename**: `09-detection-stats.png`
- **Description**: Statistics panel showing filtering results
- **Content to capture**:
  - Statistics panel/card showing:
    - Total Raw Detections (e.g., 411 boats)
    - AOI Filtered count (e.g., 385 boats)
    - After Deduplication (e.g., 334 boats)
    - Processing time
    - Tiles processed
  - Clear visualization of filtering pipeline
- **Recommended resolution**: Minimum 1000px width
- **State**: After detection and filtering complete

---

### 10. Export Results Button
- **Filename**: `10-export-results.png`
- **Description**: Export button for downloading Excel file
- **Content to capture**:
  - "Export AOI Filtered Results" button
  - Detection statistics visible
  - Button in enabled state
  - Optional: Excel icon or download indicator
- **Recommended resolution**: Minimum 1200px width
- **State**: After detection completes, ready to export

---

### 11. Batch Upload Interface
- **Filename**: `11-batch-upload.png`
- **Description**: Batch Processing tab with CSV upload
- **Content to capture**:
  - Batch Processing tab active/selected
  - CSV file upload area (drag-and-drop or file picker)
  - "Upload CSV" button
  - Instructions for CSV format
  - Sample data reference
- **Recommended resolution**: Minimum 1200px width
- **State**: Batch Processing tab, before upload

---

### 12. Batch Settings Configuration
- **Filename**: `12-batch-settings.png`
- **Description**: Batch processing settings and marina list
- **Content to capture**:
  - List of marinas from uploaded CSV (5-10 visible)
  - Zoom level setting for batch
  - Processing mode selection (if applicable)
  - "Start Batch Processing" button
  - Marina count (e.g., "10 marinas ready")
- **Recommended resolution**: Minimum 1200px width
- **State**: After CSV upload, before starting batch

---

### 13. Batch Processing Progress
- **Filename**: `13-batch-processing.png`
- **Description**: Progress for multiple marinas in batch
- **Content to capture**:
  - List of marinas with status indicators
  - Current marina being processed (highlighted/active)
  - Completed marinas (green checkmarks)
  - Pending marinas (gray/waiting)
  - Overall progress (e.g., "Processing 3 of 10")
  - Individual marina progress bars
- **Recommended resolution**: Minimum 1920px width
- **State**: During batch processing (mid-way)

---

### 14. Spatial Filtering Diagram
- **Filename**: `14-spatial-filtering.png`
- **Description**: Visual explanation of spatial filtering
- **Content to capture**:
  - Satellite image with AOI polygon overlay (blue line)
  - Boat detections (green boxes)
  - Some boats inside polygon (kept)
  - Some boats outside polygon (filtered out - maybe red X)
  - Visual demonstration of 70% threshold
  - Annotations explaining the filtering
- **Recommended resolution**: Minimum 1200px width
- **State**: Diagram/visualization showing concept

---

### 15. Deduplication Process
- **Filename**: `15-deduplication.png`
- **Description**: Visual explanation of deduplication
- **Content to capture**:
  - Two overlapping satellite tiles
  - Same boat detected in both tiles (overlapping area)
  - Visual showing how overlap is calculated
  - One detection kept (higher confidence)
  - Duplicate removed (marked with X or faded)
  - Annotations explaining 70% overlap threshold
- **Recommended resolution**: Minimum 1200px width
- **State**: Diagram/visualization showing concept

---

### 16. File System Browser
- **Filename**: `16-file-browser.png`
- **Description**: File System tab showing generated files
- **Content to capture**:
  - File System tab active
  - Directory tree showing:
    - /analysis/[request-id]/
    - /tiles/ folder
    - /annotated/ folder
    - /exports/ folder
  - File list with thumbnails
  - Download buttons/icons
  - File sizes and dates
- **Recommended resolution**: Minimum 1920px width
- **State**: File system populated with detection results

---

### 17. System Cleanup Dialog
- **Filename**: `17-system-cleanup.png`
- **Description**: System cleanup confirmation dialog
- **Content to capture**:
  - "System Cleanup" dialog/modal open
  - Warning message about permanent deletion
  - List of what will be deleted:
    - All boat detection results
    - All analysis requests
    - All cached tiles
    - All annotated images
    - All database records
  - "Cancel" and "Delete All Data" buttons
  - Red/warning styling
- **Recommended resolution**: Minimum 1000px width
- **State**: Cleanup dialog open (before confirmation)

---

## Capture Instructions

### Using macOS
1. Press `Cmd + Shift + 4`
2. Press `Space` to capture entire window
3. Click on the browser window
4. Save screenshot with appropriate filename

### Using Windows
1. Press `Windows + Shift + S`
2. Select area to capture
3. Save from clipboard with appropriate filename

### Using Browser Developer Tools
1. Open browser DevTools (F12)
2. Use device toolbar to set viewport size
3. Take screenshot using browser's built-in tool
4. Save with appropriate filename

## Image Specifications

- **Format**: PNG preferred (supports transparency)
- **Minimum width**: 1200px for full-width screenshots, 800px for close-ups
- **Compression**: Optimize for web (reduce file size without quality loss)
- **Naming**: Use exact filenames listed above (lowercase, hyphens, .png extension)
- **Content**: Ensure UI elements are clearly visible and readable
- **Map data**: Use Newport Marina or sample marina from attached_assets

## Sample Data to Use

For consistent screenshots, use the sample data:
- **Newport Marina**: Default coordinates included in application
- **Zoom Level**: 19 (recommended)
- **Expected Results**: ~411 detections → ~334 after filtering

This ensures documentation screenshots match the demo workflow users can follow.

## Key UI Elements to Capture

### Navigation Bar
- "Marina Analysis Platform" title
- Tab buttons: Single Analysis, Batch Processing, File System, System Cleanup
- Active tab highlighted

### AOI Input Section
- Large text area with JSON coordinates
- "Load Default" button
- "Load Maps" button
- Zoom level selector

### Satellite Tiles Grid
- 8-tile layout (2x4 or 4x2)
- Each tile numbered
- Google Maps satellite imagery
- Marina with boats visible

### Detection Results
- Green bounding boxes on boats
- Dimension labels (length x width)
- Confidence scores if visible

### Statistics Panel
- Total detections count
- Filtered count
- Deduplicated count
- Processing time
- Visual progression (before/after filtering)

### Export Section
- "Export AOI Filtered Results" button
- File format indication (Excel)
- Download icon

### Batch Processing
- Marina list with checkboxes/status
- Progress indicators
- Individual marina status
- Overall batch progress

## Notes

- Use the actual application running locally or on deployment
- Ensure all screenshots show professional, clean UI state
- Use real detection results (not mock data)
- Capture at full resolution for crisp, clear images
- Avoid showing any sensitive information
- Use default Newport Marina for consistency
- Ensure good contrast and readable text

## Screenshot Workflow Summary

1. **01-main-interface.png**: App homepage, Single Analysis tab
2. **02-aoi-polygon-input.png**: Polygon coordinates input
3. **03-zoom-level.png**: Zoom level selection
4. **04-load-maps.png**: Ready to load maps
5. **05-satellite-tiles.png**: 8 tiles loaded
6. **06-run-detection.png**: Ready to run detection
7. **07-detection-progress.png**: Detection in progress
8. **08-annotated-results.png**: Results with bounding boxes
9. **09-detection-stats.png**: Statistics panel
10. **10-export-results.png**: Export button
11. **11-batch-upload.png**: Batch tab, upload CSV
12. **12-batch-settings.png**: Marina list, settings
13. **13-batch-processing.png**: Batch in progress
14. **14-spatial-filtering.png**: Filtering diagram
15. **15-deduplication.png**: Dedup diagram
16. **16-file-browser.png**: File system view
17. **17-system-cleanup.png**: Cleanup confirmation
