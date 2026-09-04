import '../utils/formatters.dart';

/// Mirrors `MemberSerializer` (`apps/api/members/serializers.py`). Members are
/// people the user tracks (loan counterparties, dependents). `document` (CPF)
/// is write-only — never returned; the profile photo is served at
/// `/api/v1/members/<id>/photo/` when `profilePhoto` is non-null, and photo
/// *upload* stays on the web app (needs a native image picker).
class Member {
  final int id;
  final String uuid;
  final String name;
  final String? phone;
  final String? email;
  final String? sex;
  final DateTime? birthDate;
  final String? address;
  final String? occupation;
  final double? monthlyIncome;
  final String? emergencyContact;
  final String? notes;
  final bool isCreditor;
  final bool isBenefited;
  final bool active;
  final String? profilePhoto;
  final int? user;

  const Member({
    required this.id,
    required this.uuid,
    required this.name,
    required this.isCreditor,
    required this.isBenefited,
    required this.active,
    this.phone,
    this.email,
    this.sex,
    this.birthDate,
    this.address,
    this.occupation,
    this.monthlyIncome,
    this.emergencyContact,
    this.notes,
    this.profilePhoto,
    this.user,
  });

  factory Member.fromJson(Map<String, dynamic> json) => Member(
        id: json['id'] as int,
        uuid: json['uuid'] as String? ?? '',
        name: json['name'] as String? ?? '',
        phone: json['phone'] as String?,
        email: json['email'] as String?,
        sex: json['sex'] as String?,
        birthDate: AppFormatters.parseApiDate(json['birth_date'] as String?),
        address: json['address'] as String?,
        occupation: json['occupation'] as String?,
        monthlyIncome: json['monthly_income'] == null
            ? null
            : AppFormatters.toDouble(json['monthly_income']),
        emergencyContact: json['emergency_contact'] as String?,
        notes: json['notes'] as String?,
        isCreditor: json['is_creditor'] as bool? ?? false,
        isBenefited: json['is_benefited'] as bool? ?? false,
        active: json['active'] as bool? ?? true,
        profilePhoto: json['profile_photo'] as String?,
        user: json['user'] as int?,
      );

  Map<String, dynamic> toJson({String? document}) => {
        'name': name,
        if (document != null && document.isNotEmpty) 'document': document,
        if (phone != null) 'phone': phone,
        if (email != null && email!.isNotEmpty) 'email': email,
        if (sex != null) 'sex': sex,
        if (birthDate != null) 'birth_date': AppFormatters.apiDate(birthDate!),
        if (address != null && address!.isNotEmpty) 'address': address,
        if (occupation != null && occupation!.isNotEmpty)
          'occupation': occupation,
        if (monthlyIncome != null) 'monthly_income': monthlyIncome,
        if (emergencyContact != null && emergencyContact!.isNotEmpty)
          'emergency_contact': emergencyContact,
        if (notes != null && notes!.isNotEmpty) 'notes': notes,
        'is_creditor': isCreditor,
        'is_benefited': isBenefited,
        'active': active,
      };
}
