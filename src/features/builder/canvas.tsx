"use client"

import "@xyflow/react/dist/style.css"

import { useCallback, useMemo, useState, type CSSProperties } from "react"
import { useRouter } from "next/navigation"
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
} from "@xyflow/react"
import { Plus, Sparkles } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  canAddNode,
  edgeKey,
  nextNodeKey,
  nextNodePosition,
  CANVAS_NODE_COMPONENT,
  type CanvasEdge,
  type CanvasNode,
} from "@/lib/flow/mappers"
import { resolveNodeType, withDefaults, type NodeScope } from "@/lib/flow/registry"
import { cn } from "@/lib/utils"

import {
  addNode,
  connectNodes,
  disconnectNodes,
  updateNodePosition,
} from "@/features/builder/actions"
import { ElementNode, type BuilderNode } from "@/features/builder/element-node"
import { InspectorSheet } from "@/features/builder/inspector-sheet"
import { DRAG_MIME, PaletteSheet } from "@/features/builder/palette-sheet"
import { RunPreview } from "@/features/builder/run-preview"

// Defined once: a fresh nodeTypes object on every render makes React Flow
// remount every node it draws.
const NODE_RENDERERS: NodeTypes = { [CANVAS_NODE_COMPONENT]: ElementNode }

const FIT_VIEW_OPTIONS = { padding: 0.25 }

/**
 * React Flow ships its own palette through CSS custom properties, so pointing
 * those at our design tokens themes the canvas without fighting its stylesheet.
 */
const CANVAS_THEME = {
  "--xy-background-color": "transparent",
  "--xy-edge-stroke": "var(--color-primary)",
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
  "--xy-controls-box-shadow": "none",
  "--xy-attribution-background-color": "transparent",
} as CSSProperties

export interface CanvasProps {
  flowId: string
  scope: NodeScope
  moduleId?: string
  initialNodes: CanvasNode[]
  initialEdges: CanvasEdge[]
  unlockedTypes: string[]
  /** Receives the canvas node key; the caller maps it to a database id. */
  onOpenModule?: (nodeKey: string) => void
}

function toCanvasNode(node: BuilderNode): CanvasNode {
  return {
    id: node.id,
    type: node.type ?? CANVAS_NODE_COMPONENT,
    position: node.position,
    data: node.data,
  }
}

function toCanvasEdge(edge: Edge): CanvasEdge {
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: typeof edge.label === "string" ? edge.label : undefined,
    animated: edge.animated ?? true,
  }
}

function CanvasInner({
  flowId,
  scope,
  moduleId,
  initialNodes,
  initialEdges,
  unlockedTypes,
  onOpenModule,
}: CanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<BuilderNode>(
    initialNodes.map((node) => ({ ...node }))
  )
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(
    initialEdges.map((edge) => ({ ...edge }))
  )
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [inspectorOpen, setInspectorOpen] = useState(false)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const { screenToFlowPosition } = useReactFlow()

  const previewNodes = useMemo(() => nodes.map(toCanvasNode), [nodes])
  const previewEdges = useMemo(() => edges.map(toCanvasEdge), [edges])

  const selectedNode = useMemo(() => {
    const found = nodes.find((node) => node.id === selectedKey)
    return found ? toCanvasNode(found) : null
  }, [nodes, selectedKey])

  const place = useCallback(
    async (type: string, position: { x: number; y: number }) => {
      const guard = canAddNode(nodes, type)
      if (!guard.ok) {
        toast.error(guard.reason)
        return
      }

      const def = resolveNodeType(type)
      const optimisticKey = nextNodeKey(
        nodes.map((node) => node.id),
        type
      )
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
      }
      setNodes((current) => [...current, optimistic])

      try {
        const result = await addNode({
          flowId,
          type,
          x: Math.round(position.x),
          y: Math.round(position.y),
        })

        if (!result.ok || !result.nodeKey) {
          setNodes((current) =>
            current.filter((node) => node.id !== optimisticKey)
          )
          toast.error(result.message ?? "We could not add that step.")
          return
        }

        const saved = result.nodeKey
        setNodes((current) =>
          current.map((node) =>
            node.id === optimisticKey ? { ...node, id: saved } : node
          )
        )
        toast.success(`${def.short} added.`)
      } catch {
        setNodes((current) =>
          current.filter((node) => node.id !== optimisticKey)
        )
        toast.error("Something went wrong. Please try again.")
      }
    },
    [flowId, nodes, setNodes]
  )

  const addFromPalette = useCallback(
    (type: string) => {
      void place(type, nextNodePosition(nodes))
    },
    [nodes, place]
  )

  const onConnect = useCallback(
    (connection: Connection) => {
      const { source, target } = connection
      if (!source || !target) return
      if (source === target) {
        toast.error("A step cannot connect to itself.")
        return
      }

      const id = edgeKey(source, target)
      if (edges.some((edge) => edge.id === id)) {
        toast.error("Those steps are already connected.")
        return
      }

      setEdges((current) =>
        addEdge({ ...connection, id, animated: true }, current)
      )

      void connectNodes({ flowId, source, target })
        .then((result) => {
          if (!result.ok) {
            setEdges((current) => current.filter((edge) => edge.id !== id))
            toast.error(result.message ?? "We could not connect those steps.")
          }
        })
        .catch(() => {
          setEdges((current) => current.filter((edge) => edge.id !== id))
          toast.error("Something went wrong. Please try again.")
        })
    },
    [edges, flowId, setEdges]
  )

  const onEdgesDelete = useCallback(
    (deleted: Edge[]) => {
      for (const edge of deleted) {
        void disconnectNodes({ flowId, edgeKey: edge.id }).catch(() => {})
      }
    },
    [flowId]
  )

  const unlink = useCallback(
    (edge: Edge) => {
      setEdges((current) => current.filter((item) => item.id !== edge.id))
      void disconnectNodes({ flowId, edgeKey: edge.id })
        .then((result) => {
          if (!result.ok) {
            setEdges((current) => [...current, edge])
            toast.error(result.message ?? "We could not remove that line.")
          }
        })
        .catch(() => {
          setEdges((current) => [...current, edge])
          toast.error("Something went wrong. Please try again.")
        })
    },
    [flowId, setEdges]
  )

  return (
    <div
      className="relative h-[calc(100dvh-21rem)] min-h-88 w-full overflow-hidden rounded-xl bg-muted/30 ring-1 ring-border"
      style={CANVAS_THEME}
    >
      <div
        className="absolute inset-0 touch-none"
        onDragOver={(event) => {
          event.preventDefault()
          event.dataTransfer.dropEffect = "move"
        }}
        onDrop={(event) => {
          const type = event.dataTransfer.getData(DRAG_MIME)
          if (!type) return
          event.preventDefault()
          void place(
            type,
            screenToFlowPosition({ x: event.clientX, y: event.clientY })
          )
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
            toast("Remove this line?", {
              action: { label: "Unlink", onClick: () => unlink(edge) },
            })
          }}
          onNodeDragStop={(_, node) => {
            void updateNodePosition({
              flowId,
              nodeKey: node.id,
              x: node.position.x,
              y: node.position.y,
            }).catch(() => {})
          }}
          onNodeClick={(_, node) => {
            if (node.data.nodeType === "module") {
              onOpenModule?.(node.id)
              return
            }
            setSelectedKey(node.id)
            setInspectorOpen(true)
          }}
          onPaneClick={() => setSelectedKey(null)}
          nodeTypes={NODE_RENDERERS}
          fitView
          fitViewOptions={FIT_VIEW_OPTIONS}
          minZoom={0.4}
          maxZoom={1.5}
          nodeDragThreshold={3}
          nodeClickDistance={8}
          paneClickDistance={8}
          deleteKeyCode={null}
          zoomOnDoubleClick={false}
          selectNodesOnDrag={false}
          proOptions={{ hideAttribution: false }}
          className="h-full w-full"
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1.5}
            color="var(--color-border)"
          />
          <Controls
            className="hidden sm:flex"
            showInteractive={false}
            position="top-right"
          />
        </ReactFlow>
      </div>

      {nodes.length === 0 ? (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-4">
          <div className="pointer-events-auto w-full max-w-xs rounded-xl bg-card p-4 text-center shadow-sm ring-1 ring-border sm:p-5">
            <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Sparkles className="size-6" />
            </span>
            <h2 className="mt-3 text-base font-medium text-balance">
              Wala pang laman ang canvas
            </h2>
            <p className="mt-1 text-sm text-pretty text-muted-foreground">
              Start with one step. You can move it, connect it and change it
              any time.
            </p>
            <Button
              className="mt-4 h-11 w-full"
              onClick={() => setPaletteOpen(true)}
            >
              <Plus />
              Add your first step
            </Button>
          </div>
        </div>
      ) : null}

      <div
        className={cn(
          "pointer-events-none absolute right-4 bottom-4 z-10",
          "flex flex-col items-end gap-3 sm:bottom-6"
        )}
      >
        <div className="pointer-events-auto">
          <RunPreview
            variant="icon"
            nodes={previewNodes}
            edges={previewEdges}
          />
        </div>
        <Button
          className="pointer-events-auto size-14 rounded-full p-0 shadow-lg"
          onClick={() => setPaletteOpen(true)}
          aria-label="Add a step"
        >
          <Plus className="size-6" />
        </Button>
      </div>

      <PaletteSheet
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        scope={scope}
        moduleId={moduleId}
        unlockedTypes={unlockedTypes}
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
                : node
            )
          )
        }}
        onDeleted={(nodeKey) => {
          setNodes((current) => current.filter((node) => node.id !== nodeKey))
          setEdges((current) =>
            current.filter(
              (edge) => edge.source !== nodeKey && edge.target !== nodeKey
            )
          )
          setSelectedKey(null)
        }}
      />
    </div>
  )
}

export function Canvas(props: CanvasProps) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  )
}

export interface RaketCanvasProps {
  flowId: string
  initialNodes: CanvasNode[]
  initialEdges: CanvasEdge[]
  /** node_key -> flow_nodes.id, so a tapped module can open its own canvas. */
  nodeIds: Record<string, string>
}

/** The outer canvas: module nodes navigate into their own builder. */
export function RaketCanvas({
  flowId,
  initialNodes,
  initialEdges,
  nodeIds,
}: RaketCanvasProps) {
  const router = useRouter()

  return (
    <Canvas
      flowId={flowId}
      scope="raket"
      initialNodes={initialNodes}
      initialEdges={initialEdges}
      unlockedTypes={[]}
      onOpenModule={(nodeKey) => {
        const id = nodeIds[nodeKey]
        if (!id) {
          toast.error("That module does not have a builder yet.")
          return
        }
        router.push(`/raket/${id}`)
      }}
    />
  )
}
