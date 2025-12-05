import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../providers/auth_provider.dart';
import '../../../providers/task_provider.dart';
import '../../../providers/location_provider.dart';
import 'task_summary_grid.dart';
import 'task_card.dart';
import 'current_task_card.dart';
import 'notification_bell.dart';
import 'notification_panel.dart';
import '../home_screen.dart';

/// Dashboard tab displaying task summary, current task, and recent tasks
/// Uses modular widget imports for clean separation of concerns
class DashboardTab extends StatefulWidget {
  const DashboardTab({super.key});

  @override
  State<DashboardTab> createState() => _DashboardTabState();
}

class _DashboardTabState extends State<DashboardTab>
    with TickerProviderStateMixin {
  late AnimationController _fadeController;
  late AnimationController _slideController;
  late Animation<double> _fadeAnimation;
  late Animation<Offset> _slideAnimation;

  @override
  void initState() {
    super.initState();
    _setupAnimations();
    // Ensure tasks are loaded when dashboard is shown
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final taskProvider = Provider.of<TaskProvider>(context, listen: false);
      if (taskProvider.tasks.isEmpty && !taskProvider.isLoading) {
        taskProvider.fetchTasks();
      }
    });
  }

  void _setupAnimations() {
    _fadeController = AnimationController(
      duration: const Duration(milliseconds: 800),
      vsync: this,
    );
    _slideController = AnimationController(
      duration: const Duration(milliseconds: 600),
      vsync: this,
    );

    _fadeAnimation = Tween<double>(
      begin: 0.0,
      end: 1.0,
    ).animate(CurvedAnimation(parent: _fadeController, curve: Curves.easeOut));
    _slideAnimation = Tween<Offset>(
      begin: const Offset(0, 0.3),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _slideController, curve: Curves.easeOut));

    _fadeController.forward();
    _slideController.forward();
  }

  @override
  void dispose() {
    _fadeController.dispose();
    _slideController.dispose();
    super.dispose();
  }

  void _showNotificationPanel(BuildContext context, bool isDark) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => NotificationPanel(isDark: isDark),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      appBar: _buildAppBar(context, isDark),
      body: RefreshIndicator(
        onRefresh: () async {
          final taskProvider = Provider.of<TaskProvider>(
            context,
            listen: false,
          );
          await taskProvider.fetchTasks();
        },
        color: const Color(0xFF2196F3),
        child: Consumer<TaskProvider>(
          builder: (context, taskProvider, _) {
            // Only show loading on initial load (no cached tasks)
            if (taskProvider.isLoading && taskProvider.tasks.isEmpty) {
              return const Center(
                child: CircularProgressIndicator(color: Color(0xFF2196F3)),
              );
            }

            return FadeTransition(
              opacity: _fadeAnimation,
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (taskProvider.error != null)
                      _buildErrorCard(taskProvider, isDark),
                    if (taskProvider.currentTask != null)
                      SlideTransition(
                        position: _slideAnimation,
                        child: CurrentTaskCard(
                          task: taskProvider.currentTask!,
                          isDark: isDark,
                        ),
                      ),
                    const SizedBox(height: 24),
                    TaskSummaryGrid(isDark: isDark),
                    const SizedBox(height: 28),
                    _buildRecentTasksSection(context, taskProvider, isDark),
                  ],
                ),
              ),
            );
          },
        ),
      ),
    );
  }

  PreferredSizeWidget _buildAppBar(BuildContext context, bool isDark) {
    return AppBar(
      automaticallyImplyLeading: false,
      titleSpacing: 0,
      backgroundColor: Colors.transparent,
      elevation: 0,
      title: SizedBox(
        height: 56,
        child: Stack(
          alignment: Alignment.center,
          children: [
            // Left: Greeting
            Positioned(
              left: 20,
              top: 0,
              bottom: 0,
              child: Align(
                alignment: Alignment.centerLeft,
                child: ConstrainedBox(
                  constraints: BoxConstraints(
                    maxWidth: MediaQuery.of(context).size.width * 0.35,
                  ),
                  child: Consumer<AuthProvider>(
                    builder: (context, authProvider, _) => Text(
                      'Hi, ${authProvider.user?.fullName?.split(' ').first ?? 'Employee'}',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 22,
                        color: isDark ? Colors.white : Colors.black87,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ),
              ),
            ),
            // Center: Notification Bell
            Positioned.fill(
              child: Center(
                child: Transform.translate(
                  offset: const Offset(4, 0),
                  child: NotificationBell(
                    isDark: isDark,
                    onTap: () => _showNotificationPanel(context, isDark),
                  ),
                ),
              ),
            ),
            // Right: GPS Status
            Positioned(
              right: 4,
              top: 0,
              bottom: 0,
              child: Center(child: _buildGpsStatus(isDark)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildGpsStatus(bool isDark) {
    return Consumer<LocationProvider>(
      builder: (context, locationProvider, _) {
        final isOn = locationProvider.isLocationEnabled;
        final color = isOn ? Colors.green : Colors.red;
        return Container(
          margin: const EdgeInsets.only(right: 16),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(
            color: color.withOpacity(0.15),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: color, width: 1.5),
            boxShadow: [
              BoxShadow(
                color: color.withOpacity(0.3),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                isOn ? Icons.location_on : Icons.location_off,
                color: color,
                size: 18,
              ),
              const SizedBox(width: 6),
              Text(
                isOn ? 'GPS ON' : 'GPS OFF',
                style: TextStyle(
                  fontSize: 12,
                  color: color,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 0.5,
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildErrorCard(TaskProvider taskProvider, bool isDark) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0.0, end: 1.0),
      duration: const Duration(milliseconds: 400),
      builder: (context, value, child) =>
          Transform.scale(scale: value, child: child),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(16),
        margin: const EdgeInsets.only(bottom: 20),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [Colors.orange.shade400, Colors.orange.shade600],
          ),
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
              color: Colors.orange.withOpacity(0.4),
              blurRadius: 15,
              offset: const Offset(0, 5),
            ),
          ],
        ),
        child: Row(
          children: [
            const Icon(Icons.warning_rounded, color: Colors.white, size: 28),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                taskProvider.error!,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
            IconButton(
              icon: const Icon(Icons.close, color: Colors.white, size: 22),
              onPressed: () => taskProvider.clearError(),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildRecentTasksSection(
    BuildContext context,
    TaskProvider taskProvider,
    bool isDark,
  ) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'Recent Tasks',
              style: TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.bold,
                color: isDark ? Colors.white : Colors.black87,
              ),
            ),
            if (taskProvider.tasks.length > 5)
              TextButton(
                onPressed: () {
                  final homeState = context
                      .findAncestorStateOfType<HomeScreenState>();
                  homeState?.navigateToTab(1);
                },
                child: const Text(
                  'View All',
                  style: TextStyle(
                    color: Color(0xFF2196F3),
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
          ],
        ),
        const SizedBox(height: 16),
        if (taskProvider.tasks.isEmpty)
          _buildEmptyState(isDark)
        else
          ...taskProvider.tasks
              .take(5)
              .toList()
              .asMap()
              .entries
              .map(
                (entry) => TaskCard(
                  task: entry.value,
                  isDark: isDark,
                  animationIndex: entry.key,
                ),
              ),
      ],
    );
  }

  Widget _buildEmptyState(bool isDark) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(40),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E1E1E) : Colors.grey[50],
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: isDark ? Colors.grey[800]! : Colors.grey[200]!,
          width: 2,
        ),
      ),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: Colors.blue.withOpacity(0.1),
              shape: BoxShape.circle,
            ),
            child: Icon(
              Icons.assignment_outlined,
              size: 64,
              color: Colors.blue.withOpacity(0.5),
            ),
          ),
          const SizedBox(height: 20),
          Text(
            'No tasks assigned',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w600,
              color: isDark ? Colors.grey[400] : Colors.grey[600],
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'New tasks will appear here when assigned',
            style: TextStyle(
              fontSize: 14,
              color: isDark ? Colors.grey[500] : Colors.grey[500],
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}
