import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'dart:convert';
import '../models/task_model.dart';
import '../models/user_model.dart';


class StorageService {
  static final StorageService _instance = StorageService._internal();
  static StorageService get instance => _instance;
  
  StorageService._internal();

  late SharedPreferences _prefs;
  static const FlutterSecureStorage _secureStorage = FlutterSecureStorage(
  aOptions: AndroidOptions(
    encryptedSharedPreferences: true,
  ),
  iOptions: IOSOptions(
    accessibility: KeychainAccessibility.first_unlock_this_device,
  ),
);

  Future<void> init() async {
    _prefs = await SharedPreferences.getInstance();
  }

  // Secure token storage
  Future<void> setToken(String token) async {
    await _secureStorage.write(key: 'auth_token', value: token);
  }

  Future<String?> getToken() async {
    return await _secureStorage.read(key: 'auth_token');
  }

  Future<void> deleteToken() async {
    await _secureStorage.delete(key: 'auth_token');
  }

  // User data storage
  Future<void> setUserData(Map<String, dynamic> userData) async {
    await _prefs.setString('user_data', json.encode(userData));
  }

  Future<UserModel?> getUserData() async {
    final userDataString = _prefs.getString('user_data');
    if (userDataString != null) {
      final userData = json.decode(userDataString);
      return UserModel.fromJson(userData);
    }
    return null;
  }

  // Task storage
  Future<void> saveTasks(List<TaskModel> tasks) async {
    final tasksJson = tasks.map((task) => task.toJson()).toList();
    await _prefs.setString('tasks', json.encode(tasksJson));
    await _prefs.setString('tasks_last_sync', DateTime.now().toIso8601String());
  }

  Future<List<TaskModel>> getTasks() async {
    final tasksString = _prefs.getString('tasks');
    if (tasksString != null) {
      final List<dynamic> tasksJson = json.decode(tasksString);
      return tasksJson.map((json) => TaskModel.fromJson(json)).toList();
    }
    return [];
  }

  Future<DateTime?> getLastTaskSync() async {
    final lastSyncString = _prefs.getString('tasks_last_sync');
    if (lastSyncString != null) {
      return DateTime.parse(lastSyncString);
    }
    return null;
  }

  // Location logs storage (for offline sync)
  Future<void> saveLocationLog(Map<String, dynamic> locationLog) async {
    final logs = await getLocationLogs();
    locationLog['id'] = DateTime.now().millisecondsSinceEpoch.toString();
    logs.add(locationLog);
    await _prefs.setString('location_logs', json.encode(logs));
  }

  Future<List<Map<String, dynamic>>> getLocationLogs() async {
    final logsString = _prefs.getString('location_logs');
    if (logsString != null) {
      final List<dynamic> logsJson = json.decode(logsString);
      return logsJson.cast<Map<String, dynamic>>();
    }
    return [];
  }

  Future<List<Map<String, dynamic>>> getUnsyncedLocationLogs() async {
    final logs = await getLocationLogs();
    return logs.where((log) => log['synced'] != true).toList();
  }

  Future<void> markLocationLogSynced(String logId) async {
    final logs = await getLocationLogs();
    final index = logs.indexWhere((log) => log['id'] == logId);
    if (index != -1) {
      logs[index]['synced'] = true;
      await _prefs.setString('location_logs', json.encode(logs));
    }
  }

  // Task completion data storage
  Future<void> saveTaskCompletionData(int taskId, Map<String, dynamic> completionData) async {
    completionData['task_id'] = taskId;
    completionData['completed_at'] = DateTime.now().toIso8601String();
    completionData['synced'] = false;
    
    final completions = await getTaskCompletions();
    completions.add(completionData);
    await _prefs.setString('task_completions', json.encode(completions));
  }

  Future<List<Map<String, dynamic>>> getTaskCompletions() async {
    final completionsString = _prefs.getString('task_completions');
    if (completionsString != null) {
      final List<dynamic> completionsJson = json.decode(completionsString);
      return completionsJson.cast<Map<String, dynamic>>();
    }
    return [];
  }

  Future<List<Map<String, dynamic>>> getUnsyncedCompletionData() async {
    final completions = await getTaskCompletions();
    return completions.where((completion) => completion['synced'] != true).toList();
  }

  Future<void> markCompletionDataSynced(int taskId) async {
    final completions = await getTaskCompletions();
    final index = completions.indexWhere((completion) => completion['task_id'] == taskId);
    if (index != -1) {
      completions[index]['synced'] = true;
      await _prefs.setString('task_completions', json.encode(completions));
    }
  }

  // App settings
  Future<void> setBool(String key, bool value) async {
    await _prefs.setBool(key, value);
  }

  Future<bool> getBool(String key, {bool defaultValue = false}) async {
    return _prefs.getBool(key) ?? defaultValue;
  }

  Future<void> setString(String key, String value) async {
    await _prefs.setString(key, value);
  }

  Future<String?> getString(String key) async {
    return _prefs.getString(key);
  }

  Future<void> setInt(String key, int value) async {
    await _prefs.setInt(key, value);
  }

  Future<int?> getInt(String key) async {
    return _prefs.getInt(key);
  }

  // Clear all data (logout)
  Future<void> clearAll() async {
    await _secureStorage.deleteAll();
    await _prefs.clear();
  }

  // App preferences
  Future<void> setLocationTrackingEnabled(bool enabled) async {
    await setBool('location_tracking_enabled', enabled);
  }

  Future<bool> isLocationTrackingEnabled() async {
    return getBool('location_tracking_enabled', defaultValue: true);
  }

  Future<void> setNotificationsEnabled(bool enabled) async {
    await setBool('notifications_enabled', enabled);
  }

  // Store current active task ID
Future<void> setCurrentTaskId(int? taskId) async {
  if (taskId == null) {
    await _prefs.remove('current_task_id');
  } else {
    await _prefs.setInt('current_task_id', taskId);
  }
}

// Get current active task ID
Future<int?> getCurrentTaskId() async {
  return _prefs.getInt('current_task_id');
}

  Future<bool> areNotificationsEnabled() async {
    return getBool('notifications_enabled', defaultValue: true);
  }

  Future<void> setOfflineModeEnabled(bool enabled) async {
    await setBool('offline_mode_enabled', enabled);
  }

  Future<bool> isOfflineModeEnabled() async {
    return getBool('offline_mode_enabled', defaultValue: true);
  }
}