import 'dart:async'; // ✅ Added for StreamSubscription
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:app_links/app_links.dart'; // ✅ Added for Deep Linking
import 'package:flutter_dotenv/flutter_dotenv.dart';

import 'providers/auth_provider.dart' as auth;
import 'providers/task_provider.dart';
import 'providers/location_provider.dart';
import 'providers/theme_provider.dart';
import 'screens/auth/login_screen.dart';
import 'screens/auth/reset_password_screen.dart'; // ✅ Added Reset Screen Import
import 'screens/home/home_screen.dart';
import 'screens/splash_screen.dart';
import 'services/storage_service.dart';
import 'utils/app_theme.dart';

// ✅ 1. Define Global Navigator Key
final GlobalKey<NavigatorState> navigatorKey = GlobalKey<NavigatorState>();

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  await StorageService.instance.init();
  await dotenv.load(fileName: ".env");
  
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.dark,
    ),
  );
  
  runApp(const TaskRouteApp());
}

// ✅ 2. Converted to StatefulWidget to handle Deep Link Subscription
class TaskRouteApp extends StatefulWidget {
  const TaskRouteApp({super.key});

  @override
  State<TaskRouteApp> createState() => _TaskRouteAppState();
}

class _TaskRouteAppState extends State<TaskRouteApp> {
  late AppLinks _appLinks;
  StreamSubscription<Uri>? _linkSubscription;

  @override
  void initState() {
    super.initState();
    _initDeepLinks();
  }

  @override
  void dispose() {
    _linkSubscription?.cancel();
    super.dispose();
  }

  Future<void> _initDeepLinks() async {
    _appLinks = AppLinks();

    // Handle App Start with Link (Cold Start)
    try {
      final Uri? initialUri = await _appLinks.getInitialLink();
      if (initialUri != null) {
        _handleDeepLink(initialUri);
      }
    } catch (e) {
      debugPrint("Deep Link Init Error: $e");
    }

    // Handle Link when App is in Background (Stream)
    _linkSubscription = _appLinks.uriLinkStream.listen((Uri? uri) {
      if (uri != null) {
        _handleDeepLink(uri);
      }
    }, onError: (err) {
      debugPrint("Deep Link Stream Error: $err");
    });
  }

  void _handleDeepLink(Uri uri) {
    debugPrint("🔗 Deep Link Received: $uri"); 

    // ✅ Logic for Custom Scheme: taskroute://reset-password?token=...
    // In this format, 'reset-password' is the host
    if (uri.scheme == 'taskroute' && uri.host == 'reset-password') {
      
      final String? token = uri.queryParameters['token'];
      
      if (token != null) {
        navigatorKey.currentState?.push(
          MaterialPageRoute(
            builder: (context) => ResetPasswordScreen(token: token),
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => ThemeProvider()),
        ChangeNotifierProvider(create: (_) => auth.AuthProvider()),
        ChangeNotifierProvider(create: (_) => TaskProvider()),
        ChangeNotifierProvider(create: (_) => LocationProvider()),
      ],
      child: Consumer<ThemeProvider>(
        builder: (context, themeProvider, _) {
          return MaterialApp(
            navigatorKey: navigatorKey, // ✅ Pass the global key here
            title: 'TaskRoute Tracker',
            theme: AppTheme.lightTheme,
            darkTheme: AppTheme.darkTheme,
            themeMode: themeProvider.themeMode,
            
            // ✅ Add Routes for named navigation (used by ResetPasswordScreen success button)
            routes: {
              '/login': (context) => const LoginScreen(),
            },
            
            home: const SplashScreen(
              nextScreen: AuthWrapper(),
            ),
            debugShowCheckedModeBanner: false,
          );
        },
      ),
    );
  }
}

class AuthWrapper extends StatefulWidget {
  const AuthWrapper({super.key});

  @override
  State<AuthWrapper> createState() => _AuthWrapperState();
}

class _AuthWrapperState extends State<AuthWrapper> {
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _checkAuthStatus();
    });
  }

  Future<void> _checkAuthStatus() async {
    final authProvider = Provider.of<auth.AuthProvider>(context, listen: false);
    await authProvider.checkAuthStatus();
    
    if (mounted) {
      setState(() {
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(
        body: Center(
          child: CircularProgressIndicator(),
        ),
      );
    }

    return Consumer<auth.AuthProvider>(
      builder: (context, authProvider, _) {
        if (authProvider.isAuthenticated) {
          return const HomeScreen();
        } else {
          return const LoginScreen();
        }
      },
    );
  }
}