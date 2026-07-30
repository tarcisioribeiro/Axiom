import 'package:flutter/material.dart';

import 'screens/login_screen.dart';

void main() {
  runApp(const AxiomMobileApp());
}

class AxiomMobileApp extends StatelessWidget {
  const AxiomMobileApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Axiom',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.deepPurple),
        useMaterial3: true,
      ),
      home: const LoginScreen(),
    );
  }
}
