import 'package:intl/intl.dart';

enum TaskStatus {
  pending,
  inProgress,
  completed,
  cancelled;

  static TaskStatus fromString(String status) {
    switch (status.toLowerCase()) {
      case 'pending':
        return TaskStatus.pending;
      case 'in_progress':
        return TaskStatus.inProgress;
      case 'completed':
        return TaskStatus.completed;
      case 'cancelled':
        return TaskStatus.cancelled;
      default:
        return TaskStatus.pending;
    }
  }

  String get displayName {
    switch (this) {
      case TaskStatus.pending:
        return 'Pending';
      case TaskStatus.inProgress:
        return 'In Progress';
      case TaskStatus.completed:
        return 'Completed';
      case TaskStatus.cancelled:
        return 'Cancelled';
    }
  }
}

enum TaskPriority {
  low,
  medium,
  high,
  urgent;

  static TaskPriority fromString(String priority) {
    switch (priority.toLowerCase()) {
      case 'low':
        return TaskPriority.low;
      case 'medium':
        return TaskPriority.medium;
      case 'high':
        return TaskPriority.high;
      case 'urgent':
        return TaskPriority.urgent;
      default:
        return TaskPriority.medium;
    }
  }

  String get displayName {
    switch (this) {
      case TaskPriority.low:
        return 'Low';
      case TaskPriority.medium:
        return 'Medium';
      case TaskPriority.high:
        return 'High';
      case TaskPriority.urgent:
        return 'Urgent';
    }
  }
}

class TaskModel {
  final int id;
  final String title;
  final String? description;
  final TaskStatus status;
  final TaskPriority priority;
  final int assignedTo;
  final int createdBy;
  final String? locationName;
  final double? latitude;
  final double? longitude;
  final int? estimatedDuration;
  final int? actualDuration;
  final DateTime? dueDate;
  final DateTime? startedAt;
  final DateTime? completedAt;
  final DateTime createdAt;
  final DateTime? updatedAt;
  final String? completionNotes;
  final int? qualityRating;
  final String assignedUserName;
  final String createdUserName;

  TaskModel({
    required this.id,
    required this.title,
    this.description,
    required this.status,
    required this.priority,
    required this.assignedTo,
    required this.createdBy,
    this.locationName,
    this.latitude,
    this.longitude,
    this.estimatedDuration,
    this.actualDuration,
    this.dueDate,
    this.startedAt,
    this.completedAt,
    required this.createdAt,
    this.updatedAt,
    this.completionNotes,
    this.qualityRating,
    required this.assignedUserName,
    required this.createdUserName,
  });

  factory TaskModel.fromJson(Map<String, dynamic> json) {
    return TaskModel(
      id: json['id'],
      title: json['title'],
      description: json['description'],
      status: TaskStatus.fromString(json['status']),
      priority: TaskPriority.fromString(json['priority']),
      assignedTo: json['assigned_to'],
      createdBy: json['created_by'],
      locationName: json['location_name'],
      latitude: json['latitude']?.toDouble(),
      longitude: json['longitude']?.toDouble(),
      estimatedDuration: json['estimated_duration'],
      actualDuration: json['actual_duration'],
      dueDate: json['due_date'] != null ? DateTime.parse(json['due_date']) : null,
      startedAt: json['started_at'] != null ? DateTime.parse(json['started_at']) : null,
      completedAt: json['completed_at'] != null ? DateTime.parse(json['completed_at']) : null,
      createdAt: DateTime.parse(json['created_at']),
      updatedAt: json['updated_at'] != null ? DateTime.parse(json['updated_at']) : null,
      completionNotes: json['completion_notes'],
      qualityRating: json['quality_rating'],
      assignedUserName: json['assigned_user_name'],
      createdUserName: json['created_user_name'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'description': description,
      'status': status.name,
      'priority': priority.name,
      'assigned_to': assignedTo,
      'created_by': createdBy,
      'location_name': locationName,
      'latitude': latitude,
      'longitude': longitude,
      'estimated_duration': estimatedDuration,
      'actual_duration': actualDuration,
      'due_date': dueDate?.toIso8601String(),
      'started_at': startedAt?.toIso8601String(),
      'completed_at': completedAt?.toIso8601String(),
      'created_at': createdAt.toIso8601String(),
      'updated_at': updatedAt?.toIso8601String(),
      'completion_notes': completionNotes,
      'quality_rating': qualityRating,
      'assigned_user_name': assignedUserName,
      'created_user_name': createdUserName,
    };
  }

  String get formattedDueDate {
    if (dueDate == null) return 'No due date';
    return DateFormat('MMM dd, yyyy HH:mm').format(dueDate!);
  }

  String get formattedCreatedAt {
    return DateFormat('MMM dd, yyyy HH:mm').format(createdAt);
  }

  String get estimatedDurationText {
    if (estimatedDuration == null) return 'Not specified';
    final hours = estimatedDuration! ~/ 60;
    final minutes = estimatedDuration! % 60;
    if (hours > 0) {
      return '${hours}h ${minutes}m';
    }
    return '${minutes}m';
  }

  String get actualDurationText {
    if (actualDuration == null) return 'Not completed';
    final hours = actualDuration! ~/ 60;
    final minutes = actualDuration! % 60;
    if (hours > 0) {
      return '${hours}h ${minutes}m';
    }
    return '${minutes}m';
  }

  bool get hasLocation => latitude != null && longitude != null;

  bool get isOverdue {
    if (dueDate == null || status == TaskStatus.completed) return false;
    return DateTime.now().isAfter(dueDate!);
  }

  Duration? get timeUntilDue {
    if (dueDate == null || status == TaskStatus.completed) return null;
    final now = DateTime.now();
    if (now.isAfter(dueDate!)) return null;
    return dueDate!.difference(now);
  }

  String get timeUntilDueText {
    final duration = timeUntilDue;
    if (duration == null) {
      return isOverdue ? 'Overdue' : 'No due date';
    }
    if (duration.inDays > 0) {
      return '${duration.inDays} day(s) left';
    } else if (duration.inHours > 0) {
      return '${duration.inHours} hour(s) left';
    } else {
      return '${duration.inMinutes} minute(s) left';
    }
  }

  TaskModel copyWith({
    int? id,
    String? title,
    String? description,
    TaskStatus? status,
    TaskPriority? priority,
    int? assignedTo,
    int? createdBy,
    String? locationName,
    double? latitude,
    double? longitude,
    int? estimatedDuration,
    int? actualDuration,
    DateTime? dueDate,
    DateTime? startedAt,
    DateTime? completedAt,
    DateTime? createdAt,
    DateTime? updatedAt,
    String? completionNotes,
    int? qualityRating,
    String? assignedUserName,
    String? createdUserName,
  }) {
    return TaskModel(
      id: id ?? this.id,
      title: title ?? this.title,
      description: description ?? this.description,
      status: status ?? this.status,
      priority: priority ?? this.priority,
      assignedTo: assignedTo ?? this.assignedTo,
      createdBy: createdBy ?? this.createdBy,
      locationName: locationName ?? this.locationName,
      latitude: latitude ?? this.latitude,
      longitude: longitude ?? this.longitude,
      estimatedDuration: estimatedDuration ?? this.estimatedDuration,
      actualDuration: actualDuration ?? this.actualDuration,
      dueDate: dueDate ?? this.dueDate,
      startedAt: startedAt ?? this.startedAt,
      completedAt: completedAt ?? this.completedAt,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      completionNotes: completionNotes ?? this.completionNotes,
      qualityRating: qualityRating ?? this.qualityRating,
      assignedUserName: assignedUserName ?? this.assignedUserName,
      createdUserName: createdUserName ?? this.createdUserName,
    );
  }
}
