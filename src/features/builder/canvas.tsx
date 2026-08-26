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

/**
 * Space traffic behind the board. Planets drift down slowly, each with its
 * own face — a ring, islands, craters; rockets STREAK upward on a slant with
 * their boost lit, because on an ascending ship only something faster climbs
 * the screen. Hand-scattered positions and negative delays keep it feeling
 * random; the transit-then-rest keyframes keep streaks an event rather than
 * weather. Deterministic, zero JS.
 */
const SPACE_PLANETS: readonly {
  left: string;
  size: number;
  duration: number;
  delay: number;
  opacity: number;
  color: "planet-c2" | "planet-c3" | "planet-c4" | "planet-c5";
  feature: "ring" | "land" | "crater";
}[] = [
  { left: "7%", size: 16, duration: 46, delay: -9, opacity: 0.7, color: "planet-c5", feature: "crater" },
  { left: "29%", size: 10, duration: 40, delay: -30, opacity: 0.55, color: "planet-c3", feature: "land" },
  { left: "55%", size: 12, duration: 54, delay: -4, opacity: 0.6, color: "planet-c2", feature: "land" },
  { left: "82%", size: 20, duration: 49, delay: -26, opacity: 0.75, color: "planet-c4", feature: "ring" },
];

const SPACE_ROCKETS: readonly {
  left: string;
  size: number;
  duration: number;
  delay: number;
  opacity: number;
  shootX: string;
  tilt: number;
}[] = [
  { left: "14%", size: 16, duration: 26, delay: -5, opacity: 0.85, shootX: "24vw", tilt: 13 },
  { left: "66%", size: 13, duration: 31, delay: -17, opacity: 0.7, shootX: "-20vw", tilt: -12 },
  { left: "88%", size: 18, duration: 23, delay: -11, opacity: 0.8, shootX: "-28vw", tilt: -15 },
];

function TinyRocket({ size }: { size: number }) {
  return (
    <svg
      viewBox="0 0 14 40"
      width={size}
      height={size * (40 / 14)}
      aria-hidden="true"
      className="text-primary"
    >
      <path
        d="M7 1 C 10 5 11 10 11 16 L 10 20 L 12 24 L 8 22 L 6 22 L 2 24 L 4 20 L 3 16 C 3 10 4 5 7 1 Z"
        fill="currentColor"
        fillOpacity="0.25"
        stroke="currentColor"
        strokeOpacity="0.7"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      <circle cx="7" cy="10" r="1.6" fill="currentColor" fillOpacity="0.8" />
      {/* The boost. */}
      <g className="flame-flicker">
        <path
          d="M7 24 C 10 28 10 32 7 39 C 4 32 4 28 7 24 Z"
          fill="var(--color-destructive)"
          fillOpacity="0.5"
        />
        <path
          d="M7 25 C 8.6 28 8.6 31 7 35 C 5.4 31 5.4 28 7 25 Z"
          fill="var(--color-warning)"
          fillOpacity="0.85"
        />
      </g>
    </svg>
  );
}

function SpaceTraffic() {
  return (
    <>
      {SPACE_PLANETS.map((item, index) => (
        <div
          key={`p${index}`}
          aria-hidden="true"
          className="debris"
          style={
            {
              left: item.left,
              "--debris-duration": `${item.duration}s`,
              "--debris-delay": `${item.delay}s`,
              "--debris-opacity": item.opacity,
            } as CSSProperties
          }
        >
          <div style={{ position: "relative", width: item.size, height: item.size }}>
            <div
              className={`planet ${item.color}`}
              style={{ width: item.size, height: item.size }}
            >
              {item.feature === "land" ? (
                <>
                  <div
                    className="planet-land"
                    style={{
                      left: "18%",
                      top: "30%",
                      width: "44%",
                      height: "34%",
                      borderRadius: "62% 38% 55% 45% / 55% 60% 40% 45%",
                    }}
                  />
                  <div
                    className="planet-land"
                    style={{
                      left: "58%",
                      top: "58%",
                      width: "30%",
                      height: "24%",
                      borderRadius: "45% 55% 60% 40% / 50% 45% 55% 50%",
                    }}
                  />
                </>
              ) : null}
              {item.feature === "crater" ? (
                <>
                  <div className="planet-crater" style={{ left: "24%", top: "22%", width: "22%", height: "22%" }} />
                  <div className="planet-crater" style={{ left: "58%", top: "48%", width: "16%", height: "16%" }} />
                  <div className="planet-crater" style={{ left: "34%", top: "62%", width: "12%", height: "12%" }} />
                </>
              ) : null}
            </div>
            {item.feature === "ring" ? <div className="planet-ring" /> : null}
          </div>
        </div>
      ))}
      {SPACE_ROCKETS.map((item, index) => (
        <div
          key={`r${index}`}
          aria-hidden="true"
          className="debris-rocket"
          style={
            {
              left: item.left,
              "--debris-duration": `${item.duration}s`,
              "--debris-delay": `${item.delay}s`,
              "--debris-opacity": item.opacity,
              "--shoot-x": item.shootX,
            } as CSSProperties
          }
        >
          <div style={{ transform: `rotate(${item.tilt}deg)` }}>
            <TinyRocket size={item.size} />
          </div>
        </div>
      ))}
    </>
  );
}

// Defined once: a fresh nodeTypes object on every render makes React Flow
// remount every node it draws.
const NODE_RENDERERS: NodeTypes = { [CANVAS_NODE_COMPONENT]: ElementNode };

/*
  padding 0.1: as zoomed IN as fitting the CARDS allows. maxZoom 1 so a
  near-empty board does not open at magnifying-glass scale. The interactive
  minZoom floor below must sit under any fit the board can demand.
*/
const FIT_VIEW_OPTIONS = { padding: 0.1, maxZoom: 1 };

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
  /*
    The opening frame fits the ELEMENTS, not the artwork. The rocket
    sections stretch the board past 1900 units, and fitting them shrank
    every card to postage-stamp size — the decoration was deciding the
    zoom. Scoping the fit to the non-rocket nodes opens the board with the
    cards big and lets the hull run off-screen, which is what a close-up
    of a rocket looks like.
  */
  const fitViewOptions = useMemo(() => {
    const cards = initialNodes.filter(
      (node) => node.data.nodeType !== "rocket",
    );
    return cards.length > 0
      ? { ...FIT_VIEW_OPTIONS, nodes: cards.map((node) => ({ id: node.id })) }
      : FIT_VIEW_OPTIONS;
  }, [initialNodes]);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const { screenToFlowPosition } = useReactFlow();

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
        if (edge.id.startsWith("clients")) continue;
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
        "relative h-full w-full overflow-hidden",
        scope === "raket" ? "board-space" : "board-wash",
        className,
      )}
      style={CANVAS_THEME}
    >
      {/* Space belongs to the raket in flight, not the inner builders. */}
      {scope === "raket" ? (
        <>
          <div className="star-field-far" aria-hidden="true" />
          <div className="star-field-near" aria-hidden="true" />
          <SpaceTraffic />
        </>
      ) : null}

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
            if (edge.id.startsWith("clients")) return;
            toast("Remove this line?", {
              action: { label: "Unlink", onClick: () => unlink(edge) },
            });
          }}
          onNodeDragStop={(_, node) => {
            // The Clients markers are injected, not stored — there is no row
            // to move.
            if (node.data.nodeType === "clients") return;
            void updateNodePosition({
              flowId,
              nodeKey: node.id,
              x: node.position.x,
              y: node.position.y,
            }).catch(() => {});
          }}
          onNodeClick={(_, node) => {
            // Annotations — the Clients markers and the rocket's sections —
            // have nothing to open.
            if (
              node.data.nodeType === "clients" ||
              node.data.nodeType === "rocket"
            )
              return;
            if (node.data.nodeType === "module") {
              onOpenModule?.(node.id, node.data.moduleId ?? null);
              return;
            }
            setSelectedKey(node.id);
            setInspectorOpen(true);
          }}
          onPaneClick={() => setSelectedKey(null)}
          nodeTypes={NODE_RENDERERS}
          // Every load frames the elements: fitView scoped to the cards,
          // with nothing restoring an old camera over it. The viewport
          // memory that used to win here is gone — a board that opens
          // half off-screen reads as broken.
          fitView
          fitViewOptions={fitViewOptions}
          minZoom={0.15}
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
          {/* No grid in space: a dot lattice under a starfield reads as a
              thousand fake stars. The inner builders keep theirs — a grid
              helps arrange steps, and they have no sky to confuse. */}
          {scope !== "raket" ? (
            <Background
              variant={BackgroundVariant.Dots}
              gap={20}
              size={1.5}
              color="color-mix(in oklab, var(--color-primary) 18%, var(--color-border))"
            />
          ) : null}
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
