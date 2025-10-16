# Sample Data for Marina Analysis Platform (Google Maps)

This folder contains real sample files from RecordID 6147 (Annapolis Marina) demonstrating the complete workflow: input CSV, raw tile detections, and final filtered results.

## Files in This Folder

### 6147-addresses_export-AOI-Capture-download.csv
**Format:** CSV export from GeoCapture (AOI Capture application)
**Purpose:** Input file for both Single Analysis and Batch Processing
**Usage:**
- **Single Analysis:** Copy polygon coordinates from this file and paste into AOI Polygon field
- **Batch Processing:** Upload this entire CSV file in the Batch Processing tab

**Content:**
- 1 marina record (RecordID 6147)
- Complete 12-point polygon coordinates for Annapolis Marina
- Geocoded address and bounding box
- All required columns for processing

**⚠️ Important:** The **RecordID column** in this file was **manually added** after exporting from GeoCapture. GeoCapture exports do not include RecordID by default. You must add this column manually to ensure unique identification of each marina.

### 6147-boat-detections-tile1-export.csv
**Format:** CSV with raw boat detections
**Purpose:** Individual tile detection results BEFORE filtering and deduplication
**Content:**
- 51 boat detections from Tile 0
- Includes boats outside AOI polygon
- Includes potential duplicates in overlap areas
- Columns: Boat ID, Type, Latitude, Longitude, Length (m), Width (m), Area (m²), Confidence (%), Tile Index

### 6147-boat-detections-tile2-export.csv
**Format:** CSV with raw boat detections
**Purpose:** Individual tile detection results BEFORE filtering and deduplication
**Content:**
- 55 boat detections from Tile 7
- Includes boats outside AOI polygon
- Includes potential duplicates in overlap areas
- Columns: Boat ID, Type, Latitude, Longitude, Length (m), Width (m), Area (m²), Confidence (%), Tile Index

### 6147-Detection-results.xlsx
**Format:** Excel file (.xlsx)
**Purpose:** Final filtered and deduplicated detection results
**Usage:** This is the file used in Detection Visualizer application for visualization
**Content:**
- ~55 boats (after AOI filtering and deduplication from 106 raw detections)
- Only boats with 70%+ inside AOI polygon
- Duplicates removed (70% overlap threshold)
- Columns: Type, Latitude, Longitude, Length (m), Width (m), Polygon Coords

---

## File Format Requirements

### CSV Format for Batch Processing

The CSV file must be exported from **GeoCapture** and contain these columns:

#### Required Columns:

| Column | Description | Example | Notes |
|--------|-------------|---------|-------|
| **RecordID** | Unique alphanumeric identifier | 6147, MAR-001, ANN-6147 | **MUST BE ADDED MANUALLY** |
| **Address** | Full marina address | 410 Severn Avenue, Annapolis, MD | From GeoCapture |
| **Geocode Latitude** | Center point latitude | 38.97167 | From GeoCapture |
| **Geocode Longitude** | Center point longitude | -76.48337 | From GeoCapture |
| **Polygon Coordinates** | JSON array of polygon points | `[{"lat":38.9722,"lng":-76.4833}, ...]` | From GeoCapture |
| **Formatted Address** | Google's formatted address | 410 Severn Ave, Annapolis, MD 21403, USA | From GeoCapture |

**⚠️ Critical Note about RecordID:**
> The **RecordID** column is **NOT included** in GeoCapture exports. You **must manually add** this column to your CSV file.
>
> **Why Manual Addition is Required:**
> - Many different marinas can have the same RecordID in source data
> - The same marina can appear with different RecordIDs across different datasets
> - Manual assignment ensures each marina has a unique, traceable identifier
> - RecordID is used in output filenames: `[RecordID]-Detection-results.xlsx`
> - Without unique RecordIDs, results from different marinas may overwrite each other

**How to Add RecordID:**
1. Export AOI polygons from GeoCapture (AOI Capture app)
2. Open the exported CSV file
3. Add a new column at the beginning: `RecordID`
4. Assign unique alphanumeric IDs to each marina (e.g., 6147, 6148, MAR-001, ANN-6147, etc.)
5. Save the file
6. Upload to Marina Analysis Platform

#### Optional Columns:
- Top-Left: Bounding box corner
- Bottom-Right: Bounding box corner
- Status: Geocoding status
- Geocoded At: Timestamp
- Bounding Box Captured At: Timestamp

---

## Sample Data Details

### RecordID 6147: Annapolis, MD
- **RecordID**: 6147
- **Address**: 410 Severn Avenue, Annapolis, MD 21403
- **Coordinates**: 38.97167, -76.48337
- **Polygon Points**: 12-point irregular polygon
- **Raw Detections**: 106 boats total
  - Tile 0: 51 boats (`6147-boat-detections-tile1-export.csv`)
  - Tile 7: 55 boats (`6147-boat-detections-tile2-export.csv`)
- **Final Results**: ~55 boats after filtering/dedup (`6147-Detection-results.xlsx`)
- **Removed**: ~51 boats (outside AOI or duplicates)

---

## Polygon Coordinate Format

Polygon coordinates must be in JSON array format with `lat` and `lng` properties:

**Correct Format:**
```json
[
  {"lat":38.97220835300037,"lng":-76.48325928004924},
  {"lat":38.97275095846031,"lng":-76.48386017213753},
  {"lat":38.97230852662895,"lng":-76.48486344732065},
  {"lat":38.9717356464176,"lng":-76.48437996086551}
]
```

**Important:**
- Must be valid JSON
- Each point needs both `lat` and `lng`
- Minimum 3 points (triangle)
- Recommended 4-12 points for marinas
- Points should form closed polygon (last point connects to first)

---

## How to Use Sample Data

### Single Analysis Mode

1. Open `6147-addresses_export-AOI-Capture-download.csv` in text editor
2. Locate the **"Polygon Coordinates"** column (column G)
3. Copy the entire JSON array
4. In Marina Analysis Platform, navigate to **Single Analysis** tab
5. Paste coordinates into "AOI Polygon" text field
6. Set zoom level to 19
7. Click **"Load Maps"**
8. Click **"Run Detection on All Images"**
9. Review results and export

**Example Polygon to Copy (RecordID 6147 - Annapolis Marina):**
```json
[{"lat":38.97220835300037,"lng":-76.48325928004924},{"lat":38.97275095846031,"lng":-76.48386017213753},{"lat":38.97230852662895,"lng":-76.48486344732065},{"lat":38.9717356464176,"lng":-76.48437996086551},{"lat":38.971853566928345,"lng":-76.48421426926097},{"lat":38.97194121930017,"lng":-76.48388699767717},{"lat":38.97197461065137,"lng":-76.48372604443924},{"lat":38.971903654011264,"lng":-76.48366166314406},{"lat":38.971966262815066,"lng":-76.48353290055373},{"lat":38.97200800198685,"lng":-76.48347388436649},{"lat":38.97209982807822,"lng":-76.48348997969026},{"lat":38.972141567171306,"lng":-76.48342023328719}]
```

**Expected Results:**
- Raw detections: 106 boats across 2 tiles
- Final export: ~55 boats (after filtering/dedup)
- Output file: `6147-Detection-results.xlsx`

### Batch Processing Mode

1. Navigate to **Batch Processing** tab
2. Click **"Upload CSV"** button
3. Select `6147-addresses_export-AOI-Capture-download.csv` file
4. Review marina list (1 marina will appear: RecordID 6147)
5. Set zoom level to 19 (recommended)
6. Click **"Start Batch Processing"**
7. Wait for all marinas to complete
8. Download individual Excel files from File System

---

## Expected Results

### Processing Time
- **RecordID 6147**: 3-5 minutes average
- **Varies by**: Marina size, boat density, server load

### Detection Counts (RecordID 6147 - Annapolis)

| Stage | Count | Notes |
|-------|-------|-------|
| **Raw Detections (Tile 0)** | 51 boats | `6147-boat-detections-tile1-export.csv` |
| **Raw Detections (Tile 7)** | 55 boats | `6147-boat-detections-tile2-export.csv` |
| **Total Raw Detections** | 106 boats | Before any filtering |
| **After AOI Filtering** | ~55 boats | 70%+ inside polygon |
| **After Deduplication** | ~55 boats | `6147-Detection-results.xlsx` (final) |

**What Gets Removed:**
- ~51 boats total removed (48% reduction)
- Boats outside AOI polygon (not 70%+ inside)
- Duplicate detections in tile overlap areas (70%+ overlap)

**Note:** Actual counts vary by:
- Season (summer vs. winter)
- Time of day (satellite imagery timestamp)
- Marina occupancy
- Detection confidence threshold

---

## Output Files

### Files Included in This Folder

**Input:**
- `6147-addresses_export-AOI-Capture-download.csv` - Input CSV with AOI polygon

**Raw Tile Detections (before filtering):**
- `6147-boat-detections-tile1-export.csv` - 51 boats from Tile 0
- `6147-boat-detections-tile2-export.csv` - 55 boats from Tile 7

**Final Filtered Results:**
- `6147-Detection-results.xlsx` - ~55 boats (after AOI filtering and deduplication)

### Raw Tile CSV Columns

Raw tile CSVs contain these columns:

| Column | Description | Example |
|--------|-------------|---------|
| Boat ID | Unique identifier | B001 |
| Type | Boat size (small/medium/large) | medium |
| Latitude | GPS latitude | 38.9724177392182 |
| Longitude | GPS longitude | -76.4843675783960 |
| Length (m) | Boat length in meters | 18.5 |
| Width (m) | Boat width in meters | 7.4 |
| Area (m²) | Boat area | 136.9 |
| Confidence (%) | Detection confidence (0-10000) | 5300 |
| Tile Index | Which tile (0, 7, etc.) | 0 |

### Final Excel Columns

Final Excel file contains these columns:

| Column | Description | Example |
|--------|-------------|---------|
| Type | Boat size classification (small/medium/large) | medium |
| Latitude | GPS latitude (15 decimal places) | 38.972417739218200 |
| Longitude | GPS longitude (15 decimal places) | -76.484367578396000 |
| Length (m) | Boat length in meters | 18.5 |
| Width (m) | Boat width in meters | 7.4 |
| Polygon Coords | Bounding box in TL/TR/BR/BL format | TL: lat,lng \| TR: lat,lng \| ... |

**Sample Rows from 6147-Detection-results.xlsx:**
```
Type: medium, Latitude: 38.972417739218200, Longitude: -76.484367578396000, Length (m): 18.5, Width (m): 7.4
Type: medium, Latitude: 38.972377113895500, Longitude: -76.485816145568300, Length (m): 19.1, Width (m): 7.6
Type: large, Latitude: 38.972305853027400, Longitude: -76.484594586261600, Length (m): 20.0, Width (m): 8.0
```

---

## Creating Your Own CSV

### From GeoCapture

1. **Draw AOI Polygons**: Use GeoCapture to draw polygons around each marina
2. **Export CSV**: Click "Download AOIs" button in GeoCapture
3. **Save File**: Save as `my-marinas-input.csv`
4. **Upload Here**: Use in Batch Processing tab

### Manual Creation

If creating CSV manually:

1. **Required Columns**: RecordID, Address, Geocode Latitude, Geocode Longitude, Polygon Coordinates
2. **Valid JSON**: Ensure polygon coordinates are properly formatted JSON
3. **Test First**: Try with 1-2 marinas before large batch
4. **Use Template**: Copy structure from sample file

**Minimal CSV Example (use actual data from GeoCapture):**
```csv
RecordID,Address,Geocode Latitude,Geocode Longitude,Polygon Coordinates,Formatted Address
6147,"410 Severn Avenue, Annapolis, MD 21403",38.97167,-76.48337,"[{""lat"":38.9722,""lng"":-76.4833},{""lat"":38.9727,""lng"":-76.4839}, ...]","410 Severn Ave, Annapolis, MD 21403, USA"
```

---

## Common Issues

### CSV Upload Fails

**Problem:** "Invalid CSV format" error

**Solutions:**
1. **Check Encoding**: Save as UTF-8
2. **Verify Headers**: Ensure all required columns present
3. **Check JSON**: Polygon coordinates must be valid JSON
4. **Remove Quotes**: Ensure double quotes in JSON are properly escaped
5. **Test Sample**: Try uploading sample file first

### Polygon Won't Parse

**Problem:** "Invalid polygon coordinates" error

**Solutions:**
1. **JSON Validation**: Use JSON validator online
2. **Escape Quotes**: Ensure nested quotes properly escaped (`""` not `"`)
3. **Minimum Points**: Need at least 3 coordinate points
4. **Format Check**: Must have `lat` and `lng` for each point

### Batch Processing Stuck

**Problem:** One marina stops batch processing

**Solutions:**
1. **Check Logs**: Look for error messages
2. **Individual Test**: Try problem marina in Single Analysis mode
3. **Skip Marina**: Remove from CSV and process separately
4. **Retry**: Restart batch processing

### No Detections Found

**Problem:** Processing completes but 0 boats detected

**Possible Causes:**
- Polygon coordinates incorrect (wrong location)
- Zoom level too low (try 19 or 20)
- Marina has no boats currently
- Satellite imagery outdated

**Solutions:**
1. **Verify Location**: Check coordinates in Single Analysis mode
2. **Increase Zoom**: Try zoom 19 or 20
3. **Check Tiles**: Review loaded satellite tiles for boats
4. **Test with Sample**: Try Annapolis marina (known to have boats)

---

## Tips for Batch Processing

### Preparation
1. **Test First**: Run single marina before batch
2. **Group by Region**: Process nearby marinas together
3. **Check Quotas**: Ensure Google Maps API quota sufficient
4. **Clear Cache**: Run System Cleanup before large batches

### During Processing
1. **Monitor Progress**: Check for failed marinas
2. **Don't Refresh**: Let batch complete without interruption
3. **Note Failures**: Record any marinas that error out
4. **Export Regularly**: Download completed exports

### After Processing
1. **Verify Counts**: Check detection statistics make sense
2. **Review Samples**: Spot-check a few annotated images
3. **Compare Results**: Look for consistency across similar marinas
4. **Upload to Visualizer**: Verify results in Detection Visualizer app

---

## Coordinate System

All coordinates in the sample data use:
- **Format:** Decimal degrees
- **Datum:** WGS84
- **Latitude range:** -90 to 90 (positive = North)
- **Longitude range:** -180 to 180 (positive = East)
- **Precision:** 15 decimal places (sub-centimeter accuracy)

**Sample Location:**
- RecordID 6147 - Annapolis, MD: 38.97167°N, -76.48337°W

---

## Data Sources

The sample data in this folder is:
- **Marina:** RecordID 6147 - Actual marina in Annapolis, MD, USA
- **AOI Polygon:** 12-point polygon from GeoCapture export
- **Address:** Real address from public records (410 Severn Avenue, Annapolis, MD 21403)
- **Coordinates:** Geocoded using Google Maps API
- **Raw Detections:** Real AI detection results from Vision Agent
- **Final Results:** Actual filtered and deduplicated boat data

Data is provided for **testing and demonstration purposes only**.

---

## Next Steps

After reviewing sample data:

1. **Understand the Files**:
   - Study `6147-addresses_export-AOI-Capture-download.csv` (input format)
   - Compare raw tile CSVs (106 boats) vs final Excel (~55 boats)
   - See how filtering and deduplication work

2. **Test Single Analysis**:
   - Copy polygon from CSV file
   - Paste into Single Analysis tab
   - Run detection and compare results

3. **Test Batch Processing**:
   - Upload `6147-addresses_export-AOI-Capture-download.csv`
   - Process RecordID 6147
   - Download results from File System

4. **Verify in Visualizer**:
   - Use `6147-Detection-results.xlsx` in Detection Visualizer app
   - Paste AOI polygon from CSV file
   - Visualize boats on map

5. **Process Your Own Data**:
   - Export your marinas from GeoCapture
   - Follow same format as sample files
   - Process using Marina Analysis Platform

---

**Note:** This sample data represents a complete real-world workflow from RecordID 6147 (Annapolis Marina). Use it to understand the entire process from input CSV to final filtered results before processing your own production data.
