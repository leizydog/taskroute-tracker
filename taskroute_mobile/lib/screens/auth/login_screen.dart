import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../widgets/loading_button.dart';
import 'forgot_password_screen.dart';
import '../home/home_screen.dart'; // ✅ 1. Added Import for Home Screen

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> with TickerProviderStateMixin {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _obscurePassword = true;
  bool _rememberMe = false;
  
  late AnimationController _fadeController;
  late AnimationController _slideController;
  late AnimationController _scaleController;
  late AnimationController _rotateController;
  late Animation<double> _fadeAnimation;
  late Animation<Offset> _slideAnimation;
  late Animation<double> _scaleAnimation;
  late Animation<double> _rotateAnimation;

  @override
  void initState() {
    super.initState();
    _setupAnimations();
  }

  void _setupAnimations() {
    _fadeController = AnimationController(
      duration: const Duration(milliseconds: 1200),
      vsync: this,
    );
    
    _slideController = AnimationController(
      duration: const Duration(milliseconds: 800),
      vsync: this,
    );
    
    _scaleController = AnimationController(
      duration: const Duration(milliseconds: 1000),
      vsync: this,
    );
    
    _rotateController = AnimationController(
      duration: const Duration(milliseconds: 1500),
      vsync: this,
    );
    
    _fadeAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _fadeController, curve: Curves.easeInOut),
    );
    
    _slideAnimation = Tween<Offset>(
      begin: const Offset(0, 0.5),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _slideController, curve: Curves.elasticOut));
    
    _scaleAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _scaleController, curve: Curves.elasticOut),
    );
    
    _rotateAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _rotateController, curve: Curves.easeInOut),
    );
    
    _fadeController.forward();
    _slideController.forward();
    _scaleController.forward();
    _rotateController.forward();
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _fadeController.dispose();
    _slideController.dispose();
    _scaleController.dispose();
    _rotateController.dispose();
    super.dispose();
  }

  // ✅ 2. Updated Login Logic
  Future<void> _handleLogin() async {
    if (!_formKey.currentState!.validate()) return;

    FocusScope.of(context).unfocus();

    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final success = await authProvider.login(
      _emailController.text.trim(),
      _passwordController.text,
    );

    if (mounted) {
      if (success) {
        // ✅ SUCCESS: Navigate to Home Screen and clear history
        Navigator.of(context).pushAndRemoveUntil(
          MaterialPageRoute(builder: (context) => const HomeScreen()),
          (route) => false,
        );
      } else {
        // ❌ FAILURE: Show error
        _showErrorSnackBar(
          authProvider.error ?? 'Login failed. Please check your credentials.',
        );
      }
    }
  }

  void _showErrorSnackBar(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            const Icon(Icons.error_outline, color: Colors.white, size: 22),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                message,
                style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w500),
              ),
            ),
          ],
        ),
        backgroundColor: Colors.red.shade600,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        margin: const EdgeInsets.all(16),
        duration: const Duration(seconds: 4),
        elevation: 8,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final size = MediaQuery.of(context).size;
    final isSmallScreen = size.height < 700;

    return Scaffold(
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: isDark
                ? [
                    const Color(0xFF1A237E),
                    const Color(0xFF0D47A1),
                    const Color(0xFF01579B),
                  ]
                : [
                    const Color(0xFF42A5F5),
                    const Color(0xFF2196F3),
                    const Color(0xFF1976D2),
                  ],
          ),
        ),
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              physics: const BouncingScrollPhysics(),
              child: Padding(
                padding: EdgeInsets.symmetric(
                  horizontal: size.width * 0.08,
                  vertical: isSmallScreen ? 20 : 40,
                ),
                child: FadeTransition(
                  opacity: _fadeAnimation,
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      _buildLogoSection(isDark, isSmallScreen),
                      
                      SizedBox(height: isSmallScreen ? 30 : 50),
                      
                      SlideTransition(
                        position: _slideAnimation,
                        child: _buildLoginCard(theme, isDark, isSmallScreen),
                      ),
                      
                      const SizedBox(height: 24),
                      
                      _buildInfoMessage(isDark),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildLogoSection(bool isDark, bool isSmallScreen) {
    return Column(
      children: [
        ScaleTransition(
          scale: _scaleAnimation,
          child: RotationTransition(
            turns: _rotateAnimation,
            child: Hero(
              tag: 'app_logo',
              child: Container(
                height: isSmallScreen ? 120 : 150,
                width: isSmallScreen ? 120 : 150,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(28),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.3),
                      blurRadius: 30,
                      spreadRadius: 5,
                      offset: const Offset(0, 15),
                    ),
                    BoxShadow(
                      color: const Color(0xFF2196F3).withValues(alpha: 0.5),
                      blurRadius: 40,
                      spreadRadius: -5,
                      offset: const Offset(0, 20),
                    ),
                  ],
                ),
                padding: const EdgeInsets.all(16),
                child: Image.asset(
                  'assets/images/taskroute_logo.png',
                  fit: BoxFit.contain,
                  errorBuilder: (context, error, stackTrace) {
                    return Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          Icons.route_rounded,
                          size: isSmallScreen ? 45 : 52,
                          color: const Color(0xFF2196F3),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          'TASKROUTE',
                          style: TextStyle(
                            fontSize: isSmallScreen ? 11 : 13,
                            fontWeight: FontWeight.bold,
                            color: const Color(0xFF2196F3),
                            letterSpacing: 1,
                          ),
                        ),
                        Text(
                          'TRACKER',
                          style: TextStyle(
                            fontSize: isSmallScreen ? 9 : 11,
                            fontWeight: FontWeight.w600,
                            color: Colors.grey[700],
                            letterSpacing: 2,
                          ),
                        ),
                      ],
                    );
                  },
                ),
              ),
            ),
          ),
        ),
        SizedBox(height: isSmallScreen ? 20 : 28),
        
        Text(
          'TaskRoute',
          style: TextStyle(
            fontSize: isSmallScreen ? 32 : 38,
            fontWeight: FontWeight.bold,
            color: Colors.white,
            letterSpacing: 1,
            shadows: [
              Shadow(
                color: Colors.black.withValues(alpha: 0.3),
                offset: const Offset(0, 4),
                blurRadius: 10,
              ),
            ],
          ),
        ),
        const SizedBox(height: 10),
        Text(
          'Field Task Management',
          style: TextStyle(
            fontSize: isSmallScreen ? 15 : 17,
            color: Colors.white.withValues(alpha: 0.95),
            letterSpacing: 1.5,
            fontWeight: FontWeight.w300,
            shadows: [
              Shadow(
                color: Colors.black.withValues(alpha: 0.2),
                offset: const Offset(0, 2),
                blurRadius: 5,
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildLoginCard(ThemeData theme, bool isDark, bool isSmallScreen) {
    return Container(
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
        borderRadius: BorderRadius.circular(28),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.25),
            blurRadius: 40,
            spreadRadius: 5,
            offset: const Offset(0, 20),
          ),
          BoxShadow(
            color: isDark 
                ? Colors.blue.withValues(alpha: 0.1)
                : Colors.blue.withValues(alpha: 0.15),
            blurRadius: 60,
            spreadRadius: -10,
            offset: const Offset(0, 30),
          ),
        ],
      ),
      child: Padding(
        padding: EdgeInsets.all(isSmallScreen ? 24 : 32),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'Welcome Back',
                style: TextStyle(
                  fontSize: isSmallScreen ? 24 : 28,
                  fontWeight: FontWeight.bold,
                  color: isDark ? Colors.white : Colors.black87,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Sign in to continue your journey',
                style: TextStyle(
                  fontSize: 15,
                  color: isDark ? Colors.grey[400] : Colors.grey[600],
                ),
              ),
              
              SizedBox(height: isSmallScreen ? 28 : 36),
              
              _buildEmailField(theme, isDark),
              
              SizedBox(height: isSmallScreen ? 18 : 22),
              
              _buildPasswordField(theme, isDark),
              
              const SizedBox(height: 18),
              
              _buildRememberMeRow(isDark),
              
              SizedBox(height: isSmallScreen ? 28 : 36),
              
              Consumer<AuthProvider>(
                builder: (context, authProvider, _) {
                  return _buildAnimatedButton(
                    onPressed: _handleLogin,
                    isLoading: authProvider.isLoading,
                    text: 'Sign In',
                    isDark: isDark,
                  );
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildEmailField(ThemeData theme, bool isDark) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0.0, end: 1.0),
      duration: const Duration(milliseconds: 600),
      builder: (context, value, child) {
        return Transform.translate(
          offset: Offset(0, 20 * (1 - value)),
          child: Opacity(
            opacity: value,
            child: child,
          ),
        );
      },
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
              color: isDark 
                  ? Colors.black.withValues(alpha: 0.3)
                  : Colors.grey.withValues(alpha: 0.1),
              blurRadius: 15,
              offset: const Offset(0, 5),
            ),
          ],
        ),
        child: TextFormField(
          controller: _emailController,
          keyboardType: TextInputType.emailAddress,
          textInputAction: TextInputAction.next,
          style: TextStyle(
            color: isDark ? Colors.white : Colors.black87,
            fontSize: 16,
          ),
          decoration: InputDecoration(
            labelText: 'Email',
            hintText: 'Enter your email',
            prefixIcon: Icon(
              Icons.email_outlined,
              color: isDark ? Colors.grey[400] : Colors.grey[600],
              size: 22,
            ),
            filled: true,
            fillColor: isDark ? Colors.grey[850] : Colors.grey[50],
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(16),
              borderSide: BorderSide.none,
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(16),
              borderSide: BorderSide.none,
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(16),
              borderSide: const BorderSide(color: Color(0xFF2196F3), width: 2.5),
            ),
            errorBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(16),
              borderSide: const BorderSide(color: Colors.red, width: 2),
            ),
            contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
          ),
          validator: (value) {
            if (value == null || value.trim().isEmpty) {
              return 'Please enter your email';
            }
            if (!RegExp(r'^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$').hasMatch(value)) {
              return 'Please enter a valid email';
            }
            return null;
          },
        ),
      ),
    );
  }

  Widget _buildPasswordField(ThemeData theme, bool isDark) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0.0, end: 1.0),
      duration: const Duration(milliseconds: 800),
      builder: (context, value, child) {
        return Transform.translate(
          offset: Offset(0, 20 * (1 - value)),
          child: Opacity(
            opacity: value,
            child: child,
          ),
        );
      },
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
              color: isDark 
                  ? Colors.black.withValues(alpha: 0.3)
                  : Colors.grey.withValues(alpha: 0.1),
              blurRadius: 15,
              offset: const Offset(0, 5),
            ),
          ],
        ),
        child: TextFormField(
          controller: _passwordController,
          obscureText: _obscurePassword,
          textInputAction: TextInputAction.done,
          onFieldSubmitted: (_) => _handleLogin(),
          style: TextStyle(
            color: isDark ? Colors.white : Colors.black87,
            fontSize: 16,
          ),
          decoration: InputDecoration(
            labelText: 'Password',
            hintText: 'Enter your password',
            prefixIcon: Icon(
              Icons.lock_outline,
              color: isDark ? Colors.grey[400] : Colors.grey[600],
              size: 22,
            ),
            suffixIcon: IconButton(
              icon: Icon(
                _obscurePassword ? Icons.visibility_outlined : Icons.visibility_off_outlined,
                color: isDark ? Colors.grey[400] : Colors.grey[600],
                size: 22,
              ),
              onPressed: () {
                setState(() {
                  _obscurePassword = !_obscurePassword;
                });
              },
            ),
            filled: true,
            fillColor: isDark ? Colors.grey[850] : Colors.grey[50],
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(16),
              borderSide: BorderSide.none,
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(16),
              borderSide: BorderSide.none,
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(16),
              borderSide: const BorderSide(color: Color(0xFF2196F3), width: 2.5),
            ),
            errorBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(16),
              borderSide: const BorderSide(color: Colors.red, width: 2),
            ),
            contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
          ),
          validator: (value) {
            if (value == null || value.isEmpty) {
              return 'Please enter your password';
            }
            if (value.length < 6) {
              return 'Password must be at least 6 characters';
            }
            return null;
          },
        ),
      ),
    );
  }

  Widget _buildRememberMeRow(bool isDark) {
    return Wrap(
      alignment: WrapAlignment.spaceBetween,
      crossAxisAlignment: WrapCrossAlignment.center,
      spacing: 8,
      runSpacing: 8,
      children: [
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            SizedBox(
              height: 22,
              width: 22,
              child: Checkbox(
                value: _rememberMe,
                onChanged: (value) {
                  setState(() {
                    _rememberMe = value ?? false;
                  });
                },
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(5),
                ),
                activeColor: const Color(0xFF2196F3),
              ),
            ),
            const SizedBox(width: 10),
            Text(
              'Remember me',
              style: TextStyle(
                color: isDark ? Colors.grey[400] : Colors.grey[700],
                fontSize: 14,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
        TextButton(
          onPressed: () {
            Navigator.push(
              context,
              MaterialPageRoute(
                builder: (context) => const ForgotPasswordScreen(),
              ),
            );
          },
          style: TextButton.styleFrom(
            padding: const EdgeInsets.symmetric(horizontal: 8),
            minimumSize: Size.zero,
            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
          ),
          child: const Text(
            'Forgot Password?',
            style: TextStyle(
              color: Color(0xFF2196F3),
              fontSize: 14,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildAnimatedButton({
    required VoidCallback onPressed,
    required bool isLoading,
    required String text,
    required bool isDark,
  }) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0.0, end: 1.0),
      duration: const Duration(milliseconds: 1000),
      builder: (context, value, child) {
        return Transform.scale(
          scale: 0.8 + (0.2 * value),
          child: Opacity(
            opacity: value,
            child: child,
          ),
        );
      },
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF2196F3).withValues(alpha: 0.4),
              blurRadius: 20,
              spreadRadius: 2,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: ElevatedButton(
          onPressed: isLoading ? null : onPressed,
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFF2196F3),
            foregroundColor: Colors.white,
            disabledBackgroundColor: const Color(0xFF2196F3).withValues(alpha: 0.6),
            padding: const EdgeInsets.symmetric(vertical: 18),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
            ),
            elevation: 0,
          ),
          child: isLoading
              ? const SizedBox(
                  height: 24,
                  width: 24,
                  child: CircularProgressIndicator(
                    strokeWidth: 2.5,
                    valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                  ),
                )
              : Text(
                  text,
                  style: const TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 0.5,
                  ),
                ),
        ),
      ),
    );
  }

  Widget _buildInfoMessage(bool isDark) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0.0, end: 1.0),
      duration: const Duration(milliseconds: 1400),
      builder: (context, value, child) {
        return Transform.translate(
          offset: Offset(0, 20 * (1 - value)),
          child: Opacity(
            opacity: value,
            child: child,
          ),
        );
      },
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: isDark 
              ? Colors.white.withValues(alpha: 0.08) 
              : Colors.white.withValues(alpha: 0.35),
          borderRadius: BorderRadius.circular(18),
          border: Border.all(
            color: Colors.white.withValues(alpha: 0.3),
            width: 1.5,
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.1),
              blurRadius: 15,
              offset: const Offset(0, 5),
            ),
          ],
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.info_outline,
              color: Colors.white.withValues(alpha: 0.95),
              size: 20,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                'Contact your administrator for account access',
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.95),
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                ),
                textAlign: TextAlign.center,
              ),
            ),
          ],
        ),
      ),
    );
  }
}