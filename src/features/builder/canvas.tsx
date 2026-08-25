"use client";

import "@xyflow/react/dist/style.css";

import { useCallback, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  addEdge,
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type NodeTypes,
  type Viewport,
} from "@xyflow/react";
import { Plus, Sparkles, Store } from "lucide-react";
import { toast } from "sonner";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  canAddNode,
  edgeKey,
  moduleNodeHref,
  nextNodeKey,
  nextNodePosition,
  CANVAS_NODE_COMPONENT,
  type CanvasEdge,
  type CanvasNode,
} from "@/lib/flow/mappers";
import {
  nodeTypesForScope,
  resolveNodeType,
  withDefaults,
  type NodeScope,
} from "@/lib/flow/registry";
import { cn } from "@/lib/utils";

import {
  addNode,
  connectNodes,
  disconnectNodes,
  updateNodePosition,
} from "@/features/builder/actions";
import { ElementNode, type BuilderNode } from "@/features/builder/element-node";
import { InspectorSheet } from "@/features/builder/inspector-sheet";
import { DRAG_MIME, PaletteSheet } from "@/features/builder/palette-sheet";
import { RunPreview } from "@/features/builder/run-preview";
import { useViewportMemory } from "@/features/builder/use-viewport-memory";

// Defined once: a fresh nodeTypes object on every render makes React Flow
// remount every node it draws.
const NODE_RENDERERS: NodeTypes = { [CANVAS_NODE_COMPONENT]: ElementNode };

const FIT_VIEW_OPTIONS = { padding: 0.25 };

/**
 * React Flow ships its own palette through CSS custom properties, so pointing
 * those at our design tokens themes the canvas without fighting its stylesheet.
 */
const CANVAS_THEME = {
  "--xy-background-color": "transparent",
  "--xy-edge-stroke":
    "color-mix(in oklab, var(--color-primary) 55%, var(--color-border))",
  "--xy-edge-stroke-selected": "var(--color-primary)",
  "--xy-edge-stroke-width": "2",
  "--xy-connectionline-stroke": "var(--color-primary)",
  "--xy-handle-background-color": "var(--color-primary)",
  "--xy-handle-border-color": "var(--color-card)",
  "--xy-controls-button-background-color": "var(--color-card)",
  "--xy-controls-button-background-color-hover": "var(--color-muted)",
  "--xy-controls-button-color": "var(--color-foreground)",
  "--xy-controls-button-color-hover": "var(--color-foreground)",
  "--xy-controls-button-border-color": "var(--color-border)",
  "--xy-controls-box-shadow": "0 4px 16px -8px oklch(0 0 0 / 0.25)",
  "--xy-attribution-background-color": "transparent",
} as CSSProperties;

export interface CanvasProps {
  flowId: string;
  scope: NodeScope;
  moduleId?: string;
  initialNodes: CanvasNode[];
  initialEdges: CanvasEdge[];
  unlockedTypes: string[];
  /** Receives the canvas node key and the module behind it. */
  onOpenModule?: (nodeKey: string, moduleId: string | null) => void;
  className?: string;
}

function toCanvasNode(node: BuilderNode): CanvasNode {
  return {
    id: node.id,
    type: node.type ?? CANVAS_NODE_COMPONENT,
    position: node.position,
    data: node.data,
  };
}

function toCanvasEdge(edge: Edge): CanvasEdge {
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: typeof edge.label === "string" ? edge.label : undefined,
    animated: edge.animated ?? true,
  };
}

function CanvasInner({
  flowId,
  scope,
  moduleId,
  initialNodes,
  initialEdges,
  unlockedTypes,
  onOpenModule,
  className,
}: CanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<BuilderNode>(
    initialNodes.map((node) => ({ ...node })),
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(
    initialEdges.map((edge) => ({ ...edge })),
  );
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const { screenToFlowPosition } = useReactFlow();
  const { remember } = useViewportMemory(flowId);

  // Modules are bought in the Raket Market, so the outer board has nothing to
  // add from a palette — only the inner module builders do.
  const canAddElements = scope === "module";

  const previewNodes = useMemo(() => nodes.map(toCanvasNode), [nodes]);
  const previewEdges = useMemo(() => edges.map(toCanvasEdge), [edges]);

  const selectedNode = useMemo(() => {
    const found = nodes.find((node) => node.id === selectedKey);
    return found ? toCanvasNode(found) : null;
  }, [nodes, selectedKey]);

  // Elements already at their `maxPerFlow` — the palette hides them rather than
  // offering a row whose only possible outcome is an error toast.
  const atCapacity = useMemo(
    () =>
      nodeTypesForScope(scope, moduleId)
        .filter((def) => !canAddNode(nodes, def.type).ok)
        .map((def) => def.type),
    [moduleId, nodes, scope],
  );

  const place = useCallback(
    async (type: string, position: { x: number; y: number }) => {
      const guard = canAddNode(nodes, type);
      if (!guard.ok) {
        toast.error(guard.reason);
        return;
      }

      const def = resolveNodeType(type);
      const optimisticKey = nextNodeKey(
        nodes.map((node) => node.id),
        type,
      );
      const optimistic: BuilderNode = {
        id: optimisticKey,
        type: CANVAS_NODE_COMPONENT,
        position,
        data: {
          nodeType: type,
          moduleId: def.moduleId ?? null,
          locked: false,
          values: withDefaults(type),
        },
      };
      setNodes((current) => [...current, optimistic]);

      try {
        const result = await addNode({
          flowId,
          type,
          x: Math.round(position.x),
          y: Math.round(position.y),
        });

        if (!result.ok || !result.nodeKey) {
          setNodes((current) =>
            current.filter((node) => node.id !== optimisticKey),
          );
          toast.error(result.message ?? "We could not add that step.");
          return;
        }

        const saved = result.nodeKey;
        setNodes((current) =>
          current.map((node) =>
            node.id === optimisticKey ? { ...node, id: saved } : node,
          ),
        );
        toast.success(`${def.short} added.`);
      } catch {
        setNodes((current) =>
          current.filter((node) => node.id !== optimisticKey),
        );
        toast.error("Something went wrong. Please try again.");
      }
    },
    [flowId, nodes, setNodes],
  );

  const addFromPalette = useCallback(
    (type: string) => {
      void place(type, nextNodePosition(nodes));
    },
    [nodes, place],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      const { source, target } = connection;
      if (!source || !target) return;
      if (source === target) {
        toast.error("A step cannot connect to itself.");
        return;
      }

      const id = edgeKey(source, target);
      if (edges.some((edge) => edge.id === id)) {
        toast.error("Those steps are already connected.");
        return;
      }

      setEdges((current) =>
        addEdge({ ...connection, id, animated: true }, current),
      );

      void connectNodes({ flowId, source, target })
        .then((result) => {
          if (!result.ok) {
            setEdges((current) => current.filter((edge) => edge.id !== id));
            toast.error(result.message ?? "We could not connect those steps.");
          }
        })
        .catch(() => {
          setEdges((current) => current.filter((edge) => edge.id !== id));
          toast.error("Something went wrong. Please try again.");
        });
    },
    [edges, flowId, setEdges],
  );

  const onEdgesDelete = useCallback(
    (deleted: Edge[]) => {
      for (const edge of deleted) {
        if (edge.id.startsWith("clients->")) continue;
        void disconnectNodes({ flowId, edgeKey: edge.id }).catch(() => {});
      }
    },
    [flowId],
  );

  const unlink = useCallback(
    (edge: Edge) => {
      setEdges((current) => current.filter((item) => item.id !== edge.id));
      void disconnectNodes({ flowId, edgeKey: edge.id })
        .then((result) => {
          if (!result.ok) {
            setEdges((current) => [...current, edge]);
            toast.error(result.message ?? "We could not remove that line.");
          }
        })
        .catch(() => {
          setEdges((current) => [...current, edge]);
          toast.error("Something went wrong. Please try again.");
        });
    },
    [flowId, setEdges],
  );

  return (
    <div
      className={cn(
        "board-wash relative h-full w-full overflow-hidden",
        className,
      )}
      style={CANVAS_THEME}
    >
      <div
        className="absolute inset-0 touch-none"
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
        }}
        onDrop={(event) => {
          const type = event.dataTransfer.getData(DRAG_MIME);
          if (!type) return;
          event.preventDefault();
          void place(
            type,
            screenToFlowPosition({ x: event.clientX, y: event.clientY }),
          );
        }}
      >
        <ReactFlow<BuilderNode, Edge>
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onEdgesDelete={onEdgesDelete}
          onEdgeClick={(_, edge) => {
            // The presentation wires are not the user's to cut.
            if (edge.id.startsWith("clients->")) return;
            toast("Remove this line?", {
              action: { label: "Unlink", onClick: () => unlink(edge) },
            });
          }}
          onNodeDragStop={(_, node) => {
            void updateNodePosition({
              flowId,
              nodeKey: node.id,
              x: node.position.x,
              y: node.position.y,
            }).catch(() => {});
          }}
          onNodeClick={(_, node) => {
            // The Clients marker is an annotation; there is nothing to open.
            if (node.data.nodeType === "clients") return;
            if (node.data.nodeType === "module") {
              onOpenModule?.(node.id, node.data.moduleId ?? null);
              return;
            }
            setSelectedKey(node.id);
            setInspectorOpen(true);
          }}
          onPaneClick={() => setSelectedKey(null)}
          nodeTypes={NODE_RENDERERS}
          fitView
          fitViewOptions={FIT_VIEW_OPTIONS}
          onMoveEnd={(_, viewport: Viewport) => remember(viewport)}
          minZoom={0.4}
          maxZoom={1.5}
          nodeDragThreshold={3}
          nodeClickDistance={8}
          paneClickDistance={8}
          deleteKeyCode={null}
          zoomOnDoubleClick={false}
          selectNodesOnDrag={false}
          proOptions={{ hideAttribution: true }}
          className="h-full w-full"
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1.5}
            color="color-mix(in oklab, var(--color-primary) 18%, var(--color-border))"
          />
          {/* React Flow's stylesheet is unlayered, so `.react-flow__controls
              { display: flex }` beats Tailwind's layered `hidden`. */}
          <Controls
            className="hidden! sm:flex!"
            showInteractive={false}
            position="top-right"
          />
        </ReactFlow>
      </div>

      {nodes.length === 0 ? (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-4">
          <div className="step-enter pointer-events-auto w-full max-w-xs rounded-xl bg-card p-4 text-center shadow-node ring-1 ring-border sm:p-5 lg:max-w-sm lg:p-6">
            <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-linear-to-br from-primary/15 to-primary/5 text-primary ring-8 ring-primary/5 lg:size-14">
              <Sparkles className="size-6 lg:size-7" />
            </span>
            <h2 className="mt-3 text-base font-medium text-balance lg:mt-4 lg:text-lg">
              Wala pang laman ang canvas
            </h2>
            <p className="mt-1 text-sm text-pretty text-muted-foreground">
              {canAddElements
                ? "Start with one step. You can move it, connect it and change it any time."
                : "Your modules land here once you add them from the Raket Market."}
            </p>
            {canAddElements ? (
              <Button
                className="mt-4 h-11 w-full lg:mt-5 lg:h-12"
                onClick={() => setPaletteOpen(true)}
              >
                <Plus />
                Add your first step
              </Button>
            ) : (
              <Link
                href="/marketplace"
                className={cn(
                  buttonVariants(),
                  "mt-4 h-11 w-full gap-2 lg:mt-5 lg:h-12",
                )}
              >
                <Store aria-hidden="true" />
                Go to Raket Market
              </Link>
            )}
          </div>
        </div>
      ) : null}

      <div
        className={cn(
          "pointer-events-none absolute right-4 bottom-4 z-10",
          "flex flex-col items-end gap-3 sm:right-6 sm:bottom-6",
        )}
      >
        {canAddElements ? (
          <div className="pointer-events-auto lg:hidden">
            <RunPreview
              variant="icon"
              nodes={previewNodes}
              edges={previewEdges}
            />
          </div>
        ) : null}
        {canAddElements ? (
          <Button
            className="pointer-events-auto size-14 rounded-full p-0 shadow-lg shadow-primary/25 active:scale-95 motion-reduce:active:scale-100"
            onClick={() => setPaletteOpen(true)}
            aria-label="Add a step"
          >
            <Plus className="size-6" />
          </Button>
        ) : null}
      </div>

      <PaletteSheet
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        scope={scope}
        moduleId={moduleId}
        unlockedTypes={unlockedTypes}
        atCapacity={atCapacity}
        onAdd={addFromPalette}
      />

      <InspectorSheet
        open={inspectorOpen}
        onOpenChange={setInspectorOpen}
        flowId={flowId}
        node={selectedNode}
        moduleId={moduleId}
        onSaved={(nodeKey, values) => {
          setNodes((current) =>
            current.map((node) =>
              node.id === nodeKey
                ? {
                    ...node,
                    data: {
                      ...node.data,
                      values: { ...node.data.values, ...values },
                    },
                  }
                : node,
            ),
          );
        }}
        onDeleted={(nodeKey) => {
          setNodes((current) => current.filter((node) => node.id !== nodeKey));
          setEdges((current) =>
            current.filter(
              (edge) => edge.source !== nodeKey && edge.target !== nodeKey,
            ),
          );
          setSelectedKey(null);
        }}
      />
    </div>
  );
}

export function Canvas(props: CanvasProps) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}

export interface RaketCanvasProps {
  flowId: string;
  initialNodes: CanvasNode[];
  initialEdges: CanvasEdge[];
  /** node_key -> flow_nodes.id, so a tapped module can open its own canvas. */
  nodeIds: Record<string, string>;
}

/** The outer canvas: module nodes navigate into their own builder. */
export function RaketCanvas({
  flowId,
  initialNodes,
  initialEdges,
  nodeIds,
}: RaketCanvasProps) {
  const router = useRouter();

  return (
    <Canvas
      flowId={flowId}
      scope="raket"
      initialNodes={initialNodes}
      initialEdges={initialEdges}
      unlockedTypes={[]}
      onOpenModule={(nodeKey, moduleId) => {
        const id = nodeIds[nodeKey];
        if (!id) {
          toast.error("That module does not have a builder yet.");
          return;
        }
        // Booking opens what an owner actually checks — the Booked list —
        // rather than its inner canvas.
        router.push(moduleNodeHref(moduleId, id));
      }}
    />
  );
}
