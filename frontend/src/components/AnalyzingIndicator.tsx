'use client'

import { useEffect, useState } from 'react';

/**
 * Status messages shown while the analysis runs. The backend doesn't stream
 * progress, so these advance on a timer that roughly follows the real pipeline
 * (MCP server start -> Semgrep scan -> AI review -> structured report).
 */
const STAGES: { after: number; text: string }[] = [
  { after: 0, text: 'Starting the Semgrep MCP server…' },
  { after: 5, text: 'Scanning code with Semgrep rules…' },
  { after: 20, text: 'AI agent reviewing Semgrep findings…' },
  { after: 35, text: 'Looking for issues Semgrep may have missed…' },
  { after: 55, text: 'Scoring vulnerabilities (CVSS) and drafting fixes…' },
  { after: 80, text: 'Still working — large files and cold starts take longer…' },
];

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s.toString().padStart(2, '0')}s` : `${s}s`;
}

/**
 * Animated "analysis in progress" panel: radar scanner, indeterminate
 * progress bar, rotating status text and an elapsed-time counter.
 */
export default function AnalyzingIndicator() {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  const stage = [...STAGES].reverse().find((s) => elapsed >= s.after) ?? STAGES[0];

  return (
    <div
      role="status"
      aria-live="polite"
      className="h-full min-h-[220px] flex flex-col items-center justify-center gap-6 rounded-lg border border-border bg-gray-50 p-6"
    >
      {/* Radar scanner */}
      <div className="relative h-28 w-28" aria-hidden="true">
        <div className="absolute inset-0 rounded-full border-2 border-primary/30" />
        <div className="absolute inset-4 rounded-full border border-primary/20" />
        <div className="absolute inset-9 rounded-full border border-primary/10" />
        <div className="absolute inset-0 rounded-full motion-safe:animate-ping border border-primary/20" />
        <div
          className="absolute inset-0 rounded-full motion-safe:animate-[spin_2.5s_linear_infinite]"
          style={{ background: 'conic-gradient(from 0deg, transparent 0deg, rgba(56,161,105,0.45) 60deg, transparent 61deg)' }}
        />
        {/* Shield in the centre */}
        <svg viewBox="0 0 24 24" className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 text-primary motion-safe:animate-pulse" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6l7-3z" fill="currentColor" fillOpacity="0.12" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      </div>

      {/* Status text */}
      <div className="text-center">
        <p key={stage.text} className="font-medium text-foreground motion-safe:animate-[fadein_0.5s_ease-out]">
          {stage.text}
        </p>
        <p className="mt-1 text-xs text-accent">
          Elapsed {formatElapsed(elapsed)} · analysis usually takes 30–90 seconds
        </p>
      </div>

      {/* Indeterminate progress bar */}
      <div className="h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-primary/15" aria-hidden="true">
        <div className="h-full w-1/3 rounded-full bg-primary motion-safe:animate-[indeterminate_1.6s_ease-in-out_infinite]" />
      </div>
    </div>
  );
}
