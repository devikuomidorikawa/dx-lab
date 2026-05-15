interface Window {
  turnstile?: {
    render: (container: Element, options: Record<string, unknown>) => string
    reset: (widgetId: string) => void
    execute: (widgetId: string) => void
  }
}
