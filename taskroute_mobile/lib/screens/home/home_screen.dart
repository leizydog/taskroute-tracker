import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../providers/task_provider.dart';
import '../../providers/location_provider.dart';
import '../auth/tasks/task_list_screen.dart';
import '../auth/tasks/task_detail_screen.dart';
import '../profile/profile_screen.dart';
import '../../widgets/task_summary_card.dart';
import '../../models/task_model.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _selectedIndex = 0;
  
  @override
  void initState() {
    super.initState();
    _initializeData();
  }

 Future<void> _initializeData() async {
  final taskProvider = Provider.of<TaskProvider>(context, listen: false);
  final locationProvider = Provider.of<LocationProvider>(context, listen: false);
  
  print('=== INITIALIZE DATA DEBUG ===');
  
  // Request location permissions
  print('Requesting location permission...');
  final hasPermission = await locationProvider.requestPermission();
  print('Location permission granted: $hasPermission');
  print('Location provider state - isLocationEnabled: ${locationProvider.isLocationEnabled}');
  print('Location provider state - isTracking: ${locationProvider.isTracking}');
  
  if (hasPermission) {
    print('Attempting to get current position...');
    final position = await locationProvider.getCurrentPosition();
    if (position != null) {
      print('Current position: Lat ${position.latitude}, Lng ${position.longitude}');
      print('Position accuracy: ${position.accuracy} meters');
      print('Position timestamp: ${position.timestamp}');
    } else {
      print('Failed to get current position');
    }
  } else {
    print('Cannot get position - no location permission');
    print('Location error: ${locationProvider.error}');
  }
  
  // Fetch tasks
  print('Fetching tasks...');
  await taskProvider.fetchTasks();
  print('Tasks fetched: ${taskProvider.tasks.length}');
  
  // Sync any offline data
  print('Syncing offline data...');
  await taskProvider.syncOfflineData();
  print('Offline sync completed');
  
  print('=== INITIALIZE DATA COMPLETE ===');
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
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _selectedIndex,
        onTap: (index) {
          setState(() {
            _selectedIndex = index;
          });
        },
        type: BottomNavigationBarType.fixed,
        items: const [
          BottomNavigationBarItem(
            icon: Icon(Icons.dashboard_outlined),
            activeIcon: Icon(Icons.dashboard),
            label: 'Dashboard',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.task_outlined),
            activeIcon: Icon(Icons.task),
            label: 'Tasks',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.person_outlined),
            activeIcon: Icon(Icons.person),
            label: 'Profile',
          ),
        ],
      ),
    );
  }
}

class DashboardTab extends StatelessWidget {
  const DashboardTab({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Consumer<AuthProvider>(
          builder: (context, authProvider, _) {
            return Text('Hi, ${authProvider.user?.fullName ?? 'Employee'}');
          },
        ),
        actions: [
          Consumer<LocationProvider>(
            builder: (context, locationProvider, _) {
              return Container(
                margin: const EdgeInsets.only(right: 16),
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
                      size: 20,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      locationProvider.isLocationEnabled ? 'GPS ON' : 'GPS OFF',
                      style: TextStyle(
                        fontSize: 12,
                        color: locationProvider.isLocationEnabled 
                          ? Colors.green 
                          : Colors.red,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          final taskProvider = Provider.of<TaskProvider>(context, listen: false);
          await taskProvider.fetchTasks();
        },
        child: Consumer<TaskProvider>(
          builder: (context, taskProvider, _) {
            if (taskProvider.isLoading && taskProvider.tasks.isEmpty) {
              return const Center(child: CircularProgressIndicator());
            }

            return SingleChildScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Error message if any
                  if (taskProvider.error != null)
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(12),
                      margin: const EdgeInsets.only(bottom: 16),
                      decoration: BoxDecoration(
                        color: Colors.orange[100],
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: Colors.orange[300]!),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.warning, color: Colors.orange),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              taskProvider.error!,
                              style: const TextStyle(color: Colors.orange),
                            ),
                          ),
                          IconButton(
                            icon: const Icon(Icons.close, size: 20),
                            onPressed: () => taskProvider.clearError(),
                          ),
                        ],
                      ),
                    ),

                  // Current active task
                  if (taskProvider.currentTask != null)
                    _buildCurrentTaskCard(context, taskProvider.currentTask!),

                  // Task summary cards
                  _buildTaskSummary(context, taskProvider),

                  const SizedBox(height: 24),

                  // Recent tasks
                  Text(
                    'Recent Tasks',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 12),
                  
                  if (taskProvider.tasks.isEmpty)
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(32),
                      child: Column(
                        children: [
                          Icon(
                            Icons.assignment_outlined,
                            size: 64,
                            color: Colors.grey[400],
                          ),
                          const SizedBox(height: 16),
                          Text(
                            'No tasks assigned',
                            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                              color: Colors.grey[600],
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'New tasks will appear here when assigned',
                            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                              color: Colors.grey[500],
                            ),
                            textAlign: TextAlign.center,
                          ),
                        ],
                      ),
                    )
                  else
                    ...taskProvider.tasks.take(5).map((task) => 
                      _buildTaskListItem(context, task)
                    ),

                  if (taskProvider.tasks.length > 5) ...[
                    const SizedBox(height: 16),
                    TextButton.icon(
                      onPressed: () {
                        // Navigate to tasks tab
                        final homeState = context.findAncestorStateOfType<_HomeScreenState>();
                        homeState?.setState(() {
                          homeState._selectedIndex = 1;
                        });
                      },
                      icon: const Icon(Icons.list),
                      label: Text('View all ${taskProvider.tasks.length} tasks'),
                    ),
                  ],
                ],
              ),
            );
          },
        ),
      ),
    );
  }

  Widget _buildCurrentTaskCard(BuildContext context, TaskModel task) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 24),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            Theme.of(context).primaryColor,
            Theme.of(context).primaryColor.withOpacity(0.8),
          ],
        ),
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Theme.of(context).primaryColor.withOpacity(0.3),
            blurRadius: 8,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.play_circle, color: Colors.white, size: 24),
              const SizedBox(width: 8),
              Text(
                'CURRENT TASK',
                style: Theme.of(context).textTheme.labelMedium?.copyWith(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            task.title,
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
              color: Colors.white,
              fontWeight: FontWeight.bold,
            ),
          ),
          if (task.description != null) ...[
            const SizedBox(height: 8),
            Text(
              task.description!,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: Colors.white.withOpacity(0.9),
              ),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ],
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: () {
                    Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => TaskDetailScreen(task: task),
                      ),
                    );
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.white,
                    foregroundColor: Theme.of(context).primaryColor,
                  ),
                  icon: const Icon(Icons.visibility),
                  label: const Text('View Details'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildTaskSummary(BuildContext context, TaskProvider taskProvider) {
    return Row(
      children: [
        Expanded(
          child: TaskSummaryCard(
            title: 'Pending',
            count: taskProvider.pendingTasks.length,
            icon: Icons.schedule,
            color: Colors.orange,
            onTap: () {
              // Navigate to filtered tasks
            },
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: TaskSummaryCard(
            title: 'In Progress',
            count: taskProvider.inProgressTasks.length,
            icon: Icons.play_arrow,
            color: Colors.blue,
            onTap: () {},
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: TaskSummaryCard(
            title: 'Completed',
            count: taskProvider.completedTasks.length,
            icon: Icons.check_circle,
            color: Colors.green,
            onTap: () {},
          ),
        ),
      ],
    );
  }

  Widget _buildTaskListItem(BuildContext context, TaskModel task) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: _getStatusColor(task.status).withOpacity(0.1),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(
            _getStatusIcon(task.status),
            color: _getStatusColor(task.status),
            size: 20,
          ),
        ),
        title: Text(
          task.title,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        subtitle: Text(
          task.status.displayName,
          style: TextStyle(
            color: _getStatusColor(task.status),
            fontWeight: FontWeight.w500,
          ),
        ),
        trailing: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(
                color: _getPriorityColor(task.priority).withOpacity(0.1),
                borderRadius: BorderRadius.circular(4),
              ),
              child: Text(
                task.priority.displayName,
                style: TextStyle(
                  color: _getPriorityColor(task.priority),
                  fontSize: 10,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            const SizedBox(height: 4),
            if (task.isOverdue)
              Text(
                'OVERDUE',
                style: TextStyle(
                  color: Colors.red,
                  fontSize: 10,
                  fontWeight: FontWeight.bold,
                ),
              ),
          ],
        ),
        onTap: () {
          Navigator.of(context).push(
            MaterialPageRoute(
              builder: (_) => TaskDetailScreen(task: task),
            ),
          );
        },
      ),
    );
  }

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
    }
  }

  IconData _getStatusIcon(TaskStatus status) {
    switch (status) {
      case TaskStatus.pending:
        return Icons.schedule;
      case TaskStatus.inProgress:
        return Icons.play_arrow;
      case TaskStatus.completed:
        return Icons.check_circle;
      case TaskStatus.cancelled:
        return Icons.cancel;
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
}