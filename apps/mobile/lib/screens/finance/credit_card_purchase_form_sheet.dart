import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../models/credit_card_purchase.dart';
import '../../providers/finance_providers.dart';
import '../../services/base_service.dart';
import '../../theme/app_spacing.dart';
import '../../utils/choice_labels.dart';
import '../../utils/formatters.dart';

/// Logs a new purchase against [cardId] — the backend auto-generates the
/// installments and links them to the matching bill(s) by date range, so
/// this form only needs the purchase itself (see
/// `CreditCardPurchaseCreateSerializer`).
Future<bool?> showCreditCardPurchaseFormSheet(
  BuildContext context, {
  required int cardId,
}) {
  return showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (context) => _PurchaseFormSheet(cardId: cardId),
  );
}

class _PurchaseFormSheet extends ConsumerStatefulWidget {
  final int cardId;

  const _PurchaseFormSheet({required this.cardId});

  @override
  ConsumerState<_PurchaseFormSheet> createState() => _PurchaseFormSheetState();
}

class _PurchaseFormSheetState extends ConsumerState<_PurchaseFormSheet> {
  final _formKey = GlobalKey<FormState>();
  final _descriptionController = TextEditingController();
  final _valueController = TextEditingController();
  final _merchantController = TextEditingController();
  final _installmentsController = TextEditingController(text: '1');
  String _category = 'others';
  DateTime _date = DateTime.now();
  bool _isSaving = false;
  String? _error;

  @override
  void dispose() {
    _descriptionController.dispose();
    _valueController.dispose();
    _merchantController.dispose();
    _installmentsController.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _date,
      firstDate: DateTime(2000),
      lastDate: DateTime(2100),
    );
    if (picked != null) setState(() => _date = picked);
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _isSaving = true;
      _error = null;
    });

    final purchase = CreditCardPurchase(
      id: 0,
      uuid: '',
      description: _descriptionController.text.trim(),
      totalValue:
          double.tryParse(_valueController.text.replaceAll(',', '.')) ?? 0,
      purchaseDate: _date,
      category: _category,
      card: widget.cardId,
      totalInstallments: int.tryParse(_installmentsController.text) ?? 1,
      merchant: _merchantController.text.trim().isEmpty
          ? null
          : _merchantController.text.trim(),
    );

    try {
      await ref
          .read(creditCardPurchasesServiceProvider)
          .create(purchase.toJson());
      ref.invalidate(creditCardBillsProvider(widget.cardId));
      ref.invalidate(creditCardsProvider);
      if (mounted) Navigator.of(context).pop(true);
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: SingleChildScrollView(
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
                'Nova compra',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              SizedBox(height: AppSpacing.md),
              TextFormField(
                controller: _descriptionController,
                decoration: const InputDecoration(labelText: 'Descrição'),
                validator: (v) =>
                    (v == null || v.isEmpty) ? 'Informe uma descrição' : null,
              ),
              SizedBox(height: AppSpacing.sm),
              TextFormField(
                controller: _valueController,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(labelText: 'Valor total'),
                validator: (v) =>
                    (v == null || v.isEmpty) ? 'Informe o valor' : null,
              ),
              SizedBox(height: AppSpacing.sm),
              DropdownButtonFormField<String>(
                value: _category,
                isExpanded: true,
                decoration: const InputDecoration(labelText: 'Categoria'),
                items: ChoiceLabels.expenseCategories.entries
                    .map((e) =>
                        DropdownMenuItem(value: e.key, child: Text(e.value)))
                    .toList(),
                onChanged: (v) => setState(() => _category = v!),
              ),
              SizedBox(height: AppSpacing.sm),
              TextFormField(
                controller: _merchantController,
                decoration: const InputDecoration(
                    labelText: 'Estabelecimento (opcional)'),
              ),
              SizedBox(height: AppSpacing.sm),
              TextFormField(
                controller: _installmentsController,
                keyboardType: TextInputType.number,
                decoration:
                    const InputDecoration(labelText: 'Número de parcelas'),
                validator: (v) {
                  final n = int.tryParse(v ?? '');
                  if (n == null || n < 1 || n > 48) {
                    return 'Informe um número entre 1 e 48';
                  }
                  return null;
                },
              ),
              SizedBox(height: AppSpacing.sm),
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Data da compra'),
                subtitle: Text(AppFormatters.date(_date)),
                trailing: const Icon(Icons.calendar_today_outlined, size: 18),
                onTap: _pickDate,
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
              SizedBox(height: AppSpacing.md),
            ],
          ),
        ),
      ),
    );
  }
}
