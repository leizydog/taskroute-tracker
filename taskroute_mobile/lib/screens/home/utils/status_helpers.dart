import 'package:flutter/material.dart';
import '../../../models/task_model.dart';

/// Shared status and priority color/icon helpers for task widgets
class StatusHelpers {
  /// Get color for task status
  static Color getStatusColor(TaskStatus status) {
    switch (status) {
      case TaskStatus.pending:
        return Colors.orange;
      case TaskStatus.inProgress:
        return const Color(0xFF2196F3);
      case TaskStatus.completed:
        return Colors.green;
      case TaskStatus.cancelled:
        return Colors.red;
      case TaskStatus.queued:
        return Colors.purple;
      case TaskStatus.declined:
        return Colors.grey;
    }
  }

  /// Get icon for task status
  static IconData getStatusIcon(TaskStatus status) {
    switch (status) {
      case TaskStatus.pending:
        return Icons.schedule_rounded;
      case TaskStatus.inProgress:
        return Icons.play_arrow_rounded;
      case TaskStatus.completed:
        return Icons.check_circle_rounded;
      case TaskStatus.cancelled:
        return Icons.cancel_rounded;
      case TaskStatus.queued:
        return Icons.hourglass_empty_rounded;
      case TaskStatus.declined:
        return Icons.block_rounded;
    }
  }

  /// Get color for task priority
  static Color getPriorityColor(TaskPriority priority) {
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
