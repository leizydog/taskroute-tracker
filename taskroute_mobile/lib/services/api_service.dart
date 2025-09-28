import 'package:http/http.dart' as http;
import 'dart:convert';

class ApiService {
  static const String baseUrl = 'http://10.0.2.2:8000';
  
  // Singleton pattern
  static final ApiService _instance = ApiService._internal();
  static ApiService get instance => _instance;
  ApiService._internal();
  
  // Factory constructor to return the singleton
  factory ApiService() => _instance;
  
  String? _authToken;

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

  // Location endpoints
  Future<http.Response> logLocation(Map<String, dynamic> locationData) async {
    final response = await http.post(
      Uri.parse('$baseUrl/locations/log'),
      headers: _headers,
      body: json.encode(locationData),
    );
    
    return response;
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

  // File upload endpoints (for signatures and photos)
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

  // Health check
  Future<http.Response> healthCheck() async {
    final response = await http.get(
      Uri.parse('$baseUrl/health'),
      headers: _headers,
    );
    
    return response;
  }

  /// Register new user
  Future<http.Response> register({
    required String email,
    required String password,
    required String fullName,
    required String username,
  }) async {
    print('=== API SERVICE DEBUG ===');
    print('Base URL: $baseUrl');
    print('Full URL: $baseUrl/auth/register');
    
    final headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    print('Headers: $headers');

    final body = json.encode({
      'email': email,
      'password': password,
      'full_name': fullName,
      'username': username,
    });
    
    print('Request Body: $body');

    final url = Uri.parse('$baseUrl/auth/register');
    
    try {
      final response = await http.post(
        url,
        headers: headers,
        body: body,
      ).timeout(const Duration(seconds: 30));
      
      print('API Response Status: ${response.statusCode}');
      print('API Response Headers: ${response.headers}');
      print('API Response Body: ${response.body}');
      
      return response;
    } catch (e) {
      print('API Request Exception: $e');
      rethrow;
    }
  }
}