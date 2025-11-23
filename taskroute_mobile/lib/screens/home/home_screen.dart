import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../providers/task_provider.dart';
import '../../providers/location_provider.dart';
import '../auth/tasks/task_list_screen.dart';
import '../auth/tasks/task_detail_screen.dart';
import '../profile/profile_screen.dart';
import '../../models/task_model.dart';
import '../../services/notification_service.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> with TickerProviderStateMixin {
  int _selectedIndex = 0;
  
  @override
  void initState() {
    super.initState();
    _initializeData();
    _listenToNotifications();
  }

  Future<void> _initializeData() async {
    final taskProvider = Provider.of<TaskProvider>(context, listen: false);
    final locationProvider = Provider.of<LocationProvider>(context, listen: false);
    
    final hasPermission = await locationProvider.requestPermission();
    
    if (hasPermission) {
      await locationProvider.startLocationTracking();
      await locationProvider.getCurrentPosition();
    }
    
    await taskProvider.fetchTasks();
    await taskProvider.syncOfflineData();
    
    // Add new tasks to notifications
    _checkForNewTasks(taskProvider.tasks);
  }

  void _listenToNotifications() {
    // Listen to task provider changes
    final taskProvider = Provider.of<TaskProvider>(context, listen: false);
    taskProvider.addListener(() {
      _checkForNewTasks(taskProvider.tasks);
    });
  }

  void _checkForNewTasks(List<TaskModel> tasks) {
    final notificationService = NotificationService();
    for (var task in tasks) {
      if (task.status == TaskStatus.pending) {
        notificationService.addNotification(task);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final List<Widget> pages = [
      const DashboardTab(),
      const TaskListScreen(),
      const ProfileScreen(),
    ];

    return Scaffold(
      body: IndexedStack(
        index: _selectedIndex,
        children: pages,
      ),
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.1),
              blurRadius: 20,
              offset: const Offset(0, -5),
            ),
          ],
        ),
        child: BottomNavigationBar(
          currentIndex: _selectedIndex,
          onTap: (index) {
            setState(() {
              _selectedIndex = index;
            });
          },
          type: BottomNavigationBarType.fixed,
          backgroundColor: Theme.of(context).brightness == Brightness.dark
              ? const Color(0xFF1E1E1E)
              : Colors.white,
          selectedItemColor: const Color(0xFF2196F3),
          unselectedItemColor: Colors.grey,
          elevation: 0,
          items: const [
            BottomNavigationBarItem(
              icon: Icon(Icons.dashboard_outlined, size: 26),
              activeIcon: Icon(Icons.dashboard, size: 28),
              label: 'Dashboard',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.task_outlined, size: 26),
              activeIcon: Icon(Icons.task, size: 28),
              label: 'Tasks',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.person_outlined, size: 26),
              activeIcon: Icon(Icons.person, size: 28),
              label: 'Profile',
            ),
          ],
        ),
      ),
    );
  }
}

class DashboardTab extends StatefulWidget {
  const DashboardTab({super.key});

  @override
  State<DashboardTab> createState() => _DashboardTabState();
}

class _DashboardTabState extends State<DashboardTab> with TickerProviderStateMixin {
  late AnimationController _fadeController;
  late AnimationController _slideController;
  late Animation<double> _fadeAnimation;
  late Animation<Offset> _slideAnimation;

  @override
  void initState() {
    super.initState();
    _setupAnimations();
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
    
    _fadeAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _fadeController, curve: Curves.easeOut),
    );
    
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

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    
    return Scaffold(
      appBar: AppBar(
        automaticallyImplyLeading: false,
        titleSpacing: 0, // Remove default padding to allow full control
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: SizedBox(
          height: 56, // Standard AppBar height
          child: Stack(
            alignment: Alignment.center,
            children: [
              // 1. LEFT: Greeting (with width constraint to avoid overlapping center)
              Positioned(
                left: 20, // Matches your body padding
                top: 0,
                bottom: 0,
                child: Align(
                  alignment: Alignment.centerLeft,
                  child: ConstrainedBox(
                    constraints: BoxConstraints(
                      maxWidth: MediaQuery.of(context).size.width * 0.35, // Prevent text from hitting the bell
                    ),
                    child: Consumer<AuthProvider>(
                      builder: (context, authProvider, _) {
                        return Text(
                          'Hi, ${authProvider.user?.fullName?.split(' ').first ?? 'Employee'}',
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 22,
                            color: isDark ? Colors.white : Colors.black87,
                          ),
                          overflow: TextOverflow.ellipsis,
                        );
                      },
                    ),
                  ),
                ),
              ),

              // 2. CENTER: Notification Bell
              // Uses Positioned.fill + Center to grab absolute middle
              Positioned.fill(
                child: Center(
                  // Your _buildNotificationBell has a 'margin: right: 8', which makes it 
                  // look slightly off-center to the left. This transform fixes that 
                  // so the icon is perfectly in the middle.
                  child: Transform.translate(
                    offset: const Offset(4, 0), 
                    child: _buildNotificationBell(context, isDark),
                  ),
                ),
              ),

              // 3. RIGHT: GPS Status
              Positioned(
                right: 4, // Set to 4 because your GPS widget already has 'margin: right: 16' (4+16=20px total)
                top: 0,
                bottom: 0,
                child: Center(
                  child: Consumer<LocationProvider>(
                    builder: (context, locationProvider, _) {
                      return Container(
                        margin: const EdgeInsets.only(right: 16), // Existing margin from your code
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                        decoration: BoxDecoration(
                          color: locationProvider.isLocationEnabled 
                              ? Colors.green.withOpacity(0.15)
                              : Colors.red.withOpacity(0.15),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(
                            color: locationProvider.isLocationEnabled 
                                ? Colors.green
                                : Colors.red,
                            width: 1.5,
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: (locationProvider.isLocationEnabled 
                                  ? Colors.green
                                  : Colors.red).withOpacity(0.3),
                              blurRadius: 8,
                              offset: const Offset(0, 2),
                            ),
                          ],
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              locationProvider.isLocationEnabled 
                                ? Icons.location_on 
                                : Icons.location_off,
                              color: locationProvider.isLocationEnabled 
                                ? Colors.green
                                : Colors.red,
                              size: 18,
                            ),
                            const SizedBox(width: 6),
                            Text(
                              locationProvider.isLocationEnabled ? 'GPS ON' : 'GPS OFF',
                              style: TextStyle(
                                fontSize: 12,
                                color: locationProvider.isLocationEnabled 
                                  ? Colors.green
                                  : Colors.red,
                                fontWeight: FontWeight.bold,
                                letterSpacing: 0.5,
                              ),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          final taskProvider = Provider.of<TaskProvider>(context, listen: false);
          await taskProvider.fetchTasks();
        },
        color: const Color(0xFF2196F3),
        child: Consumer<TaskProvider>(
          builder: (context, taskProvider, _) {
            if (taskProvider.isLoading && taskProvider.tasks.isEmpty) {
              return const Center(
                child: CircularProgressIndicator(
                  color: Color(0xFF2196F3),
                ),
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
                        child: _buildCurrentTaskCard(
                          context,
                          taskProvider.currentTask!,
                          isDark,
                        ),
                      ),

                    const SizedBox(height: 24),
                    _buildTaskSummary(context, taskProvider, isDark),
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

  Widget _buildErrorCard(TaskProvider taskProvider, bool isDark) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0.0, end: 1.0),
      duration: const Duration(milliseconds: 400),
      builder: (context, value, child) {
        return Transform.scale(
          scale: value,
          child: child,
        );
      },
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(16),
        margin: const EdgeInsets.only(bottom: 20),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [
              Colors.orange.shade400,
              Colors.orange.shade600,
            ],
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

  Widget _buildCurrentTaskCard(BuildContext context, TaskModel task, bool isDark) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0.0, end: 1.0),
      duration: const Duration(milliseconds: 600),
      builder: (context, value, child) {
        return Transform.translate(
          offset: Offset(0, 30 * (1 - value)),
          child: Opacity(
            opacity: value,
            child: child,
          ),
        );
      },
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              const Color(0xFF2196F3),
              const Color(0xFF1976D2),
            ],
          ),
          borderRadius: BorderRadius.circular(24),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF2196F3).withOpacity(0.4),
              blurRadius: 25,
              spreadRadius: 2,
              offset: const Offset(0, 10),
            ),
            BoxShadow(
              color: const Color(0xFF2196F3).withOpacity(0.2),
              blurRadius: 40,
              spreadRadius: -5,
              offset: const Offset(0, 20),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.2),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(
                    Icons.play_circle_rounded,
                    color: Colors.white,
                    size: 24,
                  ),
                ),
                const SizedBox(width: 12),
                const Text(
                  'CURRENT TASK',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 13,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 1.2,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Text(
              task.title,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 24,
                fontWeight: FontWeight.bold,
                height: 1.2,
              ),
            ),
            if (task.description != null) ...[
              const SizedBox(height: 10),
              Text(
                task.description!,
                style: TextStyle(
                  color: Colors.white.withOpacity(0.95),
                  fontSize: 15,
                  height: 1.4,
                ),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ],
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => TaskDetailScreen(task: task),
                    ),
                  );
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.white,
                  foregroundColor: const Color(0xFF2196F3),
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                  elevation: 0,
                  shadowColor: Colors.black.withOpacity(0.2),
                ),
                child: const Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.visibility_rounded, size: 20),
                    SizedBox(width: 8),
                    Text(
                      'View Details',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 0.5,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTaskSummary(BuildContext context, TaskProvider taskProvider, bool isDark) {
    final summaryItems = [
      {
        'count': taskProvider.pendingTasks.length,
        'label': 'Pending',
        'icon': Icons.schedule_rounded,
        'color': Colors.orange,
      },
      {
        'count': taskProvider.inProgressTasks.length,
        'label': 'In Progress',
        'icon': Icons.play_arrow_rounded,
        'color': Colors.blue,
      },
      {
        'count': taskProvider.completedTasks.length,
        'label': 'Completed',
        'icon': Icons.check_circle_rounded,
        'color': Colors.green,
      },
    ];

    return Row(
      children: summaryItems.asMap().entries.map((entry) {
        final index = entry.key;
        final item = entry.value;
        
        return Expanded(
          child: TweenAnimationBuilder<double>(
            tween: Tween(begin: 0.0, end: 1.0),
            duration: Duration(milliseconds: 600 + (index * 200)),
            builder: (context, value, child) {
              return Transform.scale(
                scale: 0.8 + (0.2 * value),
                child: Opacity(
                  opacity: value,
                  child: child,
                ),
              );
            },
            child: Container(
              margin: EdgeInsets.only(
                left: index == 0 ? 0 : 6,
                right: index == summaryItems.length - 1 ? 0 : 6,
              ),
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
                borderRadius: BorderRadius.circular(20),
                boxShadow: [
                  BoxShadow(
                    color: isDark 
                        ? Colors.black.withOpacity(0.3)
                        : Colors.grey.withOpacity(0.15),
                    blurRadius: 15,
                    offset: const Offset(0, 5),
                  ),
                ],
              ),
              child: Column(
                children: [
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: (item['color'] as Color).withOpacity(0.15),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Icon(
                      item['icon'] as IconData,
                      color: item['color'] as Color,
                      size: 28,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    '${item['count']}',
                    style: TextStyle(
                      fontSize: 28,
                      fontWeight: FontWeight.bold,
                      color: item['color'] as Color,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    item['label'] as String,
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: isDark ? Colors.grey[400] : Colors.grey[600],
                    ),
                    textAlign: TextAlign.center,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
          ),
        );
      }).toList(),
    );
  }

  Widget _buildRecentTasksSection(BuildContext context, TaskProvider taskProvider, bool isDark) {
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
                  final homeState = context.findAncestorStateOfType<_HomeScreenState>();
                  homeState?.setState(() {
                    homeState._selectedIndex = 1;
                  });
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
          ...taskProvider.tasks.take(5).toList().asMap().entries.map((entry) {
            final index = entry.key;
            final task = entry.value;
            return TweenAnimationBuilder<double>(
              tween: Tween(begin: 0.0, end: 1.0),
              duration: Duration(milliseconds: 400 + (index * 100)),
              builder: (context, value, child) {
                return Transform.translate(
                  offset: Offset(0, 20 * (1 - value)),
                  child: Opacity(
                    opacity: value,
                    child: child,
                  ),
                );
              },
              child: _buildTaskCard(context, task, isDark),
            );
          }).toList(),
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

  Widget _buildTaskCard(BuildContext context, TaskModel task, bool isDark) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
        borderRadius: BorderRadius.circular(18),
        boxShadow: [
          BoxShadow(
            color: isDark 
                ? Colors.black.withOpacity(0.3)
                : Colors.grey.withOpacity(0.1),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () {
            Navigator.of(context).push(
              MaterialPageRoute(
                builder: (_) => TaskDetailScreen(task: task),
              ),
            );
          },
          borderRadius: BorderRadius.circular(18),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    color: _getStatusColor(task.status).withOpacity(0.15),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Icon(
                    _getStatusIcon(task.status),
                    color: _getStatusColor(task.status),
                    size: 24,
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        task.title,
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: isDark ? Colors.white : Colors.black87,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 4),
                      Text(
                        task.status.displayName,
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: _getStatusColor(task.status),
                        ),
                      ),
                    ],
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: _getPriorityColor(task.priority).withOpacity(0.15),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        task.priority.displayName,
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                          color: _getPriorityColor(task.priority),
                        ),
                      ),
                    ),
                    if (task.isOverdue) ...[
                      const SizedBox(height: 4),
                      Text(
                        'OVERDUE',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          color: Colors.red.shade600,
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
    );
  }

  // ✅ FIXED: Added queued and declined cases
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
      case TaskStatus.queued:
        return Colors.purple;
      case TaskStatus.declined:
        return Colors.grey;
    }
  }

  // ✅ FIXED: Added queued and declined cases
  IconData _getStatusIcon(TaskStatus status) {
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

  Widget _buildNotificationBell(BuildContext context, bool isDark) {
    final notificationService = NotificationService();
    
    return StreamBuilder<TaskModel>(
      stream: notificationService.notificationStream,
      builder: (context, snapshot) {
        final unreadCount = notificationService.unreadCount;
        
        return TweenAnimationBuilder<double>(
          tween: Tween(begin: 0.0, end: 1.0),
          duration: const Duration(milliseconds: 400),
          builder: (context, value, child) {
            return Transform.scale(
              scale: 0.8 + (0.2 * value),
              child: child,
            );
          },
          child: Container(
            margin: const EdgeInsets.only(right: 8),
            child: Stack(
              clipBehavior: Clip.none,
              children: [
                Container(
                  decoration: BoxDecoration(
                    color: isDark 
                        ? Colors.grey[800]
                        : Colors.grey[200],
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
                    onPressed: () {
                      _showNotificationPanel(context, isDark);
                    },
                  ),
                ),
                if (unreadCount > 0)
                  Positioned(
                    right: 6,
                    top: 6,
                    child: TweenAnimationBuilder<double>(
                      tween: Tween(begin: 0.0, end: 1.0),
                      duration: const Duration(milliseconds: 300),
                      builder: (context, value, child) {
                        return Transform.scale(
                          scale: value,
                          child: child,
                        );
                      },
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

  void _showNotificationPanel(BuildContext context, bool isDark) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => NotificationPanel(isDark: isDark),
    );
  }
}

// Notification Panel Widget (same as previous, just making sure file is complete)
class NotificationPanel extends StatefulWidget {
  final bool isDark;
  
  const NotificationPanel({super.key, required this.isDark});

  @override
  State<NotificationPanel> createState() => _NotificationPanelState();
}

class _NotificationPanelState extends State<NotificationPanel> with SingleTickerProviderStateMixin {
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
      builder: (context, child) {
        return Transform.translate(
          offset: Offset(0, (1 - _animation.value) * 300),
          child: child,
        );
      },
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
                          onPressed: () {
                            setState(() {
                              notificationService.markAsRead();
                            });
                          },
                          icon: const Icon(Icons.done_all, size: 18),
                          label: const Text('Mark all read'),
                          style: TextButton.styleFrom(
                            foregroundColor: const Color(0xFF2196F3),
                          ),
                        ),
                      IconButton(
                        onPressed: () => Navigator.pop(context),
                        icon: const Icon(Icons.close),
                        color: widget.isDark ? Colors.grey[400] : Colors.grey[600],
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
                  ? _buildEmptyNotifications(widget.isDark)
                  : ListView.builder(
                      physics: const BouncingScrollPhysics(),
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      itemCount: notificationService.unreadTasks.length,
                      itemBuilder: (context, index) {
                        final task = notificationService.unreadTasks[index];
                        return _buildNotificationItem(
                          context,
                          task,
                          widget.isDark,
                          index,
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEmptyNotifications(bool isDark) {
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
              color: isDark ? Colors.grey[400] : Colors.grey[600],
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'You\'re all caught up!',
            style: TextStyle(
              fontSize: 14,
              color: isDark ? Colors.grey[500] : Colors.grey[500],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildNotificationItem(BuildContext context, TaskModel task, bool isDark, int index) {
    final notificationService = NotificationService();
    
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0.0, end: 1.0),
      duration: Duration(milliseconds: 300 + (index * 100)),
      builder: (context, value, child) {
        return Transform.translate(
          offset: Offset(50 * (1 - value), 0),
          child: Opacity(
            opacity: value,
            child: child,
          ),
        );
      },
      child: Dismissible(
        key: Key('notification_${task.id}'),
        direction: DismissDirection.endToStart,
        background: Container(
          alignment: Alignment.centerRight,
          padding: const EdgeInsets.only(right: 20),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [
                Colors.red.shade400,
                Colors.red.shade600,
              ],
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
          setState(() {
            notificationService.markTaskAsRead(task.id);
          });
          
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: const Text('Notification archived'),
              backgroundColor: Colors.green,
              behavior: SnackBarBehavior.floating,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              action: SnackBarAction(
                label: 'UNDO',
                textColor: Colors.white,
                onPressed: () {
                  setState(() {
                    notificationService.addNotification(task);
                  });
                },
              ),
            ),
          );
        },
        child: Container(
          margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
          decoration: BoxDecoration(
            color: isDark ? Colors.grey[850] : Colors.grey[50],
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: _getPriorityColor(task.priority).withOpacity(0.3),
              width: 2,
            ),
            boxShadow: [
              BoxShadow(
                color: _getPriorityColor(task.priority).withOpacity(0.1),
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
                        color: _getPriorityColor(task.priority).withOpacity(0.15),
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: Icon(
                        Icons.assignment_outlined,
                        color: _getPriorityColor(task.priority),
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
                                    color: isDark ? Colors.white : Colors.black87,
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                decoration: BoxDecoration(
                                  color: _getPriorityColor(task.priority).withOpacity(0.2),
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: Text(
                                  task.priority.displayName,
                                  style: TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.bold,
                                    color: _getPriorityColor(task.priority),
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
                                color: isDark ? Colors.grey[400] : Colors.grey[600],
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
                                color: isDark ? Colors.grey[500] : Colors.grey[500],
                              ),
                              const SizedBox(width: 4),
                              Text(
                                'From ${task.createdUserName}',
                                style: TextStyle(
                                  fontSize: 12,
                                  color: isDark ? Colors.grey[500] : Colors.grey[500],
                                ),
                              ),
                              const Spacer(),
                              Icon(
                                Icons.access_time,
                                size: 14,
                                color: isDark ? Colors.grey[500] : Colors.grey[500],
                              ),
                              const SizedBox(width: 4),
                              Text(
                                task.formattedCreatedAt,
                                style: TextStyle(
                                  fontSize: 12,
                                  color: isDark ? Colors.grey[500] : Colors.grey[500],
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
                      color: isDark ? Colors.grey[600] : Colors.grey[400],
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