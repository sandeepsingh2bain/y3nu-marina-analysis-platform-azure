# Deployment Troubleshooting Guide

## Issue: Zero Boats Detected in Deployed Environment

The marina analysis application works correctly in development but returns zero boat detections when deployed. This is typically caused by missing environment secrets in the deployment configuration.

## Solution Steps

### 1. Configure Environment Secrets in Replit Deployment

In your Replit deployment settings, ensure these environment variables are set:

```
VISION_AGENT_API_KEY=your_vision_agent_api_key_here
GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
DATABASE_URL=your_database_url_here
```

### 2. Verify API Key Configuration

The Vision Agent API key is required for boat detection. Without it, the detection process will return empty results.

### 3. Check Deployment Environment

Use the health endpoint to verify configuration:
```
GET /api/health
```

This returns:
```json
{
  "status": "ok",
  "timestamp": "2025-06-19T23:52:34.137Z",
  "environment": {
    "nodeEnv": "production",
    "hasGoogleMapsKey": true,
    "hasVisionAgentKey": true,
    "hasDatabaseUrl": true
  }
}
```

### 4. Common Issues

1. **Missing VISION_AGENT_API_KEY**: Boat detection returns empty arrays
2. **Missing GOOGLE_MAPS_API_KEY**: Map loading fails
3. **Missing DATABASE_URL**: Application fails to start

### 5. Testing After Configuration

1. Deploy with proper environment variables
2. Load maps using the coordinate input
3. Run boat detection on any tile
4. Verify detection results appear in the boat list
5. Test the Excel export functionality

## Expected Behavior

- Development: 147 boats detected across 4 tiles
- Deployed (with proper config): Same detection results
- Deployed (missing secrets): Zero boats detected

## Support

If boat detection still returns zero after configuring environment secrets, check the server logs for specific error messages related to Vision Agent API authentication.