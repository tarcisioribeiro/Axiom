/* eslint-disable max-lines */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Highlighter,
  Link2,
  Maximize2,
  Network,
  Search,
  Sparkles,
  Trash2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ForceGraph2D } from 'react-force-graph';
import { useTranslation } from 'react-i18next';

import { AnimatedPage } from '@/components/common/AnimatedPage';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { STALE_TIMES } from '@/lib/query-client';
import { cn } from '@/lib/utils';
import { knowledgeGraphService } from '@/services/knowledge-graph-service';
import { membersService } from '@/services/members-service';
import type {
  GraphLink,
  GraphNode,
  KnowledgeLinkFormData,
  KnowledgeLinkRelation,
  KnowledgeNodeType,
} from '@/types/intellect';
import { getErrorMessage } from '@/utils/error-utils';

// ============================================================================
// CONSTANTS
// ============================================================================

const NODE_COLOR_VARS: Record<KnowledgeNodeType, string> = {
  book: '--primary',
  author: '--accent',
  course: '--success',
  skill: '--warning',
  summary: '--info',
  highlight: '--category-exercise',
};

const RELATION_COLOR_VARS: Record<KnowledgeLinkRelation, string> = {
  relates: '--muted-foreground',
  supports: '--success',
  contradicts: '--destructive',
  deepens: '--info',
  derived_from: '--warning',
  applies: '--category-exercise',
};

const NODE_SIZES: Record<KnowledgeNodeType, number> = {
  book: 9,
  author: 7,
  course: 8,
  skill: 7,
  summary: 6,
  highlight: 5,
};

const NODE_ICONS: Record<KnowledgeNodeType, string> = {
  book: '📖',
  author: '✍️',
  course: '🎓',
  skill: '⚡',
  summary: '📝',
  highlight: '✨',
};

const ALL_NODE_TYPES: KnowledgeNodeType[] = [
  'book',
  'author',
  'course',
  'skill',
  'summary',
  'highlight',
];

const ALL_RELATIONS: KnowledgeLinkRelation[] = [
  'relates',
  'supports',
  'contradicts',
  'deepens',
  'derived_from',
  'applies',
];

// ============================================================================
// CANVAS COLOR HELPERS
// ============================================================================

interface CanvasColors {
  nodes: Record<KnowledgeNodeType, string>;
  relations: Record<KnowledgeLinkRelation, string>;
  labelBg: string;
  labelText: string;
  labelDim: string;
  linkDim: string;
  linkImplicit: string;
  linkingRing: string;
}

function readCanvasColors(): CanvasColors {
  const style = getComputedStyle(document.documentElement);
  const hsl = (v: string) => `hsl(${style.getPropertyValue(v).trim()})`;
  const hsla = (v: string, a: number) =>
    `hsl(${style.getPropertyValue(v).trim()} / ${a})`;
  return {
    nodes: {
      book: hsl('--primary'),
      author: hsl('--accent'),
      course: hsl('--success'),
      skill: hsl('--warning'),
      summary: hsl('--info'),
      highlight: hsl('--category-exercise'),
    },
    relations: {
      relates: hsl('--muted-foreground'),
      supports: hsl('--success'),
      contradicts: hsl('--destructive'),
      deepens: hsl('--info'),
      derived_from: hsl('--warning'),
      applies: hsl('--category-exercise'),
    },
    labelBg: hsla('--card', 0.92),
    labelText: hsl('--card-foreground'),
    labelDim: hsl('--muted-foreground'),
    linkDim: hsla('--muted-foreground', 0.1),
    linkImplicit: hsla('--muted-foreground', 0.35),
    linkingRing: hsl('--accent'),
  };
}

// ============================================================================
// NODE DETAIL PANEL
// ============================================================================

function NodeDetailPanel({
  node,
  onClose,
  onDeleteLink,
  linkingFrom,
  onStartLink,
  links,
}: {
  node: GraphNode;
  onClose: () => void;
  onDeleteLink: (linkId: number) => void;
  linkingFrom: GraphNode | null;
  onStartLink: (node: GraphNode) => void;
  links: GraphLink[];
}) {
  const { t } = useTranslation();

  const explicitLinks = links.filter(
    (l) =>
      l.type === 'explicit' &&
      ((l.source as GraphNode).id === node.id || (l.target as GraphNode).id === node.id)
  );

  const nodeColorVar = NODE_COLOR_VARS[node.type];

  return (
    <motion.div
      initial={{ x: 320, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 320, opacity: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className="absolute right-0 top-0 z-20 flex h-full w-80 flex-col border-l border-border bg-card shadow-2xl"
    >
      {/* Header */}
      <div
        className="flex items-center justify-between border-b border-border px-md py-sm"
        style={{
          borderLeftColor: `hsl(var(${nodeColorVar}))`,
          borderLeftWidth: 3,
        }}
      >
        <div className="flex items-center gap-sm">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full text-sm"
            style={{
              backgroundColor: `hsl(var(${nodeColorVar}) / 0.2)`,
            }}
          >
            <span>{NODE_ICONS[node.type]}</span>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">
              {t(`pages.knowledgeGraph.nodeTypes.${node.type}`)}
            </p>
            <p className="line-clamp-2 text-sm font-semibold leading-tight">
              {node.label}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Metadata */}
      <div className="flex-1 overflow-y-auto p-md">
        <div className="space-y-sm">
          {node.type === 'book' && node.metadata && (
            <>
              {node.metadata.genre && (
                <MetaRow
                  label={t('pages.knowledgeGraph.meta.genre')}
                  value={node.metadata.genre}
                />
              )}
              {node.metadata.read_status && (
                <MetaRow
                  label={t('pages.knowledgeGraph.meta.status')}
                  value={node.metadata.read_status}
                />
              )}
              {node.metadata.pages && (
                <MetaRow
                  label={t('pages.knowledgeGraph.meta.pages')}
                  value={String(node.metadata.pages)}
                />
              )}
              {node.metadata.rating && (
                <MetaRow
                  label={t('pages.knowledgeGraph.meta.rating')}
                  value={`${node.metadata.rating}/5`}
                />
              )}
            </>
          )}
          {node.type === 'author' && node.metadata && (
            <MetaRow
              label={t('pages.knowledgeGraph.meta.nationality')}
              value={node.metadata.nationality_display ?? '—'}
            />
          )}
          {node.type === 'course' && node.metadata && (
            <>
              {node.metadata.platform && (
                <MetaRow
                  label={t('pages.knowledgeGraph.meta.platform')}
                  value={node.metadata.platform}
                />
              )}
              {node.metadata.category && (
                <MetaRow
                  label={t('pages.knowledgeGraph.meta.category')}
                  value={node.metadata.category}
                />
              )}
              {node.metadata.status && (
                <MetaRow
                  label={t('pages.knowledgeGraph.meta.status')}
                  value={node.metadata.status}
                />
              )}
              {node.metadata.progress_percentage !== undefined && (
                <div>
                  <p className="mb-xs text-xs text-muted-foreground">
                    {t('pages.knowledgeGraph.meta.progress')}
                  </p>
                  <div className="h-1.5 rounded-full bg-muted">
                    <div
                      className="h-1.5 rounded-full"
                      style={{
                        width: `${node.metadata.progress_percentage}%`,
                        backgroundColor: 'hsl(var(--success))',
                      }}
                    />
                  </div>
                  <p className="mt-xs text-right text-xs text-muted-foreground">
                    {node.metadata.progress_percentage}%
                  </p>
                </div>
              )}
            </>
          )}
          {node.type === 'skill' && node.metadata && (
            <>
              {node.metadata.category && (
                <MetaRow
                  label={t('pages.knowledgeGraph.meta.category')}
                  value={node.metadata.category}
                />
              )}
              {node.metadata.proficiency && (
                <MetaRow
                  label={t('pages.knowledgeGraph.meta.proficiency')}
                  value={node.metadata.proficiency}
                />
              )}
              {node.metadata.status && (
                <MetaRow
                  label={t('pages.knowledgeGraph.meta.status')}
                  value={node.metadata.status}
                />
              )}
            </>
          )}
          {node.type === 'summary' && node.metadata && (
            <MetaRow
              label={t('pages.knowledgeGraph.meta.book')}
              value={node.metadata.book_title ?? '—'}
            />
          )}
          {node.type === 'highlight' && node.metadata && (
            <>
              {node.metadata.highlight_type && (
                <MetaRow
                  label={t('pages.knowledgeGraph.meta.type')}
                  value={node.metadata.highlight_type}
                />
              )}
              {node.metadata.page_number && (
                <MetaRow
                  label={t('pages.knowledgeGraph.meta.page')}
                  value={String(node.metadata.page_number)}
                />
              )}
            </>
          )}
        </div>

        {/* Explicit links */}
        {explicitLinks.length > 0 && (
          <div className="mt-lg">
            <p className="mb-sm text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {t('pages.knowledgeGraph.explicitConnections')}
            </p>
            <div className="space-y-sm">
              {explicitLinks.map((link, i) => {
                const other =
                  (link.source as GraphNode).id === node.id
                    ? (link.target as GraphNode)
                    : (link.source as GraphNode);
                const relVar =
                  RELATION_COLOR_VARS[link.relation as KnowledgeLinkRelation] ??
                  '--muted-foreground';
                return (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-md bg-muted/40 px-sm py-xs"
                  >
                    <div className="flex min-w-0 items-center gap-xs">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{
                          backgroundColor: `hsl(var(${relVar}))`,
                        }}
                      />
                      <span className="truncate text-xs">{other.label}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        ({link.relation_display ?? link.relation})
                      </span>
                    </div>
                    {link.link_id && (
                      <button
                        onClick={() => onDeleteLink(link.link_id!)}
                        className="ml-xs shrink-0 text-destructive/60 transition-colors hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="border-t border-border p-md">
        <Button
          size="sm"
          variant={linkingFrom?.id === node.id ? 'default' : 'outline'}
          className="w-full"
          onClick={() => onStartLink(node)}
        >
          <Link2 className="mr-sm h-3.5 w-3.5" />
          {linkingFrom?.id === node.id
            ? t('pages.knowledgeGraph.clickToConnect')
            : t('pages.knowledgeGraph.createLink')}
        </Button>
      </div>
    </motion.div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-sm">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-right text-xs font-medium capitalize">{value}</span>
    </div>
  );
}

// ============================================================================
// CREATE LINK MODAL
// ============================================================================

function CreateLinkModal({
  from,
  to,
  onConfirm,
  onCancel,
  isLoading,
}: {
  from: GraphNode;
  to: GraphNode;
  onConfirm: (relation: KnowledgeLinkRelation) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const { t } = useTranslation();
  const [relation, setRelation] = useState<KnowledgeLinkRelation>('relates');

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.92, opacity: 0 }}
        className="w-96 rounded-lg border border-border bg-card p-lg shadow-2xl"
      >
        <h3 className="mb-md text-base font-semibold">
          {t('pages.knowledgeGraph.createLinkModal.title')}
        </h3>
        <div className="mb-md flex items-center gap-sm text-sm">
          <span
            className="rounded-md px-sm py-0.5 text-xs font-medium"
            style={{
              backgroundColor: `hsl(var(${NODE_COLOR_VARS[from.type]}) / 0.2)`,
              color: `hsl(var(${NODE_COLOR_VARS[from.type]}))`,
            }}
          >
            {from.label.length > 24 ? from.label.slice(0, 24) + '…' : from.label}
          </span>
          <span className="text-muted-foreground">→</span>
          <span
            className="rounded-md px-sm py-0.5 text-xs font-medium"
            style={{
              backgroundColor: `hsl(var(${NODE_COLOR_VARS[to.type]}) / 0.2)`,
              color: `hsl(var(${NODE_COLOR_VARS[to.type]}))`,
            }}
          >
            {to.label.length > 24 ? to.label.slice(0, 24) + '…' : to.label}
          </span>
        </div>

        <div className="mb-lg grid grid-cols-3 gap-sm">
          {ALL_RELATIONS.map((key) => (
            <button
              key={key}
              onClick={() => setRelation(key)}
              className={cn(
                'rounded-md border px-sm py-xs text-xs transition-all',
                relation === key
                  ? 'border-transparent text-background'
                  : 'border-border bg-muted/30 text-foreground hover:bg-muted'
              )}
              style={
                relation === key
                  ? {
                      backgroundColor: `hsl(var(${RELATION_COLOR_VARS[key]}))`,
                    }
                  : {}
              }
            >
              {t(`pages.knowledgeGraph.relations.${key}`)}
            </button>
          ))}
        </div>

        <div className="flex justify-end gap-sm">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            {t('pages.knowledgeGraph.createLinkModal.cancel')}
          </Button>
          <Button size="sm" onClick={() => onConfirm(relation)} disabled={isLoading}>
            {isLoading
              ? t('pages.knowledgeGraph.createLinkModal.creating')
              : t('pages.knowledgeGraph.createLinkModal.confirm')}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function KnowledgeGraph() {
  const { t } = useTranslation();
  const graphRef = useRef<{ zoomToFit: (ms?: number) => void } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const colorsRef = useRef<CanvasColors>(readCanvasColors());
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [linkingFrom, setLinkingFrom] = useState<GraphNode | null>(null);
  const [linkTarget, setLinkTarget] = useState<GraphNode | null>(null);
  const [search, setSearch] = useState('');
  const [activeTypes, setActiveTypes] = useState<Set<KnowledgeNodeType>>(
    new Set(ALL_NODE_TYPES)
  );
  const [includeHighlights, setIncludeHighlights] = useState(false);

  const { showConfirm } = useAlertDialog();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Update canvas colors when theme changes
  useEffect(() => {
    const observer = new MutationObserver(() => {
      colorsRef.current = readCanvasColors();
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
    return () => observer.disconnect();
  }, []);

  // Dimensions observer
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Data
  const { data: graphData, isLoading } = useQuery({
    queryKey: ['knowledge-graph', includeHighlights],
    queryFn: () => knowledgeGraphService.getGraph(includeHighlights),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const { data: memberData } = useQuery({
    queryKey: ['me'],
    queryFn: () => membersService.getCurrentUserMember(),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  // Mutations
  const createLinkMutation = useMutation({
    mutationFn: (data: KnowledgeLinkFormData) => knowledgeGraphService.createLink(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['knowledge-graph'] });
      toast({ title: t('pages.knowledgeGraph.toasts.linkCreated') });
      setLinkingFrom(null);
      setLinkTarget(null);
    },
    onError: (error) => {
      toast({
        title: t('pages.knowledgeGraph.toasts.linkCreateError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    },
  });

  const deleteLinkMutation = useMutation({
    mutationFn: (id: number) => knowledgeGraphService.deleteLink(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['knowledge-graph'] });
      toast({ title: t('pages.knowledgeGraph.toasts.linkDeleted') });
    },
  });

  // Filtered graph data
  const filteredGraphData = useMemo(() => {
    if (!graphData) return { nodes: [], links: [] };

    const lowerSearch = search.toLowerCase();
    const visibleNodes = graphData.nodes.filter(
      (n) =>
        activeTypes.has(n.type) &&
        (lowerSearch === '' || n.label.toLowerCase().includes(lowerSearch))
    );
    const visibleIds = new Set(visibleNodes.map((n) => n.id));

    const visibleLinks = graphData.links.filter((l) => {
      const srcId = typeof l.source === 'string' ? l.source : l.source.id;
      const tgtId = typeof l.target === 'string' ? l.target : l.target.id;
      return visibleIds.has(srcId) && visibleIds.has(tgtId);
    });

    return { nodes: visibleNodes, links: visibleLinks };
  }, [graphData, activeTypes, search]);

  // Node neighbors for highlight effect
  const highlightedNeighbors = useMemo(() => {
    if (!hoveredNode && !selectedNode) return new Set<string>();
    const focusId = hoveredNode?.id ?? selectedNode?.id;
    if (!focusId) return new Set<string>();
    const neighbors = new Set<string>([focusId]);
    filteredGraphData.links.forEach((l) => {
      const src = typeof l.source === 'string' ? l.source : l.source.id;
      const tgt = typeof l.target === 'string' ? l.target : l.target.id;
      if (src === focusId) neighbors.add(tgt);
      if (tgt === focusId) neighbors.add(src);
    });
    return neighbors;
  }, [hoveredNode, selectedNode, filteredGraphData.links]);

  const hasFocus = highlightedNeighbors.size > 0 && (hoveredNode || selectedNode);

  // Node canvas renderer
  const nodeCanvasObject = useCallback(
    (node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const { x = 0, y = 0 } = node;
      const baseSize = NODE_SIZES[node.type];
      const isFocused = highlightedNeighbors.has(node.id);
      const isDimmed = hasFocus && !isFocused;
      const isHovered = hoveredNode?.id === node.id;
      const isSelected = selectedNode?.id === node.id;
      const isLinking = linkingFrom?.id === node.id;

      const colors = colorsRef.current;
      const color = colors.nodes[node.type];
      const alpha = isDimmed ? 0.15 : 1;

      ctx.globalAlpha = alpha;

      // Glow for focused/hovered
      if (isHovered || isSelected || isLinking) {
        ctx.shadowColor = color;
        ctx.shadowBlur = 12;
      }

      // Outer ring for selected / linking
      if (isSelected || isLinking) {
        ctx.beginPath();
        ctx.arc(x, y, baseSize + 3, 0, 2 * Math.PI);
        ctx.strokeStyle = isLinking ? colors.linkingRing : color;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Main circle
      ctx.beginPath();
      ctx.arc(x, y, baseSize, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();

      ctx.shadowBlur = 0;

      // Label (show when zoomed in or focused)
      if (globalScale >= 1.5 || isHovered || isSelected) {
        const label =
          node.label.length > 20 ? node.label.slice(0, 20) + '…' : node.label;
        const fontSize = Math.max(9, 11 / globalScale);
        ctx.font = `${fontSize}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        const textWidth = ctx.measureText(label).width;
        const bx = x - textWidth / 2 - 3;
        const by = y + baseSize + 3;
        const bw = textWidth + 6;
        const bh = fontSize + 4;
        ctx.fillStyle = colors.labelBg;
        ctx.beginPath();
        ctx.roundRect(bx, by, bw, bh, 3);
        ctx.fill();

        ctx.fillStyle = isDimmed ? colors.labelDim : colors.labelText;
        ctx.fillText(label, x, by + 2);
      }

      ctx.globalAlpha = 1;
    },
    [highlightedNeighbors, hasFocus, hoveredNode, selectedNode, linkingFrom]
  );

  // Link color
  const getLinkColor = useCallback(
    (link: GraphLink) => {
      const srcId = typeof link.source === 'string' ? link.source : link.source.id;
      const tgtId = typeof link.target === 'string' ? link.target : link.target.id;
      const isFocused =
        hasFocus &&
        (highlightedNeighbors.has(srcId) || highlightedNeighbors.has(tgtId));
      const isDimmed = hasFocus && !isFocused;

      const colors = colorsRef.current;
      if (isDimmed) return colors.linkDim;
      if (link.type === 'explicit') {
        return (
          colors.relations[link.relation as KnowledgeLinkRelation] ??
          colors.relations.relates
        );
      }
      return colors.linkImplicit;
    },
    [hasFocus, highlightedNeighbors]
  );

  const getLinkWidth = useCallback(
    (link: GraphLink) => (link.type === 'explicit' ? 2 : 1),
    []
  );

  const getLinkDash = useCallback(
    (link: GraphLink): number[] => (link.type === 'explicit' ? [4, 3] : []),
    []
  );

  // Handlers
  const handleNodeClick = useCallback(
    (node: GraphNode) => {
      if (linkingFrom) {
        if (node.id === linkingFrom.id) {
          setLinkingFrom(null);
          return;
        }
        setLinkTarget(node);
        return;
      }
      setSelectedNode((prev) => (prev?.id === node.id ? null : node));
    },
    [linkingFrom]
  );

  const handleStartLink = useCallback((node: GraphNode) => {
    setLinkingFrom((prev) => (prev?.id === node.id ? null : node));
  }, []);

  const handleConfirmLink = useCallback(
    (relation: KnowledgeLinkRelation) => {
      if (!linkingFrom || !linkTarget || !memberData?.id) return;

      const sourceUuid = linkingFrom.id.replace(`${linkingFrom.type}-`, '');
      const targetUuid = linkTarget.id.replace(`${linkTarget.type}-`, '');

      createLinkMutation.mutate({
        source_type: linkingFrom.type,
        source_id: sourceUuid,
        target_type: linkTarget.type,
        target_id: targetUuid,
        relation_label: relation,
        owner: memberData.id,
      });
    },
    [linkingFrom, linkTarget, memberData, createLinkMutation]
  );

  const handleDeleteLink = useCallback(
    async (linkId: number) => {
      const confirmed = await showConfirm({
        title: t('pages.knowledgeGraph.deleteLink.title'),
        description: t('pages.knowledgeGraph.deleteLink.description'),
        confirmText: t('pages.knowledgeGraph.deleteLink.confirm'),
        variant: 'destructive',
      });
      if (confirmed) deleteLinkMutation.mutate(linkId);
    },
    [showConfirm, deleteLinkMutation, t]
  );

  const toggleType = (type: KnowledgeNodeType) => {
    setActiveTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        if (next.size > 1) next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  const stats = useMemo(
    () => ({
      nodes: filteredGraphData.nodes.length,
      links: filteredGraphData.links.length,
      explicit: filteredGraphData.links.filter((l) => l.type === 'explicit').length,
    }),
    [filteredGraphData]
  );

  return (
    <AnimatedPage>
      <PageContainer>
        <PageHeader
          title={t('pages.knowledgeGraph.title')}
          description={t('pages.knowledgeGraph.description')}
          icon={<Network className="h-5 w-5" />}
        />

        <div className="relative flex h-[calc(100vh-12rem)] overflow-hidden rounded-lg border border-border bg-card">
          {/* Left sidebar */}
          <div className="z-10 flex w-52 shrink-0 flex-col gap-md border-r border-border bg-card p-md">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t('pages.knowledgeGraph.search')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 pl-xl text-xs"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* Node type filters */}
            <div>
              <p className="mb-sm text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {t('pages.knowledgeGraph.nodeTypesFilter')}
              </p>
              <div className="space-y-xs">
                {ALL_NODE_TYPES.filter(
                  (tp) => tp !== 'highlight' || includeHighlights
                ).map((type) => (
                  <button
                    key={type}
                    onClick={() => toggleType(type)}
                    className={cn(
                      'flex w-full items-center gap-sm rounded-md px-sm py-xs text-xs transition-all',
                      activeTypes.has(type)
                        ? 'bg-muted/60 text-foreground'
                        : 'text-muted-foreground opacity-50 hover:opacity-75'
                    )}
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{
                        backgroundColor: `hsl(var(${NODE_COLOR_VARS[type]}))`,
                      }}
                    />
                    {t(`pages.knowledgeGraph.nodeTypes.${type}`)}
                    <span className="ml-auto text-muted-foreground">
                      {filteredGraphData.nodes.filter((n) => n.type === type).length}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Highlights toggle */}
            <div className="border-t border-border pt-md">
              <button
                onClick={() => {
                  setIncludeHighlights((v) => !v);
                  if (!includeHighlights) {
                    setActiveTypes((prev) => new Set([...prev, 'highlight']));
                  }
                }}
                className={cn(
                  'flex w-full items-center gap-sm rounded-md px-sm py-xs text-xs transition-all',
                  includeHighlights
                    ? 'bg-muted/60 text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Highlighter className="h-3.5 w-3.5" />
                <span>{t('pages.knowledgeGraph.includeHighlights')}</span>
                <div
                  className={cn(
                    'ml-auto h-4 w-7 rounded-full transition-colors',
                    includeHighlights ? 'bg-primary' : 'bg-muted'
                  )}
                >
                  <div
                    className={cn(
                      'mt-0.5 h-3 w-3 rounded-full bg-background shadow transition-transform',
                      includeHighlights ? 'translate-x-3.5' : 'translate-x-0.5'
                    )}
                  />
                </div>
              </button>
            </div>

            {/* Stats */}
            <div className="mt-auto border-t border-border pt-md text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>{t('pages.knowledgeGraph.stats.nodes')}</span>
                <span className="font-medium text-foreground">{stats.nodes}</span>
              </div>
              <div className="flex justify-between">
                <span>{t('pages.knowledgeGraph.stats.connections')}</span>
                <span className="font-medium text-foreground">{stats.links}</span>
              </div>
              <div className="flex justify-between">
                <span>{t('pages.knowledgeGraph.stats.explicit')}</span>
                <span className="font-medium text-foreground">{stats.explicit}</span>
              </div>
            </div>
          </div>

          {/* Graph area */}
          <div ref={containerRef} className="relative flex-1 overflow-hidden">
            {isLoading ? (
              <div className="flex h-full flex-col items-center justify-center gap-md text-muted-foreground">
                <Network className="h-12 w-12 animate-pulse" />
                <p className="text-sm">{t('pages.knowledgeGraph.loading')}</p>
              </div>
            ) : filteredGraphData.nodes.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-md text-muted-foreground">
                <Sparkles className="h-12 w-12 opacity-30" />
                <p className="text-sm">
                  {search
                    ? t('pages.knowledgeGraph.emptySearch')
                    : t('pages.knowledgeGraph.empty')}
                </p>
              </div>
            ) : (
              <ForceGraph2D
                ref={graphRef as never}
                graphData={filteredGraphData}
                width={dimensions.width}
                height={dimensions.height}
                backgroundColor="transparent"
                nodeCanvasObject={nodeCanvasObject as never}
                nodePointerAreaPaint={(node: GraphNode, color, ctx) => {
                  ctx.fillStyle = color;
                  ctx.beginPath();
                  ctx.arc(
                    node.x ?? 0,
                    node.y ?? 0,
                    NODE_SIZES[node.type] + 4,
                    0,
                    2 * Math.PI
                  );
                  ctx.fill();
                }}
                linkColor={getLinkColor as never}
                linkWidth={getLinkWidth as never}
                linkLineDash={getLinkDash as never}
                linkDirectionalParticles={2}
                linkDirectionalParticleWidth={(link: GraphLink) =>
                  link.type === 'explicit' ? 2.5 : 0
                }
                linkDirectionalParticleColor={getLinkColor as never}
                onNodeClick={handleNodeClick as never}
                onNodeHover={(node: GraphNode | null) => setHoveredNode(node)}
                onBackgroundClick={() => {
                  setSelectedNode(null);
                  setLinkingFrom(null);
                  setLinkTarget(null);
                }}
                nodeLabel=""
                cooldownTicks={80}
                d3AlphaDecay={0.02}
                d3VelocityDecay={0.3}
              />
            )}

            {/* Zoom controls */}
            <div className="absolute bottom-md right-md flex flex-col gap-xs">
              <button
                onClick={() => {
                  const g = graphRef.current as {
                    zoom: (n: number, ms: number) => void;
                  } | null;
                  g?.zoom(1.5, 300);
                }}
                className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card/80 text-muted-foreground shadow-sm backdrop-blur-sm transition-colors hover:text-foreground"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => {
                  const g = graphRef.current as {
                    zoom: (n: number, ms: number) => void;
                  } | null;
                  g?.zoom(0.67, 300);
                }}
                className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card/80 text-muted-foreground shadow-sm backdrop-blur-sm transition-colors hover:text-foreground"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => graphRef.current?.zoomToFit(400)}
                className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card/80 text-muted-foreground shadow-sm backdrop-blur-sm transition-colors hover:text-foreground"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Linking mode indicator */}
            <AnimatePresence>
              {linkingFrom && !linkTarget && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="absolute left-1/2 top-md -translate-x-1/2 rounded-full border border-accent/40 bg-accent/10 px-md py-xs text-xs text-accent backdrop-blur-sm"
                >
                  <Link2 className="mr-xs inline h-3 w-3" />
                  {t('pages.knowledgeGraph.clickToConnectWith')}{' '}
                  <strong>
                    {linkingFrom.label.length > 20
                      ? linkingFrom.label.slice(0, 20) + '…'
                      : linkingFrom.label}
                  </strong>
                  <button
                    onClick={() => setLinkingFrom(null)}
                    className="ml-sm text-accent/70 hover:text-accent"
                  >
                    <X className="inline h-3 w-3" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Right detail panel */}
          <AnimatePresence>
            {selectedNode && (
              <NodeDetailPanel
                node={selectedNode}
                onClose={() => setSelectedNode(null)}
                onDeleteLink={handleDeleteLink}
                linkingFrom={linkingFrom}
                onStartLink={handleStartLink}
                links={filteredGraphData.links}
              />
            )}
          </AnimatePresence>
        </div>

        {/* Legend */}
        <div className="mt-sm flex flex-wrap items-center gap-md px-xs">
          {ALL_NODE_TYPES.filter((tp) => tp !== 'highlight' || includeHighlights).map(
            (type) => (
              <div key={type} className="flex items-center gap-xs">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{
                    backgroundColor: `hsl(var(${NODE_COLOR_VARS[type]}))`,
                  }}
                />
                <span className="text-xs text-muted-foreground">
                  {t(`pages.knowledgeGraph.nodeTypes.${type}`)}
                </span>
              </div>
            )
          )}
          <div className="ml-auto flex items-center gap-xs">
            <div className="h-px w-6 border-b border-dashed border-muted-foreground/50" />
            <span className="text-xs text-muted-foreground">
              {t('pages.knowledgeGraph.legend.explicit')}
            </span>
          </div>
          <div className="flex items-center gap-xs">
            <div className="h-px w-6 border-b border-muted-foreground/30" />
            <span className="text-xs text-muted-foreground">
              {t('pages.knowledgeGraph.legend.implicit')}
            </span>
          </div>
        </div>
      </PageContainer>

      {/* Create link modal */}
      <AnimatePresence>
        {linkingFrom && linkTarget && (
          <CreateLinkModal
            from={linkingFrom}
            to={linkTarget}
            onConfirm={handleConfirmLink}
            onCancel={() => {
              setLinkTarget(null);
              setLinkingFrom(null);
            }}
            isLoading={createLinkMutation.isPending}
          />
        )}
      </AnimatePresence>
    </AnimatedPage>
  );
}
