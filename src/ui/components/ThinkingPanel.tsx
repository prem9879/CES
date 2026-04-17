'use client'

import { useStore } from '@/store'

export function ThinkingPanel() {
  const { thinkingOpen, setThinkingOpen, lastIntent, lastMode, pipelineSteps } = useStore()

  return (
    <aside
      className={`ces-panel h-screen border-l border-cyan-900/70 bg-[#06131d]/78 backdrop-blur-md transition-all duration-300 ${
        thinkingOpen ? 'w-80' : 'w-12'
      }`}
    >
      <div className="flex items-center justify-between border-b border-cyan-900/70 px-3 py-3">
        {thinkingOpen && <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-100">Thinking Panel</h3>}
        <button
          onClick={() => setThinkingOpen(!thinkingOpen)}
          className="rounded border border-cyan-800 px-2 py-1 text-xs text-cyan-200 transition-colors hover:bg-cyan-800/40"
        >
          {thinkingOpen ? '>' : '<'}
        </button>
      </div>

      {thinkingOpen && (
        <div className="space-y-4 px-3 py-4 text-sm">
          <section className="rounded-lg border border-cyan-900/70 bg-cyan-950/20 p-2">
            <p className="text-xs uppercase tracking-[0.14em] text-cyan-300/70">Intent</p>
            <p className="text-cyan-100">{lastIntent || 'n/a'}</p>
          </section>
          <section className="rounded-lg border border-cyan-900/70 bg-cyan-950/20 p-2">
            <p className="text-xs uppercase tracking-[0.14em] text-cyan-300/70">Mode</p>
            <p className="text-cyan-100">{lastMode || 'n/a'}</p>
          </section>
          <section className="rounded-lg border border-cyan-900/70 bg-cyan-950/20 p-2">
            <p className="text-xs uppercase tracking-[0.14em] text-cyan-300/70">Steps</p>
            <ol className="space-y-1 text-cyan-200/90">
              {pipelineSteps.length === 0 ? (
                <li>1. No execution steps captured yet.</li>
              ) : (
                pipelineSteps.map((step, idx) => <li key={idx}>{idx + 1}. {step}</li>)
              )}
            </ol>
          </section>
        </div>
      )}
    </aside>
  )
}
