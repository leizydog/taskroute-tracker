import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';

class ResetPasswordScreen extends StatefulWidget {
  final String token;

  const ResetPasswordScreen({super.key, required this.token});

  @override
  State<ResetPasswordScreen> createState() => _ResetPasswordScreenState();
}

class _ResetPasswordScreenState extends State<ResetPasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _passwordController = TextEditingController();
  final _confirmController = TextEditingController();
  bool _obscurePassword = true;
  bool _isSuccess = false;

  Future<void> _handleSubmit() async {
    print("🔘 Update Password Button Pressed"); // Debug Log

    if (!_formKey.currentState!.validate()) {
      print("❌ Validation Failed");
      return;
    }

    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    
    print("🚀 Sending Reset Request for token: ${widget.token}");
    print("🔑 New Password: ${_passwordController.text}");

    // Call API
    final success = await authProvider.resetPassword(
      widget.token, 
      _passwordController.text
    );

    print("📡 API Result: $success");

    if (success && mounted) {
      setState(() => _isSuccess = true);
    } else if (mounted) {
      print("❌ Error from Provider: ${authProvider.error}");
      if (authProvider.error != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(authProvider.error!), 
            backgroundColor: Colors.red
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    // Reuse your styling from Login/Forgot Password screens
    return Scaffold(
      appBar: AppBar(title: const Text("Reset Password")),
      body: Padding(
        padding: const EdgeInsets.all(24.0),
        child: _isSuccess ? _buildSuccessView() : _buildFormView(),
      ),
    );
  }

  Widget _buildSuccessView() {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        const Icon(Icons.check_circle, color: Colors.green, size: 64),
        const SizedBox(height: 20),
        const Text("Password Reset Successful!", style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
        const SizedBox(height: 20),
        ElevatedButton(
          onPressed: () {
            // Clear stack and go to Login
            Navigator.of(context).pushNamedAndRemoveUntil('/login', (route) => false);
          },
          child: const Text("Go to Login"),
        )
      ],
    );
  }

  Widget _buildFormView() {
    return Form(
      key: _formKey,
      child: Column(
        children: [
          const Text("Create a new strong password."),
          const SizedBox(height: 20),
          TextFormField(
            controller: _passwordController,
            obscureText: _obscurePassword,
            decoration: InputDecoration(
              labelText: "New Password",
              suffixIcon: IconButton(
                icon: Icon(_obscurePassword ? Icons.visibility : Icons.visibility_off),
                onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
              ),
            ),
            validator: (val) => val!.length < 8 ? "Min 8 characters" : null,
          ),
          const SizedBox(height: 16),
          TextFormField(
            controller: _confirmController,
            obscureText: _obscurePassword,
            decoration: const InputDecoration(labelText: "Confirm Password"),
            validator: (val) => val != _passwordController.text ? "Passwords do not match" : null,
          ),
          const SizedBox(height: 32),
          Consumer<AuthProvider>(
            builder: (context, provider, _) => ElevatedButton(
              onPressed: provider.isLoading ? null : _handleSubmit,
              child: provider.isLoading 
                ? const CircularProgressIndicator() 
                : const Text("Reset Password"),
            ),
          ),
        ],
      ),
    );
  }
}