import { useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

interface TerminalPanelProps {
  visible: boolean
  theme?: 'dark' | 'light'
}

export interface TerminalPanelHandle {
  resetSession: () => void
  setFontFamily: (fontFamily: string) => void
  setFontSize: (size: number) => void
}

const DARK_THEME = {
  background: '#0d1117',
  foreground: '#e6edf3',
  cursor: '#e6edf3',
  selectionBackground: '#264f78',
  black: '#484f58',
  red: '#ff7b72',
  green: '#3fb950',
  yellow: '#d29922',
  blue: '#58a6ff',
  magenta: '#bc8cff',
  cyan: '#39d353',
  white: '#b1bac4',
  brightBlack: '#6e7681',
  brightRed: '#ffa198',
  brightGreen: '#56d364',
  brightYellow: '#e3b341',
  brightBlue: '#79c0ff',
  brightMagenta: '#d2a8ff',
  brightCyan: '#56d364',
  brightWhite: '#f0f6fc',
}

const LIGHT_THEME = {
  background: '#ffffff',
  foreground: '#1f2328',
  cursor: '#1f2328',
  selectionBackground: '#b6d4fe',
  black: '#24292f',
  red: '#cf222e',
  green: '#116329',
  yellow: '#4d2d00',
  blue: '#0969da',
  magenta: '#8250df',
  cyan: '#1b7c83',
  white: '#6e7781',
  brightBlack: '#57606a',
  brightRed: '#a40e26',
  brightGreen: '#1a7f37',
  brightYellow: '#633c01',
  brightBlue: '#218bff',
  brightMagenta: '#a475f9',
  brightCyan: '#3192aa',
  brightWhite: '#8c959f',
}

export const TerminalPanel = forwardRef<TerminalPanelHandle, TerminalPanelProps>(function TerminalPanel({ visible, theme = 'dark' }, ref) {
  const containerRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const initializedRef = useRef(false)
  const exitedRef = useRef(false)

  const connect = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/terminal`)
    wsRef.current = ws
    exitedRef.current = false

    ws.onopen = () => {
      const terminal = terminalRef.current
      const fitAddon = fitAddonRef.current
      if (terminal && fitAddon) {
        // Send initial size
        fitAddon.fit()
        ws.send(JSON.stringify({
          type: 'resize',
          cols: terminal.cols,
          rows: terminal.rows,
        }))
      }
    }

    ws.onmessage = (event) => {
      const data = event.data
      try {
        const msg = JSON.parse(data)
        if (msg.type === 'exit') {
          exitedRef.current = true
          terminalRef.current?.writeln(
            `\r\n\x1b[90mProcess exited (code ${msg.code}). Press any key to restart.\x1b[0m`
          )
          return
        }
      } catch {
        // Not JSON — terminal output
      }
      terminalRef.current?.write(data)
    }

    ws.onclose = () => {
      if (!exitedRef.current) {
        terminalRef.current?.writeln('\r\n\x1b[90mDisconnected. Reconnecting...\x1b[0m')
        setTimeout(connect, 2000)
      }
    }

    ws.onerror = () => {
      ws.close()
    }
  }, [])

  const resetSession = useCallback(() => {
    // Set exitedRef true BEFORE closing so onclose handler doesn't auto-reconnect
    exitedRef.current = true
    wsRef.current?.close()
    wsRef.current = null
    // Don't reset exitedRef here — connect() does it, and onclose fires async
    const terminal = terminalRef.current
    if (terminal) {
      terminal.clear()
      terminal.reset()
    }
    // Small delay to ensure onclose fires before we connect fresh
    setTimeout(() => connect(), 0)
  }, [connect])

  const setFontFamily = useCallback((fontFamily: string) => {
    const terminal = terminalRef.current
    const fitAddon = fitAddonRef.current
    if (terminal) {
      terminal.options.fontFamily = fontFamily || 'Menlo, Monaco, "Courier New", monospace'
      if (fitAddon) fitAddon.fit()
    }
  }, [])

  const setFontSize = useCallback((size: number) => {
    const terminal = terminalRef.current
    const fitAddon = fitAddonRef.current
    if (terminal) {
      terminal.options.fontSize = size
      if (fitAddon) fitAddon.fit()
    }
  }, [])

  useImperativeHandle(ref, () => ({ resetSession, setFontFamily, setFontSize }), [resetSession, setFontFamily, setFontSize])

  useEffect(() => {
    if (initializedRef.current || !containerRef.current) return
    initializedRef.current = true

    const savedFont = localStorage.getItem('beads-board-terminal-font-family')
    const savedFontSize = localStorage.getItem('beads-board-terminal-font-size')

    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: savedFontSize ? Number(savedFontSize) : 13,
      fontFamily: savedFont || 'Menlo, Monaco, "Courier New", monospace',
      theme: theme === 'light' ? LIGHT_THEME : DARK_THEME,
    })

    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)
    terminal.open(containerRef.current)
    fitAddon.fit()

    terminalRef.current = terminal
    fitAddonRef.current = fitAddon

    terminal.onData((data) => {
      if (exitedRef.current) {
        // Restart on any keypress after exit
        exitedRef.current = false
        terminal.clear()
        wsRef.current?.close()
        connect()
        return
      }
      const ws = wsRef.current
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(data)
      }
    })

    connect()

    return () => {
      wsRef.current?.close()
      terminal.dispose()
    }
  }, [connect])

  // Sync terminal theme when UI theme changes
  useEffect(() => {
    const terminal = terminalRef.current
    if (terminal) {
      terminal.options.theme = theme === 'light' ? LIGHT_THEME : DARK_THEME
    }
  }, [theme])

  // Refit when visibility changes or container resizes
  useEffect(() => {
    if (!visible || !containerRef.current) return
    const fitAddon = fitAddonRef.current
    if (!fitAddon) return

    // Fit after layout settles
    const timer = setTimeout(() => {
      fitAddon.fit()
      const terminal = terminalRef.current
      const ws = wsRef.current
      if (terminal && ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'resize',
          cols: terminal.cols,
          rows: terminal.rows,
        }))
      }
    }, 50)

    const observer = new ResizeObserver(() => {
      fitAddon.fit()
      const terminal = terminalRef.current
      const ws = wsRef.current
      if (terminal && ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'resize',
          cols: terminal.cols,
          rows: terminal.rows,
        }))
      }
    })
    observer.observe(containerRef.current)

    return () => {
      clearTimeout(timer)
      observer.disconnect()
    }
  }, [visible])

  return (
    <div
      ref={containerRef}
      className="h-full w-full pl-2 pt-1"
      style={{ display: visible ? 'block' : 'none' }}
    />
  )
})
