import '../models/fixed_item.dart';
import 'base_service.dart';

/// CRUD + lançamento em lote de despesas/receitas fixas. As duas APIs são
/// idênticas exceto pelo caminho e pela chave do payload de lançamento.
class FixedItemsService extends BaseService<FixedItem> {
  final String _valuesKey;
  final String _idKey;

  FixedItemsService(
    super.client, {
    required super.resourcePath,
    required String valuesKey,
    required String idKey,
  })  : _valuesKey = valuesKey,
        _idKey = idKey,
        super(fromJson: FixedItem.fromJson, toJson: _toJson);

  static Map<String, dynamic> _toJson(FixedItem i) => i.toJson();

  /// Meses (`YYYY-MM`) em que todos os templates ativos já foram lançados.
  Future<List<String>> fullyGeneratedMonths() async {
    final r = await client.dio
        .get<Map<String, dynamic>>('${resourcePath}generated-months/');
    if ((r.statusCode ?? 0) >= 400) throw ApiException(r.statusCode, r.data);
    return ((r.data?['fully_generated_months'] as List?) ?? const [])
        .cast<String>();
  }

  /// [values]: `id -> valor`; [dates]: `id -> yyyy-MM-dd` (opcional).
  Future<int> generate(
    String month,
    Map<int, double> values, {
    Map<int, String> dates = const {},
  }) async {
    final r = await client.dio.post<Map<String, dynamic>>(
      '${resourcePath}generate/',
      data: {
        'month': month,
        _valuesKey: [
          for (final e in values.entries)
            {
              _idKey: e.key,
              'value': e.value,
              if (dates[e.key] != null) 'date': dates[e.key],
            },
        ],
      },
    );
    if ((r.statusCode ?? 0) >= 400) throw ApiException(r.statusCode, r.data);
    return (r.data?['created_count'] as int?) ?? 0;
  }
}
