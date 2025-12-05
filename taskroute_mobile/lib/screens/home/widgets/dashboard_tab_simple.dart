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

class DashboardTabSimple extends StatefulWidget {
  const DashboardTabSimple({super.key});

  @override
  State<DashboardTabSimple> createState() => _DashboardTabSimpleState();
}

class _DashboardTabSimpleState extends State<DashboardTabSimple> {
  @override
  void initState() {
    super.initState();
    // Force fetch on init to ensure data is fresh
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _refreshData();
    });
  }

  Future<void> _refreshData() async {
    final taskProvider = Provider.of<TaskProvider>(context, listen: false);
    await taskProvider.fetchTasks();
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
        onRefresh: _refreshData,
        color: const Color(0xFF2196F3),
        child: Consumer<TaskProvider>(
          builder: (context, taskProvider, _) {
            // Check if we have data
            final hasTasks = taskProvider.tasks.isNotEmpty;
            final isLoading = taskProvider.isLoading;

            return ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(20),
              children: [
                // Loading indicator (non-blocking)
                if (isLoading)
                  const Padding(
                    padding: EdgeInsets.only(bottom: 16.0),
                    child: LinearProgressIndicator(
                      backgroundColor: Color(0xFFE0E0E0),
                      valueColor: AlwaysStoppedAnimation<Color>(
                        Color(0xFF2196F3),
                      ),
                    ),
                  ),

                // Error message
                if (taskProvider.error != null)
                  _buildErrorCard(taskProvider, isDark),

                // Current Task (if any)
                if (taskProvider.currentTask != null) ...[
                  CurrentTaskCard(
                    task: taskProvider.currentTask!,
                    isDark: isDark,
                  ),
                  const SizedBox(height: 24),
                ],

                // Summary Grid
                TaskSummaryGrid(isDark: isDark),
                const SizedBox(height: 28),

                // Recent Tasks Section
                _buildRecentTasksSection(context, taskProvider, isDark),
              ],
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
    return Container(
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
                (entry) => Padding(
                  padding: const EdgeInsets.only(bottom: 12.0),
                  child: TaskCard(
                    task: entry.value,
                    isDark: isDark,
                    animationIndex: 0, // Disable animation delay
                  ),
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
