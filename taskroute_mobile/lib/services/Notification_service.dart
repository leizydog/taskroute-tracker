import 'dart:async';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/task_model.dart';

class NotificationService {
  static final NotificationService _instance = NotificationService._internal();
  factory NotificationService() => _instance;
  NotificationService._internal() {
    _loadReadTaskIds();
  }

  final StreamController<TaskModel> _notificationStream = StreamController<TaskModel>.broadcast();
  final List<TaskModel> _unreadTasks = [];
  final Set<int> _readTaskIds = {}; // Track which tasks have been read
  
  Stream<TaskModel> get notificationStream => _notificationStream.stream;
  List<TaskModel> get unreadTasks => _unreadTasks;
  int get unreadCount => _unreadTasks.length;

  // Load previously read task IDs from storage
  Future<void> _loadReadTaskIds() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final List<String>? readIds = prefs.getStringList('read_task_ids');
      if (readIds != null) {
        _readTaskIds.addAll(readIds.map((id) => int.parse(id)));
      }
    } catch (e) {
      print('Error loading read task IDs: $e');
    }
  }

  // Save read task IDs to storage
  Future<void> _saveReadTaskIds() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setStringList(
        'read_task_ids',
        _readTaskIds.map((id) => id.toString()).toList(),
      );
    } catch (e) {
      print('Error saving read task IDs: $e');
    }
  }

  void addNotification(TaskModel task) {
    // Don't add if task was already read or already in unread list
    if (_readTaskIds.contains(task.id)) {
      print('Task ${task.id} was already read, skipping notification');
      return;
    }
    
    // Don't add notification for completed or in-progress tasks
    if (task.status == TaskStatus.completed || task.status == TaskStatus.inProgress) {
      print('Task ${task.id} is ${task.status.displayName}, skipping notification');
      return;
    }
    
    if (!_unreadTasks.any((t) => t.id == task.id)) {
      print('Adding notification for task: ${task.title}');
      _unreadTasks.insert(0, task); // Add to front for newest first
      _notificationStream.add(task);
    }
  }
  
  // Remove notification when task status changes
  void removeNotificationByTaskId(int taskId) {
    _unreadTasks.removeWhere((t) => t.id == taskId);
    print('Removed notification for task $taskId');
  }
  
  // Update existing notifications based on task status
  void updateTaskStatus(TaskModel task) {
    // If task is completed or in progress, remove from notifications
    if (task.status == TaskStatus.completed || task.status == TaskStatus.inProgress) {
      removeNotificationByTaskId(task.id);
      // Also mark as read so it won't appear again
      _readTaskIds.add(task.id);
      _saveReadTaskIds();
    }
  }

  void markAsRead() {
    // Mark all current unread tasks as read
    for (var task in _unreadTasks) {
      _readTaskIds.add(task.id);
    }
    _unreadTasks.clear();
    _saveReadTaskIds();
  }

  void markTaskAsRead(int taskId) {
    _unreadTasks.removeWhere((t) => t.id == taskId);
    _readTaskIds.add(taskId);
    _saveReadTaskIds();
    print('Marked task $taskId as read');
  }

  // Call this when you want to reset all notifications (e.g., on logout)
  Future<void> clearAllReadHistory() async {
    _readTaskIds.clear();
    _unreadTasks.clear();
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('read_task_ids');
  }

  void dispose() {
    _notificationStream.close();
  }
}