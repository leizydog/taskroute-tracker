import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../providers/location_provider.dart';
import '../../providers/theme_provider.dart';
import '../../services/storage_service.dart';
import '../../screens/auth/login_screen.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
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

    if (mounted) {
      setState(() {
        _locationTrackingEnabled = locationTracking;
        _notificationsEnabled = notifications;
        _offlineModeEnabled = offlineMode;
      });
    }
  }

  Future<void> _toggleLocationTracking(bool value) async {
    setState(() => _locationTrackingEnabled = value);
    await StorageService.instance.setLocationTrackingEnabled(value);
    
    if (mounted) {
      final locationProvider = Provider.of<LocationProvider>(context, listen: false);
      if (value) {
        await locationProvider.startLocationTracking();
      } else {
        await locationProvider.stopLocationTracking();
      }
    }
  }

  Future<void> _toggleNotifications(bool value) async {
    setState(() => _notificationsEnabled = value);
    await StorageService.instance.setNotificationsEnabled(value);
  }

  Future<void> _toggleOfflineMode(bool value) async {
    setState(() => _offlineModeEnabled = value);
    await StorageService.instance.setOfflineModeEnabled(value);
  }

  void _showThemeDialog() {
    final themeProvider = Provider.of<ThemeProvider>(context, listen: false);
    
    showDialog(
      context: context,
      builder: (BuildContext context) {
        return AlertDialog(
          title: const Text('Choose Theme'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              RadioListTile<ThemeMode>(
                title: const Text('Light'),
                value: ThemeMode.light,
                groupValue: themeProvider.themeMode,
                onChanged: (ThemeMode? value) {
                  if (value != null) {
                    themeProvider.setThemeMode(value);
                    Navigator.of(context).pop();
                  }
                },
              ),
              RadioListTile<ThemeMode>(
                title: const Text('Dark'),
                value: ThemeMode.dark,
                groupValue: themeProvider.themeMode,
                onChanged: (ThemeMode? value) {
                  if (value != null) {
                    themeProvider.setThemeMode(value);
                    Navigator.of(context).pop();
                  }
                },
              ),
              RadioListTile<ThemeMode>(
                title: const Text('System Default'),
                value: ThemeMode.system,
                groupValue: themeProvider.themeMode,
                onChanged: (ThemeMode? value) {
                  if (value != null) {
                    themeProvider.setThemeMode(value);
                    Navigator.of(context).pop();
                  }
                },
              ),
            ],
          ),
        );
      },
    );
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
              style: TextButton.styleFrom(foregroundColor: Colors.red),
              onPressed: () async {
                // 1. Close the confirmation dialog immediately
                Navigator.of(context).pop(); 

                // 2. Perform the logout logic
                final authProvider = Provider.of<AuthProvider>(context, listen: false);
                await authProvider.logout();

                // 3. CHECK: Ensure the widget is still on screen
                if (context.mounted) {
                  // 4. FORCE NAVIGATION:
                  // "pushAndRemoveUntil" deletes all previous screens (Settings, Home, etc.)
                  // and puts LoginScreen as the only screen.
                  Navigator.of(context).pushAndRemoveUntil(
                    MaterialPageRoute(
                      builder: (context) => const LoginScreen(),
                    ), 
                    (route) => false // This returns 'false' for all routes, wiping the stack
                  );
                }
              },
              child: const Text('Logout'),
            ),
          ],
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    // 1. Get the system's bottom padding (Safe Area for iPhone home bar / Android nav)
    final bottomPadding = MediaQuery.of(context).padding.bottom;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Settings'),
      ),
      body: ListView(
        // 2. Apply dynamic padding: 16 top/left/right, but 'bottomPadding + 30' for the bottom.
        // This pushes the content up so the button isn't covered.
        padding: EdgeInsets.fromLTRB(16, 16, 16, bottomPadding + 30),
        children: [
          _buildSectionHeader(context, 'Preferences'),
          Card(
            child: Column(
              children: [
                // Theme Setting
                Consumer<ThemeProvider>(
                  builder: (context, themeProvider, _) {
                    String themeText = 'System Default';
                    IconData themeIcon = Icons.brightness_auto;
                    
                    if (themeProvider.themeMode == ThemeMode.light) {
                      themeText = 'Light';
                      themeIcon = Icons.light_mode;
                    } else if (themeProvider.themeMode == ThemeMode.dark) {
                      themeText = 'Dark';
                      themeIcon = Icons.dark_mode;
                    }
                    
                    return ListTile(
                      leading: Icon(themeIcon),
                      title: const Text('Theme'),
                      subtitle: Text(themeText),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: _showThemeDialog,
                    );
                  },
                ),
                const Divider(height: 1),
                
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
          const SizedBox(height: 24),

          _buildSectionHeader(context, 'Data & Maintenance'),
          Card(
            child: Column(
              children: [
                ListTile(
                  leading: const Icon(Icons.sync),
                  title: const Text('Sync Data'),
                  subtitle: const Text('Sync offline data with server'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () async {
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
                      if (context.mounted) {
                        Navigator.of(context).pop();
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Data synced successfully'), backgroundColor: Colors.green),
                        );
                      }
                    } catch (e) {
                      if (context.mounted) {
                        Navigator.of(context).pop();
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: Text('Sync failed: $e'), backgroundColor: Colors.red),
                        );
                      }
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
                    if (context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Location refreshed'), backgroundColor: Colors.green),
                      );
                    }
                  },
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          _buildSectionHeader(context, 'About'),
          Card(
            child: ListTile(
              leading: const Icon(Icons.info_outline),
              title: const Text('App Info'),
              subtitle: const Text('Version 1.0.0'),
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
                        Text('Field Task Management System'),
                        SizedBox(height: 8),
                        Text('Built with Flutter'),
                      ],
                    ),
                    actions: [
                      TextButton(onPressed: () => Navigator.of(context).pop(), child: const Text('OK')),
                    ],
                  ),
                );
              },
            ),
          ),
          const SizedBox(height: 24),

          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: _showLogoutDialog,
              icon: const Icon(Icons.logout, color: Colors.red),
              label: const Text('Logout', style: TextStyle(color: Colors.red)),
              style: OutlinedButton.styleFrom(
                side: const BorderSide(color: Colors.red),
                padding: const EdgeInsets.symmetric(vertical: 12),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSectionHeader(BuildContext context, String title) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8.0, left: 4.0),
      child: Text(
        title,
        style: Theme.of(context).textTheme.titleMedium?.copyWith(
          fontWeight: FontWeight.bold,
          color: Theme.of(context).primaryColor,
        ),
      ),
    );
  }
}