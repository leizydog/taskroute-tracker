import 'dart:math';
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

  bool get isMultiDestination => widget.destinations != null && widget.destinations!.isNotEmpty;

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

        _markers.clear();
        
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
              icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueAzure),
            ),
          );
        }
      });
      
      _getRoute();
    } catch (e) {
      debugPrint("Error fetching location: $e");
    }
  }

  double _getMarkerHue(int index, int total) {
    if (index == 0) return BitmapDescriptor.hueGreen;
    if (index == total - 1) return BitmapDescriptor.hueRed;
    return BitmapDescriptor.hueOrange;
  }

  Future<void> _getRoute() async {
    if (_currentLocation == null) return;

    if (isMultiDestination && widget.destinations!.isNotEmpty) {
      await _getMultiDestinationRoute();
    } else if (widget.taskLat != null && widget.taskLng != null) {
      await _getSingleDestinationRoute();
    }
  }

  Future<void> _getSingleDestinationRoute() async {
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

    debugPrint('Polyline Status: ${result.status}');
    debugPrint('Polyline Error: ${result.errorMessage}');

    if (result.points.isNotEmpty) {
      _setPolylines(result.points, "route");
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
              body: GoogleMap(
                initialCameraPosition: CameraPosition(
                  target: LatLng(
                    _currentLocation!.latitude!,
                    _currentLocation!.longitude!,
                  ),
                  zoom: 14,
                ),
                myLocationEnabled: false,
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