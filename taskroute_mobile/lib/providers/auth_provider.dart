import 'package:flutter/foundation.dart';
import 'dart:convert';
import '../models/user_model.dart';
import '../services/api_service.dart';
import '../services/storage_service.dart';

class AuthProvider with ChangeNotifier {
  final ApiService _apiService = ApiService();
  
  UserModel? _user;
  bool _isLoading = false;
  bool _isAuthenticated = false;
  String? _error;

  // Getters
  UserModel? get user => _user;
  bool get isLoading => _isLoading;
  bool get isAuthenticated => _isAuthenticated;
  String? get error => _error;

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

  /// Check authentication status on app start
  Future<void> checkAuthStatus() async {
    _setLoading(true);
    
    try {
      final token = await StorageService.instance.getToken();
      if (token == null) {
        _isAuthenticated = false;
        _setLoading(false);
        return;
      }

      // Set token in API service
      _apiService.setAuthToken(token);

      // Validate token by fetching current user
      final response = await _apiService.getCurrentUser();
      
      if (response.statusCode == 200) {
        final userData = json.decode(response.body);
        _user = UserModel.fromJson(userData);
        _isAuthenticated = true;
        
        // Save user data locally
        await StorageService.instance.setUserData(userData);
      } else {
        // Token is invalid, clear it
        await _logout(clearRemoteSession: false);
      }
    } catch (e) {
      // Network error, try to load cached user data
      final cachedUser = await StorageService.instance.getUserData();
      if (cachedUser != null) {
        _user = cachedUser;
        _isAuthenticated = true;
      } else {
        _isAuthenticated = false;
      }
      _setError('Unable to verify authentication: ${e.toString()}');
    } finally {
      _setLoading(false);
    }
  }

  /// Login with email and password
Future<bool> login(String email, String password) async {
  _setLoading(true);
  _setError(null);

  try {
    print('=== LOGIN DEBUG ===');
    print('Email: $email');
    
    final response = await _apiService.login(email, password);
    
    print('Login Response Status Code: ${response.statusCode}');
    print('Login Response Body: ${response.body}');
    
    if (response.statusCode == 200) {
      final responseData = json.decode(response.body);
      final token = responseData['access_token'];
      final userData = responseData['user']; // This should now exist with your updated FastAPI
      
      print('Token received: ${token != null}');
      print('User data received: ${userData != null}');

      // Save token and user data
      await StorageService.instance.setToken(token);
      await StorageService.instance.setUserData(userData);
      
      print('Token saved successfully');
      
      // Set token in API service
      _apiService.setAuthToken(token);
      
      // Update state
      _user = UserModel.fromJson(userData);
      _isAuthenticated = true;
      
      _setLoading(false);
      return true;
    } else if (response.statusCode == 401) {
      _setError('Invalid email or password');
    } else if (response.statusCode == 400) {
      final errorData = json.decode(response.body);
      _setError(errorData['message'] ?? 'Invalid request');
    } else {
      _setError('Login failed. Please try again.');
    }
  } catch (e) {
    print('Login Exception: $e');
    _setError('Network error: ${e.toString()}');
  } finally {
    _setLoading(false);
  }
  
  return false;
}

  /// Logout user
  Future<void> logout() async {
    await _logout(clearRemoteSession: true);
  }

  Future<void> _logout({required bool clearRemoteSession}) async {
    _setLoading(true);

    try {
      if (clearRemoteSession) {
        // TODO: Call logout endpoint if available
        // await _apiService.logout();
      }
    } catch (e) {
      // Ignore logout API errors, still clear local data
      debugPrint('Logout API error: $e');
    }

    // Clear local storage
    await StorageService.instance.clearAll();
    
    // Clear API service token
    _apiService.clearAuthToken();
    
    // Update state
    _user = null;
    _isAuthenticated = false;
    _error = null;
    
    _setLoading(false);
  }

  /// Refresh user data
  Future<void> refreshUser() async {
    if (!_isAuthenticated) return;

    try {
      final response = await _apiService.getCurrentUser();
      
      if (response.statusCode == 200) {
        final userData = json.decode(response.body);
        _user = UserModel.fromJson(userData);
        await StorageService.instance.setUserData(userData);
        notifyListeners();
      } else if (response.statusCode == 401) {
        // Token expired, logout
        await _logout(clearRemoteSession: false);
      }
    } catch (e) {
      _setError('Failed to refresh user data: ${e.toString()}');
    }
  }

  /// Update user profile
  Future<bool> updateProfile(Map<String, dynamic> profileData) async {
    if (!_isAuthenticated) return false;

    _setLoading(true);
    _setError(null);

    try {
      // TODO: Implement update profile API call
      // final response = await _apiService.updateProfile(profileData);
      
      // For now, just update local data
      final updatedUserData = {
        ..._user!.toJson(),
        ...profileData,
      };
      
      _user = UserModel.fromJson(updatedUserData);
      await StorageService.instance.setUserData(updatedUserData);
      
      _setLoading(false);
      return true;
    } catch (e) {
      _setError('Failed to update profile: ${e.toString()}');
      _setLoading(false);
      return false;
    }
  }

  /// Register new user
Future<bool> register({
  required String email,
  required String password,
  required String fullName,
  required String username,
}) async {
  _setLoading(true);
  _setError(null);

  try {
    print('=== REGISTRATION DEBUG ===');
    print('Email: $email');
    print('Username: $username');
    print('Full Name: $fullName');
    print('Password length: ${password.length}');

    final response = await _apiService.register(
      email: email,
      password: password,
      fullName: fullName,
      username: username,
    );

    print('Response Status Code: ${response.statusCode}');
    print('Response Headers: ${response.headers}');
    print('Response Body: ${response.body}');

    if (response.statusCode == 201 || response.statusCode == 200) {
      final responseData = json.decode(response.body);
      
      // Check if response contains token and user data for auto-login
      if (responseData.containsKey('access_token') && responseData.containsKey('user')) {
        final token = responseData['access_token'];
        final userData = responseData['user'];

        // Save token and user data for auto-login
        await StorageService.instance.setToken(token);
        await StorageService.instance.setUserData(userData);
        
        // Set token in API service
        _apiService.setAuthToken(token);
        
        // Update state
        _user = UserModel.fromJson(userData);
        _isAuthenticated = true;
      } else {
        // Registration successful but no auto-login (user needs to login manually)
        print('Registration successful, user needs to login');
        // Note: User account was created successfully
      }
      
      _setLoading(false);
      return true; // Registration was successful
    } else if (response.statusCode == 400) {
      final errorData = json.decode(response.body);
      _setError(errorData['message'] ?? 'Registration failed');
    } else if (response.statusCode == 409) {
      _setError('Email or username already exists');
    } else {
      print('Registration failed with status: ${response.statusCode}');
      final errorData = json.decode(response.body);
      _setError(errorData['message'] ?? 'Registration failed');
    }
  } catch (e) {
    print('Registration Exception: $e');
    _setError('Network error: ${e.toString()}');
  } finally {
    _setLoading(false);
  }
  
  return false;
}

  /// Change password
  Future<bool> changePassword(String currentPassword, String newPassword) async {
    if (!_isAuthenticated) return false;

    _setLoading(true);
    _setError(null);

    try {
      // TODO: Implement change password API call
      // final response = await _apiService.changePassword(currentPassword, newPassword);
      
      _setLoading(false);
      return true;
    } catch (e) {
      _setError('Failed to change password: ${e.toString()}');
      _setLoading(false);
      return false;
    }
  }
}