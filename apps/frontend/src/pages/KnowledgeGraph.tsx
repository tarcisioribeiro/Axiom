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
  type LucideIcon,
  Maximize2,
  Network,
  PenLine,
  Search,
  Sparkles,
  Trash2,
  X,
  Zap,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ForceGraph3D } from 'react-force-graph';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import * as THREE from 'three';

import { AnimatedPage } from '@/components/common/AnimatedPage';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip } from '@/components/ui/tooltip';
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

const NODE_ICONS: Record<KnowledgeNodeType, LucideIcon> = {
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
// 3D SCENE HELPERS
// ============================================================================

// THREE.Color only parses comma-separated hsl(); our CSS vars are space-separated.
function toThreeColor(hsl: string): string {
  const match = /^hsl\((-?[\d.]+)\s+([\d.]+%)\s+([\d.]+%)\)$/.exec(hsl);
  return match ? `hsl(${match[1]}, ${match[2]}, ${match[3]})` : hsl;
}

function createLabelSprite(
  text: string,
  colors: CanvasColors,
  dimmed: boolean
): THREE.Sprite {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  const fontSize = 28;
  const paddingX = 10;
  const paddingY = 6;
  ctx.font = `${fontSize}px Inter, sans-serif`;
  const textWidth = ctx.measureText(text).width;
  canvas.width = textWidth + paddingX * 2;
  canvas.height = fontSize + paddingY * 2;
  // canvas resize clears context state, so the font must be reapplied
  ctx.font = `${fontSize}px Inter, sans-serif`;
  ctx.fillStyle = colors.labelBg;
  ctx.beginPath();
  ctx.roundRect(0, 0, canvas.width, canvas.height, 6);
  ctx.fill();
  ctx.fillStyle = dimmed ? colors.labelDim : colors.labelText;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 1);

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    opacity: dimmed ? 0.35 : 1,
  });
  const sprite = new THREE.Sprite(material);
  const desiredHeight = 6;
  const scaleFactor = desiredHeight / canvas.height;
  sprite.scale.set(canvas.width * scaleFactor, canvas.height * scaleFactor, 1);
  return sprite;
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
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className="border-border bg-card absolute top-0 right-0 z-20 flex h-full w-80 flex-col border-l shadow-2xl"
    >
      {/* Header */}
      <div
        className="border-border px-md py-sm flex items-center justify-between border-b"
        style={{
          borderLeftColor: `hsl(var(${nodeColorVar}))`,
          borderLeftWidth: 3,
        }}
      >
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
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Metadata */}
      <div className="p-md flex-1 overflow-y-auto">
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
                        ({link.relation_display ?? link.relation})
                      </span>
                    </div>
                    {link.link_id && (
                      <button
                        onClick={() => onDeleteLink(link.link_id!)}
                        className="ml-xs text-destructive/60 hover:text-destructive shrink-0 transition-colors"
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
      <div className="border-border p-md border-t">
        <Tooltip
          content={
            linkingFrom?.id === node.id
              ? t('pages.knowledgeGraph.cancelLinkTooltip')
              : t('pages.knowledgeGraph.createLinkTooltip')
          }
          side="top"
        >
          <Button
            size="sm"
            variant={linkingFrom?.id === node.id ? 'default' : 'outline'}
            className="w-full"
            onClick={() => onStartLink(node)}
          >
            <Link2 className="mr-sm h-3.5 w-3.5" />
            {linkingFrom?.id === node.id
              ? t('pages.knowledgeGraph.cancelLink')
              : t('pages.knowledgeGraph.createLink')}
          </Button>
        </Tooltip>
      </div>
    </motion.div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="gap-sm flex items-start justify-between">
      <span className="text-muted-foreground text-xs">{label}</span>
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
        className="border-border bg-card p-lg w-96 rounded-lg border shadow-2xl"
      >
        <h3 className="mb-md text-base font-semibold">
          {t('pages.knowledgeGraph.createLinkModal.title')}
        </h3>
        <div className="mb-md gap-sm flex items-center text-sm">
          <span
            className="px-sm rounded-md py-0.5 text-xs font-medium"
            style={{
              backgroundColor: `hsl(var(${NODE_COLOR_VARS[from.type]}) / 0.2)`,
              color: `hsl(var(${NODE_COLOR_VARS[from.type]}))`,
            }}
          >
            {from.label.length > 24 ? from.label.slice(0, 24) + '…' : from.label}
          </span>
          <span className="text-muted-foreground">→</span>
          <span
            className="px-sm rounded-md py-0.5 text-xs font-medium"
            style={{
              backgroundColor: `hsl(var(${NODE_COLOR_VARS[to.type]}) / 0.2)`,
              color: `hsl(var(${NODE_COLOR_VARS[to.type]}))`,
            }}
          >
            {to.label.length > 24 ? to.label.slice(0, 24) + '…' : to.label}
          </span>
        </div>

        <div className="mb-lg gap-sm grid grid-cols-3">
          {ALL_RELATIONS.map((key) => (
            <button
              key={key}
              onClick={() => setRelation(key)}
              className={cn(
                'px-sm py-xs rounded-md border text-xs transition-all',
                relation === key
                  ? 'text-background border-transparent'
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

        <div className="gap-sm flex justify-end">
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

const KG_POSITIONS_KEY = 'axiom-kg-node-positions';

interface GraphInstance {
  zoomToFit: (ms?: number, padding?: number) => void;
  cameraPosition: (
    position: Partial<{ x: number; y: number; z: number }>,
    lookAt?: { x: number; y: number; z: number },
    ms?: number
  ) => void;
  camera: () => THREE.Camera;
  graphData: () => { nodes: GraphNode[] };
}

function loadSavedPositions(): Record<string, { x: number; y: number; z: number }> {
  try {
    const raw = localStorage.getItem(KG_POSITIONS_KEY);
    return raw
      ? (JSON.parse(raw) as Record<string, { x: number; y: number; z: number }>)
      : {};
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

  // Save node positions when simulation stops
  const handleEngineStop = useCallback(() => {
    const nodes = graphRef.current?.graphData?.()?.nodes;
    if (!nodes) return;
    const positions: Record<string, { x: number; y: number; z: number }> = {};
    nodes.forEach((n) => {
      if (n.x !== undefined && n.y !== undefined && n.z !== undefined) {
        positions[n.id] = { x: n.x, y: n.y, z: n.z };
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
        return saved
          ? {
              ...n,
              x: saved.x,
              y: saved.y,
              z: saved.z,
              fx: saved.x,
              fy: saved.y,
              fz: saved.z,
            }
          : n;
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

  // Node 3D object renderer (sphere + optional selection ring + text label)
  const nodeThreeObject = useCallback(
    (node: GraphNode) => {
      const isFocused = highlightedNeighbors.has(node.id);
      const isDimmed = Boolean(hasFocus) && !isFocused;
      const isHovered = hoveredNode?.id === node.id;
      const isSelected = selectedNode?.id === node.id;
      const isLinking = linkingFrom?.id === node.id;

      const colors = colorsRef.current;
      const baseColor = colors.nodes[node.type];
      const baseSize = NODE_SIZES[node.type];

      const group = new THREE.Group();

      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(baseSize, 16, 16),
        new THREE.MeshLambertMaterial({
          color: toThreeColor(baseColor),
          transparent: true,
          opacity: isDimmed ? 0.15 : 1,
        })
      );
      group.add(sphere);

      // Ring for hovered / selected / linking
      if (isHovered || isSelected || isLinking) {
        const ringColor = isLinking ? colors.linkingRing : baseColor;
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(baseSize + 2.5, 0.5, 8, 32),
          new THREE.MeshBasicMaterial({ color: toThreeColor(ringColor) })
        );
        group.add(ring);
      }

      const label = node.label.length > 20 ? node.label.slice(0, 20) + '…' : node.label;
      const sprite = createLabelSprite(label, colors, isDimmed);
      sprite.position.set(0, baseSize + 5, 0);
      group.add(sprite);

      return group;
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

  return (
    <AnimatedPage>
      <PageContainer>
        <PageHeader
          title={t('pages.knowledgeGraph.title')}
          description={t('pages.knowledgeGraph.description')}
          icon={<Network className="h-5 w-5" />}
        />

        <div className="border-border bg-card relative flex h-[calc(100vh-12rem)] overflow-hidden rounded-lg border">
          {/* Left sidebar */}
          <div className="gap-md border-border bg-card p-md z-10 flex w-52 shrink-0 flex-col border-r">
            {/* Suggest links button */}
            <Tooltip content={t('pages.knowledgeGraph.suggestLinks')} side="right">
              <button
                onClick={() => setShowSuggestions((v) => !v)}
                className={cn(
                  'gap-sm px-sm py-xs flex w-full items-center rounded-md text-xs font-medium transition-colors',
                  showSuggestions
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <Sparkles className="h-3.5 w-3.5 shrink-0" />
                {t('pages.knowledgeGraph.suggestLinks')}
              </button>
            </Tooltip>

            {/* Search */}
            <div className="relative">
              <Search className="text-muted-foreground absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2" />
              <Input
                placeholder={t('pages.knowledgeGraph.search')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-xl h-8 text-xs"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

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
                      'gap-sm px-sm py-xs flex w-full items-center rounded-md text-xs transition-all',
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
                  'gap-sm px-sm py-xs flex w-full items-center rounded-md text-xs transition-all',
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
              <div className="gap-md px-xl text-muted-foreground flex h-full flex-col items-center justify-center text-center">
                <div className="bg-primary/10 ring-primary/20 flex h-16 w-16 items-center justify-center rounded-2xl ring-1 ring-inset">
                  <Sparkles className="text-primary h-8 w-8" />
                </div>
                <div className="space-y-xs">
                  <p className="text-foreground text-base font-semibold">
                    {search
                      ? t('pages.knowledgeGraph.emptySearch')
                      : t('pages.knowledgeGraph.empty')}
                  </p>
                  {!search && (
                    <p className="max-w-xs text-sm">
                      {t('pages.knowledgeGraph.emptyHint')}
                    </p>
                  )}
                </div>
                {!search && (
                  <div className="gap-sm flex items-center">
                    <Link
                      to="/library/books"
                      className="gap-xs border-border bg-card px-md py-xs text-foreground hover:bg-muted flex items-center rounded-md border text-xs font-medium transition-colors"
                    >
                      <BookOpen className="h-3.5 w-3.5" />
                      {t('pages.knowledgeGraph.emptyCtaBooks')}
                    </Link>
                    <Link
                      to="/library/courses"
                      className="gap-xs border-border bg-card px-md py-xs text-foreground hover:bg-muted flex items-center rounded-md border text-xs font-medium transition-colors"
                    >
                      <GraduationCap className="h-3.5 w-3.5" />
                      {t('pages.knowledgeGraph.emptyCtaCourses')}
                    </Link>
                  </div>
                )}
              </div>
            ) : (
              <ForceGraph3D
                ref={graphRef as never}
                graphData={filteredGraphData}
                width={dimensions.width}
                height={dimensions.height}
                backgroundColor="rgba(0,0,0,0)"
                rendererConfig={{ preserveDrawingBuffer: true }}
                nodeThreeObject={nodeThreeObject}
                nodeThreeObjectExtend={false}
                linkColor={getLinkColor}
                linkWidth={getLinkWidth}
                linkOpacity={0.8}
                linkDirectionalParticles={2}
                linkDirectionalParticleWidth={(link: GraphLink) =>
                  link.type === 'explicit' ? 2.5 : 0
                }
                linkDirectionalParticleColor={getLinkColor}
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
              <div className="right-md top-md border-border bg-card absolute z-20 flex max-h-[60vh] w-72 flex-col overflow-hidden rounded-lg border shadow-lg">
                <div className="border-border px-md py-sm flex items-center justify-between border-b">
                  <p className="text-sm font-semibold">
                    {t('pages.knowledgeGraph.suggestionsPanel')}
                  </p>
                  <button
                    onClick={() => setShowSuggestions(false)}
                    className="hover:bg-muted rounded p-0.5"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="custom-scrollbar p-sm flex-1 overflow-y-auto">
                  {suggestLoading ? (
                    <p className="py-md text-muted-foreground text-center text-xs">
                      {t('pages.knowledgeGraph.loadingSuggestions')}
                    </p>
                  ) : !suggestData?.suggestions?.length ? (
                    <p className="py-md text-muted-foreground text-center text-xs">
                      {t('pages.knowledgeGraph.noSuggestions')}
                    </p>
                  ) : (
                    <div className="space-y-xs">
                      {suggestData.suggestions.map((s, i) => (
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
                            <button
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
                              className="px-xs text-primary hover:bg-primary/10 rounded py-0.5 text-xs"
                            >
                              {t('pages.knowledgeGraph.addLink')}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Zoom controls */}
            <div className="bottom-md right-md gap-xs absolute flex flex-col">
              <Tooltip content={t('pages.knowledgeGraph.exportPNG')} side="left">
                <button
                  onClick={handleExportPNG}
                  className="border-border bg-card/80 text-muted-foreground hover:text-foreground flex h-8 w-8 items-center justify-center rounded-md border shadow-sm backdrop-blur-sm transition-colors"
                >
                  <Download className="h-3.5 w-3.5" />
                </button>
              </Tooltip>
              <button
                onClick={() => {
                  const g = graphRef.current;
                  if (!g) return;
                  const { x, y, z } = g.camera().position;
                  g.cameraPosition(
                    { x: x * 0.7, y: y * 0.7, z: z * 0.7 },
                    undefined,
                    300
                  );
                }}
                className="border-border bg-card/80 text-muted-foreground hover:text-foreground flex h-8 w-8 items-center justify-center rounded-md border shadow-sm backdrop-blur-sm transition-colors"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => {
                  const g = graphRef.current;
                  if (!g) return;
                  const { x, y, z } = g.camera().position;
                  g.cameraPosition(
                    { x: x * 1.4, y: y * 1.4, z: z * 1.4 },
                    undefined,
                    300
                  );
                }}
                className="border-border bg-card/80 text-muted-foreground hover:text-foreground flex h-8 w-8 items-center justify-center rounded-md border shadow-sm backdrop-blur-sm transition-colors"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => graphRef.current?.zoomToFit(400)}
                className="border-border bg-card/80 text-muted-foreground hover:text-foreground flex h-8 w-8 items-center justify-center rounded-md border shadow-sm backdrop-blur-sm transition-colors"
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
                  <kbd className="border-accent/30 bg-accent/10 px-xs rounded border py-0.5 font-mono text-[10px]">
                    Esc
                  </kbd>
                  <button
                    onClick={() => {
                      setLinkingFrom(null);
                      setLinkTarget(null);
                    }}
                    className="ml-xs text-accent/70 hover:text-accent"
                    aria-label={t('pages.knowledgeGraph.cancelLink')}
                  >
                    <X className="h-3 w-3" />
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
