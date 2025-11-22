import 'dart:math' as math;
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:location/location.dart';
import 'package:sliding_up_panel/sliding_up_panel.dart';
import 'package:flutter_polyline_points/flutter_polyline_points.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import '../../../models/task_model.dart';

class TaskMapScreen extends StatefulWidget {
  final double? taskLat;
  final double? taskLng;
  final String taskTitle;
  final String taskDescription;
  final double? userLat;
  final double? userLng;
  final List<TaskDestination>? destinations;

  const TaskMapScreen({
    super.key,
    this.taskLat,
    this.taskLng,
    required this.taskTitle,
    required this.taskDescription,
    this.userLat,
    this.userLng,
    this.destinations,
  });

  @override
  State<TaskMapScreen> createState() => _TaskMapScreenState();
}

class _TaskMapScreenState extends State<TaskMapScreen> {
  GoogleMapController? _mapController;
  LocationData? _currentLocation;
  final Location _location = Location();

  final PolylinePoints _polylinePoints = PolylinePoints();
  final Set<Polyline> _polylines = {};
  final Set<Marker> _markers = {};

  late final String _googleApiKey = dotenv.env['DIRECTIONS_API_KEY'] ?? '';

  // ✅ NEW: Location stream subscription
  StreamSubscription<LocationData>? _locationSubscription;
  
  // ✅ NEW: Debounce timer for route updates
  Timer? _routeUpdateTimer;
  
  // ✅ NEW: Track last location to avoid unnecessary updates
  LocationData? _lastLocation;

  bool get isMultiDestination => widget.destinations != null && widget.destinations!.isNotEmpty;

  @override
  void initState() {
    super.initState();
    _fetchCurrentLocation();
    _startLocationTracking(); // ✅ Start real-time tracking
  }

  @override
  void dispose() {
    // ✅ Clean up subscriptions
    _locationSubscription?.cancel();
    _routeUpdateTimer?.cancel();
    _mapController?.dispose();
    super.dispose();
  }

  // ✅ NEW: Start continuous location tracking
  Future<void> _startLocationTracking() async {
    try {
      // Check if location service is enabled
      bool serviceEnabled = await _location.serviceEnabled();
      if (!serviceEnabled) {
        serviceEnabled = await _location.requestService();
        if (!serviceEnabled) return;
      }

      // Check permissions
      PermissionStatus permission = await _location.hasPermission();
      if (permission == PermissionStatus.denied) {
        permission = await _location.requestPermission();
        if (permission != PermissionStatus.granted) return;
      }

      // ✅ Listen to location changes
      _locationSubscription = _location.onLocationChanged.listen(
        (LocationData newLocation) {
          _onLocationUpdate(newLocation);
        },
        onError: (error) {
          debugPrint('❌ Location tracking error: $error');
        },
      );

      debugPrint('✅ Real-time location tracking started');
    } catch (e) {
      debugPrint('❌ Error starting location tracking: $e');
    }
  }

  // ✅ NEW: Handle location updates
  void _onLocationUpdate(LocationData newLocation) {
    // Skip if location hasn't changed significantly (10 meters threshold)
    if (_lastLocation != null) {
      final distance = _calculateDistance(
        _lastLocation!.latitude!,
        _lastLocation!.longitude!,
        newLocation.latitude!,
        newLocation.longitude!,
      );
      
      if (distance < 10) {
        // Location changed less than 10 meters, skip update
        return;
      }
    }

    _lastLocation = newLocation;

    setState(() {
      _currentLocation = newLocation;
      _updateMarkers();
    });

    // ✅ Update route with debouncing (wait 2 seconds after last location change)
    _routeUpdateTimer?.cancel();
    _routeUpdateTimer = Timer(const Duration(seconds: 2), () {
      _getRoute();
    });

    debugPrint('📍 Location updated: ${newLocation.latitude}, ${newLocation.longitude}');
  }

  // ✅ NEW: Calculate distance between two points (Haversine formula)
  // ✅ Calculate distance between two points (Haversine formula)
double _calculateDistance(double lat1, double lon1, double lat2, double lon2) {
  const double earthRadius = 6371000; // meters
  final dLat = _toRadians(lat2 - lat1);
  final dLon = _toRadians(lon2 - lon1);

  final a = math.sin(dLat / 2) * math.sin(dLat / 2) +
      math.cos(_toRadians(lat1)) * math.cos(_toRadians(lat2)) *
      math.sin(dLon / 2) * math.sin(dLon / 2);

  final c = 2 * math.asin(math.sqrt(a));
  return earthRadius * c;
}

double _toRadians(double degrees) => degrees * (math.pi / 180.0);

  Future<void> _fetchCurrentLocation() async {
    try {
      final loc = await _location.getLocation();
      setState(() {
        _currentLocation = loc;
        _lastLocation = loc;
        _updateMarkers();
      });
      
      _getRoute();
    } catch (e) {
      debugPrint("Error fetching location: $e");
    }
  }

  // ✅ NEW: Update markers (separated from fetching location)
  void _updateMarkers() {
    if (_currentLocation == null) return;

    _markers.clear();
    
    // User marker (current location)
    _markers.add(
      Marker(
        markerId: const MarkerId("user"),
        position: LatLng(
          _currentLocation!.latitude!,
          _currentLocation!.longitude!,
        ),
        infoWindow: const InfoWindow(title: "You are here"),
        icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueBlue),
        rotation: _currentLocation!.heading ?? 0, // ✅ Show direction
      ),
    );

    // Destination markers
    if (isMultiDestination) {
      for (var i = 0; i < widget.destinations!.length; i++) {
        final dest = widget.destinations![i];
        _markers.add(
          Marker(
            markerId: MarkerId("destination_${dest.sequence}"),
            position: LatLng(dest.latitude, dest.longitude),
            infoWindow: InfoWindow(
              title: "Stop ${dest.sequence}",
              snippet: dest.locationName,
            ),
            icon: BitmapDescriptor.defaultMarkerWithHue(
              _getMarkerHue(i, widget.destinations!.length),
            ),
          ),
        );
      }
    } else if (widget.taskLat != null && widget.taskLng != null) {
      _markers.add(
        Marker(
          markerId: const MarkerId("task"),
          position: LatLng(widget.taskLat!, widget.taskLng!),
          infoWindow: const InfoWindow(title: "Task Destination"),
          icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueRed),
        ),
      );
    }
  }

  double _getMarkerHue(int index, int total) {
    if (index == 0) return BitmapDescriptor.hueGreen;
    if (index == total - 1) return BitmapDescriptor.hueRed;
    return BitmapDescriptor.hueOrange;
  }

  Future<void> _getRoute() async {
    if (_currentLocation == null) return;

    debugPrint('🗺️ Updating route...');

    if (isMultiDestination && widget.destinations!.isNotEmpty) {
      await _getMultiDestinationRoute();
    } else if (widget.taskLat != null && widget.taskLng != null) {
      await _getSingleDestinationRoute();
    }
  }

  Future<void> _getSingleDestinationRoute() async {
    if (_googleApiKey.isEmpty) {
      debugPrint('⚠️ Google API Key not configured');
      return;
    }

    debugPrint('🗺️ Getting single destination route...');
    debugPrint('📍 From: ${_currentLocation!.latitude}, ${_currentLocation!.longitude}');
    debugPrint('📍 To: ${widget.taskLat}, ${widget.taskLng}');

    PolylineResult result = await _polylinePoints.getRouteBetweenCoordinates(
      googleApiKey: _googleApiKey,
      request: PolylineRequest(
        origin: PointLatLng(
          _currentLocation!.latitude!,
          _currentLocation!.longitude!,
        ),
        destination: PointLatLng(
          widget.taskLat!,
          widget.taskLng!,
        ),
        mode: TravelMode.driving,
      ),
    );

    debugPrint('✅ Polyline Status: ${result.status}');
    if (result.errorMessage != null) {
      debugPrint('❌ Polyline Error: ${result.errorMessage}');
    }

    if (result.points.isNotEmpty) {
      debugPrint('🎨 Drawing polyline with ${result.points.length} points');
      _setPolylines(result.points, "route");
    } else {
      debugPrint('⚠️ No points returned from Directions API');
    }
  }

  Future<void> _getMultiDestinationRoute() async {
    if (widget.destinations == null || widget.destinations!.isEmpty) return;

    List<PolylineWayPoint> waypoints = [];
    if (widget.destinations!.length > 2) {
      for (var i = 1; i < widget.destinations!.length - 1; i++) {
        waypoints.add(
          PolylineWayPoint(
            location: "${widget.destinations![i].latitude},${widget.destinations![i].longitude}",
          ),
        );
      }
    }

    PolylineResult result = await _polylinePoints.getRouteBetweenCoordinates(
      googleApiKey: _googleApiKey,
      request: PolylineRequest(
        origin: PointLatLng(
          _currentLocation!.latitude!,
          _currentLocation!.longitude!,
        ),
        destination: PointLatLng(
          widget.destinations!.last.latitude,
          widget.destinations!.last.longitude,
        ),
        mode: TravelMode.driving,
        wayPoints: waypoints,
      ),
    );

    debugPrint('Multi-destination Polyline Status: ${result.status}');
    debugPrint('Multi-destination Polyline Error: ${result.errorMessage}');

    if (result.points.isNotEmpty) {
      _setPolylines(result.points, "multi_route");
    }
  }

  void _setPolylines(List<PointLatLng> points, String routeId) {
    final route = Polyline(
      polylineId: PolylineId(routeId),
      color: Colors.indigo,
      width: 6,
      points: points.map((p) => LatLng(p.latitude, p.longitude)).toList(),
    );

    setState(() {
      _polylines.clear();
      _polylines.add(route);
    });

    debugPrint('✅ Polyline updated on map');
  }

  void _zoomToFitRoute() {
    if (_mapController == null || _currentLocation == null) return;

    final userLocation = LatLng(_currentLocation!.latitude!, _currentLocation!.longitude!);
    
    List<LatLng> allPoints = [userLocation];
    
    if (isMultiDestination) {
      allPoints.addAll(widget.destinations!.map(
        (d) => LatLng(d.latitude, d.longitude)
      ));
    } else if (widget.taskLat != null && widget.taskLng != null) {
      allPoints.add(LatLng(widget.taskLat!, widget.taskLng!));
    }

    if (allPoints.length < 2) return;

    double minLat = allPoints.map((p) => p.latitude).reduce((a, b) => a < b ? a : b);
    double maxLat = allPoints.map((p) => p.latitude).reduce((a, b) => a > b ? a : b);
    double minLng = allPoints.map((p) => p.longitude).reduce((a, b) => a < b ? a : b);
    double maxLng = allPoints.map((p) => p.longitude).reduce((a, b) => a > b ? a : b);

    final bounds = LatLngBounds(
      southwest: LatLng(minLat, minLng),
      northeast: LatLng(maxLat, maxLng),
    );

    _mapController!.animateCamera(
      CameraUpdate.newLatLngBounds(bounds, 100.0),
    );
  }

  // ✅ NEW: Center map on current location
  void _centerOnCurrentLocation() {
    if (_mapController == null || _currentLocation == null) return;

    _mapController!.animateCamera(
      CameraUpdate.newLatLngZoom(
        LatLng(_currentLocation!.latitude!, _currentLocation!.longitude!),
        16,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.taskTitle),
        backgroundColor: Colors.white,
        elevation: 1,
      ),
      body: _currentLocation == null
          ? const Center(child: CircularProgressIndicator())
          : SlidingUpPanel(
              minHeight: 150,
              maxHeight: isMultiDestination ? 300 : 250,
              borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
              panel: _buildTaskDetails(),
              body: Stack(
                children: [
                  GoogleMap(
                    initialCameraPosition: CameraPosition(
                      target: LatLng(
                        _currentLocation!.latitude!,
                        _currentLocation!.longitude!,
                      ),
                      zoom: 15,
                    ),
                    myLocationEnabled: false, // We're handling this manually
                    myLocationButtonEnabled: false,
                    onMapCreated: (controller) {
                      _mapController = controller;
                      _zoomToFitRoute();
                    },
                    markers: _markers,
                    polylines: _polylines,
                  ),
                  // ✅ NEW: Floating action button to center on current location
                  Positioned(
                    right: 16,
                    bottom: 180,
                    child: FloatingActionButton(
                      mini: true,
                      backgroundColor: Colors.white,
                      onPressed: _centerOnCurrentLocation,
                      child: const Icon(Icons.my_location, color: Colors.blue),
                    ),
                  ),
                ],
              ),
            ),
    );
  }

  Widget _buildTaskDetails() {
    return Container(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            widget.taskTitle,
            style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),
          
          if (isMultiDestination) ...[
            Text(
              "${widget.destinations!.length} Destinations:",
              style: TextStyle(fontSize: 14, color: Colors.grey[600], fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 8),
            Expanded(
              child: ListView.builder(
                itemCount: widget.destinations!.length,
                itemBuilder: (context, index) {
                  final dest = widget.destinations![index];
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 4),
                    child: Row(
                      children: [
                        Container(
                          width: 24,
                          height: 24,
                          decoration: BoxDecoration(
                            color: index == 0 
                                ? Colors.green 
                                : (index == widget.destinations!.length - 1 
                                    ? Colors.red 
                                    : Colors.orange),
                            shape: BoxShape.circle,
                          ),
                          child: Center(
                            child: Text(
                              '${dest.sequence}',
                              style: const TextStyle(
                                color: Colors.white, 
                                fontSize: 12, 
                                fontWeight: FontWeight.bold
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            dest.locationName,
                            style: const TextStyle(fontSize: 14),
                          ),
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),
          ] else ...[
            Text(
              widget.taskDescription,
              style: TextStyle(fontSize: 16, color: Colors.grey[700]),
              textAlign: TextAlign.center,
            ),
            const Spacer(),
          ],
          
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: ElevatedButton.icon(
                  icon: const Icon(Icons.navigation),
                  label: const Text("Navigate"),
                  onPressed: _zoomToFitRoute,
                  style: ElevatedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: OutlinedButton.icon(
                  icon: const Icon(Icons.check_circle_outline),
                  label: const Text("Complete"),
                  onPressed: () {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text("Completion logic not yet implemented.")),
                    );
                  },
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}