import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import * as dagre from '@dagrejs/dagre'
import type { BeadIssue } from '@/lib/types'

interface DependencyGraphProps {
  issues: BeadIssue[]
  onNodeClick?: (id: string) => void
}

// Status-based colors for dark theme
const STATUS_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  open: { bg: '#1a2e1a', border: '#238636', text: '#7ee787' },
  in_progress: { bg: '#152238', border: '#1f6feb', text: '#79c0ff' },
  closed: { bg: '#1c1c1c', border: '#484f58', text: '#8b949e' },
  blocked: { bg: '#3b1a1a', border: '#da3633', text: '#ff7b72' },
  deferred: { bg: '#2a2017', border: '#9e6a03', text: '#e3b341' },
}

// Light theme colors
const STATUS_COLORS_LIGHT: Record<string, { bg: string; border: string; text: string }> = {
  open: { bg: '#dafbe1', border: '#238636', text: '#116329' },
  in_progress: { bg: '#ddf4ff', border: '#1f6feb', text: '#0550ae' },
  closed: { bg: '#f0f0f0', border: '#8b949e', text: '#57606a' },
  blocked: { bg: '#ffebe9', border: '#da3633', text: '#cf222e' },
  deferred: { bg: '#fff8c5', border: '#9e6a03', text: '#6f4e00' },
}

const DEFAULT_COLOR = { bg: '#1c1c1c', border: '#484f58', text: '#8b949e' }
const DEFAULT_COLOR_LIGHT = { bg: '#f6f8fa', border: '#d0d7de', text: '#57606a' }

const NODE_WIDTH = 180
const NODE_HEIGHT = 56
const PADDING = 40

interface LayoutNode {
  id: string
  x: number
  y: number
  issue: BeadIssue
}

interface LayoutEdge {
  from: string
  to: string
  points: Array<{ x: number; y: number }>
}

function computeLayout(issues: BeadIssue[]): { nodes: LayoutNode[]; edges: LayoutEdge[]; width: number; height: number } {
  const g = new dagre.graphlib.Graph()
  g.setGraph({
    rankdir: 'TB',
    nodesep: 40,
    ranksep: 60,
    marginx: PADDING,
    marginy: PADDING,
  })
  g.setDefaultEdgeLabel(() => ({}))

  const issueMap = new Map(issues.map(i => [i.id, i]))

  for (const issue of issues) {
    g.setNode(issue.id, { width: NODE_WIDTH, height: NODE_HEIGHT })
  }

  for (const issue of issues) {
    if (issue.dependencies) {
      for (const dep of issue.dependencies) {
        if (issueMap.has(dep)) {
          // Edge from dependent -> dependency (issue depends on dep)
          g.setEdge(issue.id, dep)
        }
      }
    }
  }

  dagre.layout(g)

  const nodes: LayoutNode[] = []
  const edges: LayoutEdge[] = []

  for (const id of g.nodes()) {
    const node = g.node(id)
    const issue = issueMap.get(id)
    if (node && issue) {
      nodes.push({ id, x: node.x, y: node.y, issue })
    }
  }

  for (const e of g.edges()) {
    const edgeData = g.edge(e)
    if (edgeData && edgeData.points) {
      edges.push({ from: e.v, to: e.w, points: edgeData.points })
    }
  }

  const graphLabel = g.graph()
  const width = (graphLabel?.width || 800) + PADDING * 2
  const height = (graphLabel?.height || 600) + PADDING * 2

  return { nodes, edges, width, height }
}

function getTransitiveDeps(issueId: string, issueMap: Map<string, BeadIssue>, visited = new Set<string>()): Set<string> {
  if (visited.has(issueId)) return visited
  visited.add(issueId)
  const issue = issueMap.get(issueId)
  if (issue?.dependencies) {
    for (const dep of issue.dependencies) {
      if (issueMap.has(dep)) {
        getTransitiveDeps(dep, issueMap, visited)
      }
    }
  }
  return visited
}

function getTransitiveDependents(issueId: string, dependentsMap: Map<string, string[]>, visited = new Set<string>()): Set<string> {
  if (visited.has(issueId)) return visited
  visited.add(issueId)
  const dependents = dependentsMap.get(issueId) || []
  for (const dep of dependents) {
    getTransitiveDependents(dep, dependentsMap, visited)
  }
  return visited
}

function buildSmoothPath(points: Array<{ x: number; y: number }>): string {
  if (points.length < 2) return ''
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`
  }

  let d = `M ${points[0].x} ${points[0].y}`
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1]
    const curr = points[i]
    const next = points[i + 1]
    const cpx1 = (prev.x + curr.x) / 2
    const cpy1 = (prev.y + curr.y) / 2
    const cpx2 = (curr.x + next.x) / 2
    const cpy2 = (curr.y + next.y) / 2
    if (i === 1) {
      d += ` Q ${curr.x} ${curr.y} ${cpx2} ${cpy2}`
    } else {
      d += ` T ${cpx2} ${cpy2}`
    }
    // Unused but kept for potential future use
    void cpx1; void cpy1
  }
  const last = points[points.length - 1]
  d += ` L ${last.x} ${last.y}`
  return d
}

function truncateText(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text
  return text.slice(0, maxLen - 1) + '\u2026'
}

export function DependencyGraph({ issues, onNodeClick }: DependencyGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 })
  const [isPanning, setIsPanning] = useState(false)
  const panStart = useRef({ x: 0, y: 0, tx: 0, ty: 0 })
  const [isDark, setIsDark] = useState(true)

  // Detect theme
  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains('dark'))
    check()
    const observer = new MutationObserver(check)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  const colorMap = isDark ? STATUS_COLORS : STATUS_COLORS_LIGHT
  const defaultColor = isDark ? DEFAULT_COLOR : DEFAULT_COLOR_LIGHT

  const issueMap = useMemo(() => new Map(issues.map(i => [i.id, i])), [issues])
  const dependentsMap = useMemo(() => {
    const m = new Map<string, string[]>()
    for (const issue of issues) {
      if (issue.dependencies) {
        for (const dep of issue.dependencies) {
          const list = m.get(dep) || []
          list.push(issue.id)
          m.set(dep, list)
        }
      }
    }
    return m
  }, [issues])

  const layout = useMemo(() => computeLayout(issues), [issues])

  const highlightedIds = useMemo(() => {
    if (!selectedId) return null
    const deps = getTransitiveDeps(selectedId, issueMap)
    const dependents = getTransitiveDependents(selectedId, dependentsMap)
    return new Set([...deps, ...dependents])
  }, [selectedId, issueMap, dependentsMap])

  // Fit to view on mount / issues change
  useEffect(() => {
    if (!containerRef.current) return
    const { width: gw, height: gh } = layout
    const cw = containerRef.current.clientWidth
    const ch = containerRef.current.clientHeight
    if (gw === 0 || gh === 0) return
    const scale = Math.min(cw / gw, ch / gh, 1) * 0.9
    const x = (cw - gw * scale) / 2
    const y = (ch - gh * scale) / 2
    setTransform({ x, y, scale })
  }, [layout])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    setTransform(prev => {
      const newScale = Math.min(3, Math.max(0.1, prev.scale * delta))
      // Zoom toward mouse position
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return { ...prev, scale: newScale }
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      return {
        scale: newScale,
        x: mx - (mx - prev.x) * (newScale / prev.scale),
        y: my - (my - prev.y) * (newScale / prev.scale),
      }
    })
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    // Only pan when clicking on the background SVG (not nodes)
    if ((e.target as SVGElement).closest('.dag-node')) return
    setIsPanning(true)
    panStart.current = { x: e.clientX, y: e.clientY, tx: transform.x, ty: transform.y }
  }, [transform])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning) return
    setTransform({
      ...transform,
      x: panStart.current.tx + (e.clientX - panStart.current.x),
      y: panStart.current.ty + (e.clientY - panStart.current.y),
    })
  }, [isPanning, transform])

  const handleMouseUp = useCallback(() => {
    setIsPanning(false)
  }, [])

  const handleNodeClick = useCallback((id: string) => {
    setSelectedId(prev => prev === id ? null : id)
    onNodeClick?.(id)
  }, [onNodeClick])

  const bgColor = isDark ? '#0d1117' : '#ffffff'
  const gridColor = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.04)'
  const edgeDefaultColor = isDark ? 'rgba(139,148,158,0.3)' : 'rgba(87,96,106,0.25)'
  const edgeHighlightColor = isDark ? 'rgba(136,192,255,0.7)' : 'rgba(31,111,235,0.6)'
  const edgeDimColor = isDark ? 'rgba(139,148,158,0.08)' : 'rgba(87,96,106,0.08)'

  if (issues.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        No issues to display
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative overflow-hidden"
      style={{ background: bgColor, cursor: isPanning ? 'grabbing' : 'grab' }}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <svg
        width="100%"
        height="100%"
        style={{ position: 'absolute', top: 0, left: 0 }}
      >
        {/* Grid pattern */}
        <defs>
          <pattern id="dag-grid" width="20" height="20" patternUnits="userSpaceOnUse"
            patternTransform={`translate(${transform.x},${transform.y}) scale(${transform.scale})`}>
            <circle cx="10" cy="10" r="0.5" fill={gridColor} />
          </pattern>
          <marker
            id="dag-arrow"
            viewBox="0 0 10 10"
            refX="10"
            refY="5"
            markerWidth="8"
            markerHeight="8"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill={edgeDefaultColor} />
          </marker>
          <marker
            id="dag-arrow-highlight"
            viewBox="0 0 10 10"
            refX="10"
            refY="5"
            markerWidth="8"
            markerHeight="8"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill={edgeHighlightColor} />
          </marker>
          <marker
            id="dag-arrow-dim"
            viewBox="0 0 10 10"
            refX="10"
            refY="5"
            markerWidth="8"
            markerHeight="8"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill={edgeDimColor} />
          </marker>
          <filter id="dag-glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        <rect width="100%" height="100%" fill="url(#dag-grid)" />

        <g transform={`translate(${transform.x},${transform.y}) scale(${transform.scale})`}>
          {/* Edges */}
          {layout.edges.map((edge, i) => {
            const isHighlighted = highlightedIds
              ? highlightedIds.has(edge.from) && highlightedIds.has(edge.to)
              : false
            const isDimmed = highlightedIds !== null && !isHighlighted
            const color = isDimmed ? edgeDimColor : isHighlighted ? edgeHighlightColor : edgeDefaultColor
            const markerId = isDimmed ? 'dag-arrow-dim' : isHighlighted ? 'dag-arrow-highlight' : 'dag-arrow'

            return (
              <path
                key={`edge-${i}`}
                d={buildSmoothPath(edge.points)}
                fill="none"
                stroke={color}
                strokeWidth={isHighlighted ? 2 : 1.5}
                markerEnd={`url(#${markerId})`}
                style={{ transition: 'stroke 0.3s, stroke-width 0.3s, opacity 0.3s' }}
              />
            )
          })}

          {/* Nodes */}
          {layout.nodes.map(node => {
            const status = node.issue.status || 'open'
            const colors = colorMap[status] || defaultColor
            const isSelected = selectedId === node.id
            const isHighlighted = highlightedIds ? highlightedIds.has(node.id) : false
            const isDimmed = highlightedIds !== null && !isHighlighted
            const opacity = isDimmed ? 0.2 : 1

            return (
              <g
                key={node.id}
                className="dag-node"
                transform={`translate(${node.x - NODE_WIDTH / 2},${node.y - NODE_HEIGHT / 2})`}
                onClick={() => handleNodeClick(node.id)}
                style={{
                  cursor: 'pointer',
                  opacity,
                  transition: 'opacity 0.3s',
                }}
              >
                {/* Node background */}
                <rect
                  width={NODE_WIDTH}
                  height={NODE_HEIGHT}
                  rx={8}
                  ry={8}
                  fill={colors.bg}
                  stroke={isSelected ? colors.text : colors.border}
                  strokeWidth={isSelected ? 2.5 : 1.5}
                  filter={isSelected ? 'url(#dag-glow)' : undefined}
                  style={{ transition: 'stroke 0.2s, stroke-width 0.2s' }}
                />
                {/* Status indicator bar */}
                <rect
                  x={0}
                  y={0}
                  width={4}
                  height={NODE_HEIGHT}
                  rx={2}
                  fill={colors.border}
                />
                {/* Bead ID */}
                <text
                  x={14}
                  y={20}
                  fill={colors.text}
                  fontSize={11}
                  fontFamily="ui-monospace, SFMono-Regular, monospace"
                  fontWeight={600}
                >
                  {node.issue.id}
                </text>
                {/* Title */}
                <text
                  x={14}
                  y={40}
                  fill={isDark ? '#c9d1d9' : '#1f2328'}
                  fontSize={11}
                  fontFamily="system-ui, -apple-system, sans-serif"
                >
                  {truncateText(node.issue.title, 22)}
                </text>
                {/* Status pill */}
                <rect
                  x={NODE_WIDTH - 68}
                  y={6}
                  width={56}
                  height={18}
                  rx={9}
                  fill={colors.border}
                  opacity={0.3}
                />
                <text
                  x={NODE_WIDTH - 40}
                  y={18}
                  fill={colors.text}
                  fontSize={9}
                  fontFamily="system-ui, sans-serif"
                  textAnchor="middle"
                >
                  {status.replace('_', ' ')}
                </text>
              </g>
            )
          })}
        </g>
      </svg>

      {/* Legend */}
      <div
        className="absolute bottom-4 left-4 rounded-lg border p-3 text-xs space-y-1.5"
        style={{
          background: isDark ? 'rgba(13,17,23,0.9)' : 'rgba(255,255,255,0.9)',
          borderColor: isDark ? 'rgba(48,54,61,0.8)' : 'rgba(208,215,222,0.8)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <div className="font-semibold text-foreground mb-1">Status</div>
        {Object.entries(colorMap).map(([status, colors]) => (
          <div key={status} className="flex items-center gap-2">
            <span
              className="inline-block w-3 h-3 rounded-sm"
              style={{ background: colors.border }}
            />
            <span style={{ color: colors.text }}>{status.replace('_', ' ')}</span>
          </div>
        ))}
        <div className="border-t pt-1.5 mt-1.5" style={{ borderColor: isDark ? 'rgba(48,54,61,0.6)' : 'rgba(208,215,222,0.6)' }}>
          <span className="text-muted-foreground">Click node to highlight dependencies</span>
        </div>
      </div>

      {/* Controls hint */}
      <div
        className="absolute bottom-4 right-4 rounded-lg border px-3 py-2 text-xs text-muted-foreground"
        style={{
          background: isDark ? 'rgba(13,17,23,0.9)' : 'rgba(255,255,255,0.9)',
          borderColor: isDark ? 'rgba(48,54,61,0.8)' : 'rgba(208,215,222,0.8)',
          backdropFilter: 'blur(8px)',
        }}
      >
        Scroll to zoom &middot; Drag to pan
      </div>
    </div>
  )
}
