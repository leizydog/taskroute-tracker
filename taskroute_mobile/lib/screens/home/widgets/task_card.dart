import 'package:flutter/material.dart';
import '../../../models/task_model.dart';
import '../../auth/tasks/task_detail_screen.dart';
import '../utils/status_helpers.dart';

/// Enhanced task card displaying Task ID, title, status, assigner, and due date
/// Features status-colored borders and overdue badges
class TaskCard extends StatelessWidget {
  final TaskModel task;
  final bool isDark;
  final int animationIndex;

  const TaskCard({
    super.key,
    required this.task,
    required this.isDark,
    this.animationIndex = 0,
  });

  @override
  Widget build(BuildContext context) {
    final statusColor = StatusHelpers.getStatusColor(task.status);

    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0.0, end: 1.0),
      duration: Duration(milliseconds: 400 + (animationIndex * 100)),
      builder: (context, value, child) => Transform.translate(
        offset: Offset(0, 20 * (1 - value)),
        child: Opacity(opacity: value, child: child),
      ),
      child: Container(
        margin: const EdgeInsets.only(bottom: 14),
        decoration: BoxDecoration(
          color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: statusColor.withOpacity(0.3), width: 1.5),
          boxShadow: [
            BoxShadow(
              color: isDark
                  ? Colors.black.withOpacity(0.25)
                  : statusColor.withOpacity(0.08),
              blurRadius: 12,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => TaskDetailScreen(task: task)),
            ),
            borderRadius: BorderRadius.circular(16),
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Top row: Task ID + Priority badge
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 4,
                        ),
                        decoration: BoxDecoration(
                          color: isDark ? Colors.grey[800] : Colors.grey[100],
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          '#${task.id}',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: isDark ? Colors.grey[400] : Colors.grey[600],
                          ),
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 4,
                        ),
                        decoration: BoxDecoration(
                          color: StatusHelpers.getPriorityColor(
                            task.priority,
                          ).withOpacity(0.12),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          task.priority.displayName,
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                            color: StatusHelpers.getPriorityColor(
                              task.priority,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),

                  // Middle row: Status icon + Title + Chevron
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: statusColor.withOpacity(0.12),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Icon(
                          StatusHelpers.getStatusIcon(task.status),
                          color: statusColor,
                          size: 22,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              task.title,
                              style: TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.bold,
                                color: isDark ? Colors.white : Colors.black87,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                            const SizedBox(height: 3),
                            Text(
                              task.status.displayName,
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: statusColor,
                              ),
                            ),
                          ],
                        ),
                      ),
                      Icon(
                        Icons.chevron_right_rounded,
                        color: isDark ? Colors.grey[600] : Colors.grey[400],
                        size: 22,
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),

                  // Bottom row: Assigner + Due date + Overdue badge
                  Row(
                    children: [
                      Icon(
                        Icons.person_outline,
                        size: 14,
                        color: isDark ? Colors.grey[500] : Colors.grey[500],
                      ),
                      const SizedBox(width: 4),
                      Expanded(
                        child: Text(
                          task.createdUserName,
                          style: TextStyle(
                            fontSize: 11,
                            color: isDark ? Colors.grey[500] : Colors.grey[600],
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      Icon(
                        Icons.access_time,
                        size: 14,
                        color: isDark ? Colors.grey[500] : Colors.grey[500],
                      ),
                      const SizedBox(width: 4),
                      Text(
                        task.formattedDueDate,
                        style: TextStyle(
                          fontSize: 11,
                          color: isDark ? Colors.grey[500] : Colors.grey[600],
                        ),
                      ),
                      if (task.isOverdue) ...[
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 6,
                            vertical: 2,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.red.withOpacity(0.15),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            'OVERDUE',
                            style: TextStyle(
                              fontSize: 9,
                              fontWeight: FontWeight.bold,
                              color: Colors.red.shade600,
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
