'use client';

import { useEffect, useRef } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { useAgentTerminal } from '@/hooks/useAgentTerminal';
import '@xterm/xterm/css/xterm.css';

interface Props {
  agentId: string;
  initialContent?: string;
}

export function Terminal({ agentId, initialContent }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<XTerm | null>(null);
  const { connect, disconnect, sendStdin } = useAgentTerminal(agentId);

  useEffect(() => {
    if (!containerRef.current) return;

    const terminal = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'JetBrains Mono, Menlo, Monaco, monospace',
      theme: {
        background: '#1a1b26',
        foreground: '#a9b1d6',
        cursor: '#c0caf5',
        selectionBackground: '#33467c',
      },
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);

    terminal.open(containerRef.current);
    fitAddon.fit();

    terminalRef.current = terminal;

    if (initialContent) {
      terminal.write(initialContent);
    }

    connect((chunk) => {
      terminal.write(chunk);
    });

    terminal.onData((data) => {
      sendStdin(data);
    });

    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      disconnect();
      resizeObserver.disconnect();
      terminal.dispose();
    };
  }, [agentId, connect, disconnect, sendStdin, initialContent]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
    />
  );
}
