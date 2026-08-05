import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../models/exercise_catalog.dart';
import '../../providers/planning_providers.dart';
import '../../services/base_service.dart';
import '../../theme/app_spacing.dart';

Future<bool?> showExerciseCatalogFormSheet(
  BuildContext context, {
  ExerciseCatalog? existing,
}) {
  return showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (context) => _ExerciseCatalogFormSheet(existing: existing),
  );
}

class _ExerciseCatalogFormSheet extends ConsumerStatefulWidget {
  final ExerciseCatalog? existing;

  const _ExerciseCatalogFormSheet({this.existing});

  @override
  ConsumerState<_ExerciseCatalogFormSheet> createState() =>
      _ExerciseCatalogFormSheetState();
}

class _ExerciseCatalogFormSheetState
    extends ConsumerState<_ExerciseCatalogFormSheet> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _nameController;
  late final TextEditingController _muscleGroupsController;
  bool _isSaving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _nameController = TextEditingController(text: widget.existing?.name ?? '');
    _muscleGroupsController =
        TextEditingController(text: widget.existing?.muscleGroups ?? '');
  }

  @override
  void dispose() {
    _nameController.dispose();
    _muscleGroupsController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _isSaving = true;
      _error = null;
    });

    final exercise = ExerciseCatalog(
      id: widget.existing?.id ?? 0,
      uuid: widget.existing?.uuid ?? '',
      name: _nameController.text.trim(),
      muscleGroups: _muscleGroupsController.text.trim().isEmpty
          ? null
          : _muscleGroupsController.text.trim(),
    );

    final service = ref.read(exerciseCatalogServiceProvider);
    try {
      if (widget.existing == null) {
        await service.create(exercise.toJson());
      } else {
        await service.update(widget.existing!.id, exercise.toJson());
      }
      ref.invalidate(exerciseCatalogProvider);
      if (mounted) Navigator.of(context).pop(true);
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isEditing = widget.existing != null;
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.only(
          left: AppSpacing.md,
          right: AppSpacing.md,
          bottom: AppSpacing.md + MediaQuery.of(context).viewInsets.bottom,
        ),
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                isEditing ? 'Editar exercício' : 'Novo exercício',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              SizedBox(height: AppSpacing.md),
              TextFormField(
                controller: _nameController,
                decoration: const InputDecoration(labelText: 'Nome'),
                validator: (v) =>
                    (v == null || v.isEmpty) ? 'Informe um nome' : null,
              ),
              SizedBox(height: AppSpacing.sm),
              TextFormField(
                controller: _muscleGroupsController,
                decoration: const InputDecoration(
                  labelText: 'Grupos musculares (opcional)',
                ),
              ),
              if (_error != null) ...[
                SizedBox(height: AppSpacing.sm),
                Text(
                  _error!,
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
              ],
              SizedBox(height: AppSpacing.md),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: _isSaving ? null : _save,
                  child: _isSaving
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text('Salvar'),
                ),
              ),
              SizedBox(height: AppSpacing.sm),
            ],
          ),
        ),
      ),
    );
  }
}
