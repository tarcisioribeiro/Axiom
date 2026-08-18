import '../models/vault_status.dart';
import 'api_client.dart';
import 'base_service.dart';

/// `security/vault/*` — the master-password gate in front of every
/// `security/*` endpoint (passwords, stored cards/accounts, archives).
/// Locked/not-yet-configured states are reported here rather than as
/// generic errors so [SecurityScreen] can render the right form.
class VaultService {
  final ApiClient client;

  VaultService(this.client);

  static const _basePath = '/api/v1/security/vault/';

  Future<VaultStatus> status() async {
    final response =
        await client.dio.get<Map<String, dynamic>>('${_basePath}status/');
    if ((response.statusCode ?? 0) >= 400) {
      throw ApiException(response.statusCode, response.data);
    }
    return VaultStatus.fromJson(response.data!);
  }

  Future<void> setup(String masterPassword) async {
    final response = await client.dio.post<Map<String, dynamic>>(
      '${_basePath}setup/',
      data: {
        'master_password': masterPassword,
        'confirm_master_password': masterPassword,
      },
    );
    if ((response.statusCode ?? 0) >= 400) {
      throw ApiException(response.statusCode, response.data);
    }
  }

  Future<void> unlock(String masterPassword) async {
    final response = await client.dio.post<Map<String, dynamic>>(
      '${_basePath}unlock/',
      data: {'master_password': masterPassword},
    );
    if ((response.statusCode ?? 0) >= 400) {
      throw ApiException(response.statusCode, response.data);
    }
  }

  Future<void> lock() async {
    await client.dio.post('${_basePath}lock/');
  }
}
