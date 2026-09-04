import '../models/member.dart';
import 'base_service.dart';

class MembersService extends BaseService<Member> {
  MembersService(super.client)
      : super(
          resourcePath: '/api/v1/members/',
          fromJson: Member.fromJson,
          toJson: (m) => m.toJson(),
        );

  /// `members/me/` — the [Member] record tied to the logged-in user, or
  /// `null` when the user has no member profile yet (loans then can't be
  /// created from mobile; the web app handles first-time member setup).
  Future<Member?> me() async {
    final response =
        await client.dio.get<Map<String, dynamic>>('${resourcePath}me/');
    final status = response.statusCode ?? 0;
    if (status == 404) return null;
    if (status >= 400) throw ApiException(status, response.data);
    return Member.fromJson(response.data!);
  }

  /// Quick-create used by the loan form's member picker. [document] is a
  /// CPF — the backend hashes it and enforces uniqueness, so a duplicate
  /// surfaces as an [ApiException]. `phone` is required by the backend.
  Future<Member> quickCreate({
    required String name,
    required String document,
    required String phone,
    String sex = 'M',
    bool isBenefited = false,
    bool isCreditor = false,
  }) {
    return create({
      'name': name,
      'document': document,
      'phone': phone,
      'sex': sex,
      'is_benefited': isBenefited,
      'is_creditor': isCreditor,
      'active': true,
    });
  }
}
