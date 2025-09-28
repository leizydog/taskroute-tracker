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
    penStrokeWidth: 2,
    penColor: Colors.black,
    exportBackgroundColor: Colors.white,
  );
  
  List<File> _photos = [];
  bool _isLoading = false;
  int _qualityRating = 5;
  Position? _currentPosition;

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
    final locationProvider = Provider.of<LocationProvider>(context, listen: false);
    _currentPosition = await locationProvider.getCurrentPosition();
  }

  Future<void> _takePhoto() async {
    final picker = ImagePicker();
    final pickedFile = await picker.pickImage(
      source: ImageSource.camera,
      imageQuality: 80,
      maxWidth: 1920,
      maxHeight: 1920,
    );

    if (pickedFile != null) {
      setState(() {
        _photos.add(File(pickedFile.path));
      });
    }
  }

  Future<void> _selectFromGallery() async {
    final picker = ImagePicker();
    final pickedFiles = await picker.pickMultiImage(
      imageQuality: 80,
      maxWidth: 1920,
      maxHeight: 1920,
    );

    if (pickedFiles.isNotEmpty) {
      setState(() {
        _photos.addAll(pickedFiles.map((file) => File(file.path)));
      });
    }
  }

  void _removePhoto(int index) {
    setState(() {
      _photos.removeAt(index);
    });
  }

  void _clearSignature() {
    _signatureController.clear();
  }

 Future<void> _startTask() async {
  if (_currentPosition == null) {
    final locationProvider = Provider.of<LocationProvider>(context, listen: false);
    _currentPosition = await locationProvider.getCurrentPosition();

    if (_currentPosition == null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Unable to get current location. Please try again.'),
            backgroundColor: Colors.red,
          ),
        );
      });
      return;
    }
  }

  if (mounted) {
    setState(() => _isLoading = true);
  }

  try {
    // ensure task has a pinned location before starting / navigating
    if (!widget.task.hasLocation) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('This task has no location to navigate to.'),
            backgroundColor: Colors.orange,
          ),
        );
      });
      return;
    }

    final taskProvider = Provider.of<TaskProvider>(context, listen: false);

    final locationData = {
      'latitude': _currentPosition!.latitude,
      'longitude': _currentPosition!.longitude,
    };

    final success = await taskProvider.startTask(widget.task.id, locationData);

    WidgetsBinding.instance.addPostFrameCallback((_) async {
      if (!mounted) return;

      if (success) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Task started successfully!'),
            backgroundColor: Colors.green,
          ),
        );

        // Navigate to TaskMapScreen (pass the four required params)
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(
            builder: (_) => TaskMapScreen(
              taskLat: widget.task.latitude!, // safe - we checked hasLocation
              taskLng: widget.task.longitude!,
              taskTitle: widget.task.title,
              taskDescription: widget.task.description ?? '',
            ),
          ),
        );
      } else {
        final errorMessage = taskProvider.error ?? 'Failed to start task';
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(errorMessage),
            backgroundColor: Colors.red,
          ),
        );
      }
    });
  } catch (e) {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error starting task: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    });
  } finally {
    if (mounted) {
      setState(() => _isLoading = false);
    }
  }
}



  Future<void> _completeTask() async {
    if (_completionNotesController.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please add completion notes'),
          backgroundColor: Colors.orange,
        ),
      );
      return;
    }

    if (_signatureController.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please provide your signature'),
          backgroundColor: Colors.orange,
        ),
      );
      return;
    }

    if (_currentPosition == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Unable to get current location. Please try again.'),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    setState(() => _isLoading = true);

    try {
      final taskProvider = Provider.of<TaskProvider>(context, listen: false);
      
      // Get signature as bytes
      final Uint8List? signatureBytes = await _signatureController.toPngBytes();
      
      final completionData = {
        'completion_notes': _completionNotesController.text.trim(),
        'quality_rating': _qualityRating,
        'latitude': _currentPosition!.latitude,
        'longitude': _currentPosition!.longitude,
        'accuracy': _currentPosition!.accuracy,
        'timestamp': DateTime.now().toIso8601String(),
        'photos_count': _photos.length,
        'has_signature': signatureBytes != null,
      };

      final success = await taskProvider.completeTask(
        widget.task.id,
        completionData,
        signatureBytes: signatureBytes,
        photos: _photos,
      );

      if (success) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Task completed successfully!'),
              backgroundColor: Colors.green,
            ),
          );
          Navigator.of(context).pop();
        }
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(taskProvider.error ?? 'Failed to complete task'),
              backgroundColor: Colors.red,
            ),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error completing task: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Task Details'),
        actions: [
          if (widget.task.status == TaskStatus.pending)
            IconButton(
              icon: const Icon(Icons.play_arrow),
              onPressed: _isLoading ? null : _startTask,
              tooltip: 'Start Task',
            ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildTaskHeader(),
            const SizedBox(height: 24),
            _buildTaskDetails(),
            const SizedBox(height: 24),
            if (widget.task.hasLocation) _buildLocationSection(),
            const SizedBox(height: 24),
            if (widget.task.status == TaskStatus.inProgress) ...[
              _buildCompletionSection(),
              const SizedBox(height: 24),
            ],
            _buildActionButtons(),
          ],
        ),
      ),
    );
  }

  Widget _buildTaskHeader() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: _getStatusColor(widget.task.status).withOpacity(0.1),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: _getStatusColor(widget.task.status).withOpacity(0.3),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: _getStatusColor(widget.task.status),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Text(
                  widget.task.status.displayName.toUpperCase(),
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: _getPriorityColor(widget.task.priority).withOpacity(0.2),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  widget.task.priority.displayName,
                  style: TextStyle(
                    color: _getPriorityColor(widget.task.priority),
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            widget.task.title,
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
              fontWeight: FontWeight.bold,
            ),
          ),
          if (widget.task.description != null) ...[
            const SizedBox(height: 8),
            Text(
              widget.task.description!,
              style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                color: Colors.grey[700],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildTaskDetails() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Task Information',
          style: Theme.of(context).textTheme.titleLarge?.copyWith(
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: 12),
        _buildDetailRow('Assigned to', widget.task.assignedUserName),
        _buildDetailRow('Created by', widget.task.createdUserName),
        _buildDetailRow('Created', widget.task.formattedCreatedAt),
        if (widget.task.dueDate != null)
          _buildDetailRow('Due date', widget.task.formattedDueDate),
        _buildDetailRow('Estimated duration', widget.task.estimatedDurationText),
        if (widget.task.actualDuration != null)
          _buildDetailRow('Actual duration', widget.task.actualDurationText),
        if (widget.task.startedAt != null)
          _buildDetailRow('Started at', widget.task.startedAt!.toString()),
        if (widget.task.completedAt != null)
          _buildDetailRow('Completed at', widget.task.completedAt!.toString()),
        if (widget.task.completionNotes != null) ...[
          const SizedBox(height: 8),
          Text(
            'Completion Notes:',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            widget.task.completionNotes!,
            style: Theme.of(context).textTheme.bodyMedium,
          ),
        ],
        if (widget.task.qualityRating != null) ...[
          const SizedBox(height: 8),
          Row(
            children: [
              Text(
                'Quality Rating: ',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w600,
                ),
              ),
              ...List.generate(5, (index) => Icon(
                index < widget.task.qualityRating!
                    ? Icons.star
                    : Icons.star_border,
                color: Colors.amber,
                size: 20,
              )),
            ],
          ),
        ],
      ],
    );
  }

  Widget _buildDetailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 140,
            child: Text(
              '$label:',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLocationSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Location',
          style: Theme.of(context).textTheme.titleLarge?.copyWith(
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: 12),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.grey[50],
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: Colors.grey[300]!),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (widget.task.locationName != null) ...[
                Row(
                  children: [
                    const Icon(Icons.location_on, color: Colors.blue),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        widget.task.locationName!,
                        style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
              ],
              Text(
                'Coordinates: ${widget.task.latitude!.toStringAsFixed(6)}, ${widget.task.longitude!.toStringAsFixed(6)}',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: Colors.grey[600],
                ),
              ),
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: () {
                    // TODO: Open in maps app
                  },
                  icon: const Icon(Icons.map),
                  label: const Text('View on Map'),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildCompletionSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Complete Task',
          style: Theme.of(context).textTheme.titleLarge?.copyWith(
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: 16),
        
        // Completion Notes
        TextFormField(
          controller: _completionNotesController,
          maxLines: 4,
          decoration: InputDecoration(
            labelText: 'Completion Notes *',
            hintText: 'Describe the work performed, any issues encountered, etc.',
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
            ),
            filled: true,
            fillColor: Colors.grey[50],
          ),
        ),
        const SizedBox(height: 16),

        // Quality Rating
        Text(
          'Quality Rating',
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 8),
        Row(
          children: List.generate(5, (index) => GestureDetector(
            onTap: () => setState(() => _qualityRating = index + 1),
            child: Icon(
              index < _qualityRating ? Icons.star : Icons.star_border,
              color: Colors.amber,
              size: 32,
            ),
          )),
        ),
        const SizedBox(height: 16),

        // Photos
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'Photos (${_photos.length})',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w600,
              ),
            ),
            Row(
              children: [
                IconButton(
                  onPressed: _takePhoto,
                  icon: const Icon(Icons.camera_alt),
                  tooltip: 'Take Photo',
                ),
                IconButton(
                  onPressed: _selectFromGallery,
                  icon: const Icon(Icons.photo_library),
                  tooltip: 'Select from Gallery',
                ),
              ],
            ),
          ],
        ),
        if (_photos.isNotEmpty) ...[
          const SizedBox(height: 8),
          SizedBox(
            height: 100,
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              itemCount: _photos.length,
              itemBuilder: (context, index) => Container(
                width: 100,
                margin: const EdgeInsets.only(right: 8),
                child: Stack(
                  children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: Image.file(
                        _photos[index],
                        width: 100,
                        height: 100,
                        fit: BoxFit.cover,
                      ),
                    ),
                    Positioned(
                      top: 4,
                      right: 4,
                      child: GestureDetector(
                        onTap: () => _removePhoto(index),
                        child: Container(
                          padding: const EdgeInsets.all(4),
                          decoration: const BoxDecoration(
                            color: Colors.red,
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(
                            Icons.close,
                            color: Colors.white,
                            size: 16,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
        const SizedBox(height: 16),

        // Signature
        Text(
          'Signature *',
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 8),
        Container(
          width: double.infinity,
          height: 200,
          decoration: BoxDecoration(
            border: Border.all(color: Colors.grey[300]!),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Signature(
            controller: _signatureController,
            backgroundColor: Colors.white,
          ),
        ),
        const SizedBox(height: 8),
        Align(
          alignment: Alignment.centerRight,
          child: TextButton.icon(
            onPressed: _clearSignature,
            icon: const Icon(Icons.clear),
            label: const Text('Clear'),
          ),
        ),
      ],
    );
  }

  Widget _buildActionButtons() {
    if (widget.task.status == TaskStatus.completed) {
      return const SizedBox.shrink();
    }

    return Column(
      children: [
        if (widget.task.status == TaskStatus.pending)
          LoadingButton(
            onPressed: _startTask,
            isLoading: _isLoading,
            text: 'Start Task',
            width: double.infinity,
            backgroundColor: Colors.green,
          ),
        if (widget.task.status == TaskStatus.inProgress) ...[
          LoadingButton(
            onPressed: _completeTask,
            isLoading: _isLoading,
            text: 'Complete Task',
            width: double.infinity,
            backgroundColor: Colors.blue,
          ),
          const SizedBox(height: 8),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton(
              onPressed: _isLoading ? null : () {
                // TODO: Add pause/cancel functionality
              },
              child: const Text('Pause Task'),
            ),
          ),
        ],
      ],
    );
  }

  Color _getStatusColor(TaskStatus status) {
    switch (status) {
      case TaskStatus.pending:
        return Colors.orange;
      case TaskStatus.inProgress:
        return Colors.blue;
      case TaskStatus.completed:
        return Colors.green;
      case TaskStatus.cancelled:
        return Colors.red;
    }
  }

  Color _getPriorityColor(TaskPriority priority) {
    switch (priority) {
      case TaskPriority.low:
        return Colors.green;
      case TaskPriority.medium:
        return Colors.orange;
      case TaskPriority.high:
        return Colors.red;
      case TaskPriority.urgent:
        return Colors.purple;
    }
  }
}