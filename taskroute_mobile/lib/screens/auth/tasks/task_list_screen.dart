import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../../../providers/task_provider.dart';
import '../../../models/task_model.dart';
import 'task_detail_screen.dart';

class TaskListScreen extends StatefulWidget {
  const TaskListScreen({super.key});

  @override
  State<TaskListScreen> createState() => _TaskListScreenState();
}

class _TaskListScreenState extends State<TaskListScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  String _searchQuery = '';
  final TextEditingController _searchController = TextEditingController();
  
  String _sortBy = 'due_date';
  bool _sortAscending = true;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 4, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    _searchController.dispose();
    super.dispose();
  }

  void _sortTasks(List<TaskModel> tasks) {
    tasks.sort((a, b) {
      int cmp = 0;
      switch (_sortBy) {
        case 'due_date':
          if (a.dueDate == null) cmp = 1;
          else if (b.dueDate == null) cmp = -1;
          else cmp = a.dueDate!.compareTo(b.dueDate!);
          break;
        case 'priority':
          cmp = b.priority.index.compareTo(a.priority.index);
          break;
        case 'title':
          cmp = a.title.compareTo(b.title);
          break;
        case 'created_at':
          cmp = b.createdAt.compareTo(a.createdAt);
          break;
        default:
          cmp = 0;
      }
      return _sortAscending ? cmp : -cmp;
    });
  }

  @override
  Widget build(BuildContext context) {
    final taskProvider = Provider.of<TaskProvider>(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    
    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(isDark),
            _buildTabBar(isDark),
            Expanded(
              child: TabBarView(
                controller: _tabController,
                children: [
                  _buildTaskListView(taskProvider, TaskStatus.pending),
                  _buildTaskListView(taskProvider, TaskStatus.inProgress),
                  _buildTaskListView(taskProvider, TaskStatus.completed),
                  _buildTaskListView(taskProvider, TaskStatus.cancelled),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader(bool isDark) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                "My Tasks",
                style: TextStyle(
                  fontSize: 28, 
                  fontWeight: FontWeight.bold, 
                  color: isDark ? Colors.white : Colors.black87
                ),
              ),
              PopupMenuButton<String>(
                icon: Icon(Icons.sort, color: isDark ? Colors.white70 : Colors.black87),
                color: isDark ? Colors.grey[800] : Colors.white,
                onSelected: (value) {
                  setState(() {
                    if (_sortBy == value) {
                      _sortAscending = !_sortAscending;
                    } else {
                      _sortBy = value;
                      _sortAscending = true;
                    }
                  });
                },
                itemBuilder: (context) => [
                  const PopupMenuItem(value: 'due_date', child: Text('Sort by Due Date')),
                  const PopupMenuItem(value: 'priority', child: Text('Sort by Priority')),
                  const PopupMenuItem(value: 'created_at', child: Text('Sort by Date Created')),
                ],
              ),
            ],
          ),
          const SizedBox(height: 16),
          Container(
            decoration: BoxDecoration(
              color: isDark ? Colors.grey[800] : Colors.white,
              borderRadius: BorderRadius.circular(12),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(isDark ? 0.2 : 0.05),
                  blurRadius: 10,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: TextField(
              controller: _searchController,
              style: TextStyle(color: isDark ? Colors.white : Colors.black),
              onChanged: (value) => setState(() => _searchQuery = value),
              decoration: InputDecoration(
                hintText: 'Search tasks...',
                hintStyle: TextStyle(color: isDark ? Colors.grey[400] : Colors.grey[400]),
                prefixIcon: Icon(Icons.search, color: isDark ? Colors.grey[400] : Colors.grey[400]),
                border: InputBorder.none,
                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                suffixIcon: _searchQuery.isNotEmpty
                    ? IconButton(
                        icon: Icon(Icons.clear, color: isDark ? Colors.white70 : Colors.grey),
                        onPressed: () {
                          _searchController.clear();
                          setState(() => _searchQuery = '');
                        },
                      )
                    : null,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTabBar(bool isDark) {
    return Container(
      margin: const EdgeInsets.only(top: 8, bottom: 8),
      child: TabBar(
        controller: _tabController,
        isScrollable: true,
        labelColor: Colors.blue[400],
        unselectedLabelColor: isDark ? Colors.grey[400] : Colors.grey[600],
        labelStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
        unselectedLabelStyle: const TextStyle(fontWeight: FontWeight.w500, fontSize: 15),
        indicatorColor: Colors.blue[400],
        indicatorSize: TabBarIndicatorSize.label,
        dividerColor: Colors.transparent,
        tabs: const [
          Tab(text: 'Pending'),
          Tab(text: 'In Progress'),
          Tab(text: 'Completed'),
          Tab(text: 'Cancelled'),
        ],
      ),
    );
  }

  Widget _buildTaskListView(TaskProvider provider, TaskStatus status) {
    var tasks = provider.tasks.where((t) => t.status == status).toList();

    if (_searchQuery.isNotEmpty) {
      tasks = tasks.where((t) => 
        t.title.toLowerCase().contains(_searchQuery.toLowerCase()) ||
        (t.description?.toLowerCase().contains(_searchQuery.toLowerCase()) ?? false)
      ).toList();
    }

    _sortTasks(tasks);

    if (tasks.isEmpty) {
      final isDark = Theme.of(context).brightness == Brightness.dark;
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.assignment_outlined, size: 64, color: isDark ? Colors.grey[700] : Colors.grey[300]),
            const SizedBox(height: 16),
            Text(
              "No ${status.displayName} tasks",
              style: TextStyle(color: isDark ? Colors.grey[500] : Colors.grey[500], fontSize: 16),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: () async {
        await provider.refreshTasks();
      },
      child: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: tasks.length,
        separatorBuilder: (context, index) => const SizedBox(height: 12),
        itemBuilder: (context, index) => _buildTaskCard(tasks[index]),
      ),
    );
  }

  Widget _buildTaskCard(TaskModel task) {
    final isOverdue = task.isOverdue;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    
    return GestureDetector(
      onTap: () {
        Navigator.push(
          context,
          MaterialPageRoute(builder: (_) => TaskDetailScreen(task: task)),
        );
      },
      child: Container(
        decoration: BoxDecoration(
          color: isDark ? Colors.grey[850] : Colors.white,
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(isDark ? 0.3 : 0.03),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
          border: Border.all(color: isDark ? Colors.grey[800]! : Colors.grey[100]!),
        ),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: _getPriorityColor(task.priority).withOpacity(0.15),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      task.priority.displayName,
                      style: TextStyle(
                        color: _getPriorityColor(task.priority),
                        fontWeight: FontWeight.w600,
                        fontSize: 12,
                      ),
                    ),
                  ),
                  if (task.dueDate != null)
                    Text(
                      task.formattedDueDate,
                      style: TextStyle(
                        color: isOverdue ? Colors.red[300] : (isDark ? Colors.grey[400] : Colors.grey[500]),
                        fontWeight: isOverdue ? FontWeight.bold : FontWeight.normal,
                        fontSize: 12,
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 12),
              Text(
                task.title,
                style: TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.bold,
                  color: isDark ? Colors.white : Colors.black87,
                ),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Icon(Icons.location_on_outlined, size: 16, color: isDark ? Colors.grey[400] : Colors.grey),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Text(
                      task.effectiveLocationName ?? "No location",
                      style: TextStyle(
                        color: isDark ? Colors.grey[400] : Colors.grey[600], 
                        fontSize: 13
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Color _getPriorityColor(TaskPriority priority) {
    switch (priority) {
      case TaskPriority.low: return Colors.green[600]!;
      case TaskPriority.medium: return Colors.orange[700]!;
      case TaskPriority.high: return Colors.red[600]!;
      case TaskPriority.urgent: return Colors.purple[600]!;
    }
  }
}