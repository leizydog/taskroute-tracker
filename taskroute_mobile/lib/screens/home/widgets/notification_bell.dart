import 'package:flutter/material.dart';
import '../../../services/notification_service.dart';

/// Notification bell icon with animated unread count badge
/// Listens to countStream for real-time updates when notifications are read
class NotificationBell extends StatelessWidget {
  final bool isDark;
  final VoidCallback onTap;

  const NotificationBell({
    super.key,
    required this.isDark,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final notificationService = NotificationService();

    // Listen to countStream for real-time count updates
    return StreamBuilder<int>(
      stream: notificationService.countStream,
      builder: (context, snapshot) {
        // Get current unread count (snapshot.data is only new events)
        final unreadCount = notificationService.unreadCount;

        return TweenAnimationBuilder<double>(
          tween: Tween(begin: 0.0, end: 1.0),
          duration: const Duration(milliseconds: 400),
          builder: (context, value, child) =>
              Transform.scale(scale: 0.8 + (0.2 * value), child: child),
          child: Container(
            margin: const EdgeInsets.only(right: 8),
            child: Stack(
              clipBehavior: Clip.none,
              children: [
                Container(
                  decoration: BoxDecoration(
                    color: isDark ? Colors.grey[800] : Colors.grey[200],
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.1),
                        blurRadius: 8,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: IconButton(
                    icon: Icon(
                      unreadCount > 0
                          ? Icons.notifications_active_rounded
                          : Icons.notifications_outlined,
                      color: unreadCount > 0
                          ? const Color(0xFF2196F3)
                          : (isDark ? Colors.grey[400] : Colors.grey[600]),
                      size: 26,
                    ),
                    onPressed: onTap,
                  ),
                ),
                // Animated badge
                if (unreadCount > 0)
                  Positioned(
                    right: 6,
                    top: 6,
                    child: TweenAnimationBuilder<double>(
                      tween: Tween(begin: 0.0, end: 1.0),
                      duration: const Duration(milliseconds: 300),
                      builder: (context, value, child) =>
                          Transform.scale(scale: value, child: child),
                      child: Container(
                        padding: const EdgeInsets.all(4),
                        decoration: BoxDecoration(
                          color: Colors.red,
                          shape: BoxShape.circle,
                          boxShadow: [
                            BoxShadow(
                              color: Colors.red.withOpacity(0.5),
                              blurRadius: 8,
                              spreadRadius: 1,
                            ),
                          ],
                        ),
                        constraints: const BoxConstraints(
                          minWidth: 20,
                          minHeight: 20,
                        ),
                        child: Center(
                          child: Text(
                            unreadCount > 9 ? '9+' : '$unreadCount',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        );
      },
    );
  }
}
