import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';

class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  bool _isSuccess = false; // To track if email was sent successfully

  @override
  void dispose() {
    _emailController.dispose();
    super.dispose();
  }

  Future<void> _handleSubmit() async {
    if (!_formKey.currentState!.validate()) return;

    // Dismiss keyboard
    FocusScope.of(context).unfocus();

    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final success = await authProvider.forgotPassword(_emailController.text.trim());

    if (success && mounted) {
      setState(() {
        _isSuccess = true;
      });
    } else if (mounted && authProvider.error != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(authProvider.error!),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      // Use the same Gradient Background as Login
      body: Container(
        height: double.infinity,
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: isDark
                ? [const Color(0xFF1A237E), const Color(0xFF0D47A1), const Color(0xFF01579B)]
                : [const Color(0xFF42A5F5), const Color(0xFF2196F3), const Color(0xFF1976D2)],
          ),
        ),
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: _isSuccess 
                  ? _buildSuccessCard(isDark) 
                  : _buildFormCard(isDark),
            ),
          ),
        ),
      ),
    );
  }

  // --- SUCCESS STATE (Matches the CheckCircle part of your React code) ---
  Widget _buildSuccessCard(bool isDark) {
    return Container(
      padding: const EdgeInsets.all(32),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
        borderRadius: BorderRadius.circular(28),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.25),
            blurRadius: 40,
            offset: const Offset(0, 20),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.green.withOpacity(0.15),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.check_circle_outline, color: Colors.green, size: 40),
          ),
          const SizedBox(height: 24),
          Text(
            'Check Your Email',
            style: TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.bold,
              color: isDark ? Colors.white : Colors.black87,
            ),
          ),
          const SizedBox(height: 16),
          Text(
            'We\'ve sent password reset instructions to',
            textAlign: TextAlign.center,
            style: TextStyle(color: isDark ? Colors.grey[400] : Colors.grey[600]),
          ),
          const SizedBox(height: 4),
          Text(
            _emailController.text,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontWeight: FontWeight.bold,
              color: isDark ? Colors.white : Colors.black87,
              fontSize: 16,
            ),
          ),
          const SizedBox(height: 32),
          SizedBox(
            width: double.infinity,
            child: TextButton.icon(
              onPressed: () => Navigator.pop(context), // Go back to login
              icon: const Icon(Icons.arrow_back, size: 20),
              label: const Text('Back to Login'),
              style: TextButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 12),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // --- FORM STATE (Matches the Input part of your React code) ---
  Widget _buildFormCard(bool isDark) {
    return Container(
      padding: const EdgeInsets.all(32),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
        borderRadius: BorderRadius.circular(28),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.25),
            blurRadius: 40,
            offset: const Offset(0, 20),
          ),
        ],
      ),
      child: Form(
        key: _formKey,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: const Color(0xFF2196F3).withOpacity(0.15),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.mail_outline, color: Color(0xFF2196F3), size: 32),
            ),
            const SizedBox(height: 24),
            Text(
              'Forgot Password?',
              style: TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.bold,
                color: isDark ? Colors.white : Colors.black87,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'No worries! Enter your email and we\'ll send you reset instructions.',
              textAlign: TextAlign.center,
              style: TextStyle(color: isDark ? Colors.grey[400] : Colors.grey[600]),
            ),
            const SizedBox(height: 32),
            
            // Email Field
            TextFormField(
              controller: _emailController,
              keyboardType: TextInputType.emailAddress,
              style: TextStyle(color: isDark ? Colors.white : Colors.black87),
              decoration: InputDecoration(
                labelText: 'Email address',
                hintText: 'Enter your email',
                prefixIcon: Icon(Icons.email_outlined, color: isDark ? Colors.grey[400] : Colors.grey[600]),
                filled: true,
                fillColor: isDark ? Colors.grey[850] : Colors.grey[50],
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide.none,
                ),
              ),
              validator: (value) {
                if (value == null || value.isEmpty) return 'Please enter your email';
                if (!value.contains('@')) return 'Please enter a valid email';
                return null;
              },
            ),
            const SizedBox(height: 24),

            // Submit Button
            Consumer<AuthProvider>(
              builder: (context, authProvider, _) {
                return SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: authProvider.isLoading ? null : _handleSubmit,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF2196F3),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                      elevation: 0,
                    ),
                    child: authProvider.isLoading
                        ? const SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                          )
                        : const Text(
                            'Send Reset Link',
                            style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                          ),
                  ),
                );
              },
            ),
            const SizedBox(height: 24),
            
            // Back to Login Link
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  'Remember your password? ',
                  style: TextStyle(color: isDark ? Colors.grey[400] : Colors.grey[600]),
                ),
                GestureDetector(
                  onTap: () => Navigator.pop(context),
                  child: const Text(
                    'Sign in',
                    style: TextStyle(
                      color: Color(0xFF2196F3),
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}