import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:signature/signature.dart';
import 'package:image_picker/image_picker.dart';
import 'package:geolocator/geolocator.dart';
import 'dart:io';
import 'dart:typed_data';
import '../../../models/task_model.dart';
import '../../../providers/task_provider.dart';
import '../../../providers/location_provider.dart';
import '../../../widgets/loading_button.dart';
import '../tasks/task_map_screen.dart';

class TaskDetailScreen extends StatefulWidget {
  final TaskModel task;

  const TaskDetailScreen({
    super.key,
    required this.task,
  });

  @override
  State<TaskDetailScreen> createState() => _TaskDetailScreenState();
}

class _TaskDetailScreenState extends State<TaskDetailScreen> {
  final _completionNotesController = TextEditingController();
  final _signatureController = SignatureController(
    penStrokeWidth: 3,
    penColor: Colors.black,
    exportBackgroundColor: Colors.white,
  );
  
  // Single file instead of List<File>
  File? _photo;
  
  bool _isLoading = false;
  int _qualityRating = 5;
  Position? _currentPosition;
  bool _isFetchingLocation = false;

  @override
  void initState() {
    super.initState();
    _getCurrentLocation();
  }

  @override
  void dispose() {
    _completionNotesController.dispose();
    _signatureController.dispose();
    super.dispose();
  }

  Future<void> _getCurrentLocation() async {
    setState(() => _isFetchingLocation = true);
    try {
      final locationProvider = Provider.of<LocationProvider>(context, listen: false);
      _currentPosition = await locationProvider.getCurrentPosition();
    } catch (e) {
      debugPrint("Error getting location: $e");
    } finally {
      if (mounted) setState(() => _isFetchingLocation = false);
    }
  }

  Future<void> _takePhoto() async {
    final picker = ImagePicker();
    final pickedFile = await picker.pickImage(
      source: ImageSource.camera,
      imageQuality: 70,
      maxWidth: 1920,
      maxHeight: 1920,
    );

    if (pickedFile != null) {
      setState(() {
        _photo = File(pickedFile.path);
      });
    }
  }

  Future<void> _selectFromGallery() async {
    final picker = ImagePicker();
    final pickedFile = await picker.pickImage(
      source: ImageSource.gallery,
      imageQuality: 70,
      maxWidth: 1920,
      maxHeight: 1920,
    );

    if (pickedFile != null) {
      setState(() {
        _photo = File(pickedFile.path);
      });
    }
  }

  void _clearPhoto() {
    setState(() {
      _photo = null;
    });
  }

  // ✅ Accept Task (Queue)
  Future<void> _handleAccept(int taskId) async {
    setState(() => _isLoading = true);
    final provider = Provider.of<TaskProvider>(context, listen: false);
    final success = await provider.acceptTask(taskId);
    
    if (mounted) {
      setState(() => _isLoading = false);
      if (success) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text("Task added to your queue"), backgroundColor: Colors.green),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(provider.error ?? "Failed to accept task"), backgroundColor: Colors.red),
        );
      }
    }
  }

  // ✅ Decline Task
  Future<void> _handleDecline(int taskId) async {
    setState(() => _isLoading = true);
    final provider = Provider.of<TaskProvider>(context, listen: false);
    final success = await provider.declineTask(taskId);
    
    if (mounted) {
      setState(() => _isLoading = false);
      if (success) {
        Navigator.pop(context); // Exit screen since we declined
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text("Task declined"), backgroundColor: Colors.grey),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(provider.error ?? "Failed to decline task"), backgroundColor: Colors.red),
        );
      }
    }
  }

  Future<void> _cancelTask(TaskModel currentTask) async {
    final reasonController = TextEditingController();
    
    final shouldCancel = await showDialog<bool>(
      context: context,
      builder: (context) {
        final isDark = Theme.of(context).brightness == Brightness.dark;
        return AlertDialog(
          title: const Text('Cancel Task'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.red.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: Colors.red.withOpacity(0.3)),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Icon(Icons.warning_amber_rounded, color: Colors.red),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          'Important: Please inform your supervisor before cancelling so they can reassign the task immediately.',
                          style: TextStyle(
                            color: isDark ? Colors.red[200] : Colors.red[800],
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),
                const Text('Please provide a reason for cancellation (e.g., emergency, vehicle breakdown):'),
                const SizedBox(height: 12),
                TextField(
                  controller: reasonController,
                  maxLines: 2,
                  decoration: const InputDecoration(
                    hintText: 'Enter reason here...',
                    border: OutlineInputBorder(),
                  ),
                ),
                SizedBox(height: MediaQuery.of(context).viewInsets.bottom > 0 ? 20 : 0),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Go Back'),
            ),
            TextButton(
              onPressed: () {
                if (reasonController.text.trim().isEmpty) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Reason is required to cancel.')),
                  );
                  return;
                }
                Navigator.pop(context, true);
              },
              style: TextButton.styleFrom(foregroundColor: Colors.red),
              child: const Text('Confirm Cancel'),
            ),
          ],
        );
      },
    );

    if (shouldCancel == true) {
      setState(() => _isLoading = true);
      try {
        final taskProvider = Provider.of<TaskProvider>(context, listen: false);
        
        final success = await taskProvider.cancelTask(
          currentTask.id, 
          reasonController.text.trim()
        );

        if (mounted) {
          if (success) {
            _showSnack('Task cancelled successfully.', Colors.orange);
            Navigator.of(context).pop(); 
          } else {
            _showSnack(taskProvider.error ?? 'Failed to cancel task', Colors.red);
          }
        }
      } catch (e) {
        if (mounted) _showSnack('Error cancelling task: $e', Colors.red);
      } finally {
        if (mounted) setState(() => _isLoading = false);
      }
    }
  }

  Future<void> _startTask(TaskModel currentTask) async {
    if (_currentPosition == null) {
      await _getCurrentLocation();
    }
    
    if (_currentPosition == null) {
      _showSnack('Unable to get current location. Please enable GPS.', Colors.red);
      return;
    }

    setState(() => _isLoading = true);

    try {
      if (!currentTask.hasLocation) {
        _showSnack('This task has no location to navigate to.', Colors.orange);
        return;
      }

      final taskProvider = Provider.of<TaskProvider>(context, listen: false);
      final locationData = {
        'latitude': _currentPosition!.latitude,
        'longitude': _currentPosition!.longitude,
      };

      final success = await taskProvider.startTask(currentTask.id, locationData);

      if (mounted) {
        if (success) {
          _showSnack('Task started successfully!', Colors.green);
          
          Navigator.of(context).push(
            MaterialPageRoute(
              builder: (_) => TaskMapScreen(
                key: UniqueKey(),
                taskLat: currentTask.effectiveLatitude!,
                taskLng: currentTask.effectiveLongitude!,
                taskTitle: currentTask.title,
                taskDescription: currentTask.description ?? 'No description provided.',
                userLat: _currentPosition?.latitude,
                userLng: _currentPosition?.longitude,
                destinations: currentTask.destinations,
              ),
            ),
          );
        } else {
          _showSnack(taskProvider.error ?? 'Failed to start task', Colors.red);
        }
      }
    } catch (e) {
      if (mounted) _showSnack('Error starting task: $e', Colors.red);
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _completeTask(TaskModel currentTask) async {
    if (_completionNotesController.text.trim().isEmpty) {
      _showSnack('Please add completion notes', Colors.orange);
      return;
    }

    if (_signatureController.isEmpty) {
      _showSnack('Client signature is required', Colors.orange);
      return;
    }

    if (_currentPosition == null) {
      await _getCurrentLocation();
    }
    if (_currentPosition == null) {
      _showSnack('GPS location is required to complete tasks.', Colors.red);
      return;
    }

    if (currentTask.hasLocation) {
      double distanceInMeters = Geolocator.distanceBetween(
        _currentPosition!.latitude,
        _currentPosition!.longitude,
        currentTask.effectiveLatitude!,
        currentTask.effectiveLongitude!,
      );

      if (distanceInMeters > 500) {
        _showSnack(
          'You are too far (${distanceInMeters.round()}m). Please move within 500m.', 
          Colors.red
        );
        return;
      }
    }

    setState(() => _isLoading = true);

    try {
      final taskProvider = Provider.of<TaskProvider>(context, listen: false);
      final Uint8List? signatureBytes = await _signatureController.toPngBytes();
      
      final completionData = {
        'completion_notes': _completionNotesController.text.trim(),
        'quality_rating': _qualityRating,
        'latitude': _currentPosition!.latitude,
        'longitude': _currentPosition!.longitude,
        'accuracy': _currentPosition!.accuracy,
        'timestamp': DateTime.now().toIso8601String(),
        'photos_count': _photo != null ? 1 : 0,
        'has_signature': signatureBytes != null,
      };

      final success = await taskProvider.completeTask(
        currentTask.id,
        completionData,
        signatureBytes: signatureBytes,
        photos: _photo != null ? [_photo!] : [],
      );

      if (mounted) {
        if (success) {
          _showSnack('Task completed successfully!', Colors.green);
          Navigator.of(context).pop();
        } else {
          _showSnack(taskProvider.error ?? 'Failed to complete task', Colors.red);
        }
      }
    } catch (e) {
      if (mounted) _showSnack('Error completing task: $e', Colors.red);
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _showSnack(String msg, Color color) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg),
        backgroundColor: color,
        behavior: SnackBarBehavior.floating,
        margin: const EdgeInsets.all(16),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textColor = isDark ? Colors.white : Colors.black;

    final taskProvider = Provider.of<TaskProvider>(context);
    final TaskModel currentTask = taskProvider.tasks.firstWhere(
      (t) => t.id == widget.task.id,
      orElse: () => widget.task,
    );

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(
        title: Text('Task Details', style: TextStyle(color: textColor)),
        backgroundColor: Theme.of(context).scaffoldBackgroundColor,
        elevation: 0,
        iconTheme: IconThemeData(color: textColor),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildHeader(currentTask, isDark, textColor),
            const SizedBox(height: 24),
            _buildSectionTitle("Location", isDark),
            _buildLocationCard(currentTask, isDark),
            const SizedBox(height: 24),
            _buildSectionTitle("Details", isDark),
            _buildInfoList(currentTask, isDark),
            const SizedBox(height: 32),
            
            if (currentTask.status == TaskStatus.inProgress) ...[
              Divider(thickness: 1, color: isDark ? Colors.grey[800] : Colors.grey[200]),
              const SizedBox(height: 24),
              _buildSectionTitle("Proof of Delivery", isDark),
              _buildProofOfDeliveryForm(isDark, textColor),
            ],
          ],
        ),
      ),
      bottomNavigationBar: _buildBottomAction(currentTask, isDark),
    );
  }

  Widget _buildHeader(TaskModel task, bool isDark, Color textColor) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Chip(
              label: Text(task.status.displayName.toUpperCase()),
              backgroundColor: _getStatusColor(task.status).withOpacity(0.15),
              labelStyle: TextStyle(
                color: _getStatusColor(task.status),
                fontWeight: FontWeight.bold,
                fontSize: 12,
              ),
              side: BorderSide.none,
            ),
            const SizedBox(width: 8),
            Chip(
              label: Text(task.priority.displayName),
              backgroundColor: isDark ? Colors.grey[800] : Colors.grey[100],
              labelStyle: TextStyle(color: isDark ? Colors.grey[300] : Colors.grey[800], fontSize: 12),
              side: BorderSide.none,
            ),
          ],
        ),
        const SizedBox(height: 12),
        Text(
          task.title,
          style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: textColor),
        ),
        if (task.description != null) ...[
          const SizedBox(height: 8),
          Text(
            task.description!,
            style: TextStyle(
              color: isDark ? Colors.grey[400] : Colors.grey[600], 
              fontSize: 16, 
              height: 1.5
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildLocationCard(TaskModel task, bool isDark) {
    return Container(
      margin: const EdgeInsets.only(top: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E293B) : Colors.blue[50],
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: isDark ? Colors.blue[900]! : Colors.blue[100]!),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: isDark ? Colors.grey[800] : Colors.white, 
              shape: BoxShape.circle
            ),
            child: const Icon(Icons.map_outlined, color: Colors.blue),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  task.effectiveLocationName ?? "No location set",
                  style: TextStyle(
                    fontWeight: FontWeight.bold, 
                    fontSize: 16,
                    color: isDark ? Colors.white : Colors.black87
                  ),
                ),
                if (task.isMultiDestination)
                  Text(
                    "${task.destinations?.length ?? 0} stops",
                    style: TextStyle(color: Colors.blue[400], fontSize: 12),
                  ),
              ],
            ),
          ),
          if (task.hasLocation)
            IconButton(
              onPressed: () {
                Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => TaskMapScreen(
                      taskLat: task.effectiveLatitude,
                      taskLng: task.effectiveLongitude,
                      taskTitle: task.title,
                      taskDescription: task.description ?? '',
                      destinations: task.destinations,
                    ),
                  ),
                );
              },
              icon: const Icon(Icons.arrow_forward_ios, size: 16, color: Colors.blue),
            )
        ],
      ),
    );
  }

  Widget _buildInfoList(TaskModel task, bool isDark) {
    return Column(
      children: [
        _buildDetailRow(Icons.calendar_today, "Due Date", task.formattedDueDate, isDark),
        _buildDetailRow(Icons.person_outline, "Assigned By", task.createdUserName, isDark),
        _buildDetailRow(Icons.timer_outlined, "Est. Duration", task.estimatedDurationText, isDark),
      ],
    );
  }

  Widget _buildDetailRow(IconData icon, String label, String value, bool isDark) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Icon(icon, size: 20, color: isDark ? Colors.grey[500] : Colors.grey[400]),
          const SizedBox(width: 12),
          Text(
            label, 
            style: TextStyle(color: isDark ? Colors.grey[400] : Colors.grey, fontSize: 14)
          ),
          const Spacer(),
          Text(
            value, 
            style: TextStyle(
              fontWeight: FontWeight.w500, 
              fontSize: 14,
              color: isDark ? Colors.grey[200] : Colors.black87
            )
          ),
        ],
      ),
    );
  }

  Widget _buildProofOfDeliveryForm(bool isDark, Color textColor) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: 12),
        TextField(
          controller: _completionNotesController,
          maxLines: 3,
          style: TextStyle(color: textColor),
          decoration: InputDecoration(
            hintText: 'Add completion notes...',
            hintStyle: TextStyle(color: isDark ? Colors.grey[500] : Colors.grey[500]),
            filled: true,
            fillColor: isDark ? Colors.grey[800] : Colors.grey[50],
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide.none,
            ),
          ),
        ),
        const SizedBox(height: 20),
        
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text("Photo", style: TextStyle(fontWeight: FontWeight.w600, color: textColor)),
            if (_photo == null)
              Row(
                children: [
                  IconButton(icon: Icon(Icons.camera_alt_outlined, color: textColor), onPressed: _takePhoto),
                  IconButton(icon: Icon(Icons.photo_library_outlined, color: textColor), onPressed: _selectFromGallery),
                ],
              )
          ],
        ),
        
        if (_photo != null)
          Container(
            height: 200,
            width: double.infinity,
            margin: const EdgeInsets.only(top: 8),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: isDark ? Colors.grey[700]! : Colors.grey[300]!),
              image: DecorationImage(
                image: FileImage(_photo!),
                fit: BoxFit.cover,
              ),
            ),
            child: Stack(
              children: [
                Positioned(
                  right: 8,
                  top: 8,
                  child: GestureDetector(
                    onTap: _clearPhoto,
                    child: Container(
                      padding: const EdgeInsets.all(6),
                      decoration: const BoxDecoration(
                        color: Colors.red,
                        shape: BoxShape.circle,
                        boxShadow: [BoxShadow(blurRadius: 4, color: Colors.black26)],
                      ),
                      child: const Icon(Icons.close, size: 20, color: Colors.white),
                    ),
                  ),
                ),
              ],
            ),
          ),
        
        const SizedBox(height: 20),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text("Signature *", style: TextStyle(fontWeight: FontWeight.w600, color: textColor)),
            TextButton(onPressed: () => _signatureController.clear(), child: const Text("Clear")),
          ],
        ),
        Container(
          height: 180,
          decoration: BoxDecoration(
            border: Border.all(color: isDark ? Colors.grey[700]! : Colors.grey[300]!, width: 1),
            borderRadius: BorderRadius.circular(12),
            color: Colors.white, 
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: Signature(
              controller: _signatureController,
              backgroundColor: Colors.transparent,
            ),
          ),
        ),
        
        const SizedBox(height: 20),
        Text("Quality Rating", style: TextStyle(fontWeight: FontWeight.w600, color: textColor)),
        const SizedBox(height: 8),
        Row(
          children: List.generate(5, (index) => GestureDetector(
            onTap: () => setState(() => _qualityRating = index + 1),
            child: Padding(
              padding: const EdgeInsets.only(right: 8.0),
              child: Icon(
                index < _qualityRating ? Icons.star : Icons.star_border,
                color: Colors.amber,
                size: 32,
              ),
            ),
          )),
        ),
      ],
    );
  }

  Widget _buildBottomAction(TaskModel task, bool isDark) {
    // Hide actions for non-actionable statuses
    if (task.status == TaskStatus.completed || 
        task.status == TaskStatus.cancelled ||
        task.status == TaskStatus.declined) {
      return const SizedBox.shrink();
    }

    final bool isBusy = _isLoading || _isFetchingLocation;
    final double bottomPadding = MediaQuery.of(context).padding.bottom;
    
    // Check if any OTHER task is in progress
    final taskProvider = Provider.of<TaskProvider>(context, listen: false);
    final bool hasActiveTask = taskProvider.tasks.any(
      (t) => t.status == TaskStatus.inProgress && t.id != task.id
    );

    return Container(
      padding: EdgeInsets.fromLTRB(20, 20, 20, 20 + bottomPadding),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(isDark ? 0.3 : 0.05), 
            blurRadius: 10, 
            offset: const Offset(0, -5)
          )
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (_isFetchingLocation)
            Padding(
              padding: const EdgeInsets.only(bottom: 8.0),
              child: Text(
                "Acquiring GPS Location...", 
                style: TextStyle(fontSize: 12, color: Colors.blue)
              ),
            ),

          // 1. PENDING Tasks
          if (task.status == TaskStatus.pending) ...[
            if (hasActiveTask) ...[
              // Busy -> Show Accept/Decline
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: isBusy ? null : () => _handleDecline(task.id),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: Colors.red,
                        side: const BorderSide(color: Colors.red),
                        padding: const EdgeInsets.symmetric(vertical: 16),
                      ),
                      child: const Text('Decline'),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: ElevatedButton(
                      onPressed: isBusy ? null : () => _handleAccept(task.id),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.blue[700],
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 16),
                      ),
                      child: const Text('Accept (Queue)'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              const Text(
                "You have a task in progress. Accepting this will add it to your queue.",
                style: TextStyle(fontSize: 11, color: Colors.grey),
                textAlign: TextAlign.center,
              ),
            ] else ...[
              // Free -> Show Start Task
              LoadingButton(
                onPressed: () => _startTask(task),
                isLoading: isBusy,
                text: 'Start Task',
                backgroundColor: isDark ? Colors.white : Colors.black,
                textColor: isDark ? Colors.black : Colors.white,
                width: double.infinity,
              ),
            ]
          ],

          // 2. QUEUED Tasks
          if (task.status == TaskStatus.queued) ...[
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.purple.withOpacity(0.1),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Colors.purple.withOpacity(0.3)),
              ),
              child: const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.hourglass_empty, size: 20, color: Colors.purple),
                  SizedBox(width: 8),
                  Text(
                    "Queued - Will start automatically", 
                    style: TextStyle(color: Colors.purple, fontWeight: FontWeight.bold)
                  ),
                ],
              ),
            ),
          ],

          // 3. IN PROGRESS Tasks
          if (task.status == TaskStatus.inProgress) ...[
            LoadingButton(
              onPressed: () => _completeTask(task),
              isLoading: isBusy,
              text: 'Complete Task',
              backgroundColor: Colors.blue[600],
              width: double.infinity,
            ),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton(
                onPressed: isBusy ? null : () => _cancelTask(task),
                style: OutlinedButton.styleFrom(
                  foregroundColor: Colors.red[400],
                  side: BorderSide(color: Colors.red[400]!.withOpacity(0.5)),
                  padding: const EdgeInsets.symmetric(vertical: 12),
                ),
                child: const Text("Cancel Task"),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildSectionTitle(String title, bool isDark) {
    return Text(
      title.toUpperCase(),
      style: TextStyle(
        fontSize: 12,
        fontWeight: FontWeight.bold,
        color: isDark ? Colors.grey[400] : Colors.grey[500],
        letterSpacing: 1.2,
      ),
    );
  }

  // ✅ Fixed non-exhaustive switch error
  Color _getStatusColor(TaskStatus status) {
    switch (status) {
      case TaskStatus.pending: return Colors.orange;
      case TaskStatus.inProgress: return Colors.blue;
      case TaskStatus.completed: return Colors.green;
      case TaskStatus.cancelled: return Colors.red;
      case TaskStatus.queued: return Colors.purple;
      case TaskStatus.declined: return Colors.grey;
    }
  }
}