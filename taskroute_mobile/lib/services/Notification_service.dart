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
      await prefs.setStringList('read_task_ids', _readTaskIds.map((id) => id.toString()).toList());
    } catch (e) {
      print('Error saving read task IDs: $e');
    }
  }

  // Method to add a notification when a new task arrives
  void addNotification(TaskModel task) {
    // Only add if not previously read and not already in list
    if (!_readTaskIds.contains(task.id) && !_unreadTasks.any((t) => t.id == task.id)) {
      _unreadTasks.insert(0, task); // Add to front for newest first
      _notificationStream.add(task);
    }
  }

  // Remove notification when task status changes
  void removeNotificationByTaskId(int taskId) {
    _unreadTasks.removeWhere((t) => t.id == taskId);
    // We don't necessarily mark as read here, just remove from active notifications
  }
  
  // 1. Task Archived: Remove from notifications if it exists
  void notifyTaskArchived(int taskId) {
    removeNotificationByTaskId(taskId);
  }

  // 2. Task Deleted: Remove from notifications if it exists
  void notifyTaskDeleted(int taskId) {
    removeNotificationByTaskId(taskId);
  }

  // 3. Employee Complete Task: Receive a notification
  void notifyTaskCompleted(TaskModel task) {
    // We stream the task so the UI can show a success message/snackbar
    _notificationStream.add(task);
    
    // We remove it from unread "To Do" notifications since it's done
    removeNotificationByTaskId(task.id);
  }

  // 4. Employee Accepted/Started Queued Task: Notification when it starts
  void notifyTaskStarted(TaskModel task) {
    // Ensure it's in the unread list as it is now an active task
    if (!_unreadTasks.any((t) => t.id == task.id)) {
      _unreadTasks.insert(0, task);
    }
    // Broadcast to UI
    _notificationStream.add(task);
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
  }

  // Call this when you want to reset read status (e.g. logout)
  Future<void> clearReadHistory() async {
    _readTaskIds.clear();
    _unreadTasks.clear();
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('read_task_ids');
  }

  void dispose() {
    _notificationStream.close();
  }
}