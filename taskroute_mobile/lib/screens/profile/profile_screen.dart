import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../providers/location_provider.dart';
import '../../services/storage_service.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  bool _locationTrackingEnabled = true;
  bool _notificationsEnabled = true;
  bool _offlineModeEnabled = true;

  @override
  void initState() {
    super.initState();
    _loadPreferences();
  }

  Future<void> _loadPreferences() async {
    final storage = StorageService.instance;
    final locationTracking = await storage.isLocationTrackingEnabled();
    final notifications = await storage.areNotificationsEnabled();
    final offlineMode = await storage.isOfflineModeEnabled();

    setState(() {
      _locationTrackingEnabled = locationTracking;
      _notificationsEnabled = notifications;
      _offlineModeEnabled = offlineMode;
    });
  }

  Future<void> _toggleLocationTracking(bool value) async {
    setState(() {
      _locationTrackingEnabled = value;
    });

    await StorageService.instance.setLocationTrackingEnabled(value);
    
    final locationProvider = Provider.of<LocationProvider>(context, listen: false);
    if (value) {
      await locationProvider.startLocationTracking();
    } else {
      await locationProvider.stopLocationTracking();
    }
  }

  Future<void> _toggleNotifications(bool value) async {
    setState(() {
      _notificationsEnabled = value;
    });
    
    await StorageService.instance.setNotificationsEnabled(value);
  }

  Future<void> _toggleOfflineMode(bool value) async {
    setState(() {
      _offlineModeEnabled = value;
    });
    
    await StorageService.instance.setOfflineModeEnabled(value);
  }

  void _showLogoutDialog() {
    showDialog(
      context: context,
      builder: (BuildContext context) {
        return AlertDialog(
          title: const Text('Logout'),
          content: const Text('Are you sure you want to logout?'),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Cancel'),
            ),
            TextButton(
              onPressed: () async {
                Navigator.of(context).pop();
                final authProvider = Provider.of<AuthProvider>(context, listen: false);
                await authProvider.logout();
              },
              style: TextButton.styleFrom(
                foregroundColor: Colors.red,
              ),
              child: const Text('Logout'),
            ),
          ],
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Profile'),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: _showLogoutDialog,
            tooltip: 'Logout',
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // User Profile Section
            Consumer<AuthProvider>(
              builder: (context, authProvider, _) {
                final user = authProvider.user;
                
                return Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      children: [
                        // Avatar
                        CircleAvatar(
                          radius: 40,
                          backgroundColor: Theme.of(context).primaryColor,
                          child: Text(
                            user?.initials ?? 'U',
                            style: const TextStyle(
                              fontSize: 24,
                              fontWeight: FontWeight.bold,
                              color: Colors.white,
                            ),
                          ),
                        ),
                        const SizedBox(height: 16),
                        
                        // User Info
                        Text(
                          user?.displayName ?? 'Unknown User',
                          style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          user?.email ?? 'No email',
                          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: Colors.grey[600],
                          ),
                        ),
                        const SizedBox(height: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                          decoration: BoxDecoration(
                            color: Theme.of(context).primaryColor.withOpacity(0.1),
                            borderRadius: BorderRadius.circular(16),
                          ),
                          child: Text(
                            user?.role.toUpperCase() ?? 'EMPLOYEE',
                            style: TextStyle(
                              color: Theme.of(context).primaryColor,
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
            const SizedBox(height: 24),

            // Location Status
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
                              color: locationProvider.isLocationEnabled ? Colors.green : Colors.red,
                            ),
                            const SizedBox(width: 8),
                            Text(
                              'Location Status',
                              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        _buildStatusRow(
                          'GPS Status',
                          locationProvider.isLocationEnabled ? 'Enabled' : 'Disabled',
                          locationProvider.isLocationEnabled ? Colors.green : Colors.red,
                        ),
                        _buildStatusRow(
                          'Tracking',
                          locationProvider.isTracking ? 'Active' : 'Inactive',
                          locationProvider.isTracking ? Colors.green : Colors.orange,
                        ),
                        if (locationProvider.currentPosition != null) ...[
                          _buildStatusRow(
                            'Accuracy',
                            locationProvider.getAccuracyStatus(),
                            Colors.blue,
                          ),
                          _buildStatusRow(
                            'Last Update',
                            locationProvider.getLocationAge(),
                            Colors.grey,
                          ),
                        ],
                      ],
                    ),
                  ),
                );
              },
            ),
            const SizedBox(height: 24),

            // Settings Section
            Text(
              'Settings',
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 12),

            Card(
              child: Column(
                children: [
                  SwitchListTile(
                    title: const Text('Location Tracking'),
                    subtitle: const Text('Enable GPS tracking for tasks'),
                    value: _locationTrackingEnabled,
                    onChanged: _toggleLocationTracking,
                    secondary: const Icon(Icons.location_on),
                  ),
                  const Divider(height: 1),
                  SwitchListTile(
                    title: const Text('Notifications'),
                    subtitle: const Text('Receive task and system notifications'),
                    value: _notificationsEnabled,
                    onChanged: _toggleNotifications,
                    secondary: const Icon(Icons.notifications),
                  ),
                  const Divider(height: 1),
                  SwitchListTile(
                    title: const Text('Offline Mode'),
                    subtitle: const Text('Save data when network is unavailable'),
                    value: _offlineModeEnabled,
                    onChanged: _toggleOfflineMode,
                    secondary: const Icon(Icons.cloud_off),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // Action Buttons
            Card(
              child: Column(
                children: [
                  ListTile(
                    leading: const Icon(Icons.sync),
                    title: const Text('Sync Data'),
                    subtitle: const Text('Sync offline data with server'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () async {
                      // Show loading indicator
                      showDialog(
                        context: context,
                        barrierDismissible: false,
                        builder: (context) => const AlertDialog(
                          content: Row(
                            children: [
                              CircularProgressIndicator(),
                              SizedBox(width: 16),
                              Text('Syncing data...'),
                            ],
                          ),
                        ),
                      );

                      try {
                        final locationProvider = Provider.of<LocationProvider>(context, listen: false);
                        await locationProvider.syncOfflineLocationLogs();
                        
                        Navigator.of(context).pop(); // Close loading dialog
                        
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text('Data synced successfully'),
                            backgroundColor: Colors.green,
                          ),
                        );
                      } catch (e) {
                        Navigator.of(context).pop(); // Close loading dialog
                        
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text('Sync failed: ${e.toString()}'),
                            backgroundColor: Colors.red,
                          ),
                        );
                      }
                    },
                  ),
                  const Divider(height: 1),
                  ListTile(
                    leading: const Icon(Icons.refresh),
                    title: const Text('Refresh Location'),
                    subtitle: const Text('Get current GPS location'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () async {
                      final locationProvider = Provider.of<LocationProvider>(context, listen: false);
                      await locationProvider.refreshLocation();
                      
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('Location refreshed'),
                          backgroundColor: Colors.green,
                        ),
                      );
                    },
                  ),
                  const Divider(height: 1),
                  ListTile(
                    leading: const Icon(Icons.info_outline),
                    title: const Text('App Info'),
                    subtitle: const Text('Version and system information'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () {
                      showDialog(
                        context: context,
                        builder: (context) => AlertDialog(
                          title: const Text('App Information'),
                          content: const Column(
                            mainAxisSize: MainAxisSize.min,
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('TaskRoute Mobile'),
                              SizedBox(height: 8),
                              Text('Version: 1.0.0'),
                              SizedBox(height: 8),
                              Text('Field Task Management System'),
                              SizedBox(height: 8),
                              Text('Built with Flutter'),
                            ],
                          ),
                          actions: [
                            TextButton(
                              onPressed: () => Navigator.of(context).pop(),
                              child: const Text('OK'),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // Logout Button
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: _showLogoutDialog,
                icon: const Icon(Icons.logout, color: Colors.red),
                label: const Text(
                  'Logout',
                  style: TextStyle(color: Colors.red),
                ),
                style: OutlinedButton.styleFrom(
                  side: const BorderSide(color: Colors.red),
                  padding: const EdgeInsets.symmetric(vertical: 12),
                ),
              ),
            ),
            const SizedBox(height: 24),

            // Footer
            Center(
              child: Text(
                'TaskRoute Mobile v1.0.0',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Colors.grey[500],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatusRow(String label, String value, Color color) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          SizedBox(
            width: 100,
            child: Text(
              '$label:',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
          Text(
            value,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: color,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}