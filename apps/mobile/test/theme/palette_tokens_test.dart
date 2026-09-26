import 'package:axiom_mobile/theme/app_palette_tokens.dart';
import 'package:axiom_mobile/theme/app_theme_variant.dart';
import 'package:axiom_mobile/theme/app_themes.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('every theme variant has generated palette tokens', () {
    for (final v in [...kDarkVariants, ...kLightVariants]) {
      expect(kPaletteTokens[v.id], isNotNull, reason: v.id);
      expect(v.toThemeData().extension<AppPaletteTokens>(), isNotNull);
    }
  });
}
