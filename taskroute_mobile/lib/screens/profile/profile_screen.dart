// Update profile_screen.dart

import 'dart:io';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:image_picker/image_picker.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import '../../providers/auth_provider.dart';
import '../../providers/location_provider.dart';
import '../../services/storage_service.dart';
import '../../services/api_service.dart'; // ✅ ADD THIS
import '../settings/settings_screen.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  bool _isEditing = false;
  bool _isUploading = false;
  late TextEditingController _nameController;
  late TextEditingController _phoneController;
  File? _pickedImage;
  final _formKey = GlobalKey<FormState>();

  @override
  void initState() {
    super.initState();
    final user = Provider.of<AuthProvider>(context, listen: false).user;
    _nameController = TextEditingController(text: user?.displayName ?? '');
    _phoneController = TextEditingController(text: user?.phone ?? '');
  }

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  Future<void> _pickImage() async {
    if (!_isEditing) return;

    final ImagePicker picker = ImagePicker();
    try {
      final XFile? image = await picker.pickImage(
        source: ImageSource.gallery,
        maxWidth: 800,
        maxHeight: 800,
        imageQuality: 85,
      );
      
      if (image != null) {
        setState(() {
          _pickedImage = File(image.path);
        });
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error picking image: $e')),
        );
      }
    }
  }

  // ✅ FIXED: Upload avatar with correct endpoint
  Future<bool> _uploadAvatar() async {
    if (_pickedImage == null) return true;

    setState(() => _isUploading = true);

    try {
      final authProvider = Provider.of<AuthProvider>(context, listen: false);
      final user = authProvider.user;
      
      if (user == null) {
        throw Exception('User not logged in');
      }

      // ✅ FIX: Use ApiService.baseUrl which includes /api/v1 and correct IP
      final uri = Uri.parse('${ApiService.baseUrl}/users/${user.id}/avatar');
      final request = http.MultipartRequest('POST', uri);
      
      print('=== AVATAR UPLOAD DEBUG ===');
      print('Upload URI: $uri');
      
      // Get token from StorageService
      final token = await StorageService.instance.getToken();
      if (token != null) {
        request.headers['Authorization'] = 'Bearer $token';
        print('Token added to request');
      } else {
        print('WARNING: No token found!');
      }

      // Add file
      request.files.add(
        await http.MultipartFile.fromPath(
          'avatar',
          _pickedImage!.path,
        ),
      );
      
      print('File added to request: ${_pickedImage!.path}');

      // Send request
      print('Sending request...');
      final streamedResponse = await request.send();
      final response = await http.Response.fromStream(streamedResponse);

      print('Response Status: ${response.statusCode}');
      print('Response Body: ${response.body}');

      if (response.statusCode == 200) {
        // Update local user data
        await authProvider.refreshUser();
        
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Avatar uploaded successfully!')),
          );
        }
        
        return true;
      } else {
        throw Exception('Upload failed: ${response.body}');
      }
    } catch (e) {
      print('Avatar upload error: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to upload avatar: $e')),
        );
      }
      return false;
    } finally {
      if (mounted) {
        setState(() => _isUploading = false);
      }
    }
  }

  Future<void> _saveProfile() async {
    if (!_formKey.currentState!.validate()) return;

    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    
    // Step 1: Upload avatar if changed
    if (_pickedImage != null) {
      final avatarUploaded = await _uploadAvatar();
      if (!avatarUploaded) {
        final shouldContinue = await showDialog<bool>(
          context: context,
          builder: (context) => AlertDialog(
            title: const Text('Avatar Upload Failed'),
            content: const Text('Do you want to save other changes anyway?'),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context, false),
                child: const Text('Cancel'),
              ),
              TextButton(
                onPressed: () => Navigator.pop(context, true),
                child: const Text('Continue'),
              ),
            ],
          ),
        );
        
        if (shouldContinue != true) return;
      }
    }

    // Step 2: Update profile data (name, phone)
    Map<String, dynamic> updateData = {
      'full_name': _nameController.text.trim(),
      'phone': _phoneController.text.trim(),
    };

    final success = await authProvider.updateProfile(updateData);

    if (success && mounted) {
      setState(() {
        _isEditing = false;
        _pickedImage = null;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Profile updated successfully')),
      );
    } else if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(authProvider.error ?? 'Failed to update profile'),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Profile'),
        actions: [
          if (_isEditing)
            IconButton(
              icon: _isUploading 
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.save),
              onPressed: _isUploading ? null : _saveProfile,
              tooltip: 'Save Changes',
            )
          else
            IconButton(
              icon: const Icon(Icons.edit),
              onPressed: () {
                setState(() => _isEditing = true);
              },
              tooltip: 'Edit Profile',
            ),
          IconButton(
            icon: const Icon(Icons.settings),
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (context) => const SettingsScreen()),
              );
            },
            tooltip: 'Settings',
          ),
        ],
      ),
      body: Consumer<AuthProvider>(
        builder: (context, authProvider, _) {
          final user = authProvider.user;
          
          if (!_isEditing && user != null) {
            if (_nameController.text != user.displayName) {
              _nameController.text = user.displayName;
            }
            if (_phoneController.text != (user.phone ?? '')) {
              _phoneController.text = user.phone ?? '';
            }
          }

          return SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Form(
              key: _formKey,
              child: Column(
                children: [
                  const SizedBox(height: 20),
                  
                  // Avatar Section
                  Center(
                    child: Stack(
                      children: [
                        GestureDetector(
                          onTap: _isEditing ? _pickImage : null,
                          child: CircleAvatar(
                            radius: 60,
                            backgroundColor: Theme.of(context).primaryColor,
                            backgroundImage: _getAvatarImage(user),
                            child: _pickedImage == null && user?.avatarUrl == null
                                ? Text(
                                    user?.initials ?? 'U',
                                    style: const TextStyle(
                                      fontSize: 40,
                                      fontWeight: FontWeight.bold,
                                      color: Colors.white,
                                    ),
                                  )
                                : null,
                          ),
                        ),
                        if (_isEditing)
                          Positioned(
                            bottom: 0,
                            right: 0,
                            child: Container(
                              padding: const EdgeInsets.all(4),
                              decoration: BoxDecoration(
                                color: _isUploading ? Colors.grey : Colors.blue,
                                shape: BoxShape.circle,
                              ),
                              child: _isUploading
                                  ? const SizedBox(
                                      width: 20,
                                      height: 20,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                        color: Colors.white,
                                      ),
                                    )
                                  : const Icon(
                                      Icons.camera_alt,
                                      color: Colors.white,
                                      size: 20,
                                    ),
                            ),
                          ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 32),

                  // Name Field
                  TextFormField(
                    controller: _nameController,
                    enabled: _isEditing,
                    decoration: const InputDecoration(
                      labelText: 'Full Name',
                      prefixIcon: Icon(Icons.person),
                      border: OutlineInputBorder(),
                    ),
                    validator: (value) {
                      if (value == null || value.trim().isEmpty) {
                        return 'Name cannot be empty';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 16),

                  // Phone Field
                  TextFormField(
                    controller: _phoneController,
                    enabled: _isEditing,
                    keyboardType: TextInputType.phone,
                    decoration: const InputDecoration(
                      labelText: 'Phone Number',
                      prefixIcon: Icon(Icons.phone),
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Email Field (Read-only)
                  TextFormField(
                    initialValue: user?.email ?? '',
                    enabled: false,
                    readOnly: true,
                    style: TextStyle(color: Colors.grey[600]),
                    decoration: const InputDecoration(
                      labelText: 'Email Address',
                      prefixIcon: Icon(Icons.email),
                      border: OutlineInputBorder(),
                      filled: true,
                    ),
                  ),
                  const Padding(
                    padding: EdgeInsets.only(top: 8.0, left: 4.0),
                    child: Align(
                      alignment: Alignment.centerLeft,
                      child: Text(
                        'Email address cannot be changed.',
                        style: TextStyle(fontSize: 12, color: Colors.grey),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Role (Read-only)
                  TextFormField(
                    initialValue: user?.role.toUpperCase() ?? 'EMPLOYEE',
                    enabled: false,
                    readOnly: true,
                    decoration: const InputDecoration(
                      labelText: 'Role',
                      prefixIcon: Icon(Icons.badge),
                      border: OutlineInputBorder(),
                      filled: true,
                    ),
                  ),
                  const SizedBox(height: 32),

                  // Location Status Card
                  Consumer<LocationProvider>(
                    builder: (context, locationProvider, _) {
                      return Card(
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Icon(
                                    Icons.location_on,
                                    color: locationProvider.isLocationEnabled 
                                        ? Colors.green 
                                        : Colors.red,
                                  ),
                                  const SizedBox(width: 8),
                                  Text(
                                    'Location Status',
                                    style: Theme.of(context)
                                        .textTheme
                                        .titleMedium
                                        ?.copyWith(
                                          fontWeight: FontWeight.w600,
                                        ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 12),
                              _buildStatusRow(
                                'Tracking',
                                locationProvider.isTracking 
                                    ? 'Active' 
                                    : 'Inactive',
                                locationProvider.isTracking 
                                    ? Colors.green 
                                    : Colors.orange,
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                  
                  if (_isEditing) ...[
                    const SizedBox(height: 24),
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton(
                            onPressed: _isUploading ? null : () {
                              setState(() {
                                _isEditing = false;
                                _nameController.text = user?.displayName ?? '';
                                _phoneController.text = user?.phone ?? '';
                                _pickedImage = null;
                              });
                            },
                            child: const Text('Cancel'),
                          ),
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                          child: ElevatedButton(
                            onPressed: _isUploading ? null : _saveProfile,
                            child: _isUploading
                                ? const SizedBox(
                                    width: 20,
                                    height: 20,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                      color: Colors.white,
                                    ),
                                  )
                                : const Text('Save Changes'),
                          ),
                        ),
                      ],
                    )
                  ]
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  // ✅ FIXED: Use ApiService.baseUrl for avatar display
  ImageProvider? _getAvatarImage(dynamic user) {
    if (_pickedImage != null) {
      return FileImage(_pickedImage!);
    }
    
    if (user?.avatarUrl != null && user.avatarUrl.isNotEmpty) {
      // ✅ Use ApiService.baseUrl which has the correct IP and port
      // Remove /api/v1 from the base URL for static files
      final baseUrlWithoutApi = ApiService.baseUrl.replaceAll('/api/v1', '');
      final fullUrl = '$baseUrlWithoutApi${user.avatarUrl}';
      print('Loading avatar from: $fullUrl');
      return NetworkImage(fullUrl);
    }
    
    return null;
  }

  Widget _buildStatusRow(String label, String value, Color color) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: const TextStyle(fontWeight: FontWeight.w500)),
        Text(
          value, 
          style: TextStyle(color: color, fontWeight: FontWeight.bold),
        ),
      ],
    );
  }
}