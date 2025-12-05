import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../models/task_model.dart';
import '../../../providers/task_provider.dart';
import '../home_screen.dart';

/// Modern 2x2 grid displaying task status summary cards
/// Each card shows count, status label, and navigates to Tasks tab on tap
class TaskSummaryGrid extends StatelessWidget {
  final bool isDark;

  const TaskSummaryGrid({super.key, required this.isDark});

  @override
  Widget build(BuildContext context) {
    return Consumer<TaskProvider>(
      builder: (context, taskProvider, _) {
        final summaryItems = [
          {
            'count': taskProvider.pendingTasks.length,
            'label': 'Pending',
            'icon': Icons.schedule_rounded,
            'color': Colors.orange,
          },
          {
            'count': taskProvider.inProgressTasks.length,
            'label': 'Active',
            'icon': Icons.play_arrow_rounded,
            'color': const Color(0xFF2196F3),
          },
          {
            'count': taskProvider.completedTasks.length,
            'label': 'Done',
            'icon': Icons.check_circle_rounded,
            'color': Colors.green,
          },
          {
            'count': taskProvider.tasks
                .where((t) => t.status == TaskStatus.cancelled)
                .length,
            'label': 'Cancelled',
            'icon': Icons.cancel_rounded,
            'color': Colors.red,
          },
        ];

        return Column(
          children: [
            Row(
              children: [
                Expanded(child: _buildCard(context, 0, summaryItems[0])),
                const SizedBox(width: 10),
                Expanded(child: _buildCard(context, 1, summaryItems[1])),
              ],
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(child: _buildCard(context, 2, summaryItems[2])),
                const SizedBox(width: 10),
                Expanded(child: _buildCard(context, 3, summaryItems[3])),
              ],
            ),
          ],
        );
      },
    );
  }

  Widget _buildCard(
    BuildContext context,
    int index,
    Map<String, dynamic> item,
  ) {
    final color = item['color'] as Color;

    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0.0, end: 1.0),
      duration: Duration(milliseconds: 400 + (index * 100)),
      builder: (context, value, child) => Transform.scale(
        scale: 0.9 + (0.1 * value),
        child: Opacity(opacity: value, child: child),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () {
            final homeState = context
                .findAncestorStateOfType<HomeScreenState>();
            homeState?.navigateToTab(1);
          },
          borderRadius: BorderRadius.circular(16),
          child: Ink(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: BoxDecoration(
              color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: color.withOpacity(0.25), width: 1.5),
              boxShadow: [
                BoxShadow(
                  color: color.withOpacity(isDark ? 0.15 : 0.1),
                  blurRadius: 12,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: color.withOpacity(0.12),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(item['icon'] as IconData, color: color, size: 22),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        '${item['count']}',
                        style: TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.bold,
                          color: isDark ? Colors.white : Colors.black87,
                        ),
                      ),
                      Text(
                        item['label'] as String,
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: color,
                        ),
                      ),
                    ],
                  ),
                ),
                Icon(
                  Icons.chevron_right_rounded,
                  color: isDark ? Colors.grey[600] : Colors.grey[400],
                  size: 20,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
