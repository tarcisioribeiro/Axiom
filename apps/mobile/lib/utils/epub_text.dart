import 'dart:convert';
import 'dart:typed_data';

import 'package:archive/archive.dart';
import 'package:xml/xml.dart';

class EpubChapter {
  final String title;
  final String text;
  const EpubChapter(this.title, this.text);
}

/// Extrai o texto de um EPUB na ordem do *spine*. Leitor simples: sem
/// imagens nem estilos (ponytail: para render fiel, trocar por um leitor
/// EPUB nativo/WebView).
List<EpubChapter> parseEpub(Uint8List bytes) {
  final zip = ZipDecoder().decodeBytes(bytes);
  ArchiveFile? find(String path) {
    for (final f in zip) {
      if (f.name == path) return f;
    }
    return null;
  }

  String read(ArchiveFile f) =>
      utf8.decode(f.content as List<int>, allowMalformed: true);

  final container = find('META-INF/container.xml');
  if (container == null) throw const FormatException('EPUB inválido.');
  final opfPath = XmlDocument.parse(read(container))
      .findAllElements('rootfile')
      .first
      .getAttribute('full-path')!;
  final opf = XmlDocument.parse(read(find(opfPath)!));
  final base = opfPath.contains('/')
      ? opfPath.substring(0, opfPath.lastIndexOf('/') + 1)
      : '';

  final manifest = {
    for (final i in opf.findAllElements('item'))
      i.getAttribute('id')!: i.getAttribute('href')!,
  };

  final chapters = <EpubChapter>[];
  for (final ref in opf.findAllElements('itemref')) {
    final href = manifest[ref.getAttribute('idref')];
    if (href == null) continue;
    final file = find(Uri.decodeFull('$base$href').split('#').first);
    if (file == null) continue;
    final text = htmlToText(read(file));
    if (text.trim().isEmpty) continue;
    chapters.add(EpubChapter('Parte ${chapters.length + 1}', text));
  }
  return chapters;
}

String htmlToText(String html) {
  var s = html
      .replaceAll(
          RegExp(r'<(script|style)[\s\S]*?</\1>', caseSensitive: false), '')
      .replaceAll(RegExp(r'<br\s*/?>', caseSensitive: false), '\n')
      .replaceAll(
          RegExp(r'</(p|div|h[1-6]|li|tr)>', caseSensitive: false), '\n\n')
      .replaceAll(RegExp(r'<[^>]+>'), '');
  const entities = {
    '&nbsp;': ' ',
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
  };
  entities.forEach((k, v) => s = s.replaceAll(k, v));
  s = s.replaceAllMapped(
      RegExp(r'&#(\d+);'), (m) => String.fromCharCode(int.parse(m.group(1)!)));
  return s
      .replaceAll(RegExp(r'[ \t]+'), ' ')
      .replaceAll(RegExp(r'\n{3,}'), '\n\n')
      .trim();
}
