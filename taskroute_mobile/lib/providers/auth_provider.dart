import 'package:flutter/foundation.dart';
import 'dart:convert';
import 'package:http/http.dart' as http;
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
        final userData = responseData['user']; 
        
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

  /// Refresh user data from server
  Future<bool> refreshUser() async {
    try {
      final token = await StorageService.instance.getToken();
      
      if (token == null || _user == null) {
        return false;
      }

      final response = await http.get(
        Uri.parse('${ApiService.baseUrl}/users/${_user!.id}'),
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
      );

      if (response.statusCode == 200) {
        final userData = json.decode(response.body);
        _user = UserModel.fromJson(userData);
        notifyListeners();
        
        // Save to storage
        await StorageService.instance.setUserData(userData);
        return true;
      } else if (response.statusCode == 401) {
        // Token expired, logout
        await _logout(clearRemoteSession: false);
      }
      return false;
    } catch (e) {
      _setError('Failed to refresh user data: ${e.toString()}');
      return false;
    }
  }

  /// Update user profile
  Future<bool> updateProfile(Map<String, dynamic> updateData) async {
    _setLoading(true);
    _setError(null);
    notifyListeners();

    try {
      final token = await StorageService.instance.getToken();
      
      if (token == null || _user == null) {
        _setError('Not authenticated');
        _setLoading(false);
        return false;
      }

      final response = await http.put(
        Uri.parse('${ApiService.baseUrl}/users/${_user!.id}/profile'),
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
        body: json.encode(updateData),
      );

      if (response.statusCode == 200) {
        final responseData = json.decode(response.body);
        
        // Update local user data
        if (responseData['user'] != null) {
          _user = UserModel.fromJson(responseData['user']);
        } else {
          // Fallback: refresh user data
          await refreshUser();
        }
        
        // Save updated data to storage
        if (_user != null) {
          await StorageService.instance.setUserData(_user!.toJson());
        }

        notifyListeners();
        _setLoading(false);
        return true;
      } else {
        final errorData = json.decode(response.body);
        _setError(errorData['detail'] ?? 'Failed to update profile');
        _setLoading(false);
        return false;
      }
    } catch (e) {
      _setError('Failed to update profile: ${e.toString()}');
      _setLoading(false);
      return false;
    }
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

  // Add this inside AuthProvider class
  Future<bool> resetPassword(String token, String newPassword) async {
    _setLoading(true);
    _setError(null);
    notifyListeners();

    try {
      final response = await http.post(
        Uri.parse('${ApiService.baseUrl}/auth/reset-password'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({
          'token': token,
          'new_password': newPassword
        }),
      );

      if (response.statusCode == 200) {
        _setLoading(false);
        return true;
      } else {
        final errorData = json.decode(response.body);
        _setError(errorData['detail'] ?? 'Failed to reset password');
        _setLoading(false);
        return false;
      }
    } catch (e) {
      _setError('Network error: ${e.toString()}');
      _setLoading(false);
      return false;
    }
  }

  // ✅ ADDED: Forgot Password Method
  Future<bool> forgotPassword(String email) async {
    _setLoading(true);
    _setError(null);
    notifyListeners();

    try {
      // We use direct http here to match the pattern in updateProfile
      // This targets the FastAPI endpoint: router.post("/forgot-password")
      final response = await http.post(
        Uri.parse('${ApiService.baseUrl}/auth/forgot-password'),
        headers: {
          'Content-Type': 'application/json',
        },
        body: json.encode({'email': email}),
      );

      // FastAPI returns 200 OK with a message
      if (response.statusCode == 200) {
        _setLoading(false);
        notifyListeners();
        return true;
      } else {
        // Parse error message
        try {
          final errorData = json.decode(response.body);
          _setError(errorData['detail'] ?? 'Failed to send reset link');
        } catch (_) {
          _setError('An error occurred. Please try again.');
        }
        _setLoading(false);
        return false;
      }
    } catch (e) {
      _setError('Network error: ${e.toString()}');
      _setLoading(false);
      return false;
    }
  }
}