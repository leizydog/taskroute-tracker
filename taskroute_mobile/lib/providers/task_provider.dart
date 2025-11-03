import 'package:flutter/foundation.dart';
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';
import '../models/task_model.dart';
import '../services/api_service.dart';
import '../services/storage_service.dart';
import 'dart:math';
import 'package:flutter/material.dart';



class TaskProvider with ChangeNotifier {
  final ApiService _apiService = ApiService();
  
  List<TaskModel> _tasks = [];
  TaskModel? _currentTask;
  bool _isLoading = false;
  String? _error;

  // Getters
  List<TaskModel> get tasks => _tasks;
  TaskModel? get currentTask => _currentTask;
  bool get isLoading => _isLoading;
  String? get error => _error;

  // Filtered task lists
  List<TaskModel> get pendingTasks => 
      _tasks.where((task) => task.status == TaskStatus.pending).toList();
  
  List<TaskModel> get inProgressTasks => 
      _tasks.where((task) => task.status == TaskStatus.inProgress).toList();
  
  List<TaskModel> get completedTasks => 
      _tasks.where((task) => task.status == TaskStatus.completed).toList();
  
  List<TaskModel> get cancelledTasks => 
      _tasks.where((task) => task.status == TaskStatus.cancelled).toList();

  void _setLoading(bool loading) {
    _isLoading = loading;
    notifyListeners();
  }

  void _setError(String? error) {
    _error = error;
    notifyListeners();
  }

  void clearError() {
    _error = null;
    notifyListeners();
  }

 /// Fetch tasks from API
Future<void> fetchTasks({bool assignedToMe = true}) async {
  _setLoading(true);
  _setError(null);

  try {
    print('=== FETCH TASKS DEBUG ===');
    final token = await StorageService.instance.getToken();
    print('Stored token exists: ${token != null}');
    if (token != null) {
      print('Token preview: ${token.substring(0, min(20, token.length))}...');
    }
    
    final response = await _apiService.getTasks(assignedToMe: assignedToMe);
    
    print('Tasks Response Status: ${response.statusCode}');
    print('Tasks Response Headers: ${response.headers}');
    print('Tasks Response Body: ${response.body}');
    
    if (response.statusCode == 200) {
      final List<dynamic> tasksJson = json.decode(response.body);
      _tasks = tasksJson.map((json) => TaskModel.fromJson(json)).toList();
      
      print('Successfully loaded ${_tasks.length} tasks');
      
      // Update current task if exists
      _updateCurrentTask();
      
      // Save to local storage
      await StorageService.instance.saveTasks(_tasks);
    } else if (response.statusCode == 401) {
      print('Authentication failed - token expired or invalid');
      _setError('Authentication expired. Please login again.');
      
      // Clear invalid token
      await StorageService.instance.deleteToken();
    } else {
      print('Failed to fetch tasks with status: ${response.statusCode}');
      _setError('Failed to fetch tasks');
      // Load from cache on error
      await _loadTasksFromCache();
    }
  } catch (e) {
    print('Fetch tasks exception: $e');
    _setError('Network error: ${e.toString()}');
    // Load from cache on error
    await _loadTasksFromCache();
  } finally {
    _setLoading(false);
  }
}

  /// Load tasks from local cache
  Future<void> _loadTasksFromCache() async {
    try {
      _tasks = await StorageService.instance.getTasks();
      _updateCurrentTask();
    } catch (e) {
      debugPrint('Error loading tasks from cache: $e');
    }
  }

  /// Update current active task
  void _updateCurrentTask() {
    try {
      _currentTask = _tasks.firstWhere(
        (task) => task.status == TaskStatus.inProgress,
      );
    } catch (e) {
      _currentTask = null;
    }
  }

  /// Get specific task details
  Future<TaskModel?> getTask(int taskId) async {
    try {
      final response = await _apiService.getTask(taskId);
      
      if (response.statusCode == 200) {
        final taskJson = json.decode(response.body);
        final task = TaskModel.fromJson(taskJson);
        
        // Update in local list if exists
        final index = _tasks.indexWhere((t) => t.id == taskId);
        if (index != -1) {
          _tasks[index] = task;
          notifyListeners();
        }
        
        return task;
      }
    } catch (e) {
      _setError('Failed to fetch task details: ${e.toString()}');
    }
    
    return null;
  }

 Future<bool> startTask(int taskId, Map<String, dynamic> locationData) async {
  _setLoading(true);
  _setError(null);

  try {
    final response = await _apiService.startTask(taskId, locationData);
    
    if (response.statusCode == 200) {
      final taskJson = json.decode(response.body);
      final updatedTask = TaskModel.fromJson(taskJson);
      
      // Update task in list
      final index = _tasks.indexWhere((t) => t.id == taskId);
      if (index != -1) {
        _tasks[index] = updatedTask;
        _updateCurrentTask();
        
        // Save to cache
        await StorageService.instance.saveTasks(_tasks);
      }
      
      // ✅ FIX: Just set loading to false directly, no need for postFrameCallback
      _setLoading(false);
      return true;
    } else {
      final errorData = json.decode(response.body);
      _setError(errorData['message'] ?? 'Failed to start task');
      _setLoading(false);  // Add this
    }
  } catch (e) {
    print('StartTask parsing error: $e');
    _setError('Network error: ${e.toString()}');
    await _saveTaskStartOffline(taskId, locationData);
    _setLoading(false);  // Add this
  }
  
  return false;
}

  /// Complete a task
  Future<bool> completeTask(
    int taskId, 
    Map<String, dynamic> completionData, {
    Uint8List? signatureBytes,
    List<File>? photos,
  }) async {
    _setLoading(true);
    _setError(null);

    try {
      // First, complete the task
      final response = await _apiService.completeTask(taskId, completionData);
      
      if (response.statusCode == 200) {
        // Upload signature if provided
        if (signatureBytes != null) {
          await _apiService.uploadSignature(taskId, signatureBytes);
        }
        
        // Upload photos if provided
        if (photos != null) {
          for (final photo in photos) {
            await _apiService.uploadPhoto(taskId, photo.path);
          }
        }
        
        // Update local task
        final taskJson = json.decode(response.body);
        final updatedTask = TaskModel.fromJson(taskJson);
        
        final index = _tasks.indexWhere((t) => t.id == taskId);
        if (index != -1) {
          _tasks[index] = updatedTask;
          _updateCurrentTask();
          
          // Save to cache
          await StorageService.instance.saveTasks(_tasks);
        }
        
        _setLoading(false);
        return true;
      } else {
        final errorData = json.decode(response.body);
        _setError(errorData['message'] ?? 'Failed to complete task');
      }
    } catch (e) {
      _setError('Network error: ${e.toString()}');
      
      // Save offline for later sync
      await _saveTaskCompletionOffline(
        taskId, 
        completionData, 
        signatureBytes: signatureBytes, 
        photos: photos,
      );
    } finally {
      _setLoading(false);
    }
    
    return false;
  }

  /// Save task start for offline sync
  Future<void> _saveTaskStartOffline(int taskId, Map<String, dynamic> locationData) async {
    try {
      // Update local task status
      final index = _tasks.indexWhere((t) => t.id == taskId);
      if (index != -1) {
        _tasks[index] = _tasks[index].copyWith(
          status: TaskStatus.inProgress,
          startedAt: DateTime.now(),
        );
        _updateCurrentTask();
        notifyListeners();
      }
      
      // Save for later sync
      final offlineData = {
        'action': 'start_task',
        'task_id': taskId,
        'location_data': locationData,
        'timestamp': DateTime.now().toIso8601String(),
      };
      
      await StorageService.instance.saveLocationLog(offlineData);
    } catch (e) {
      debugPrint('Error saving offline task start: $e');
    }
  }

  /// Save task completion for offline sync
  Future<void> _saveTaskCompletionOffline(
    int taskId, 
    Map<String, dynamic> completionData, {
    Uint8List? signatureBytes,
    List<File>? photos,
  }) async {
    try {
      // Update local task status
      final index = _tasks.indexWhere((t) => t.id == taskId);
      if (index != -1) {
        _tasks[index] = _tasks[index].copyWith(
          status: TaskStatus.completed,
          completedAt: DateTime.now(),
          completionNotes: completionData['completion_notes'],
          qualityRating: completionData['quality_rating'],
        );
        _updateCurrentTask();
        notifyListeners();
      }
      
      // Save completion data for later sync
      await StorageService.instance.saveTaskCompletionData(taskId, {
        ...completionData,
        'has_signature': signatureBytes != null,
        'photos_count': photos?.length ?? 0,
      });
      
      // TODO: Save signature and photos to local storage for later upload
      
    } catch (e) {
      debugPrint('Error saving offline task completion: $e');
    }
  }

  /// Sync offline data when network is available
  Future<void> syncOfflineData() async {
    try {
      // Sync location logs
      final unsyncedLogs = await StorageService.instance.getUnsyncedLocationLogs();
      for (final log in unsyncedLogs) {
        try {
          if (log['action'] == 'start_task') {
            final response = await _apiService.startTask(
              log['task_id'], 
              log['location_data'],
            );
            if (response.statusCode == 200) {
              await StorageService.instance.markLocationLogSynced(log['id']);
            }
          } else {
            // Regular location log
            final response = await _apiService.logLocation(log);
            if (response.statusCode == 200) {
              await StorageService.instance.markLocationLogSynced(log['id']);
            }
          }
        } catch (e) {
          debugPrint('Error syncing log ${log['id']}: $e');
        }
      }
      
      // Sync completion data
      final unsyncedCompletions = await StorageService.instance.getUnsyncedCompletionData();
      for (final completion in unsyncedCompletions) {
        try {
          final response = await _apiService.completeTask(
            completion['task_id'], 
            completion,
          );
          if (response.statusCode == 200) {
            await StorageService.instance.markCompletionDataSynced(
              completion['task_id'],
            );
          }
        } catch (e) {
          debugPrint('Error syncing completion ${completion['task_id']}: $e');
        }
      }
      
      // Refresh tasks after sync
      await fetchTasks();
      
    } catch (e) {
      debugPrint('Error during offline sync: $e');
    }
  }

  /// Filter tasks by status
  List<TaskModel> getTasksByStatus(TaskStatus status) {
    return _tasks.where((task) => task.status == status).toList();
  }

  /// Filter tasks by priority
  List<TaskModel> getTasksByPriority(TaskPriority priority) {
    return _tasks.where((task) => task.priority == priority).toList();
  }

  /// Get overdue tasks
  List<TaskModel> get overdueTasks {
    return _tasks.where((task) => task.isOverdue).toList();
  }

  /// Search tasks by title or description
  List<TaskModel> searchTasks(String query) {
    if (query.isEmpty) return _tasks;
    
    final lowercaseQuery = query.toLowerCase();
    return _tasks.where((task) {
      return task.title.toLowerCase().contains(lowercaseQuery) ||
             (task.description?.toLowerCase().contains(lowercaseQuery) ?? false) ||
             task.locationName?.toLowerCase().contains(lowercaseQuery) == true;
    }).toList();
  }

  /// Sort tasks by different criteria
  void sortTasks(String sortBy, {bool ascending = true}) {
    switch (sortBy) {
      case 'title':
        _tasks.sort((a, b) => ascending 
            ? a.title.compareTo(b.title)
            : b.title.compareTo(a.title));
        break;
      case 'due_date':
        _tasks.sort((a, b) {
          if (a.dueDate == null && b.dueDate == null) return 0;
          if (a.dueDate == null) return ascending ? 1 : -1;
          if (b.dueDate == null) return ascending ? -1 : 1;
          return ascending 
              ? a.dueDate!.compareTo(b.dueDate!)
              : b.dueDate!.compareTo(a.dueDate!);
        });
        break;
      case 'priority':
        _tasks.sort((a, b) => ascending 
            ? a.priority.index.compareTo(b.priority.index)
            : b.priority.index.compareTo(a.priority.index));
        break;
      case 'status':
        _tasks.sort((a, b) => ascending 
            ? a.status.index.compareTo(b.status.index)
            : b.status.index.compareTo(a.status.index));
        break;
      case 'created_at':
        _tasks.sort((a, b) => ascending 
            ? a.createdAt.compareTo(b.createdAt)
            : b.createdAt.compareTo(a.createdAt));
        break;
    }
    notifyListeners();
  }

  /// Refresh tasks (pull to refresh)
  Future<void> refreshTasks() async {
    await fetchTasks();
  }
}