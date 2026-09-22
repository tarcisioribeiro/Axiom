import 'dart:convert';
import 'dart:typed_data';

import 'package:archive/archive.dart';
import 'package:axiom_mobile/utils/epub_text.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('parseEpub follows the spine and strips html', () {
    final a = Archive()
      ..addFile(_f('META-INF/container.xml',
          '<container><rootfiles><rootfile full-path="OEBPS/c.opf"/></rootfiles></container>'))
      ..addFile(_f(
          'OEBPS/c.opf',
          '<package><manifest><item id="b" href="b.xhtml"/><item id="a" href="a.xhtml"/></manifest>'
              '<spine><itemref idref="a"/><itemref idref="b"/></spine></package>'))
      ..addFile(_f('OEBPS/a.xhtml',
          '<body><style>x{}</style><p>Ol&aacute;&amp; um</p><p>dois</p></body>'))
      ..addFile(_f('OEBPS/b.xhtml', '<body><h1>Fim</h1></body>'));
    final chapters = parseEpub(Uint8List.fromList(ZipEncoder().encode(a)));
    expect(chapters.length, 2);
    expect(chapters[0].text, contains('& um'));
    expect(chapters[0].text, isNot(contains('x{}')));
    expect(chapters[1].text, 'Fim');
  });
}

ArchiveFile _f(String name, String body) {
  final bytes = utf8.encode(body);
  return ArchiveFile(name, bytes.length, bytes);
}
