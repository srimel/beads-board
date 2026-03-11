import { useEffect, useRef, useCallback } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

interface TerminalPanelProps {
  visible: boolean
}

export function TerminalPanel({ visible }: TerminalPanelProps) {
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

  useEffect(() => {
    if (initializedRef.current || !containerRef.current) return
    initializedRef.current = true

    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
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
      },
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
      className="h-full w-full"
      style={{ display: visible ? 'block' : 'none' }}
    />
  )
}
