import 'package:flutter/material.dart';

/// Motion tokens mirroring `--duration-*` / `--ease-out` in the web
/// `index.css`. Every animation here collapses to zero when the OS asks
/// for reduced motion (`MediaQuery.disableAnimations`), as the web does
/// with `prefers-reduced-motion`.
class AppMotion {
  static const fast = Duration(milliseconds: 200);
  static const normal = Duration(milliseconds: 300);
  static const slow = Duration(milliseconds: 600);
  static const easeOut = Cubic(0.16, 1, 0.3, 1);

  static bool reduced(BuildContext context) =>
      MediaQuery.maybeDisableAnimationsOf(context) ?? false;

  static Duration of(BuildContext context, Duration d) =>
      reduced(context) ? Duration.zero : d;
}

/// Fade + small upward slide on first build (web `itemVariants` /
/// `emptyStateVariants`).
class FadeIn extends StatelessWidget {
  final Widget child;

  const FadeIn({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: AppMotion.of(context, AppMotion.normal),
      curve: AppMotion.easeOut,
      child: child,
      builder: (context, t, child) => Opacity(
        opacity: t,
        child: Transform.translate(
          offset: Offset(0, (1 - t) * 8),
          child: child,
        ),
      ),
    );
  }
}

/// Cross-fades between loading / error / data bodies of an `AsyncValue`
/// (`.when(...)`) — wrap the `.when` result in this.
class AsyncSwitcher extends StatelessWidget {
  final Widget child;

  const AsyncSwitcher({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    return AnimatedSwitcher(
      duration: AppMotion.of(context, AppMotion.fast),
      // Pass the parent's constraints through and keep content top-aligned,
      // exactly as if the switcher weren't there.
      layoutBuilder: (current, previous) => Stack(
        fit: StackFit.passthrough,
        alignment: Alignment.topCenter,
        children: [...previous, if (current != null) current],
      ),
      child: KeyedSubtree(key: ValueKey(child.runtimeType), child: child),
    );
  }
}

/// Progress bar that grows to [value] (web animated progress bar).
class AnimatedProgressBar extends StatelessWidget {
  final double value;
  final Color color;
  final double height;

  const AnimatedProgressBar({
    super.key,
    required this.value,
    required this.color,
    this.height = 6,
  });

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: value.clamp(0, 1).toDouble()),
      duration: AppMotion.of(context, AppMotion.slow),
      curve: AppMotion.easeOut,
      builder: (context, v, _) => ClipRRect(
        borderRadius: BorderRadius.circular(height),
        child: LinearProgressIndicator(
          value: v,
          minHeight: height,
          backgroundColor: color.withValues(alpha: 0.15),
          valueColor: AlwaysStoppedAnimation(color),
        ),
      ),
    );
  }
}
