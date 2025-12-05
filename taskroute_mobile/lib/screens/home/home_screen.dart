import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../providers/task_provider.dart';
import '../../providers/location_provider.dart';
import '../auth/tasks/task_list_screen.dart';
import '../profile/profile_screen.dart';
import '../../models/task_model.dart';
import '../../services/notification_service.dart';
import 'widgets/dashboard_tab_simple.dart';

/// Main home screen with bottom navigation
/// Provides navigation context for child widgets via HomeScreenState
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  HomeScreenState createState() => HomeScreenState();
}

class HomeScreenState extends State<HomeScreen> {
  int _selectedIndex = 0;
  Set<int> _knownTaskIds = {};

  /// Navigate to a specific tab (used by child widgets)
  void navigateToTab(int index) {
    setState(() => _selectedIndex = index);
  }

  @override
  void initState() {
    super.initState();
    _initializeData();
    _listenToNotifications();
  }

  Future<void> _initializeData() async {
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final taskProvider = Provider.of<TaskProvider>(context, listen: false);
    final locationProvider = Provider.of<LocationProvider>(
      context,
      listen: false,
    );

    try {
      if (authProvider.user != null) {
        await taskProvider.fetchTasks();
        _knownTaskIds = taskProvider.tasks.map((t) => t.id).toSet();
      }
    } catch (e) {
      debugPrint('Error fetching tasks: $e');
    }

    try {
      await locationProvider.init();
    } catch (e) {
      debugPrint('Error initializing location: $e');
    }
  }

  VoidCallback? _taskListener;

  @override
  void dispose() {
    if (_taskListener != null) {
      final taskProvider = Provider.of<TaskProvider>(context, listen: false);
      taskProvider.removeListener(_taskListener!);
    }
    super.dispose();
  }

  void _listenToNotifications() {
    final taskProvider = Provider.of<TaskProvider>(context, listen: false);
    _taskListener = () {
      try {
        _checkForNewTasks(taskProvider.tasks);
      } catch (e) {
        debugPrint('Error checking for new tasks: $e');
      }
    };
    taskProvider.addListener(_taskListener!);
  }

  void _checkForNewTasks(List<TaskModel> tasks) {
    final notificationService = NotificationService();
    for (var task in tasks) {
      if (!_knownTaskIds.contains(task.id) &&
          task.status == TaskStatus.pending) {
        notificationService.addNotification(task);
        _knownTaskIds.add(task.id);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final pages = [
      const DashboardTabSimple(),
      const TaskListScreen(),
      const ProfileScreen(),
    ];

    return Scaffold(
      body: IndexedStack(index: _selectedIndex, children: pages),
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(isDark ? 0.3 : 0.08),
              blurRadius: 20,
              offset: const Offset(0, -5),
            ),
          ],
        ),
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _buildNavItem(Icons.home_rounded, 'Home', 0, isDark),
                _buildNavItem(Icons.assignment_rounded, 'Tasks', 1, isDark),
                _buildNavItem(Icons.person_rounded, 'Profile', 2, isDark),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildNavItem(IconData icon, String label, int index, bool isDark) {
    final isSelected = _selectedIndex == index;
    final color = isSelected
        ? const Color(0xFF2196F3)
        : (isDark ? Colors.grey[500] : Colors.grey[600]);

    return GestureDetector(
      onTap: () => navigateToTab(index),
      behavior: HitTestBehavior.opaque,
      child: TweenAnimationBuilder<double>(
        tween: Tween(begin: 0.0, end: isSelected ? 1.0 : 0.0),
        duration: const Duration(milliseconds: 200),
        builder: (context, value, child) {
          return Container(
            padding: EdgeInsets.symmetric(
              horizontal: 16 + (value * 8),
              vertical: 10,
            ),
            decoration: BoxDecoration(
              color: isSelected
                  ? const Color(0xFF2196F3).withOpacity(0.12)
                  : Colors.transparent,
              borderRadius: BorderRadius.circular(16),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(icon, color: color, size: 24),
                if (isSelected) ...[
                  const SizedBox(width: 8),
                  Text(
                    label,
                    style: TextStyle(
                      color: color,
                      fontWeight: FontWeight.bold,
                      fontSize: 14,
                    ),
                  ),
                ],
              ],
            ),
          );
        },
      ),
    );
  }
}
