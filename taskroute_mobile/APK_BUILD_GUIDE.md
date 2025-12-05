# Flutter APK Build Configuration Guide

## Issues Found in Your .env File

Your current `.env` has **3 critical errors**:

```env
# ❌ WRONG - React prefix (not for Flutter)
REACT_APP_GOOGLE_API_KEY=AIzaSyDAVM3qnLqc6nFv4YJobnUe9RkA7xUCCgI 

# ❌ WRONG - Typo in URL (missing 't', malformed IP)
API_URL=htp://192.168.1021188000/api/v1
          ↑ should be "http"
          ↑ should be "192.168.102.118:8000"
```

---

## ✅ CORRECTED Configuration

### Step 1: Update Your `.env` File

**Replace your entire `.env` file with this:**

```env
# Google Maps API Key (for development only)
MAPS_API_KEY=AIzaSyDAVM3qnLqc6nFv4YJobnUe9RkA7xUCCgI

# Backend API URL
# Use deployed URL for production APK:
API_URL=https://taskroute-tracker.onrender.com/api/v1

# For local testing only (comment out for production):
# API_URL=http://192.168.102.118:8000/api/v1
```

### Step 2: Update AndroidManifest.xml

**File**: `android/app/src/main/AndroidManifest.xml`

**Find line 7-9** (the Google Maps API key meta-data):

```xml
<!-- CURRENT (line 7-9): -->
<meta-data
    android:name="com.google.android.geo.API_KEY"
    android:value="${MAPS_API_KEY}" />
```

**Replace with** (hardcoded API key):

```xml
<!-- UPDATED: -->
<meta-data
    android:name="com.google.android.geo.API_KEY"
    android:value="AIzaSyDAVM3qnLqc6nFv4YJobnUe9RkA7xUCCgI" />
```

---

## Why These Changes?

### **Google Maps API Key:**
- **For APK builds**: Must be **hardcoded** in `AndroidManifest.xml`
- **Reason**: The `${MAPS_API_KEY}` placeholder only works with special build configurations
- **Security**: API keys in APKs are semi-public anyway (anyone can decompile)

### **Backend API URL:**
- **Should NOT** be in `AndroidManifest.xml`
- **Should be** in your Dart code (loaded from environment or config)
- **For production APK**: Use `https://taskroute-tracker.onrender.com/api/v1`

---

## How to Build APK

### **1. Update API URL in Code**

Check your API service file (likely `lib/services/api_service.dart`):

```dart
// Make sure it's using the deployed URL for production:
static const String baseUrl = 'https://taskroute-tracker.onrender.com/api/v1';

// Or load from .env if you have flutter_dotenv configured:
// static final String baseUrl = dotenv.env['API_URL'] ?? 'https://taskroute-tracker.onrender.com/api/v1';
```

### **2. Build the APK**

```bash
# Navigate to mobile directory
cd taskroute_mobile

# Build release APK
flutter build apk --release

# Output location:
# build/app/outputs/flutter-apk/app-release.apk
```

---

## Quick Checklist Before Building

- [ ] Updated `.env` with correct `API_URL`
- [ ] Hardcoded Google Maps API key in `AndroidManifest.xml`
- [ ] Verified API service uses production URL
- [ ] Tested app with production API
- [ ] Run `flutter build apk --release`

---

## Common Errors & Fixes

**Error**: "Maps not showing"
- ✅ Make sure API key is hardcoded in `AndroidManifest.xml`

**Error**: "Cannot connect to API"
- ✅ Use `https://taskroute-tracker.onrender.com/api/v1` not local IP
- ✅ Remove `http://192.168...` from production builds

**Error**: "API_KEY not found"
- ✅ Don't use `${MAPS_API_KEY}` - hardcode the actual key

---

## Summary

**DO THIS:**
1. Fix `.env` file (correct API_URL typo)
2. Hardcode Maps API key in `AndroidManifest.xml`
3. Use production API URL for release builds
4. Build: `flutter build apk --release`

**DON'T DO THIS:**
- ❌ Don't use `REACT_APP_*` prefixes in Flutter
- ❌ Don't put API URLs in `AndroidManifest.xml`
- ❌ Don't use local IP addresses in production APKs
- ❌ Don't rely on `${MAPS_API_KEY}` placeholder for APKs
