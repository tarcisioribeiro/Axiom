import 'package:axiom_mobile/utils/formatters.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';

void main() {
  setUpAll(() async {
    await initializeDateFormatting('pt_BR', null);
  });

  group('AppFormatters.toDouble', () {
    test('parses DRF DecimalField strings', () {
      expect(AppFormatters.toDouble('1234.56'), 1234.56);
    });

    test('passes through numeric values', () {
      expect(AppFormatters.toDouble(42), 42.0);
      expect(AppFormatters.toDouble(3.5), 3.5);
    });

    test('defaults to zero for null/invalid input', () {
      expect(AppFormatters.toDouble(null), 0);
      expect(AppFormatters.toDouble('not-a-number'), 0);
    });
  });

  group('AppFormatters.currency', () {
    test('formats as BRL', () {
      final formatted = AppFormatters.currency(1234.5);
      expect(formatted, contains('R\$'));
      expect(formatted, contains('1.234,50'));
    });
  });

  group('AppFormatters date helpers', () {
    test('apiDate/parseApiDate round-trip', () {
      final date = DateTime(2026, 3, 5);
      final wire = AppFormatters.apiDate(date);
      expect(wire, '2026-03-05');
      final parsed = AppFormatters.parseApiDate(wire);
      expect(parsed, DateTime(2026, 3, 5));
    });

    test('parseApiDate returns null for empty/null input', () {
      expect(AppFormatters.parseApiDate(null), isNull);
      expect(AppFormatters.parseApiDate(''), isNull);
    });

    test('date formats as dd/MM/yyyy', () {
      expect(AppFormatters.date(DateTime(2026, 3, 5)), '05/03/2026');
    });
  });
}
