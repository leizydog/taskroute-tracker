import 'dart:math';
import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:location/location.dart';
import 'package:sliding_up_panel/sliding_up_panel.dart';
import 'package:flutter_polyline_points/flutter_polyline_points.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';

class TaskMapScreen extends StatefulWidget {
  final double taskLat;
  final double taskLng;
  final String taskTitle;
  final String taskDescription;
  final double? userLat;
  final double? userLng;

  const TaskMapScreen({
    super.key,
    required this.taskLat,
    required this.taskLng,
    required this.taskTitle,
    required this.taskDescription,
    this.userLat,
    this.userLng,
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
  final Set<Marker> _markers = {}; // <-- now we manage markers here

  late final String _googleApiKey = dotenv.env['DIRECTIONS_API_KEY'] ?? '';

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

        // Refresh markers every time
        _markers.clear();
        _markers.add(
          Marker(
            markerId: const MarkerId("task"),
            position: LatLng(widget.taskLat, widget.taskLng),
            infoWindow: const InfoWindow(title: "Task Destination"),
            icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueAzure),
          ),
        );
        _markers.add(
          Marker(
            markerId: const MarkerId("user"),
            position: LatLng(
              _currentLocation!.latitude!,
              _currentLocation!.longitude!,
            ),
            infoWindow: const InfoWindow(title: "You are here"),
            icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueRed),
          ),
        );
      });
      _getRoute();
    } catch (e) {
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

    debugPrint('Polyline Status: ${result.status}');
    debugPrint('Polyline Error: ${result.errorMessage}');

    if (result.points.isNotEmpty) {
      _setPolylines(result.points);
    }
  }

  void _setPolylines(List<PointLatLng> points) {
    final route = Polyline(
      polylineId: const PolylineId("route"),
      color: Colors.indigo,
      width: 6,
      points: points.map((p) => LatLng(p.latitude, p.longitude)).toList(),
    );

    setState(() {
      _polylines.clear();
      _polylines.add(route);
    });
  }

  void _zoomToFitRoute() {
    if (_mapController == null || _currentLocation == null) return;

    final userLocation =
        LatLng(_currentLocation!.latitude!, _currentLocation!.longitude!);
    final taskLocation = LatLng(widget.taskLat, widget.taskLng);

    final southwestLat = min(userLocation.latitude, taskLocation.latitude);
    final southwestLng = min(userLocation.longitude, taskLocation.longitude);
    final northeastLat = max(userLocation.latitude, taskLocation.latitude);
    final northeastLng = max(userLocation.longitude, taskLocation.longitude);

    final bounds = LatLngBounds(
      southwest: LatLng(southwestLat, southwestLng),
      northeast: LatLng(northeastLat, northeastLng),
    );

    _mapController!.animateCamera(
      CameraUpdate.newLatLngBounds(bounds, 80.0),
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
              maxHeight: 250,
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
                myLocationEnabled: false, // disable blue dot (avoid overlap)
                myLocationButtonEnabled: true,
                onMapCreated: (controller) {
                  _mapController = controller;
                  _zoomToFitRoute();
                },
                markers: _markers,
                polylines: _polylines,
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
          Text(
            widget.taskDescription,
            style: TextStyle(fontSize: 16, color: Colors.grey[700]),
            textAlign: TextAlign.center,
          ),
          const Spacer(),
          Row(
            children: [
              Expanded(
                child: ElevatedButton.icon(
                  icon: const Icon(Icons.navigation),
                  label: const Text("Start Task"),
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
                      const SnackBar(
                          content: Text("Completion logic not yet implemented.")),
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
