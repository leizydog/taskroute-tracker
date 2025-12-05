import 'package:flutter/material.dart';
import '../../../models/task_model.dart';
import '../../../services/notification_service.dart';
import '../../auth/tasks/task_detail_screen.dart';
import '../utils/status_helpers.dart';

/// Notification panel shown as a bottom sheet
/// Displays unread task notifications with swipe-to-archive
class NotificationPanel extends StatefulWidget {
  final bool isDark;

  const NotificationPanel({super.key, required this.isDark});

  @override
  State<NotificationPanel> createState() => _NotificationPanelState();
}

class _NotificationPanelState extends State<NotificationPanel>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _animation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: const Duration(milliseconds: 300),
      vsync: this,
    );
    _animation = CurvedAnimation(parent: _controller, curve: Curves.easeOut);
    _controller.forward();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final notificationService = NotificationService();
    final size = MediaQuery.of(context).size;

    return AnimatedBuilder(
      animation: _animation,
      builder: (context, child) => Transform.translate(
        offset: Offset(0, (1 - _animation.value) * 300),
        child: child,
      ),
      child: Container(
        height: size.height * 0.7,
        decoration: BoxDecoration(
          color: widget.isDark ? const Color(0xFF1E1E1E) : Colors.white,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.2),
              blurRadius: 20,
              offset: const Offset(0, -5),
            ),
          ],
        ),
        child: Column(
          children: [
            // Handle bar
            Container(
              margin: const EdgeInsets.symmetric(vertical: 12),
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.grey[400],
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            // Header
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Notifications',
                    style: TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                      color: widget.isDark ? Colors.white : Colors.black87,
                    ),
                  ),
                  Row(
                    children: [
                      if (notificationService.unreadCount > 0)
                        TextButton.icon(
                          onPressed: () =>
                              setState(() => notificationService.markAsRead()),
                          icon: const Icon(Icons.done_all, size: 18),
                          label: const Text('Mark all read'),
                          style: TextButton.styleFrom(
                            foregroundColor: const Color(0xFF2196F3),
                          ),
                        ),
                      IconButton(
                        onPressed: () => Navigator.pop(context),
                        icon: const Icon(Icons.close),
                        color: widget.isDark
                            ? Colors.grey[400]
                            : Colors.grey[600],
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const Divider(height: 1),
            // Notifications List
            Expanded(
              child: notificationService.unreadTasks.isEmpty
                  ? _buildEmptyNotifications()
                  : ListView.builder(
                      physics: const BouncingScrollPhysics(),
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      itemCount: notificationService.unreadTasks.length,
                      itemBuilder: (context, index) => _buildNotificationItem(
                        notificationService.unreadTasks[index],
                        index,
                      ),
                    ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEmptyNotifications() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: Colors.blue.withOpacity(0.1),
              shape: BoxShape.circle,
            ),
            child: Icon(
              Icons.notifications_off_outlined,
              size: 64,
              color: Colors.blue.withOpacity(0.5),
            ),
          ),
          const SizedBox(height: 20),
          Text(
            'No new notifications',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w600,
              color: widget.isDark ? Colors.grey[400] : Colors.grey[600],
            ),
          ),
          const SizedBox(height: 8),
          Text(
            "You're all caught up!",
            style: TextStyle(
              fontSize: 14,
              color: widget.isDark ? Colors.grey[500] : Colors.grey[500],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildNotificationItem(TaskModel task, int index) {
    final notificationService = NotificationService();
    final priorityColor = StatusHelpers.getPriorityColor(task.priority);

    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0.0, end: 1.0),
      duration: Duration(milliseconds: 300 + (index * 100)),
      builder: (context, value, child) => Transform.translate(
        offset: Offset(50 * (1 - value), 0),
        child: Opacity(opacity: value, child: child),
      ),
      child: Dismissible(
        key: Key('notification_${task.id}'),
        direction: DismissDirection.endToStart,
        background: Container(
          alignment: Alignment.centerRight,
          padding: const EdgeInsets.only(right: 20),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [Colors.red.shade400, Colors.red.shade600],
            ),
          ),
          child: const Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.archive_rounded, color: Colors.white, size: 28),
              SizedBox(height: 4),
              Text(
                'Archive',
                style: TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                  fontSize: 12,
                ),
              ),
            ],
          ),
        ),
        onDismissed: (direction) {
          setState(() => notificationService.markTaskAsRead(task.id));
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: const Text('Notification archived'),
              backgroundColor: Colors.green,
              behavior: SnackBarBehavior.floating,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(10),
              ),
              action: SnackBarAction(
                label: 'UNDO',
                textColor: Colors.white,
                onPressed: () =>
                    setState(() => notificationService.addNotification(task)),
              ),
            ),
          );
        },
        child: Container(
          margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
          decoration: BoxDecoration(
            color: widget.isDark ? Colors.grey[850] : Colors.grey[50],
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: priorityColor.withOpacity(0.3), width: 2),
            boxShadow: [
              BoxShadow(
                color: priorityColor.withOpacity(0.1),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: () {
                Navigator.pop(context);
                notificationService.markTaskAsRead(task.id);
                Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => TaskDetailScreen(task: task),
                  ),
                );
              },
              borderRadius: BorderRadius.circular(16),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    Container(
                      width: 50,
                      height: 50,
                      decoration: BoxDecoration(
                        color: priorityColor.withOpacity(0.15),
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: Icon(
                        Icons.assignment_outlined,
                        color: priorityColor,
                        size: 26,
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: Text(
                                  task.title,
                                  style: TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.bold,
                                    color: widget.isDark
                                        ? Colors.white
                                        : Colors.black87,
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 8,
                                  vertical: 3,
                                ),
                                decoration: BoxDecoration(
                                  color: priorityColor.withOpacity(0.2),
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: Text(
                                  task.priority.displayName,
                                  style: TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.bold,
                                    color: priorityColor,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 6),
                          if (task.description != null)
                            Text(
                              task.description!,
                              style: TextStyle(
                                fontSize: 13,
                                color: widget.isDark
                                    ? Colors.grey[400]
                                    : Colors.grey[600],
                              ),
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                            ),
                          const SizedBox(height: 8),
                          Row(
                            children: [
                              Icon(
                                Icons.person_outline,
                                size: 14,
                                color: widget.isDark
                                    ? Colors.grey[500]
                                    : Colors.grey[500],
                              ),
                              const SizedBox(width: 4),
                              Text(
                                'From ${task.createdUserName}',
                                style: TextStyle(
                                  fontSize: 12,
                                  color: widget.isDark
                                      ? Colors.grey[500]
                                      : Colors.grey[500],
                                ),
                              ),
                              const Spacer(),
                              Icon(
                                Icons.access_time,
                                size: 14,
                                color: widget.isDark
                                    ? Colors.grey[500]
                                    : Colors.grey[500],
                              ),
                              const SizedBox(width: 4),
                              Text(
                                task.formattedCreatedAt,
                                style: TextStyle(
                                  fontSize: 12,
                                  color: widget.isDark
                                      ? Colors.grey[500]
                                      : Colors.grey[500],
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 12),
                    Icon(
                      Icons.chevron_right,
                      color: widget.isDark
                          ? Colors.grey[600]
                          : Colors.grey[400],
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
