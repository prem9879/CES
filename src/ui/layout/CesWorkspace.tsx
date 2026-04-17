'use client'

import { Sidebar } from '@/components/Sidebar'
import { ChatArea } from '@/components/ChatArea'
import { SettingsModal } from '@/components/SettingsModal'
import { useStore } from '@/store'
import { CommandPalette } from '@/ui/components/CommandPalette'
import { FirstRunOnboarding } from '@/ui/components/FirstRunOnboarding'

export function CesWorkspace() {
  const { showSettings, setShowSettings, sidebarOpen, setSidebarOpen } = useStore()

  return (
    <div className="ces-shell h-dvh w-full overflow-hidden bg-ice-gradient text-cyan-100">
      <CommandPalette />
      <FirstRunOnboarding />
      <div className="ces-layer grid h-full min-h-0 grid-cols-[0_minmax(0,1fr)] md:grid-cols-[280px_minmax(0,1fr)]">
        <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
        <div className="ces-reveal min-h-0 min-w-0">
          <ChatArea />
        </div>
      </div>
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  )
}
