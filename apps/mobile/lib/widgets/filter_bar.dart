import 'package:flutter/material.dart';

import '../theme/app_spacing.dart';

/// Search field + arbitrary filter widgets (dropdowns, chips) + a "clear"
/// action shown only when filters are active — mirrors the
/// `FilterBar`/`SearchInput` combo repeated across Accounts/Expenses/
/// Revenues/Transfers/Passwords on the web app.
class FilterBar extends StatelessWidget implements PreferredSizeWidget {
  final TextEditingController searchController;
  final String searchHint;
  final ValueChanged<String>? onSearchChanged;
  final List<Widget> filters;
  final bool hasActiveFilters;
  final VoidCallback? onClear;

  const FilterBar({
    super.key,
    required this.searchController,
    this.searchHint = 'Buscar...',
    this.onSearchChanged,
    this.filters = const [],
    this.hasActiveFilters = false,
    this.onClear,
  });

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.sm,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: searchController,
                  onChanged: onSearchChanged,
                  decoration: InputDecoration(
                    isDense: true,
                    hintText: searchHint,
                    prefixIcon: const Icon(Icons.search_rounded, size: 20),
                    suffixIcon: searchController.text.isEmpty
                        ? null
                        : IconButton(
                            icon: const Icon(Icons.close_rounded, size: 18),
                            onPressed: () {
                              searchController.clear();
                              onSearchChanged?.call('');
                            },
                          ),
                  ),
                ),
              ),
              if (hasActiveFilters && onClear != null)
                IconButton(
                  tooltip: 'Limpar filtros',
                  icon: const Icon(Icons.filter_alt_off_outlined),
                  onPressed: onClear,
                ),
            ],
          ),
          if (filters.isNotEmpty) ...[
            SizedBox(height: AppSpacing.xs),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  for (final filter in filters) ...[
                    filter,
                    SizedBox(width: AppSpacing.xs),
                  ],
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}
