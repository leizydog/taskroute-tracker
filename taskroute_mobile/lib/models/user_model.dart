class UserModel {
  final int id;
  final String email;
  final String username;
  final String fullName;
  final bool isActive;
  final String role;
  final DateTime createdAt;
  final DateTime? updatedAt;
  // ✅ Added missing fields for profile update
  final String? phone;
  final String? avatarUrl;

  UserModel({
    required this.id,
    required this.email,
    required this.username,
    required this.fullName,
    required this.isActive,
    required this.role,
    required this.createdAt,
    this.updatedAt,
    // ✅ Added to constructor
    this.phone,
    this.avatarUrl,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['id'],
      email: json['email'],
      username: json['username'],
      fullName: json['full_name'],
      isActive: json['is_active'],
      role: json['role'],
      createdAt: DateTime.parse(json['created_at']),
      updatedAt: json['updated_at'] != null 
          ? DateTime.parse(json['updated_at']) 
          : null,
      // ✅ Added to fromJson
      phone: json['phone'],
      avatarUrl: json['avatar_url'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'email': email,
      'username': username,
      'full_name': fullName,
      'is_active': isActive,
      'role': role,
      'created_at': createdAt.toIso8601String(),
      'updated_at': updatedAt?.toIso8601String(),
      // ✅ Added to toJson
      'phone': phone,
      'avatar_url': avatarUrl,
    };
  }

  String get displayName => fullName.isNotEmpty ? fullName : username;

  String get initials {
    if (fullName.isNotEmpty) {
      final parts = fullName.split(' ');
      if (parts.length >= 2) {
        return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
      } else {
        return fullName[0].toUpperCase();
      }
    }
    return username[0].toUpperCase();
  }

  bool get isAdmin => role.toLowerCase() == 'admin';
  bool get isManager => role.toLowerCase() == 'manager' || isAdmin;
}