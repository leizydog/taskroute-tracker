import 'dart:math'; // Added for calculating map bounds
import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:location/location.dart';
import 'package:sliding_up_panel/sliding_up_panel.dart';
import 'package:flutter_polyline_points/flutter_polyline_points.dart';

class TaskMapScreen extends StatefulWidget {
  final double taskLat;
  final double taskLng;
  final String taskTitle;
  final String taskDescription;

  const TaskMapScreen({
    Key? key,
    required this.taskLat,
    required this.taskLng,
    required this.taskTitle,
    required this.taskDescription,
  }) : super(key: key);

  @override
  State<TaskMapScreen> createState() => _TaskMapScreenState();
}

class _TaskMapScreenState extends State<TaskMapScreen> {
  GoogleMapController? _mapController;
  LocationData? _currentLocation;
  final Location _location = Location();

  final PolylinePoints _polylinePoints = PolylinePoints();
  final Set<Polyline> _polylines = {};

  // IMPORTANT: For production, load this key securely (e.g., from environment variables)
  final String _googleApiKey = "YOUR_GOOGLE_API_KEY_HERE";

  @override
  void initState() {
    super.initState();
    _fetchCurrentLocation();
  }

  Future<void> _fetchCurrentLocation() async {
    try {
      final loc = await _location.getLocation();
      setState(() {
        _currentLocation = loc;
      });
      _getRoute(); // Load route once location is ready
    } catch (e) {
      // Handle location permission errors, etc.
      debugPrint("Error fetching location: $e");
    }
  }

  Future<void> _getRoute() async {
    if (_currentLocation == null) return;

    PolylineResult result = await _polylinePoints.getRouteBetweenCoordinates(
      googleApiKey: _googleApiKey,
      request: PolylineRequest(
        origin: PointLatLng(
          _currentLocation!.latitude!,
          _currentLocation!.longitude!,
        ),
        destination: PointLatLng(
          widget.taskLat,
          widget.taskLng,
        ),
        mode: TravelMode.driving,
      ),
    );

    if (result.points.isNotEmpty) {
      _setPolylines(result.points);
    }
  }

  void _setPolylines(List<PointLatLng> points) {
    final route = Polyline(
      polylineId: const PolylineId("route"),
      color: Colors.indigo,
      width: 6,
      points: points
          .map((p) => LatLng(p.latitude, p.longitude))
          .toList(),
    );

    setState(() {
      _polylines.clear();
      _polylines.add(route);
    });
  }

  // --- NEW: Method to animate camera ---
  /// Animates the camera to fit both the user's location and the task marker.
  void _zoomToFitRoute() {
    if (_mapController == null || _currentLocation == null) return;

    final userLocation = LatLng(_currentLocation!.latitude!, _currentLocation!.longitude!);
    final taskLocation = LatLng(widget.taskLat, widget.taskLng);

    // Calculate the bounds
    final southwestLat = min(userLocation.latitude, taskLocation.latitude);
    final southwestLng = min(userLocation.longitude, taskLocation.longitude);
    final northeastLat = max(userLocation.latitude, taskLocation.latitude);
    final northeastLng = max(userLocation.longitude, taskLocation.longitude);

    final bounds = LatLngBounds(
      southwest: LatLng(southwestLat, southwestLng),
      northeast: LatLng(northeastLat, northeastLng),
    );

    // Animate the camera to the calculated bounds with padding
    _mapController!.animateCamera(
      CameraUpdate.newLatLngBounds(bounds, 80.0), // 80.0 provides padding
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
              minHeight: 150, // Set a minimum height for the panel
              maxHeight: 250, // Set a maximum height for the panel
              borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
              panel: _buildTaskDetails(),
              body: GoogleMap(
                initialCameraPosition: CameraPosition(
                  target: LatLng(
                    _currentLocation!.latitude!,
                    _currentLocation!.longitude!,
                  ),
                  zoom: 14,
                ),
                myLocationEnabled: true,
                myLocationButtonEnabled: true,
                onMapCreated: (controller) => _mapController = controller,
                markers: {
                  Marker(
                    markerId: const MarkerId("task"),
                    position: LatLng(widget.taskLat, widget.taskLng),
                    infoWindow: InfoWindow(title: "Task Destination"),
                    icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueAzure),
                  ),
                },
                polylines: _polylines,
              ),
            ),
    );
  }

  // --- UPDATED: Task details panel with the "Start Task" button ---
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
          Text(
            widget.taskDescription,
            style: TextStyle(fontSize: 16, color: Colors.grey[700]),
            textAlign: TextAlign.center,
          ),
          const Spacer(), // Pushes buttons to the bottom
          Row(
            children: [
              Expanded(
                child: ElevatedButton.icon(
                  icon: const Icon(Icons.navigation),
                  label: const Text("Start Task"),
                  onPressed: _zoomToFitRoute, // Triggers the camera animation
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
                    // TODO: Implement task completion logic
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