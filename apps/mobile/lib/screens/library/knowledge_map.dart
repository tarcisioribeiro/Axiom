import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../providers/library_providers.dart';
import '../../widgets/empty_state.dart';
import '../../widgets/loading_state.dart';

const _typeColors = {
  'book': Colors.blue,
  'author': Colors.orange,
  'course': Colors.green,
  'skill': Colors.purple,
  'summary': Colors.teal,
  'highlight': Colors.amber,
};

class _Node {
  final String id;
  final String type;
  final String label;
  Offset pos;
  Offset vel = Offset.zero;
  _Node(this.id, this.type, this.label, this.pos);
}

/// Mapa do grafo de conhecimento: layout de forças (repulsão + molas)
/// calculado uma vez ao carregar; toque num nó mostra o nome.
/// Limitado a 150 nós (O(n²) por iteração).
class KnowledgeMap extends ConsumerStatefulWidget {
  const KnowledgeMap({super.key});

  @override
  ConsumerState<KnowledgeMap> createState() => _KnowledgeMapState();
}

class _KnowledgeMapState extends ConsumerState<KnowledgeMap> {
  static const _size = 900.0;
  List<_Node> _nodes = const [];
  List<(int, int)> _edges = const [];
  Object? _laidOutFor;
  _Node? _selected;

  void _layout(Map<String, dynamic> data) {
    final raw = ((data['nodes'] as List?) ?? const []).take(150).toList();
    final rnd = math.Random(7);
    final nodes = [
      for (final n in raw)
        _Node(
          n['id'] as String,
          n['type'] as String? ?? '',
          n['label'] as String? ?? '',
          Offset(_size / 2 + rnd.nextDouble() * 200 - 100,
              _size / 2 + rnd.nextDouble() * 200 - 100),
        ),
    ];
    final index = {for (var i = 0; i < nodes.length; i++) nodes[i].id: i};
    final edges = <(int, int)>[
      for (final l in (data['links'] as List?) ?? const [])
        if (index[l['source']] != null && index[l['target']] != null)
          (index[l['source']]!, index[l['target']]!),
    ];
    for (var it = 0; it < 200; it++) {
      for (var i = 0; i < nodes.length; i++) {
        var f = (Offset(_size / 2, _size / 2) - nodes[i].pos) * 0.002;
        for (var j = 0; j < nodes.length; j++) {
          if (i == j) continue;
          final d = nodes[i].pos - nodes[j].pos;
          final dist = math.max(d.distance, 1.0);
          f += d / dist * (6000 / (dist * dist));
        }
        nodes[i].vel = (nodes[i].vel + f) * 0.85;
      }
      for (final (a, b) in edges) {
        final d = nodes[b].pos - nodes[a].pos;
        final pull = d * ((d.distance - 90) * 0.0008);
        nodes[a].vel += pull;
        nodes[b].vel -= pull;
      }
      for (final n in nodes) {
        n.pos += n.vel;
      }
    }
    _nodes = nodes;
    _edges = edges;
  }

  void _tap(Offset p) {
    _Node? best;
    var bestD = 22.0;
    for (final n in _nodes) {
      final d = (n.pos - p).distance;
      if (d < bestD) {
        best = n;
        bestD = d;
      }
    }
    setState(() => _selected = best);
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(knowledgeGraphProvider);
    return async.when(
      loading: () => const LoadingState(variant: LoadingVariant.list),
      error: (e, _) => Center(child: Text('Erro: $e')),
      data: (data) {
        if (_laidOutFor != data) {
          _layout(data);
          _laidOutFor = data;
        }
        if (_nodes.isEmpty) {
          return const EmptyState(
              icon: Icons.hub_outlined, title: 'Grafo vazio');
        }
        return Stack(children: [
          InteractiveViewer(
            constrained: false,
            minScale: 0.3,
            maxScale: 3,
            boundaryMargin: const EdgeInsets.all(200),
            child: GestureDetector(
              onTapUp: (d) => _tap(d.localPosition),
              child: CustomPaint(
                size: const Size(_size, _size),
                painter: _MapPainter(
                    _nodes, _edges, _selected, Theme.of(context).colorScheme),
              ),
            ),
          ),
          Positioned(
            left: 12,
            right: 12,
            bottom: 12,
            child: Wrap(spacing: 8, children: [
              for (final e in _typeColors.entries)
                Chip(
                  visualDensity: VisualDensity.compact,
                  avatar: CircleAvatar(backgroundColor: e.value, radius: 6),
                  label: Text(e.key, style: const TextStyle(fontSize: 11)),
                ),
              if (_selected != null)
                Chip(
                    label: Text(_selected!.label,
                        overflow: TextOverflow.ellipsis)),
            ]),
          ),
        ]);
      },
    );
  }
}

class _MapPainter extends CustomPainter {
  final List<_Node> nodes;
  final List<(int, int)> edges;
  final _Node? selected;
  final ColorScheme scheme;
  _MapPainter(this.nodes, this.edges, this.selected, this.scheme);

  @override
  void paint(Canvas canvas, Size size) {
    final line = Paint()
      ..color = scheme.outline.withValues(alpha: 0.5)
      ..strokeWidth = 1;
    for (final (a, b) in edges) {
      canvas.drawLine(nodes[a].pos, nodes[b].pos, line);
    }
    for (final n in nodes) {
      final c = _typeColors[n.type] ?? Colors.grey;
      canvas.drawCircle(n.pos, n == selected ? 10 : 7, Paint()..color = c);
      final tp = TextPainter(
        text: TextSpan(
          text: n.label.length > 18 ? '${n.label.substring(0, 17)}…' : n.label,
          style: TextStyle(fontSize: 9, color: scheme.onSurface),
        ),
        textDirection: TextDirection.ltr,
      )..layout();
      tp.paint(canvas, n.pos + const Offset(9, -5));
    }
  }

  @override
  bool shouldRepaint(_MapPainter old) =>
      old.selected != selected || old.nodes != nodes;
}
