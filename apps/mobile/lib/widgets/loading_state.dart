import 'package:flutter/material.dart';

import '../theme/app_radius.dart';
import '../theme/app_spacing.dart';

/// Skeleton/spinner shapes for "data is loading" — mirrors
/// `components/common/LoadingState` on the web app. Skeletons are preferred
/// over a bare spinner on list-heavy screens for better perceived speed.
enum LoadingVariant { spinner, list, stats }

class LoadingState extends StatelessWidget {
  final LoadingVariant variant;
  final int itemCount;

  const LoadingState({
    super.key,
    this.variant = LoadingVariant.spinner,
    this.itemCount = 4,
  });

  @override
  Widget build(BuildContext context) {
    switch (variant) {
      case LoadingVariant.spinner:
        return const Center(child: CircularProgressIndicator());
      case LoadingVariant.list:
        // A plain (non-scrolling) Column, not a ListView: this variant is
        // used both as a whole screen's loading body (under a
        // RefreshIndicator, which supplies the actual Scrollable) and
        // nested as a single item inside an outer ListView (e.g. a
        // "section" of a longer screen). A ListView in the latter position
        // is a viewport nested inside another viewport with unbounded
        // height, which throws "Vertical viewport was given unbounded
        // height" at layout time — a Column just takes the height of its
        // children in either context.
        return Padding(
          padding: const EdgeInsets.all(AppSpacing.md),
          child: Column(
            children: [
              for (var i = 0; i < itemCount; i++) ...[
                if (i > 0) SizedBox(height: AppSpacing.sm),
                const _SkeletonBlock(height: 72),
              ],
            ],
          ),
        );
      case LoadingVariant.stats:
        return Row(
          children: List.generate(
            itemCount,
            (index) => Expanded(
              child: Padding(
                padding: EdgeInsets.only(
                  right: index == itemCount - 1 ? 0 : AppSpacing.sm,
                ),
                child: const _SkeletonBlock(height: 96),
              ),
            ),
          ),
        );
    }
  }
}

class _SkeletonBlock extends StatelessWidget {
  final double height;

  const _SkeletonBlock({required this.height});

  @override
  Widget build(BuildContext context) {
    final base = Theme.of(context).colorScheme.onSurfaceVariant;
    return Container(
      height: height,
      decoration: BoxDecoration(
        color: base.withValues(alpha: 0.08),
        borderRadius: AppRadius.lgRadius,
      ),
    );
  }
}
