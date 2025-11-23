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
  
  // ✅ ADDED: Map ID configuration
  final String _mapId = 'c70a2cab35a44cdebe219e9a';

  StreamSubscription<LocationData>? _locationSubscription;
  Timer? _routeUpdateTimer;
  double? _distanceToTarget;
  LocationData? _lastLocation;

  // Panel state
  // Track position from 0.0 (closed) to 1.0 (open)
  double _currentPanelPos = 0.0; 

  bool get isMultiDestination => widget.destinations != null && widget.destinations!.isNotEmpty;

  @override
  void initState() {
    super.initState();
    _fetchCurrentLocation();
    _startLocationTracking();
  }

  @override
  void dispose() {
    _locationSubscription?.cancel();
    _routeUpdateTimer?.cancel();
    _mapController?.dispose();
    super.dispose();
  }

  Future<void> _startLocationTracking() async {
    try {
      bool serviceEnabled = await _location.serviceEnabled();
      if (!serviceEnabled) {
        serviceEnabled = await _location.requestService();
        if (!serviceEnabled) return;
      }

      PermissionStatus permission = await _location.hasPermission();
      if (permission == PermissionStatus.denied) {
        permission = await _location.requestPermission();
        if (permission != PermissionStatus.granted) return;
      }

      _locationSubscription = _location.onLocationChanged.listen(
        (LocationData newLocation) {
          _onLocationUpdate(newLocation);
        },
        onError: (error) {
          debugPrint('❌ Location tracking error: $error');
        },
      );
    } catch (e) {
      debugPrint('❌ Error starting location tracking: $e');
    }
  }

  void _onLocationUpdate(LocationData newLocation) {
     if (_lastLocation != null) {
      final distance = _calculateDistance(
        _lastLocation!.latitude!,
        _lastLocation!.longitude!,
        newLocation.latitude!,
        newLocation.longitude!,
      );
      if (distance < 5) return;
    }
    _lastLocation = newLocation;

    if (mounted) {
      setState(() {
        _currentLocation = newLocation;
        _updateMarkers();
        
        if (widget.taskLat != null && widget.taskLng != null) {
          _distanceToTarget = _calculateDistance(
            newLocation.latitude!, 
            newLocation.longitude!, 
            widget.taskLat!, 
            widget.taskLng!
          );
        }
      });
    }
    
    _routeUpdateTimer?.cancel();
    _routeUpdateTimer = Timer(const Duration(seconds: 5), _getRoute);
  }

  double _calculateDistance(double lat1, double lon1, double lat2, double lon2) {
    const double r = 6371000;
    final dLat = (lat2 - lat1) * (math.pi / 180.0);
    final dLon = (lon2 - lon1) * (math.pi / 180.0);
    final a = math.sin(dLat / 2) * math.sin(dLat / 2) +
        math.cos(lat1 * (math.pi / 180.0)) * math.cos(lat2 * (math.pi / 180.0)) *
        math.sin(dLon / 2) * math.sin(dLon / 2);
    final c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a));
    return r * c;
  }

  Future<void> _fetchCurrentLocation() async {
    try {
      final loc = await _location.getLocation();
      _onLocationUpdate(loc);
      _getRoute();
    } catch (e) {
      debugPrint("Error fetching location: $e");
    }
  }

  void _updateMarkers() {
    if (_currentLocation == null) return;
    _markers.clear();
    _markers.add(
      Marker(
        markerId: const MarkerId("user"),
        position: LatLng(_currentLocation!.latitude!, _currentLocation!.longitude!),
        infoWindow: const InfoWindow(title: "You are here"),
        icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueBlue),
        rotation: _currentLocation!.heading ?? 0,
      ),
    );

    if (isMultiDestination) {
      for (var i = 0; i < widget.destinations!.length; i++) {
        final dest = widget.destinations![i];
        _markers.add(
          Marker(
            markerId: MarkerId("destination_${dest.sequence}"),
            position: LatLng(dest.latitude, dest.longitude),
            infoWindow: InfoWindow(title: "Stop ${dest.sequence}", snippet: dest.locationName),
            icon: BitmapDescriptor.defaultMarkerWithHue(_getMarkerHue(i, widget.destinations!.length)),
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
    if (_currentLocation == null || _googleApiKey.isEmpty) return;
    if (isMultiDestination && widget.destinations!.isNotEmpty) {
      await _getMultiDestinationRoute();
    } else if (widget.taskLat != null && widget.taskLng != null) {
      await _getSingleDestinationRoute();
    }
  }

  Future<void> _getSingleDestinationRoute() async {
    try {
      PolylineResult result = await _polylinePoints.getRouteBetweenCoordinates(
        googleApiKey: _googleApiKey,
        request: PolylineRequest(
          origin: PointLatLng(_currentLocation!.latitude!, _currentLocation!.longitude!),
          destination: PointLatLng(widget.taskLat!, widget.taskLng!),
          mode: TravelMode.driving,
        ),
      );
      if (result.points.isNotEmpty) _setPolylines(result.points, "route");
    } catch (e) { debugPrint("Error getting route: $e"); }
  }

  Future<void> _getMultiDestinationRoute() async {
    if (widget.destinations == null || widget.destinations!.isEmpty) return;
    List<PolylineWayPoint> waypoints = [];
    if (widget.destinations!.length > 2) {
      for (var i = 1; i < widget.destinations!.length - 1; i++) {
        waypoints.add(PolylineWayPoint(location: "${widget.destinations![i].latitude},${widget.destinations![i].longitude}"));
      }
    }

    try {
      PolylineResult result = await _polylinePoints.getRouteBetweenCoordinates(
        googleApiKey: _googleApiKey,
        request: PolylineRequest(
          origin: PointLatLng(_currentLocation!.latitude!, _currentLocation!.longitude!),
          destination: PointLatLng(widget.destinations!.last.latitude, widget.destinations!.last.longitude),
          mode: TravelMode.driving,
          wayPoints: waypoints,
        ),
      );
      if (result.points.isNotEmpty) _setPolylines(result.points, "multi_route");
    } catch (e) { debugPrint("Error getting multi route: $e"); }
  }

  void _setPolylines(List<PointLatLng> points, String routeId) {
    final route = Polyline(
      polylineId: PolylineId(routeId),
      color: Colors.blueAccent,
      width: 5,
      points: points.map((p) => LatLng(p.latitude, p.longitude)).toList(),
    );
    if (mounted) setState(() { _polylines.clear(); _polylines.add(route); });
  }

  void _zoomToFitRoute() {
    if (_mapController == null || _currentLocation == null) return;
    final userLocation = LatLng(_currentLocation!.latitude!, _currentLocation!.longitude!);
    List<LatLng> allPoints = [userLocation];
    
    if (isMultiDestination) {
      allPoints.addAll(widget.destinations!.map((d) => LatLng(d.latitude, d.longitude)));
    } else if (widget.taskLat != null && widget.taskLng != null) {
      allPoints.add(LatLng(widget.taskLat!, widget.taskLng!));
    }

    if (allPoints.length < 2) { _centerOnCurrentLocation(); return; }

    double minLat = allPoints.map((p) => p.latitude).reduce(math.min);
    double maxLat = allPoints.map((p) => p.latitude).reduce(math.max);
    double minLng = allPoints.map((p) => p.longitude).reduce(math.min);
    double maxLng = allPoints.map((p) => p.longitude).reduce(math.max);

    _mapController!.animateCamera(CameraUpdate.newLatLngBounds(
      LatLngBounds(southwest: LatLng(minLat, minLng), northeast: LatLng(maxLat, maxLng)), 
      100.0
    ));
  }

  void _centerOnCurrentLocation() {
    if (_mapController == null || _currentLocation == null) return;
    _mapController!.animateCamera(CameraUpdate.newLatLngZoom(
      LatLng(_currentLocation!.latitude!, _currentLocation!.longitude!), 16
    ));
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    
    final bottomPadding = MediaQuery.of(context).padding.bottom;
    final panelMinHeight = 180.0 + bottomPadding;
    final panelMaxHeight = 400.0 + bottomPadding;
    
    final initFabHeight = 170.0 + bottomPadding;
    final currentFabBottom = _currentPanelPos * (panelMaxHeight - panelMinHeight) + initFabHeight + 16;

    return Scaffold(
      body: _currentLocation == null
          ? const Center(child: CircularProgressIndicator())
          : SlidingUpPanel(
              maxHeight: panelMaxHeight,
              minHeight: panelMinHeight,
              color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
              borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
              boxShadow: [BoxShadow(blurRadius: 15.0, color: Colors.black.withOpacity(isDark ? 0.5 : 0.1))],
              onPanelSlide: (pos) => setState(() => _currentPanelPos = pos),
              panel: _buildPanel(isDark, bottomPadding),
              body: Stack(
                children: [
                  GoogleMap(
                    // ✅ ADDED: Map ID property
                    cloudMapId: _mapId,
                    
                    initialCameraPosition: CameraPosition(
                      target: LatLng(_currentLocation!.latitude!, _currentLocation!.longitude!),
                      zoom: 15,
                    ),
                    myLocationEnabled: true,
                    myLocationButtonEnabled: false,
                    zoomControlsEnabled: false,
                    padding: EdgeInsets.only(bottom: panelMinHeight + 20),
                    onMapCreated: (c) {
                      _mapController = c;
                      Future.delayed(const Duration(milliseconds: 500), _zoomToFitRoute);
                    },
                    markers: _markers,
                    polylines: _polylines,
                  ),
                  // Custom Map Buttons
                  Positioned(
                    right: 16,
                    bottom: currentFabBottom,
                    child: Column(
                      children: [
                         FloatingActionButton.small(
                          heroTag: "recenter",
                          backgroundColor: isDark ? Colors.grey[800] : Colors.white,
                          onPressed: _zoomToFitRoute,
                          child: Icon(Icons.route, color: isDark ? Colors.white : Colors.black87),
                        ),
                        const SizedBox(height: 8),
                        FloatingActionButton(
                          heroTag: "location",
                          backgroundColor: isDark ? Colors.grey[800] : Colors.white,
                          onPressed: _centerOnCurrentLocation,
                          child: const Icon(Icons.my_location, color: Colors.blue),
                        ),
                      ],
                    ),
                  ),
                  // Back Button
                  Positioned(
                    top: 50, left: 16,
                    child: GestureDetector(
                      onTap: () => Navigator.pop(context),
                      child: Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: isDark ? Colors.grey[800] : Colors.white, 
                          shape: BoxShape.circle, 
                          boxShadow: const [BoxShadow(blurRadius: 5, color: Colors.black12)]
                        ),
                        child: Icon(Icons.arrow_back, color: isDark ? Colors.white : Colors.black87),
                      ),
                    ),
                  ),
                ],
              ),
            ),
    );
  }

  Widget _buildPanel(bool isDark, double bottomPadding) {
    return Padding(
      padding: EdgeInsets.fromLTRB(24, 12, 24, 24 + bottomPadding),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Container(
              width: 40, height: 4,
              margin: const EdgeInsets.only(bottom: 20),
              decoration: BoxDecoration(
                color: isDark ? Colors.grey[600] : Colors.grey[300], 
                borderRadius: BorderRadius.circular(2)
              ),
            ),
          ),
          Text(
            widget.taskTitle,
            style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87),
            maxLines: 1, overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 8),
          
          if (_distanceToTarget != null)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: _distanceToTarget! <= 500 
                    ? (isDark ? Colors.green.withOpacity(0.2) : Colors.green[50]) 
                    : (isDark ? Colors.orange.withOpacity(0.2) : Colors.orange[50]),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    _distanceToTarget! <= 500 ? Icons.check_circle : Icons.info_outline,
                    size: 16,
                    color: _distanceToTarget! <= 500 ? Colors.green : Colors.orange,
                  ),
                  const SizedBox(width: 8),
                  Text(
                    "${_distanceToTarget!.round()}m away",
                    style: TextStyle(
                      color: _distanceToTarget! <= 500 
                        ? (isDark ? Colors.green[300] : Colors.green[700])
                        : (isDark ? Colors.orange[300] : Colors.orange[800]),
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
            
          const SizedBox(height: 16),
          Text(
            "Destinations", 
            style: TextStyle(
              color: isDark ? Colors.grey[400] : Colors.grey, 
              fontSize: 12, 
              fontWeight: FontWeight.bold, 
              letterSpacing: 1
            )
          ),
          const SizedBox(height: 8),
          Expanded(
            child: ListView(
              padding: EdgeInsets.zero,
              children: [
                if (isMultiDestination)
                  ...widget.destinations!.map((d) => _buildLocationItem(d.locationName, d.sequence, isDark))
                else
                  _buildLocationItem(widget.taskDescription, 1, isDark),
              ],
            ),
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: () => Navigator.pop(context),
              style: ElevatedButton.styleFrom(
                backgroundColor: isDark ? Colors.white : Colors.black,
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: Text(
                "Arrived / Return to Details", 
                style: TextStyle(
                  color: isDark ? Colors.black : Colors.white, 
                  fontWeight: FontWeight.bold
                )
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLocationItem(String name, int index, bool isDark) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        children: [
          Container(
            width: 28, height: 28,
            decoration: BoxDecoration(
              color: isDark ? Colors.blue.withOpacity(0.2) : Colors.blue[50], 
              shape: BoxShape.circle
            ),
            child: Center(
              child: Text(
                "$index", 
                style: const TextStyle(color: Colors.blue, fontWeight: FontWeight.bold)
              )
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              name, 
              style: TextStyle(
                fontSize: 15, 
                fontWeight: FontWeight.w500,
                color: isDark ? Colors.grey[300] : Colors.black87
              )
            )
          ),
        ],
      ),
    );
  }
}