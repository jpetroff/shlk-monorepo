import { isSuccessfulSnoozeResponse, type SnoozeMessage, type SnoozeMessageResponse } from './snooze.protocol'

export const BRIDGE_CHANNEL = 'shlk:website-bridge:v1'
export const MESSAGE_TIMEOUT_MS = 2_000

export function validateSnoozeResponse(response: unknown): SnoozeMessageResponse {
  if (isSuccessfulSnoozeResponse(response)) return response
  const error = response && typeof response === 'object' && 'error' in response
    ? String(response.error) : 'The extension is incompatible'
  throw new Error(error)
}

export function withMessageTimeout<T>(operation: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = globalThis.setTimeout(() => reject(new Error('The extension did not respond')), MESSAGE_TIMEOUT_MS)
    Promise.resolve().then(operation).then(resolve, reject).finally(() => globalThis.clearTimeout(timeout))
  })
}

export function sendWebsiteBridgeMessage(message: SnoozeMessage, origin: string): Promise<SnoozeMessageResponse> {
  if (!origin || window.location.origin !== origin || window.top !== window) {
    return Promise.reject(new Error('Extension messaging is unavailable on this page'))
  }
  return new Promise((resolve, reject) => {
    const requestId = crypto.randomUUID()
    const cleanup = () => {
      window.removeEventListener('message', onMessage)
      globalThis.clearTimeout(timeout)
    }
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window || event.origin !== origin) return
      const data = event.data
      if (!data || data.channel !== BRIDGE_CHANNEL || data.direction !== 'response' || data.requestId !== requestId) return
      cleanup()
      try { resolve(validateSnoozeResponse(data.response)) } catch (error) { reject(error) }
    }
    const timeout = globalThis.setTimeout(() => {
      cleanup()
      reject(new Error('The extension did not respond'))
    }, MESSAGE_TIMEOUT_MS)
    window.addEventListener('message', onMessage)
    try {
      window.postMessage({ channel: BRIDGE_CHANNEL, direction: 'request', requestId, message }, origin)
    } catch (error) {
      cleanup()
      reject(error)
    }
  })
}
