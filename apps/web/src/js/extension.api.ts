// Only the WebExtension API surface used by SHLK. Firefox uses native promises;
// Chrome MV3 supports promises for these methods too.
export type ExtensionAlarm = { name: string, scheduledTime?: number, periodInMinutes?: number }
export type ExtensionAlarmCreateInfo = { when?: number, delayInMinutes?: number, periodInMinutes?: number }
export type ExtensionTab = { id?: number, url?: string }
export type ExtensionMessageSender = {
  id?: string
  url?: string
  origin?: string
  frameId?: number
  tab?: ExtensionTab
}
export type ExtensionNotificationOptions = {
  type: 'basic'
  title: string
  message: string
  iconUrl: string
  priority?: number
}
export type MessageListener = (
  message: unknown, sender: ExtensionMessageSender, respond: (response: any) => void
) => boolean | void
type ExtensionEvent<T> = { addListener(callback: T): void }
export type StorageArea = {
  get(keys?: string | string[] | null): Promise<Record<string, any>>
  set(items: Record<string, any>): Promise<void>
  remove(keys: string | string[]): Promise<void>
  clear(): Promise<void>
}
export type ExtensionApi = {
  runtime: {
    id?: string
    getURL(path: string): string
    sendMessage(message: unknown): Promise<unknown>
    onMessage: ExtensionEvent<MessageListener>
    onMessageExternal?: ExtensionEvent<MessageListener>
    onInstalled: ExtensionEvent<() => void>
    onStartup: ExtensionEvent<() => void>
  }
  tabs?: {
    query(query: { active?: boolean, lastFocusedWindow?: boolean, url?: string }): Promise<ExtensionTab[]>
    create(options: { url: string }): Promise<ExtensionTab>
    remove(id: number): Promise<void>
  }
  alarms?: {
    create(name: string, info: ExtensionAlarmCreateInfo): Promise<void> | void
    getAll(): Promise<ExtensionAlarm[]>
    clear(name: string): Promise<boolean>
    onAlarm: ExtensionEvent<(alarm: ExtensionAlarm) => void>
  }
  notifications?: {
    create(id: string, options: ExtensionNotificationOptions): Promise<string>
    onClicked: ExtensionEvent<(id: string) => void>
  }
  storage?: { local: StorageArea, sync: StorageArea, session?: StorageArea }
}

export function getExtensionApi(): ExtensionApi | undefined {
  const scope = globalThis as typeof globalThis & { browser?: ExtensionApi, chrome?: unknown }
  return scope.browser ?? scope.chrome as ExtensionApi | undefined
}

export function isFirefoxExtension(): boolean {
  return Boolean(getExtensionApi()?.runtime.getURL?.('').startsWith('moz-extension://'))
}

export function isTrustedExtensionSender(sender: ExtensionMessageSender, webAppOrigin: string): boolean {
  const api = getExtensionApi()
  if (!api?.runtime.id || sender.id !== api.runtime.id || !sender.url) return false
  try {
    const url = new URL(sender.url)
    // Popup and other extension-owned pages; never trust a caller-supplied origin.
    const root = new URL(api.runtime.getURL(''))
    if (url.protocol === root.protocol && url.host === root.host) return true
    return sender.frameId === 0 && Boolean(sender.tab) && url.origin === webAppOrigin
  } catch {
    return false
  }
}
