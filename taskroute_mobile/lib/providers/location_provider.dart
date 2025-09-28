import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';
import 'dart:async';
import 'dart:convert';
import '../services/location_service.dart';
import '../services/api_service.dart';
import '../services/storage_service.dart';

class LocationProvider with ChangeNotifier {
  final LocationService _locationService = LocationService();
  final ApiService _apiService = ApiService();
  
  Position? _currentPosition;
  bool _isLocationEnabled = false;
  bool _isTracking = false;
  String? _error;
  StreamSubscription<Position>? _positionStreamSubscription;
  Timer? _locationTimer;

  // Getters
  Position? get currentPosition => _currentPosition;
  bool get isLocationEnabled => _isLocationEnabled;
  bool get isTracking => _isTracking;
  String? get error => _error;

  void _setError(String? error) {
    _error = error;
    notifyListeners();
  }

  void clearError() {
    _error = null;
    notifyListeners();
  }

  /// Initialize location provider
  Future<void> init() async {
    await _checkLocationStatus();
    
    // Start tracking if enabled in settings
    final isTrackingEnabled = await StorageService.instance.isLocationTrackingEnabled();
    if (isTrackingEnabled && _isLocationEnabled) {
      await startLocationTracking();
    }
  }

  /// Check if location services are enabled and we have permission
  Future<void> _checkLocationStatus() async {
    try {
      final serviceEnabled = await _locationService.isLocationServiceEnabled();
      final permission = await _locationService.checkPermission();
      
      _isLocationEnabled = serviceEnabled && 
          (permission == LocationPermission.always || 
           permission == LocationPermission.whileInUse);
      
      if (_isLocationEnabled) {
        // Get initial position
        await getCurrentPosition();
      }
    } catch (e) {
      _setError('Failed to check location status: ${e.toString()}');
    }
    
    notifyListeners();
  }

 /// Request location permission
Future<bool> requestPermission() async {
  try {
    // First check if location services are enabled
    bool serviceEnabled = await _locationService.isLocationServiceEnabled();
    if (!serviceEnabled) {
      _setError('Location services are disabled. Please enable location services.');
      return false;
    }

    // Request permission
    LocationPermission permission = await Geolocator.checkPermission();
    
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) {
        _setError('Location permissions are denied');
        return false;
      }
    }

    if (permission == LocationPermission.deniedForever) {
      _setError('Location permissions are permanently denied. Please enable in settings.');
      return false;
    }

    await _checkLocationStatus();
    return true;
  } catch (e) {
    _setError('Failed to request location permission: ${e.toString()}');
    return false;
  }
}

  /// Get current position
  Future<Position?> getCurrentPosition({bool forceUpdate = false}) async {
    if (!_isLocationEnabled) {
      _setError('Location services are not enabled');
      return null;
    }

    try {
      Position? position;
      
      if (forceUpdate) {
        position = await _locationService.getCurrentPosition();
      } else {
        // Try to get cached position first
        position = await _locationService.getLastKnownPosition();
        
        // If no cached position or it's too old, get fresh position
        if (position == null || 
            DateTime.now().difference(position.timestamp).inMinutes > 5) {
          position = await _locationService.getCurrentPosition();
        }
      }

      if (position != null) {
        _currentPosition = position;
        _setError(null);
        notifyListeners();
      }
      
      return position;
    } catch (e) {
      _setError('Failed to get current position: ${e.toString()}');
      return null;
    }
  }

  /// Start continuous location tracking
  Future<void> startLocationTracking() async {
    if (!_isLocationEnabled) {
      await requestPermission();
      if (!_isLocationEnabled) {
        _setError('Location permission denied');
        return;
      }
    }

    if (_isTracking) return;

    try {
      _isTracking = true;
      notifyListeners();

      // Start position stream
      _positionStreamSubscription = _locationService.getPositionStream().listen(
        (Position position) {
          _currentPosition = position;
          notifyListeners();
          
          // Log location to API
          _logLocationToAPI(position);
        },
        onError: (error) {
          _setError('Location tracking error: ${error.toString()}');
        },
      );

      // Also set up a timer for periodic location logging (backup)
      _locationTimer = Timer.periodic(const Duration(minutes: 5), (timer) async {
        if (_isTracking) {
          final position = await getCurrentPosition(forceUpdate: true);
          if (position != null) {
            await _logLocationToAPI(position);
          }
        }
      });

      // Save tracking state
      await StorageService.instance.setLocationTrackingEnabled(true);
      
    } catch (e) {
      _isTracking = false;
      _setError('Failed to start location tracking: ${e.toString()}');
      notifyListeners();
    }
  }

  /// Stop location tracking
  Future<void> stopLocationTracking() async {
    if (!_isTracking) return;

    _positionStreamSubscription?.cancel();
    _locationTimer?.cancel();
    
    _isTracking = false;
    notifyListeners();

    // Save tracking state
    await StorageService.instance.setLocationTrackingEnabled(false);
  }

  /// Log location to API (with offline support)
  Future<void> _logLocationToAPI(Position position) async {
    try {
      final locationData = {
        'latitude': position.latitude,
        'longitude': position.longitude,
        'altitude': position.altitude,
        'accuracy': position.accuracy,
        'heading': position.heading,
        'speed': position.speed,
        'timestamp': position.timestamp.toIso8601String(),
      };

      final response = await _apiService.logLocation(locationData);
      
      if (response.statusCode != 200) {
        // Save for offline sync if API call fails
        await StorageService.instance.saveLocationLog(locationData);
      }
    } catch (e) {
      // Save for offline sync on network error
      final locationData = {
        'latitude': position.latitude,
        'longitude': position.longitude,
        'altitude': position.altitude,
        'accuracy': position.accuracy,
        'heading': position.heading,
        'speed': position.speed,
        'timestamp': position.timestamp.toIso8601String(),
      };
      
      await StorageService.instance.saveLocationLog(locationData);
    }
  }

  /// Calculate distance between two points
  Future<double> calculateDistance(
    double startLatitude,
    double startLongitude,
    double endLatitude,
    double endLongitude,
  ) async {
    try {
      return await _locationService.calculateDistance(
        startLatitude,
        startLongitude,
        endLatitude,
        endLongitude,
      );
    } catch (e) {
      _setError('Failed to calculate distance: ${e.toString()}');
      return 0.0;
    }
  }

  /// Get distance to a specific location
  Future<double?> getDistanceToLocation(double latitude, double longitude) async {
    if (_currentPosition == null) {
      await getCurrentPosition();
      if (_currentPosition == null) return null;
    }

    try {
      return await calculateDistance(
        _currentPosition!.latitude,
        _currentPosition!.longitude,
        latitude,
        longitude,
      );
    } catch (e) {
      _setError('Failed to get distance to location: ${e.toString()}');
      return null;
    }
  }

  /// Check if user is within a certain radius of a location
  Future<bool> isWithinRadius(
    double targetLatitude,
    double targetLongitude,
    double radiusInMeters,
  ) async {
    final distance = await getDistanceToLocation(targetLatitude, targetLongitude);
    if (distance == null) return false;
    
    return distance <= radiusInMeters;
  }

  /// Get location accuracy status
  String getAccuracyStatus() {
    if (_currentPosition == null) return 'No location';
    
    final accuracy = _currentPosition!.accuracy;
    if (accuracy <= 5) return 'Excellent';
    if (accuracy <= 10) return 'Good';
    if (accuracy <= 20) return 'Fair';
    return 'Poor';
  }

  /// Get formatted location string
  String getFormattedLocation() {
    if (_currentPosition == null) return 'Location not available';
    
    return '${_currentPosition!.latitude.toStringAsFixed(6)}, '
           '${_currentPosition!.longitude.toStringAsFixed(6)}';
  }

  /// Get location age
  String getLocationAge() {
    if (_currentPosition == null) return 'Unknown';
    
    final age = DateTime.now().difference(_currentPosition!.timestamp);
    
    if (age.inSeconds < 60) return 'Just now';
    if (age.inMinutes < 60) return '${age.inMinutes}m ago';
    if (age.inHours < 24) return '${age.inHours}h ago';
    return '${age.inDays}d ago';
  }

  /// Sync offline location logs
  Future<void> syncOfflineLocationLogs() async {
    try {
      final unsyncedLogs = await StorageService.instance.getUnsyncedLocationLogs();
      
      for (final log in unsyncedLogs) {
        try {
          final response = await _apiService.logLocation(log);
          
          if (response.statusCode == 200) {
            await StorageService.instance.markLocationLogSynced(log['id']);
          }
        } catch (e) {
          debugPrint('Failed to sync location log ${log['id']}: $e');
        }
      }
    } catch (e) {
      debugPrint('Error syncing offline location logs: $e');
    }
  }

  /// Toggle location tracking
  Future<void> toggleLocationTracking() async {
    if (_isTracking) {
      await stopLocationTracking();
    } else {
      await startLocationTracking();
    }
  }

  /// Get location history from API
  Future<List<Map<String, dynamic>>> getLocationHistory({
    int? taskId,
    int limit = 100,
  }) async {
    try {
      final response = await _apiService.getLocationHistory(
        taskId: taskId,
        limit: limit,
      );
      
      if (response.statusCode == 200) {
        final List<dynamic> historyJson = json.decode(response.body);
        return historyJson.cast<Map<String, dynamic>>();
      }
    } catch (e) {
      _setError('Failed to get location history: ${e.toString()}');
    }
    
    return [];
  }

  /// Check if location is stale (older than threshold)
  bool isLocationStale({Duration threshold = const Duration(minutes: 10)}) {
    if (_currentPosition == null) return true;
    
    final age = DateTime.now().difference(_currentPosition!.timestamp);
    
    return age > threshold;
  }

  /// Force refresh location
  Future<void> refreshLocation() async {
    await getCurrentPosition(forceUpdate: true);
  }

  /// Cleanup resources
  @override
  void dispose() {
    _positionStreamSubscription?.cancel();
    _locationTimer?.cancel();
    super.dispose();
  }
}