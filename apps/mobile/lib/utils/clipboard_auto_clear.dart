import 'package:flutter/services.dart';

/// How long a value copied from the vault (card number, account number,
/// password) is allowed to sit on the system clipboard before being wiped —
/// mirrors the 30s auto-hide already used for on-screen reveal.
const Duration kClipboardAutoClearDelay = Duration(seconds: 30);

/// Copies [text] to the clipboard and schedules it to be wiped after
/// [delay], but only if the clipboard still holds exactly what we put there
/// — if the user copied something else in the meantime, that value is left
/// alone.
Future<void> copyToClipboardWithAutoClear(
  String text, {
  Duration delay = kClipboardAutoClearDelay,
}) async {
  await Clipboard.setData(ClipboardData(text: text));
  Future.delayed(delay, () async {
    final current = await Clipboard.getData(Clipboard.kTextPlain);
    if (current?.text == text) {
      await Clipboard.setData(const ClipboardData(text: ''));
    }
  });
}
