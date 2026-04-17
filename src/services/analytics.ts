export interface AnalyticsEvent {
  type: 'request' | 'mode' | 'latency'
  timestamp: number
  metadata: Record<string, string | number | boolean>
}

class AnalyticsService {
  private events: AnalyticsEvent[] = []

  track(event: AnalyticsEvent): void {
    this.events.push(event)
    if (this.events.length > 5000) {
      this.events.shift()
    }
  }

  summarize(): { total: number; byType: Record<string, number> } {
    const byType: Record<string, number> = {}
    this.events.forEach((event) => {
      byType[event.type] = (byType[event.type] || 0) + 1
    })
    return { total: this.events.length, byType }
  }
}

export const analyticsService = new AnalyticsService()
