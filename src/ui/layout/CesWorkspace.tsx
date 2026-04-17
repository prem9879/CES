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
    <div className="ces-shell h-screen w-full overflow-hidden bg-ice-gradient text-cyan-100">
      <CommandPalette />
      <FirstRunOnboarding />
      <div className="ces-layer flex h-full min-h-0">
        <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
        <div className="ces-reveal flex-1 h-full min-h-0 min-w-0">
          <ChatArea />
        </div>
      </div>
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  )
}
