/* eslint-disable max-lines */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BookOpen,
  Download,
  FileText,
  GraduationCap,
  Highlighter,
  Link2,
  Maximize2,
  Network,
  PenLine,
  ArrowRight,
  Sparkles,
  Trash2,
  X,
  Zap,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { useTranslation } from 'react-i18next';

import { Can } from '@/components/common/Can';
import { EmptyState } from '@/components/common/EmptyState';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { LIST_PAGE_SIZE, PaginatedSlide } from '@/components/common/PaginatedSlide';
import { SearchInput } from '@/components/common/SearchInput';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { VisuallyHidden } from '@/components/ui/visually-hidden';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { ACTION_COLOR } from '@/lib/action-colors';
import { HIGHLIGHT_TYPE_KEY } from '@/lib/highlight-colors';
import { STALE_TIMES } from '@/lib/query-client';
import { cn } from '@/lib/utils';
import { knowledgeGraphService } from '@/services/knowledge-graph-service';
import { membersService } from '@/services/members-service';
import type { IconComponent } from '@/types/icon';
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

const NODE_ICONS: Record<KnowledgeNodeType, IconComponent> = {
  book: BookOpen,
  author: PenLine,
  course: GraduationCap,
  skill: Zap,
  summary: FileText,
  highlight: Sparkles,
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
  const NodeIcon = NODE_ICONS[node.type];

  return (
    <motion.div
      initial={{ x: 320, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 320, opacity: 0 }}
      className="border-border bg-card absolute top-0 right-0 z-20 flex h-full w-80 flex-col border-l"
    >
      {/* Header */}
      <div className="border-border px-md py-sm flex items-center justify-between border-b">
        <div className="gap-sm flex items-center">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full"
            style={{
              backgroundColor: `hsl(var(${nodeColorVar}) / 0.2)`,
              color: `hsl(var(${nodeColorVar}))`,
            }}
          >
            <NodeIcon className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <p className="text-muted-foreground text-xs">
              {t(`pages.knowledgeGraph.nodeTypes.${node.type}`)}
            </p>
            <p className="line-clamp-2 text-sm leading-tight font-semibold">
              {node.label}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          aria-label={t('common.actions.close')}
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Metadata */}
      <div className="p-md flex-1">
        <div className="space-y-sm">
          {node.type === 'book' && node.metadata && (
            <>
              {node.metadata.genre && (
                <MetaRow
                  label={t('pages.knowledgeGraph.meta.genre')}
                  value={t(`pages.books.genres.${node.metadata.genre}`, {
                    defaultValue: node.metadata.genre,
                  })}
                />
              )}
              {node.metadata.read_status && (
                <MetaRow
                  label={t('pages.knowledgeGraph.meta.status')}
                  value={t(`pages.books.readStatuses.${node.metadata.read_status}`, {
                    defaultValue: node.metadata.read_status,
                  })}
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
              value={
                node.metadata.nationality
                  ? t(`pages.authors.nationalities.${node.metadata.nationality}`, {
                      defaultValue: node.metadata.nationality_display,
                    })
                  : (node.metadata.nationality_display ?? '—')
              }
            />
          )}
          {node.type === 'course' && node.metadata && (
            <>
              {node.metadata.platform && (
                <MetaRow
                  label={t('pages.knowledgeGraph.meta.platform')}
                  value={t(`pages.courses.platform.${node.metadata.platform}`, {
                    defaultValue: node.metadata.platform,
                  })}
                />
              )}
              {node.metadata.category && (
                <MetaRow
                  label={t('pages.knowledgeGraph.meta.category')}
                  value={t(`pages.courses.category.${node.metadata.category}`, {
                    defaultValue: node.metadata.category,
                  })}
                />
              )}
              {node.metadata.status && (
                <MetaRow
                  label={t('pages.knowledgeGraph.meta.status')}
                  value={t(`pages.courses.status.${node.metadata.status}`, {
                    defaultValue: node.metadata.status,
                  })}
                />
              )}
              {node.metadata.progress_percentage !== undefined && (
                <div>
                  <p className="mb-xs text-muted-foreground text-xs">
                    {t('pages.knowledgeGraph.meta.progress')}
                  </p>
                  <div className="bg-muted h-1.5 rounded-full">
                    <div
                      className="h-1.5 rounded-full"
                      style={{
                        width: `${node.metadata.progress_percentage}%`,
                        backgroundColor: 'hsl(var(--success))',
                      }}
                    />
                  </div>
                  <p className="mt-xs text-muted-foreground text-right text-xs">
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
                  value={t(`pages.skills.category.${node.metadata.category}`, {
                    defaultValue: node.metadata.category,
                  })}
                />
              )}
              {node.metadata.proficiency && (
                <MetaRow
                  label={t('pages.knowledgeGraph.meta.proficiency')}
                  value={t(`pages.skills.proficiency.${node.metadata.proficiency}`, {
                    defaultValue: node.metadata.proficiency,
                  })}
                />
              )}
              {node.metadata.status && (
                <MetaRow
                  label={t('pages.knowledgeGraph.meta.status')}
                  value={t(`pages.skills.status.${node.metadata.status}`, {
                    defaultValue: node.metadata.status,
                  })}
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
                  value={t(HIGHLIGHT_TYPE_KEY[node.metadata.highlight_type] ?? '', {
                    defaultValue: node.metadata.highlight_type,
                  })}
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
            <p className="mb-sm text-muted-foreground text-xs font-medium tracking-wider uppercase">
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
                    className="bg-muted/40 px-sm py-xs flex items-center justify-between rounded-md"
                  >
                    <div className="gap-xs flex min-w-0 items-center">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{
                          backgroundColor: `hsl(var(${relVar}))`,
                        }}
                      />
                      <span className="truncate text-xs">{other.label}</span>
                      <span className="text-muted-foreground shrink-0 text-xs">
                        (
                        {t(`pages.knowledgeGraph.relations.${link.relation}`, {
                          defaultValue: link.relation_display ?? link.relation,
                        })}
                        )
                      </span>
                    </div>
                    {link.link_id && (
                      <Can action="delete">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="ml-xs h-6 w-6 shrink-0"
                          aria-label={t('common.actions.delete')}
                          onClick={() => onDeleteLink(link.link_id!)}
                        >
                          <Trash2 className={cn('h-3 w-3', ACTION_COLOR.delete)} />
                        </Button>
                      </Can>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="border-border p-md border-t">
        <Button
          size="sm"
          variant={linkingFrom?.id === node.id ? 'default' : 'outline'}
          className="w-full"
          onClick={() => onStartLink(node)}
        >
          <Link2 className="h-3.5 w-3.5" />
          {linkingFrom?.id === node.id
            ? t('pages.knowledgeGraph.cancelLink')
            : t('pages.knowledgeGraph.createLink')}
        </Button>
      </div>
    </motion.div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="gap-sm flex items-start justify-between">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="text-right text-xs font-medium">{value}</span>
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
  from: GraphNode | null;
  to: GraphNode | null;
  onConfirm: (relation: KnowledgeLinkRelation) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const { t } = useTranslation();
  const [relation, setRelation] = useState<KnowledgeLinkRelation>('relates');

  const chip = (node: GraphNode) => (
    <span
      className="px-sm truncate rounded-md py-0.5 text-xs font-medium"
      style={{
        backgroundColor: `hsl(var(${NODE_COLOR_VARS[node.type]}) / 0.2)`,
        color: `hsl(var(${NODE_COLOR_VARS[node.type]}))`,
      }}
      title={node.label}
    >
      {node.label}
    </span>
  );

  return (
    <Dialog open={!!from && !!to} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="max-w-md">
        {from && to && (
          <>
            <DialogHeader>
              <DialogTitle icon={Link2}>
                {t('pages.knowledgeGraph.createLinkModal.title')}
              </DialogTitle>
              <VisuallyHidden>
                <DialogDescription>
                  {from.label} → {to.label}
                </DialogDescription>
              </VisuallyHidden>
            </DialogHeader>
            <div className="gap-sm flex min-w-0 items-center text-sm">
              {chip(from)}
              <ArrowRight className="text-muted-foreground h-4 w-4 shrink-0" />
              {chip(to)}
            </div>
            <div className="gap-sm grid grid-cols-3">
              {ALL_RELATIONS.map((key) => (
                <Button
                  key={key}
                  type="button"
                  size="sm"
                  variant={relation === key ? 'default' : 'outline'}
                  onClick={() => setRelation(key)}
                  className="text-xs"
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: `hsl(var(${RELATION_COLOR_VARS[key]}))` }}
                  />
                  {t(`pages.knowledgeGraph.relations.${key}`)}
                </Button>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={onCancel} disabled={isLoading}>
                <X aria-hidden="true" />
                {t('pages.knowledgeGraph.createLinkModal.cancel')}
              </Button>
              <Button onClick={() => onConfirm(relation)} loading={isLoading}>
                {!isLoading && <Link2 aria-hidden="true" />}
                {t('pages.knowledgeGraph.createLinkModal.confirm')}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================

const KG_POSITIONS_KEY = 'axiom-kg-node-positions';

interface GraphInstance {
  zoomToFit: (ms?: number, padding?: number) => void;
  zoom: (zoom?: number, ms?: number) => number;
  graphData: () => { nodes: GraphNode[] };
}

function loadSavedPositions(): Record<string, { x: number; y: number }> {
  try {
    const raw = localStorage.getItem(KG_POSITIONS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, { x: number; y: number }>) : {};
  } catch {
    return {};
  }
}

export default function KnowledgeGraph() {
  const { t } = useTranslation();
  const graphRef = useRef<GraphInstance | null>(null);
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
  const [showSuggestions, setShowSuggestions] = useState(false);

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

  // Cancel linking mode on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && linkingFrom) {
        setLinkingFrom(null);
        setLinkTarget(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [linkingFrom]);

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

  const { data: suggestData, isFetching: suggestLoading } = useQuery({
    queryKey: ['knowledge-graph-suggestions'],
    queryFn: async () => {
      const { apiClient } = await import('@/services/api-client');
      const { API_CONFIG } = await import('@/config/constants');
      return apiClient.get<{
        suggestions: Array<{
          source_type: string;
          source_id: string;
          source_title: string;
          target_type: string;
          target_id: string;
          target_title: string;
          similarity: number;
        }>;
      }>(API_CONFIG.ENDPOINTS.KNOWLEDGE_GRAPH_SUGGEST_LINKS);
    },
    enabled: showSuggestions,
    staleTime: 60_000,
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
        title: t('pages.knowledgeGraph.toasts.linkCreateError', {
          reason: getErrorMessage(error),
        }),
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

  // Save node positions when simulation stops
  const handleEngineStop = useCallback(() => {
    const nodes = graphRef.current?.graphData?.()?.nodes;
    if (!nodes) return;
    const positions: Record<string, { x: number; y: number }> = {};
    nodes.forEach((n) => {
      if (n.x !== undefined && n.y !== undefined) {
        positions[n.id] = { x: n.x, y: n.y };
      }
    });
    localStorage.setItem(KG_POSITIONS_KEY, JSON.stringify(positions));
  }, []);

  // Filtered graph data with saved positions applied
  const filteredGraphData = useMemo(() => {
    if (!graphData) return { nodes: [], links: [] };

    const savedPositions = loadSavedPositions();
    const lowerSearch = search.toLowerCase();
    const visibleNodes = graphData.nodes
      .filter(
        (n) =>
          activeTypes.has(n.type) &&
          (lowerSearch === '' || n.label.toLowerCase().includes(lowerSearch))
      )
      .map((n) => {
        const saved = savedPositions[n.id];
        return saved ? { ...n, x: saved.x, y: saved.y, fx: saved.x, fy: saved.y } : n;
      });
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

  // Node degree (connection count) — drives node radius, Obsidian-style
  // ("more linked" nodes render bigger).
  const nodeDegree = useMemo(() => {
    const map = new Map<string, number>();
    filteredGraphData.links.forEach((l) => {
      const srcId = typeof l.source === 'string' ? l.source : l.source.id;
      const tgtId = typeof l.target === 'string' ? l.target : l.target.id;
      map.set(srcId, (map.get(srcId) ?? 0) + 1);
      map.set(tgtId, (map.get(tgtId) ?? 0) + 1);
    });
    return map;
  }, [filteredGraphData.links]);

  const nodeRadius = useCallback(
    (node: GraphNode) => {
      const degree = nodeDegree.get(node.id) ?? 0;
      return NODE_SIZES[node.type] * 0.55 + Math.min(degree, 12) * 0.6;
    },
    [nodeDegree]
  );

  // Flat 2D node renderer (circle + optional selection ring + label),
  // matching Obsidian's graph view look.
  const nodeCanvasObject = useCallback(
    (node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const isFocused = highlightedNeighbors.has(node.id);
      const isDimmed = Boolean(hasFocus) && !isFocused;
      const isHovered = hoveredNode?.id === node.id;
      const isSelected = selectedNode?.id === node.id;
      const isLinking = linkingFrom?.id === node.id;

      const colors = colorsRef.current;
      const baseColor = colors.nodes[node.type];
      const radius = nodeRadius(node);
      const x = node.x ?? 0;
      const y = node.y ?? 0;

      ctx.globalAlpha = isDimmed ? 0.15 : 1;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, 2 * Math.PI);
      ctx.fillStyle = baseColor;
      ctx.fill();

      if (isHovered || isSelected || isLinking) {
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = isLinking ? colors.linkingRing : baseColor;
        ctx.beginPath();
        ctx.arc(x, y, radius + 2.5, 0, 2 * Math.PI);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // Labels only near/hover/selected, or once zoomed in enough — avoids
      // clutter when zoomed out, same as Obsidian's graph view.
      if (isHovered || isSelected || isFocused || globalScale > 2.2) {
        const label =
          node.label.length > 24 ? node.label.slice(0, 24) + '…' : node.label;
        const fontSize = Math.max(3, 11 / globalScale);
        ctx.font = `${fontSize}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = isDimmed ? colors.labelDim : colors.labelText;
        ctx.fillText(label, x, y + radius + 2);
      }
    },
    [highlightedNeighbors, hasFocus, hoveredNode, selectedNode, linkingFrom, nodeRadius]
  );

  const nodePointerAreaPaint = useCallback(
    (node: GraphNode, color: string, ctx: CanvasRenderingContext2D) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(node.x ?? 0, node.y ?? 0, nodeRadius(node), 0, 2 * Math.PI);
      ctx.fill();
    },
    [nodeRadius]
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

  const handleExportPNG = useCallback(() => {
    const canvas = containerRef.current?.querySelector('canvas');
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `knowledge-graph-${new Date().toISOString().slice(0, 10)}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }, []);

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

  const handleGraphControl = (action: 'export' | 'in' | 'out' | 'fit') => {
    const g = graphRef.current;
    if (action === 'export') handleExportPNG();
    else if (action === 'fit') g?.zoomToFit(400);
    else if (g) g.zoom(g.zoom() * (action === 'in' ? 1.4 : 0.7), 300);
  };

  return (
    <>
      <PageContainer>
        <PageHeader
          title={t('pages.knowledgeGraph.title')}
          icon={<Network className="h-5 w-5" />}
        />

        <div className="border-border bg-card relative flex h-[calc(100dvh-15.5rem)] overflow-hidden rounded-lg border">
          {/* Left sidebar */}
          <div className="gap-md border-border bg-card p-md z-10 flex w-52 shrink-0 flex-col border-r">
            {/* Suggest links button */}
            <Can action="ai_suggest">
              <Button
                variant={showSuggestions ? 'secondary' : 'outline'}
                size="sm"
                className="w-full justify-start text-xs"
                onClick={() => setShowSuggestions((v) => !v)}
              >
                <Sparkles className="h-3.5 w-3.5 shrink-0" />
                {t('pages.knowledgeGraph.suggestLinks')}
              </Button>
            </Can>

            {/* Search */}
            <SearchInput
              placeholder={t('pages.knowledgeGraph.search')}
              value={search}
              onValueChange={setSearch}
              className="w-full flex-none"
            />

            {/* Node type filters */}
            <div>
              <p className="mb-sm text-muted-foreground text-xs font-medium tracking-wider uppercase">
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
                      'gap-sm px-sm py-xs flex w-full items-center rounded-md text-xs transition',
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
                    <span className="text-muted-foreground ml-auto">
                      {filteredGraphData.nodes.filter((n) => n.type === type).length}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Highlights toggle */}
            <div className="border-border pt-md border-t">
              <button
                onClick={() => {
                  setIncludeHighlights((v) => !v);
                  if (!includeHighlights) {
                    setActiveTypes((prev) => new Set([...prev, 'highlight']));
                  }
                }}
                className={cn(
                  'gap-sm px-sm py-xs flex w-full items-center rounded-md text-xs transition',
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
                      'bg-background mt-0.5 h-3 w-3 rounded-full shadow transition-transform',
                      includeHighlights ? 'translate-x-3.5' : 'translate-x-0.5'
                    )}
                  />
                </div>
              </button>
            </div>

            {/* Stats */}
            <div className="border-border pt-md text-muted-foreground mt-auto border-t text-xs">
              <div className="flex justify-between">
                <span>{t('pages.knowledgeGraph.stats.nodes')}</span>
                <span className="text-foreground font-medium">{stats.nodes}</span>
              </div>
              <div className="flex justify-between">
                <span>{t('pages.knowledgeGraph.stats.connections')}</span>
                <span className="text-foreground font-medium">{stats.links}</span>
              </div>
              <div className="flex justify-between">
                <span>{t('pages.knowledgeGraph.stats.explicit')}</span>
                <span className="text-foreground font-medium">{stats.explicit}</span>
              </div>
            </div>
          </div>

          {/* Graph area */}
          <div
            ref={containerRef}
            className={cn(
              'relative flex-1 overflow-hidden',
              linkingFrom && 'cursor-crosshair'
            )}
          >
            {isLoading ? (
              <div className="gap-md text-muted-foreground flex h-full flex-col items-center justify-center">
                <Network className="h-12 w-12 animate-pulse" />
                <p className="text-sm">{t('pages.knowledgeGraph.loading')}</p>
              </div>
            ) : filteredGraphData.nodes.length === 0 ? (
              <EmptyState
                icon={<Sparkles />}
                title={
                  search
                    ? t('pages.knowledgeGraph.emptySearch')
                    : t('pages.knowledgeGraph.empty')
                }
              />
            ) : (
              <ForceGraph2D
                ref={graphRef as never}
                graphData={filteredGraphData}
                width={dimensions.width}
                height={dimensions.height}
                backgroundColor="rgba(0,0,0,0)"
                nodeCanvasObject={nodeCanvasObject}
                nodePointerAreaPaint={nodePointerAreaPaint}
                linkColor={getLinkColor}
                linkWidth={getLinkWidth}
                onNodeClick={handleNodeClick}
                onNodeHover={(node: GraphNode | null) => setHoveredNode(node)}
                onBackgroundClick={() => {
                  setSelectedNode(null);
                  setLinkingFrom(null);
                  setLinkTarget(null);
                }}
                onEngineStop={handleEngineStop}
                nodeLabel=""
                cooldownTicks={80}
                d3AlphaDecay={0.02}
                d3VelocityDecay={0.3}
              />
            )}

            {/* Suggest links panel */}
            {showSuggestions && (
              <div className="animate-pop-in right-md top-md border-border bg-card absolute z-20 flex w-72 flex-col rounded-lg border">
                <div className="border-border px-md py-sm flex items-center justify-between border-b">
                  <p className="text-sm font-semibold">
                    {t('pages.knowledgeGraph.suggestionsPanel')}
                  </p>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    aria-label={t('common.actions.close')}
                    onClick={() => setShowSuggestions(false)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="p-sm flex-1">
                  {suggestLoading ? (
                    <LoadingState />
                  ) : !suggestData?.suggestions?.length ? (
                    <EmptyState title={t('pages.knowledgeGraph.noSuggestions')} />
                  ) : (
                    <PaginatedSlide
                      items={suggestData.suggestions}
                      pageSize={LIST_PAGE_SIZE}
                      pinNav={false}
                      className="space-y-xs"
                    >
                      {(pageSuggestions) =>
                        pageSuggestions.map((s, i) => (
                          <div key={i} className="border-border p-sm rounded-md border">
                            <p className="truncate text-xs font-medium">
                              {s.source_title}
                            </p>
                            <p className="text-muted-foreground text-xs">
                              → {s.target_title}
                            </p>
                            <div className="mt-xs flex items-center justify-between">
                              <span className="text-muted-foreground text-xs">
                                {t('pages.knowledgeGraph.similarity')}:{' '}
                                {Math.round(s.similarity * 100)}%
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 text-xs"
                                onClick={() => {
                                  if (!memberData?.id) return;
                                  createLinkMutation.mutate({
                                    source_type: s.source_type as KnowledgeNodeType,
                                    source_id: s.source_id,
                                    target_type: s.target_type as KnowledgeNodeType,
                                    target_id: s.target_id,
                                    relation_label: 'relates',
                                    owner: memberData.id,
                                  });
                                }}
                              >
                                <Link2 className="h-3 w-3" />
                                {t('pages.knowledgeGraph.addLink')}
                              </Button>
                            </div>
                          </div>
                        ))
                      }
                    </PaginatedSlide>
                  )}
                </div>
              </div>
            )}

            {/* Zoom controls */}
            <div className="bottom-md right-md gap-xs absolute flex flex-col">
              {(
                [
                  ['export', t('pages.knowledgeGraph.exportPNG'), Download],
                  ['in', t('common.actions.zoomIn'), ZoomIn],
                  ['out', t('common.actions.zoomOut'), ZoomOut],
                  ['fit', t('common.actions.fitView'), Maximize2],
                ] as const
              ).map(([action, label, Icon]) => (
                <Button
                  key={action}
                  variant="outline"
                  size="icon"
                  className="bg-card/80 h-8 w-8 backdrop-blur-sm"
                  aria-label={label}
                  tooltipSide="left"
                  onClick={() => handleGraphControl(action)}
                >
                  <Icon className="h-3.5 w-3.5" />
                </Button>
              ))}
            </div>

            {/* Linking mode indicator */}
            <AnimatePresence>
              {linkingFrom && !linkTarget && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="top-md gap-sm border-accent/40 bg-accent/10 px-md py-xs text-accent absolute left-1/2 flex -translate-x-1/2 items-center rounded-full border text-xs backdrop-blur-sm"
                >
                  <Link2 className="h-3 w-3 shrink-0" />
                  <span>
                    {t('pages.knowledgeGraph.clickToConnectWith')}{' '}
                    <strong>
                      {linkingFrom.label.length > 20
                        ? linkingFrom.label.slice(0, 20) + '…'
                        : linkingFrom.label}
                    </strong>
                  </span>
                  <span className="mx-xs text-accent/40">·</span>
                  <kbd className="border-accent/30 bg-accent/10 px-xs text-2xs rounded border py-0.5">
                    Esc
                  </kbd>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="ml-xs text-accent h-5 w-5"
                    onClick={() => {
                      setLinkingFrom(null);
                      setLinkTarget(null);
                    }}
                    aria-label={t('pages.knowledgeGraph.cancelLink')}
                  >
                    <X className="h-3 w-3" />
                  </Button>
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
        <div className="mt-sm gap-md px-xs flex flex-wrap items-center">
          {ALL_NODE_TYPES.filter((tp) => tp !== 'highlight' || includeHighlights).map(
            (type) => (
              <div key={type} className="gap-xs flex items-center">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{
                    backgroundColor: `hsl(var(${NODE_COLOR_VARS[type]}))`,
                  }}
                />
                <span className="text-muted-foreground text-xs">
                  {t(`pages.knowledgeGraph.nodeTypes.${type}`)}
                </span>
              </div>
            )
          )}
          <div className="gap-xs ml-auto flex items-center">
            <div className="border-muted-foreground/50 h-px w-6 border-b border-dashed" />
            <span className="text-muted-foreground text-xs">
              {t('pages.knowledgeGraph.legend.explicit')}
            </span>
          </div>
          <div className="gap-xs flex items-center">
            <div className="border-muted-foreground/30 h-px w-6 border-b" />
            <span className="text-muted-foreground text-xs">
              {t('pages.knowledgeGraph.legend.implicit')}
            </span>
          </div>
        </div>
      </PageContainer>

      {/* Create link modal */}
      <CreateLinkModal
        from={linkTarget ? linkingFrom : null}
        to={linkTarget}
        onConfirm={handleConfirmLink}
        onCancel={() => {
          setLinkTarget(null);
          setLinkingFrom(null);
        }}
        isLoading={createLinkMutation.isPending}
      />
    </>
  );
}
