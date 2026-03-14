import { useEffect, useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { XIcon, ArrowLeft } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { CardSourceRect } from '@/App'
import type { BeadIssue } from '@/lib/types'

interface IssueDetail {
  id: string
  title: string
  description?: string
  status: string
  priority: number
  issue_type?: string
  owner?: string
  created_at?: string
  updated_at?: string
  closed_at?: string
  close_reason?: string
  dependencies?: Array<{ id: string; title: string; status: string; dependency_type?: string }>
  dependents?: Array<{ id: string; title: string; status: string; dependency_type?: string }>
  parent?: string
}

const PRIORITY_COLORS: Record<number, string> = {
  0: 'text-[#f85149]',
  1: 'text-[#e3b341]',
  2: 'text-[#58a6ff]',
  3: 'text-[#7d8590]',
  4: 'text-muted-foreground',
}

const TYPE_STYLES: Record<string, string> = {
  bug: 'bg-[#da3633]/15 text-[#f85149] border-[#da3633]/30',
  feature: 'bg-[#8957e5]/15 text-[#bc8cff] border-[#8957e5]/30',
  task: 'bg-[#2dd4bf]/15 text-[#5eead4] border-[#2dd4bf]/30',
  epic: 'bg-[#d29922]/15 text-[#e3b341] border-[#d29922]/30',
  chore: 'bg-[#7d8590]/15 text-[#7d8590] border-[#7d8590]/30',
}

const STATUS_STYLES: Record<string, string> = {
  open: 'bg-[#238636]/20 text-[#3fb950] border border-[#238636]/40',
  in_progress: 'bg-[#1f6feb]/20 text-[#58a6ff] border border-[#1f6feb]/40',
  closed: 'bg-[#7d8590]/20 text-[#7d8590] border border-[#7d8590]/40',
  blocked: 'bg-[#da3633]/20 text-[#f85149] border border-[#da3633]/40',
}

function formatDate(dateStr?: string) {
  if (!dateStr) return null
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function DepItem({ dep, onNavigate }: { dep: { id: string; title: string; status: string; dependency_type?: string }; onNavigate?: (id: string) => void }) {
  const icon = dep.status === 'closed' ? '\u2713' : dep.status === 'in_progress' ? '\u25D0' : '\u25CB'
  return (
    <div className="flex items-start gap-2 py-1">
      <span className="text-xs leading-4 text-foreground">{icon}</span>
      <div className="min-w-0">
        <div className="flex items-center gap-1">
          <code
            className="text-xs leading-4 text-muted-foreground cursor-pointer hover:underline hover:text-foreground transition-colors"
            onClick={() => onNavigate?.(dep.id)}
          >
            {dep.id}
          </code>
          {dep.dependency_type && (
            <span className="text-xs leading-4 text-muted-foreground">({dep.dependency_type})</span>
          )}
        </div>
        <p className="text-sm leading-tight text-foreground">{dep.title}</p>
      </div>
    </div>
  )
}

// Compute initial animation state: morph from card position to modal center
function getInitialAnimState(sourceRect: CardSourceRect | null) {
  if (!sourceRect) {
    // Fallback: subtle scale-up from center
    return { opacity: 0, scale: 0.92, y: 8 }
  }

  const modalWidth = Math.min(560, window.innerWidth - 32)
  const modalHeight = Math.min(window.innerHeight * 0.85, 640)
  const modalCenterX = window.innerWidth / 2
  const modalCenterY = window.innerHeight / 2
  const cardCenterX = sourceRect.left + sourceRect.width / 2
  const cardCenterY = sourceRect.top + sourceRect.height / 2

  return {
    opacity: 0,
    scale: Math.max(sourceRect.width / modalWidth, sourceRect.height / modalHeight),
    x: cardCenterX - modalCenterX,
    y: cardCenterY - modalCenterY,
  }
}

// Spring config for natural, snappy feel
const modalSpring = { type: 'spring' as const, damping: 28, stiffness: 380, mass: 0.8 }
const overlayTween = { duration: 0.2, ease: [0.4, 0, 0.2, 1] as const }

// Module-level cache: survives modal close/reopen, cleared on page reload
const detailCache = new Map<string, IssueDetail>()

export function IssueDetailPanel({
  issueId,
  open,
  onClose,
  sourceRect,
  issues,
}: {
  issueId: string | null
  open: boolean
  onClose: () => void
  sourceRect?: CardSourceRect | null
  issues?: BeadIssue[]
}) {
  const [detail, setDetail] = useState<IssueDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [navStack, setNavStack] = useState<string[]>([])
  const [currentId, setCurrentId] = useState<string | null>(issueId)
  const [contentReady, setContentReady] = useState(false)
  const fetchedDetail = useRef<IssueDetail | null>(null)

  // Sync currentId when issueId prop changes (new modal open)
  useEffect(() => {
    setCurrentId(issueId)
    setNavStack([])
    setContentReady(false)
    fetchedDetail.current = null
  }, [issueId])

  // Reset stack when modal closes
  useEffect(() => {
    if (!open) {
      setNavStack([])
      setContentReady(false)
      fetchedDetail.current = null
    }
  }, [open])

  const navigateTo = useCallback((targetId: string) => {
    if (currentId) {
      setNavStack(prev => [...prev, currentId])
    }
    setCurrentId(targetId)
    setContentReady(false)
    fetchedDetail.current = null
  }, [currentId])

  const navigateBack = useCallback(() => {
    setNavStack(prev => {
      const next = [...prev]
      const previousId = next.pop()
      if (previousId) setCurrentId(previousId)
      setContentReady(false)
      fetchedDetail.current = null
      return next
    })
  }, [])

  // Track whether entrance animation is done
  const [animDone, setAnimDone] = useState(false)

  useEffect(() => {
    if (!currentId || !open) return

    // Stale-while-revalidate: show cached or list data instantly, then refresh
    const cached = detailCache.get(currentId)
    if (cached) {
      fetchedDetail.current = cached
      setDetail(cached)
      setContentReady(true)
    } else if (issues) {
      // Use list data as instant placeholder (partial — no deps/description detail)
      const listItem = issues.find(i => i.id === currentId)
      if (listItem) {
        const partial: IssueDetail = {
          id: listItem.id,
          title: listItem.title,
          status: listItem.status,
          priority: listItem.priority,
          issue_type: listItem.issue_type || listItem.type,
          description: listItem.description,
          created_at: listItem.created_at,
          updated_at: listItem.updated_at,
          parent: listItem.parent,
        }
        fetchedDetail.current = partial
        setDetail(partial)
        setContentReady(true)
      }
    }

    setLoading(!cached && !issues?.find(i => i.id === currentId))
    fetch(`/api/issue/${currentId}`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(data => {
        const issue = Array.isArray(data) ? data[0] : data
        if (issue) detailCache.set(currentId, issue)
        fetchedDetail.current = issue || null
        if (animDone) {
          setDetail(issue || null)
          setContentReady(true)
        }
      })
      .catch(() => {
        if (!cached) {
          fetchedDetail.current = null
          if (animDone) {
            setDetail(null)
            setContentReady(true)
          }
        }
      })
      .finally(() => setLoading(false))
  }, [currentId, open]) // intentionally exclude animDone to avoid re-fetching

  // When animation completes, reveal content if data is ready
  useEffect(() => {
    if (animDone && !loading && fetchedDetail.current !== undefined) {
      setDetail(fetchedDetail.current)
      setContentReady(true)
    }
  }, [animDone, loading])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, handleKeyDown])

  const initialAnim = getInitialAnimState(sourceRect || null)

  // Reset animDone when modal opens/closes
  useEffect(() => {
    if (!open) setAnimDone(false)
  }, [open])

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Overlay */}
          <motion.div
            key="overlay"
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={overlayTween}
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            key="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="issue-detail-title"
            className="fixed z-50 w-full sm:max-w-[560px] max-w-[calc(100%-2rem)] max-h-[85vh] flex flex-col rounded-xl border bg-card text-card-foreground border-border shadow-2xl p-0 outline-none overflow-hidden"
            style={{
              top: '50%',
              left: '50%',
              translateX: '-50%',
              translateY: '-50%',
            }}
            initial={initialAnim}
            animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
            exit={{
              opacity: 0,
              scale: 0.95,
              y: 6,
              transition: { duration: 0.15, ease: [0.4, 0, 1, 1] },
            }}
            transition={modalSpring}
            onAnimationComplete={() => setAnimDone(true)}
          >
            {/* Back button */}
            {navStack.length > 0 && (
              <button
                onClick={navigateBack}
                className="absolute top-4 left-4 z-10 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-hidden"
              >
                <ArrowLeft className="size-4" />
                <span className="sr-only">Back</span>
              </button>
            )}

            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 z-10 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-hidden"
            >
              <XIcon className="size-4" />
              <span className="sr-only">Close</span>
            </button>

            {!contentReady ? (
              <div className="p-5 pb-3 space-y-4 animate-pulse">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-4 w-6 rounded bg-muted" />
                  <div className="h-4 w-24 rounded bg-muted" />
                  <div className="h-5 w-12 rounded-full bg-muted" />
                  <div className="h-5 w-16 rounded-full bg-muted" />
                </div>
                <div className="h-5 w-3/4 rounded bg-muted" />
                <div className="h-4 w-1/3 rounded bg-muted" />
                <Separator />
                <div className="space-y-2 pt-2">
                  <div className="h-3 w-20 rounded bg-muted" />
                  <div className="h-4 w-full rounded bg-muted" />
                  <div className="h-4 w-full rounded bg-muted" />
                  <div className="h-4 w-2/3 rounded bg-muted" />
                </div>
              </div>
            ) : detail ? (
              <ScrollArea className="flex-1 min-h-0">
                <div className="p-5 pb-3">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span className={`text-xs font-semibold ${PRIORITY_COLORS[detail.priority] || PRIORITY_COLORS[4]}`}>
                      P{detail.priority}
                    </span>
                    <code className="text-xs text-muted-foreground">{detail.id}</code>
                    {detail.issue_type && (
                      <Badge variant="outline" className={TYPE_STYLES[detail.issue_type] || ''}>
                        {detail.issue_type}
                      </Badge>
                    )}
                    <Badge className={STATUS_STYLES[detail.status] || ''}>
                      {detail.status.replace('_', ' ')}
                    </Badge>
                  </div>
                  <h2 id="issue-detail-title" className="text-base leading-tight font-semibold text-foreground">{detail.title}</h2>
                  {detail.owner && (
                    <p className="text-sm text-muted-foreground mt-1">{detail.owner}</p>
                  )}
                </div>

                <Separator />

                <div className="p-5 space-y-4">
                  {detail.description && (
                    <div>
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Description</h3>
                      <p className="text-sm whitespace-pre-wrap text-foreground leading-relaxed">{detail.description}</p>
                    </div>
                  )}

                  {detail.close_reason && (
                    <div>
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Close Reason</h3>
                      <p className="text-sm text-foreground">{detail.close_reason}</p>
                    </div>
                  )}

                  {detail.parent && (
                    <div>
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Parent</h3>
                      <code
                        className="text-xs text-muted-foreground cursor-pointer hover:underline hover:text-foreground transition-colors"
                        onClick={() => navigateTo(detail.parent!)}
                      >
                        {detail.parent}
                      </code>
                    </div>
                  )}

                  {detail.dependencies && detail.dependencies.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Dependencies</h3>
                      {detail.dependencies.map(dep => <DepItem key={dep.id} dep={dep} onNavigate={navigateTo} />)}
                    </div>
                  )}

                  {detail.dependents && detail.dependents.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Blocks</h3>
                      {detail.dependents.map(dep => <DepItem key={dep.id} dep={dep} onNavigate={navigateTo} />)}
                    </div>
                  )}

                  <Separator />

                  <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                    {detail.created_at && (
                      <div>
                        <span className="font-semibold">Created</span>
                        <p>{formatDate(detail.created_at)}</p>
                      </div>
                    )}
                    {detail.updated_at && (
                      <div>
                        <span className="font-semibold">Updated</span>
                        <p>{formatDate(detail.updated_at)}</p>
                      </div>
                    )}
                    {detail.closed_at && (
                      <div>
                        <span className="font-semibold">Closed</span>
                        <p>{formatDate(detail.closed_at)}</p>
                      </div>
                    )}
                  </div>
                </div>
              </ScrollArea>
            ) : (
              <div className="flex items-center justify-center py-12">
                <span className="text-sm text-muted-foreground">Issue not found</span>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
