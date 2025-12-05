import 'dart:async';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/task_model.dart';

/// Service for managing in-app notifications
/// Uses streams to notify UI of changes to unread count
class NotificationService {
  static final NotificationService _instance = NotificationService._internal();
  factory NotificationService() => _instance;
  NotificationService._internal() {
    _loadReadTaskIds();
  }

  // Stream for new notifications
  final StreamController<TaskModel> _notificationStream =
      StreamController<TaskModel>.broadcast();

  // NEW: Stream specifically for count changes (triggers UI rebuild)
  final StreamController<int> _countStream = StreamController<int>.broadcast();

  final List<TaskModel> _unreadTasks = [];
  final Set<int> _readTaskIds = {};

  Stream<TaskModel> get notificationStream => _notificationStream.stream;
  Stream<int> get countStream => _countStream.stream; // NEW
  List<TaskModel> get unreadTasks => _unreadTasks;
  int get unreadCount => _unreadTasks.length;

  // Emit count change to trigger UI rebuild
  void _notifyCountChange() {
    _countStream.add(_unreadTasks.length);
  }

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
    if (!_readTaskIds.contains(task.id) &&
        !_unreadTasks.any((t) => t.id == task.id)) {
      _unreadTasks.insert(0, task);
      _notificationStream.add(task);
      _notifyCountChange(); // NEW: Trigger UI update
    }
  }

  void removeNotificationByTaskId(int taskId) {
    final removed = _unreadTasks.any((t) => t.id == taskId);
    _unreadTasks.removeWhere((t) => t.id == taskId);
    if (removed) _notifyCountChange(); // NEW: Trigger UI update
  }

  void notifyTaskArchived(int taskId) {
    removeNotificationByTaskId(taskId);
  }

  void notifyTaskDeleted(int taskId) {
    removeNotificationByTaskId(taskId);
  }

  void notifyTaskCompleted(TaskModel task) {
    _notificationStream.add(task);
    removeNotificationByTaskId(task.id);
  }

  void notifyTaskStarted(TaskModel task) {
    if (!_unreadTasks.any((t) => t.id == task.id)) {
      _unreadTasks.insert(0, task);
      _notifyCountChange(); // NEW
    }
    _notificationStream.add(task);
  }

  void updateTaskStatus(TaskModel task) {
    if (task.status == TaskStatus.completed ||
        task.status == TaskStatus.inProgress) {
      removeNotificationByTaskId(task.id);
      _readTaskIds.add(task.id);
      _saveReadTaskIds();
    }
  }

  void markAsRead() {
    for (var task in _unreadTasks) {
      _readTaskIds.add(task.id);
    }
    _unreadTasks.clear();
    _saveReadTaskIds();
    _notifyCountChange(); // NEW: Trigger UI update to show 0
  }

  void markTaskAsRead(int taskId) {
    _unreadTasks.removeWhere((t) => t.id == taskId);
    _readTaskIds.add(taskId);
    _saveReadTaskIds();
    _notifyCountChange(); // NEW: Trigger UI update
  }

  Future<void> clearReadHistory() async {
    _readTaskIds.clear();
    _unreadTasks.clear();
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('read_task_ids');
    _notifyCountChange(); // NEW
  }

  void dispose() {
    _notificationStream.close();
    _countStream.close(); // NEW
  }
}
