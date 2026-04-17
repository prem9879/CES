import type { CESIntent } from './intent-engine'

export type CESMode = 'chat' | 'build' | 'debug' | 'research' | 'decision'

const MAP_INTENT_TO_MODE: Record<CESIntent, CESMode> = {
  build: 'build',
  research: 'research',
  debug: 'debug',
  decide: 'decision',
  automate: 'build',
  chat: 'chat'
}

export interface ModeRouteResult {
  mode: CESMode
  reason: string
}

export function routeMode(intent: CESIntent, preferredMode?: CESMode): ModeRouteResult {
  if (preferredMode && preferredMode !== 'chat') {
    return {
      mode: preferredMode,
      reason: `User-selected mode '${preferredMode}' overrides automatic routing.`
    }
  }

  const mode = MAP_INTENT_TO_MODE[intent]
  return {
    mode,
    reason: `Intent '${intent}' routed to mode '${mode}'.`
  }
}
