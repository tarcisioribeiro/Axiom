import 'package:intl/intl.dart';

/// BRL/pt-BR formatting helpers, mirroring `lib/formatters.ts` on the web
/// app (`formatCurrency`, `formatDate`, percentage formatting).
class AppFormatters {
  const AppFormatters._();

  static final NumberFormat _currency = NumberFormat.currency(
    locale: 'pt_BR',
    symbol: 'R\$',
  );
  static final NumberFormat _percent = NumberFormat.decimalPercentPattern(
    locale: 'pt_BR',
    decimalDigits: 1,
  );
  static final DateFormat _date = DateFormat('dd/MM/yyyy', 'pt_BR');
  static final DateFormat _dateTime = DateFormat('dd/MM/yyyy HH:mm', 'pt_BR');
  static final DateFormat _apiDate = DateFormat('yyyy-MM-dd');

  /// Accepts either a numeric value or a DRF `DecimalField` string (e.g.
  /// `"1234.56"`).
  static double toDouble(dynamic value) {
    if (value == null) return 0;
    if (value is num) return value.toDouble();
    return double.tryParse(value.toString()) ?? 0;
  }

  static String currency(dynamic value) => _currency.format(toDouble(value));

  static String percent(double fraction) => _percent.format(fraction);

  static String date(DateTime date) => _date.format(date);

  static String dateTime(DateTime date) => _dateTime.format(date);

  /// `YYYY-MM-DD`, the wire format every date field on the API uses.
  static String apiDate(DateTime date) => _apiDate.format(date);

  static DateTime? parseApiDate(String? value) {
    if (value == null || value.isEmpty) return null;
    return DateTime.tryParse(value);
  }
}
