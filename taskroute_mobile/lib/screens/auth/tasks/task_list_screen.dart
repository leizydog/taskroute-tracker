import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
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
  String _searchQuery = '';
  final TextEditingController _searchController = TextEditingController();

  String _sortBy = 'due_date';
  bool _sortAscending = true;

  // Removed local _selectedStatuses in favor of TaskProvider state

  VoidCallback? _taskListener;

  @override
  void initState() {
    super.initState();
    final taskProvider = Provider.of<TaskProvider>(context, listen: false);
    _taskListener = () {
      if (mounted) setState(() {});
    };
    taskProvider.addListener(_taskListener!);
  }

  @override
  void dispose() {
    if (_taskListener != null) {
      final taskProvider = Provider.of<TaskProvider>(context, listen: false);
      taskProvider.removeListener(_taskListener!);
    }
    _searchController.dispose();
    super.dispose();
  }

  void _sortTasks(List<TaskModel> tasks) {
    tasks.sort((a, b) {
      int cmp = 0;
      switch (_sortBy) {
        case 'due_date':
          if (a.dueDate == null)
            cmp = 1;
          else if (b.dueDate == null)
            cmp = -1;
          else
            cmp = a.dueDate!.compareTo(b.dueDate!);
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
            _buildStatusFilters(taskProvider, isDark),
            Expanded(child: _buildTaskListView(taskProvider, isDark)),
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
                  color: isDark ? Colors.white : Colors.black87,
                ),
              ),
              PopupMenuButton<String>(
                icon: Icon(
                  Icons.sort,
                  color: isDark ? Colors.white70 : Colors.black87,
                ),
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
                  const PopupMenuItem(
                    value: 'due_date',
                    child: Text('Sort by Due Date'),
                  ),
                  const PopupMenuItem(
                    value: 'priority',
                    child: Text('Sort by Priority'),
                  ),
                  const PopupMenuItem(
                    value: 'created_at',
                    child: Text('Sort by Date Created'),
                  ),
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
                hintStyle: TextStyle(
                  color: isDark ? Colors.grey[400] : Colors.grey[400],
                ),
                prefixIcon: Icon(
                  Icons.search,
                  color: isDark ? Colors.grey[400] : Colors.grey[400],
                ),
                border: InputBorder.none,
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 14,
                ),
                suffixIcon: _searchQuery.isNotEmpty
                    ? IconButton(
                        icon: Icon(
                          Icons.clear,
                          color: isDark ? Colors.white70 : Colors.grey,
                        ),
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

  Widget _buildStatusFilters(TaskProvider provider, bool isDark) {
    final filterConfigs = [
      {
        'status': null, // "All" filter
        'label': 'All',
        'icon': Icons.dashboard_rounded,
        'color': const Color(0xFF2196F3),
        'count': provider.tasks.length,
      },
      {
        'status': TaskStatus.pending,
        'label': 'Pending',
        'icon': Icons.schedule_rounded,
        'color': Colors.orange,
        'count': provider.pendingTasks.length,
      },
      {
        'status': TaskStatus.inProgress,
        'label': 'In Progress',
        'icon': Icons.play_arrow_rounded,
        'color': const Color(0xFF2196F3),
        'count': provider.inProgressTasks.length,
      },
      {
        'status': TaskStatus.completed,
        'label': 'Completed',
        'icon': Icons.check_circle_rounded,
        'color': Colors.green,
        'count': provider.completedTasks.length,
      },
      {
        'status': TaskStatus.cancelled,
        'label': 'Cancelled',
        'icon': Icons.cancel_rounded,
        'color': Colors.red,
        'count': provider.tasks
            .where((t) => t.status == TaskStatus.cancelled)
            .length,
      },
    ];

    return Container(
      height: 65,
      margin: const EdgeInsets.only(top: 12, bottom: 8),
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: filterConfigs.length,
        separatorBuilder: (context, index) => const SizedBox(width: 10),
        itemBuilder: (context, index) {
          final config = filterConfigs[index];
          final status = config['status'] as TaskStatus?;
          final isAll = status == null;
          final isSelected = isAll
              ? provider.filterStatuses.length == 4
              : provider.filterStatuses.contains(status);

          final color = config['color'] as Color;
          final icon = config['icon'] as IconData;
          final label = config['label'] as String;
          final count = config['count'] as int;

          return AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            child: Material(
              color: Colors.transparent,
              child: InkWell(
                onTap: () => isAll
                    ? provider.resetFilter()
                    : provider.toggleFilter(status!),
                borderRadius: BorderRadius.circular(16),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 10,
                  ),
                  decoration: BoxDecoration(
                    color: isSelected
                        ? color.withOpacity(0.15)
                        : (isDark ? Colors.grey[850] : Colors.grey[100]),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(
                      color: isSelected ? color : Colors.transparent,
                      width: 2,
                    ),
                    boxShadow: isSelected
                        ? [
                            BoxShadow(
                              color: color.withOpacity(0.3),
                              blurRadius: 8,
                              offset: const Offset(0, 2),
                            ),
                          ]
                        : [],
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        icon,
                        color: isSelected
                            ? color
                            : (isDark ? Colors.grey[400] : Colors.grey[600]),
                        size: 20,
                      ),
                      const SizedBox(width: 8),
                      Text(
                        label,
                        style: TextStyle(
                          color: isSelected
                              ? color
                              : (isDark ? Colors.grey[300] : Colors.grey[700]),
                          fontWeight: isSelected
                              ? FontWeight.bold
                              : FontWeight.w600,
                          fontSize: 14,
                        ),
                      ),
                      const SizedBox(width: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 6,
                          vertical: 2,
                        ),
                        decoration: BoxDecoration(
                          color: isSelected
                              ? color
                              : (isDark ? Colors.grey[700] : Colors.grey[300]),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Text(
                          '$count',
                          style: TextStyle(
                            color: isSelected
                                ? Colors.white
                                : (isDark
                                      ? Colors.grey[300]
                                      : Colors.grey[700]),
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildTaskListView(TaskProvider provider, bool isDark) {
    var tasks = provider.tasks
        .where((t) => provider.filterStatuses.contains(t.status))
        .toList();

    if (_searchQuery.isNotEmpty) {
      tasks = tasks
          .where(
            (t) =>
                t.title.toLowerCase().contains(_searchQuery.toLowerCase()) ||
                (t.description?.toLowerCase().contains(
                      _searchQuery.toLowerCase(),
                    ) ??
                    false),
          )
          .toList();
    }

    _sortTasks(tasks);

    if (tasks.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.assignment_outlined,
              size: 64,
              color: isDark ? Colors.grey[700] : Colors.grey[300],
            ),
            const SizedBox(height: 16),
            Text(
              _searchQuery.isNotEmpty ? "No tasks found" : "No tasks",
              style: TextStyle(
                color: isDark ? Colors.grey[500] : Colors.grey[500],
                fontSize: 16,
              ),
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
          border: Border.all(
            color: isDark ? Colors.grey[800]! : Colors.grey[100]!,
          ),
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
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 4,
                    ),
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
                        color: isOverdue
                            ? Colors.red[300]
                            : (isDark ? Colors.grey[400] : Colors.grey[500]),
                        fontWeight: isOverdue
                            ? FontWeight.bold
                            : FontWeight.normal,
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
                  Icon(
                    Icons.location_on_outlined,
                    size: 16,
                    color: isDark ? Colors.grey[400] : Colors.grey,
                  ),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Text(
                      task.effectiveLocationName ?? "No location",
                      style: TextStyle(
                        color: isDark ? Colors.grey[400] : Colors.grey[600],
                        fontSize: 13,
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
      case TaskPriority.low:
        return Colors.green[600]!;
      case TaskPriority.medium:
        return Colors.orange[700]!;
      case TaskPriority.high:
        return Colors.red[600]!;
      case TaskPriority.urgent:
        return Colors.purple[600]!;
    }
  }
}
