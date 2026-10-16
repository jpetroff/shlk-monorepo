import { getExtensionApi } from './extension.api'
import { isSnoozeMessage, SNOOZE_PROTOCOL_VERSION } from './snooze.protocol'
import { BRIDGE_CHANNEL, validateSnoozeResponse, withMessageTimeout } from './website-bridge'

export function installWebsiteBridge(origin: string): () => void {
  const api = getExtensionApi()
  if (!api?.runtime.id || window.top !== window || window.location.origin !== origin) return () => {}
  const pending = new Set<string>()
  let active = true
  const onMessage = (event: MessageEvent) => {
    if (event.source !== window || event.origin !== origin) return
    const data = event.data
    if (!data || data.channel !== BRIDGE_CHANNEL || data.direction !== 'request' ||
      typeof data.requestId !== 'string' || !/^[\w-]{1,128}$/.test(data.requestId) ||
      !isSnoozeMessage(data.message) || pending.has(data.requestId)) return
    const { requestId, message } = data
    pending.add(requestId)
    void withMessageTimeout(() => api.runtime.sendMessage(message))
      .then(validateSnoozeResponse)
      .catch((error: unknown) => ({
        ok: false, protocol: SNOOZE_PROTOCOL_VERSION,
        error: error instanceof Error ? error.message : 'Extension messaging failed'
      }))
      .then((response) => {
        pending.delete(requestId)
        if (active) window.postMessage({ channel: BRIDGE_CHANNEL, direction: 'response', requestId, response }, origin)
      })
  }
  const cleanup = () => {
    active = false
    pending.clear()
    window.removeEventListener('message', onMessage)
    window.removeEventListener('pagehide', onPageHide)
  }
  const onPageHide = (event: PageTransitionEvent) => {
    if (!event.persisted) cleanup()
  }
  window.addEventListener('message', onMessage)
  window.addEventListener('pagehide', onPageHide)
  return cleanup
}

if (typeof __SHLK_WEB_APP_ORIGIN__ !== 'undefined') installWebsiteBridge(__SHLK_WEB_APP_ORIGIN__)
