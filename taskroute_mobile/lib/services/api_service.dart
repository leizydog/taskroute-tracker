import 'package:http/http.dart' as http;
import 'dart:convert';
import 'storage_service.dart';

class ApiService {
  // ✅ Base URL with /api/v1
  static const String baseUrl = 'http://192.168.102.8:8000/api/v1';

  // Singleton pattern
  static final ApiService _instance = ApiService._internal();
  static ApiService get instance => _instance;
  ApiService._internal();
  
  // Factory constructor to return the singleton
  factory ApiService() => _instance;
  
  String? _authToken;

  Future<void> initializeAuthToken() async {
    final token = await StorageService.instance.getToken();
    if (token != null) {
      setAuthToken(token);
    } else {
      print('ApiService initialized but no token found in secure storage.');
    }
  }

  void setAuthToken(String token) {
    _authToken = token;
    print('Token set in ApiService: ${token.substring(0, 20)}...');
  }

  void clearAuthToken() {
    _authToken = null;
  }

  Map<String, String> get _headers {
    final headers = <String, String>{
      'Content-Type': 'application/json',
    };
    
    if (_authToken != null) {
      headers['Authorization'] = 'Bearer $_authToken';
      print('Authorization header added: Bearer ${_authToken!.substring(0, 20)}...');
    } else {
      print('No auth token available for headers');
    }
    
    return headers;
  }

  // Authentication endpoints
  Future<http.Response> login(String email, String password) async {
    print('=== LOGIN API SERVICE DEBUG ===');
    print('Base URL: $baseUrl');
    print('Full URL: $baseUrl/auth/login-json');
    
    final body = json.encode({
      'email': email,
      'password': password,
    });
    
    print('Login Request Body: $body');
    
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/auth/login-json'),
        headers: _headers,
        body: body,
      );
      
      print('Login API Response Status: ${response.statusCode}');
      print('Login API Response Body: ${response.body}');
      
      return response;
    } catch (e) {
      print('Login API Request Exception: $e');
      rethrow;
    }
  }

  Future<http.Response> getCurrentUser() async {
    final response = await http.get(
      Uri.parse('$baseUrl/auth/me'),
      headers: _headers,
    );
    
    return response;
  }

  // ✅ Profile Management (Added)
  Future<http.Response> updateProfile(int userId, Map<String, dynamic> profileData) async {
    print('=== UPDATE PROFILE API DEBUG ===');
    print('User ID: $userId');
    print('Data: $profileData');
    
    try {
      final response = await http.put(
        Uri.parse('$baseUrl/users/$userId/profile'),
        headers: _headers,
        body: json.encode(profileData),
      );
      
      print('Update Profile Response Status: ${response.statusCode}');
      return response;
    } catch (e) {
      print('Update Profile Exception: $e');
      rethrow;
    }
  }

  // Task endpoints
  Future<http.Response> getTasks({bool assignedToMe = false}) async {
    print('=== GET TASKS API DEBUG ===');
    print('Base URL: $baseUrl');
    
    String url = '$baseUrl/tasks/';
    
    if (assignedToMe) {
      url += '?assigned_to_me=true';
    }
    
    print('Request URL: $url');
    print('Headers being sent: $_headers');
    
    try {
      final response = await http.get(
        Uri.parse(url),
        headers: _headers,
      );
      
      print('GET tasks API response status: ${response.statusCode}');
      print('GET tasks API response headers: ${response.headers}');
      print('GET tasks API response body: ${response.body}');
      
      return response;
    } catch (e) {
      print('GET tasks API exception: $e');
      rethrow;
    }
  }

  Future<http.Response> getTask(int taskId) async {
    final response = await http.get(
      Uri.parse('$baseUrl/tasks/$taskId'),
      headers: _headers,
    );
    
    return response;
  }

  Future<http.Response> startTask(int taskId, Map<String, dynamic> locationData) async {
    print('=== START TASK API DEBUG ===');
    print('Task ID: $taskId');
    print('Location Data: $locationData');
    print('URL: $baseUrl/tasks/$taskId/start');
    print('Headers: $_headers');
    
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/tasks/$taskId/start'),
        headers: _headers,
        body: json.encode(locationData),
      );
      
      print('Start Task API Response Status: ${response.statusCode}');
      print('Start Task API Response Body: ${response.body}');
      
      return response;
    } catch (e) {
      print('Start Task API Exception: $e');
      rethrow;
    }
  }

  Future<http.Response> completeTask(int taskId, Map<String, dynamic> completionData) async {
    final response = await http.post(
      Uri.parse('$baseUrl/tasks/$taskId/complete'),
      headers: _headers,
      body: json.encode(completionData),
    );
    
    return response;
  }

  Future<http.Response> cancelTask(int taskId, String reason) async {
    print('=== CANCEL TASK API DEBUG ===');
    print('Task ID: $taskId');
    print('Reason: $reason');
    
    final response = await http.post(
      Uri.parse('$baseUrl/tasks/$taskId/cancel'), 
      headers: _headers,
      body: json.encode({'cancellation_reason': reason}), 
    );
    
    return response;
  }

  // Location endpoints
  Future<http.Response> logLocation(Map<String, dynamic> locationData) async {
    print('=== LOG LOCATION API DEBUG ===');
    print('Location Data: $locationData');
    print('URL: $baseUrl/locations/');
    print('Headers: $_headers');
    
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/locations/'),
        headers: _headers,
        body: json.encode(locationData),
      );
      
      print('Log Location API Response Status: ${response.statusCode}');
      print('Log Location API Response Body: ${response.body}');
      
      return response;
    } catch (e) {
      print('Log Location API Exception: $e');
      rethrow;
    }
  }

  Future<http.Response> getLocationHistory({int? taskId, int limit = 100}) async {
    String url = '$baseUrl/locations/?limit=$limit';
    
    if (taskId != null) {
      url += '&task_id=$taskId';
    }
    
    final response = await http.get(
      Uri.parse(url),
      headers: _headers,
    );
    
    return response;
  }

  // File upload endpoints
  Future<http.Response> uploadSignature(int taskId, List<int> signatureBytes) async {
    final request = http.MultipartRequest(
      'POST',
      Uri.parse('$baseUrl/tasks/$taskId/signature'),
    );
    
    request.headers.addAll(_headers);
    request.files.add(
      http.MultipartFile.fromBytes(
        'signature',
        signatureBytes,
        filename: 'signature_$taskId.png',
      ),
    );
    
    final streamedResponse = await request.send();
    return await http.Response.fromStream(streamedResponse);
  }

  Future<http.Response> uploadPhoto(int taskId, String filePath) async {
    final request = http.MultipartRequest(
      'POST',
      Uri.parse('$baseUrl/tasks/$taskId/photo'),
    );
    
    request.headers.addAll(_headers);
    request.files.add(
      await http.MultipartFile.fromPath('photo', filePath),
    );
    
    final streamedResponse = await request.send();
    return await http.Response.fromStream(streamedResponse);
  }

  Future<http.Response> acceptTask(int taskId) async {
    final response = await http.post(
      Uri.parse('$baseUrl/tasks/$taskId/accept'),
      headers: _headers,
    );
    return response;
  }

  Future<http.Response> declineTask(int taskId) async {
    final response = await http.post(
      Uri.parse('$baseUrl/tasks/$taskId/decline'),
      headers: _headers,
    );
    return response;
  }

  // Health check
  Future<http.Response> healthCheck() async {
    final response = await http.get(
      Uri.parse('$baseUrl/health'),
      headers: _headers,
    );
    
    return response;
  }
}