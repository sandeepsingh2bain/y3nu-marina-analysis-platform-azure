# Marina & Vessel Analysis Platform

## Overview
This platform is a full-stack solution for analyzing marina occupancy and vessel detection using satellite imagery and AI-powered computer vision. It integrates Google Maps (now Azure Maps) satellite data with advanced object detection to provide detailed analytics on boat presence and movement, offering insights into marina utilization and maritime activity. The project aims to provide an accurate, efficient, and scalable tool for marine industry professionals and analysts.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
The application employs a modern full-stack architecture, separating client and server components for scalability and maintainability.

- **Frontend**: Built with React and TypeScript, utilizing Vite for development and shadcn/ui with Tailwind CSS for a consistent and responsive user interface. State management is handled by React Query, and Wouter is used for client-side routing.
- **Backend**: An Express.js server developed in TypeScript handles API requests, imagery fetching, and integration with the AI/ML components. It manages Google Maps (now Azure Maps) integration for satellite imagery and orchestrates Python script execution for computer vision tasks.
- **Database**: PostgreSQL is used as the primary data store, with Drizzle ORM facilitating efficient data interaction. It stores user information, analysis requests, and detailed vessel detection results including coordinates and measurements.
- **AI/ML**: Python-based computer vision, powered by the `vision-agent` library, performs advanced object detection and image processing on satellite imagery. This includes generating annotated images with bounding boxes and labels.
- **Mapping Service**: Initially Google Static Maps API, the system has migrated to Microsoft Azure Maps for satellite imagery fetching.
- **Core Functionality**:
    - **Coordinate/Polygon Input**: Users can define areas of interest using geographic coordinates or by providing an AOI polygon, with automatic bounds calculation and validation.
    - **Image Processing**: Fetches and stitches satellite imagery tiles (or processes individual tiles without stitching for performance).
    - **Object Detection**: Analyzes imagery for boat detection using the Vision Agent API, returning detailed detection data.
    - **Data Management**: Stores detections, tracks analysis jobs, and manages cached imagery and analysis results to optimize performance and reduce API calls.
    - **Spatial Filtering**: Implements point-in-polygon checks and deduplication logic (70% polygon overlap threshold) to refine detection results within the AOI.
    - **Batch Processing**: Supports CSV uploads for automated processing of multiple AOIs, with real-time progress tracking and batch job management.
    - **Authentication**: Integrates Microsoft Entra ID (Azure AD) for secure user authentication and access control.
    - **Visualization**: Displays annotated images with detected boats, offering tile-specific and overall analysis visualizations with precise coordinate conversion from pixel to geographic coordinates.
    - **Export**: Provides Excel export functionality for filtered and deduplicated detection results, including custom filenames and comprehensive metadata.

## External Dependencies

- **APIs and Services**:
    - Microsoft Azure Maps: Satellite imagery source.
    - Neon Database: PostgreSQL hosting.
    - `vision-agent`: AI/ML library for object detection.
- **Key Libraries**:
    - **Frontend**: React, TypeScript, Vite, TanStack Query, Tailwind CSS, shadcn/ui, Wouter.
    - **Backend**: Express.js, Drizzle ORM, tsx.
    - **AI/ML**: `vision-agent`, pillow-heif, numpy.

## Recent Changes

- July 10, 2025. Increased boat detection confidence threshold from 0.3 to 0.35 (35%) to reduce false positives and provide more precise boat detections while maintaining good coverage of legitimate vessels
- July 10, 2025. Further increased boat detection confidence threshold to 0.4 (40%) for even more precise detections with minimal false positives
- July 15, 2025. Performed comprehensive data cleanup for 24 AOI records - completely deleted all database records and cached files for specific Record IDs to enable fresh detection runs
- July 18, 2025. Performed complete system reset for fresh start - deleted ALL database records (93,187 detections, 7,907 tile mappings, 825 batch AOIs, 810 analysis requests, 5 batch jobs) and cleared all cached files (analysis cache, satellite tiles, annotated images, visualizations). System completely clean and ready for new AOI processing with 40% detection confidence threshold