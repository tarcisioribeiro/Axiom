import 'package:flutter/material.dart';

import 'empty_state.dart';

/// Placeholder body for a route that's wired into navigation but whose real
/// content lands in a later implementation step. Kept as a small shared
/// widget so it's trivial to grep for and delete once every screen has real
/// content.
class ComingSoon extends StatelessWidget {
  final String label;

  const ComingSoon({super.key, required this.label});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: EmptyState(
        icon: Icons.construction_rounded,
        title: label,
        message: 'Esta tela ainda está em construção.',
      ),
    );
  }
}
