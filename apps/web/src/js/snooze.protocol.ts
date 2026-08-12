export const SNOOZE_PROTOCOL_VERSION = 1 as const

export type SnoozeScheduleItem = {
  id: string
  location: string
  awake: number
  siteTitle?: string
}

export type SnoozePingRequest = {
  type: 'shlk:ping'
  protocol: typeof SNOOZE_PROTOCOL_VERSION
}

export type SnoozeScheduleRequest = {
  type: 'shlk:schedule'
  protocol: typeof SNOOZE_PROTOCOL_VERSION
  item: SnoozeScheduleItem
}

export type SnoozeMessage = SnoozePingRequest | SnoozeScheduleRequest

export type SnoozeMessageResponse = {
  ok: boolean
  protocol: typeof SNOOZE_PROTOCOL_VERSION
  error?: string
}

export const pingRequest = (): SnoozePingRequest => ({
  type: 'shlk:ping',
  protocol: SNOOZE_PROTOCOL_VERSION
})

export const scheduleRequest = (item: SnoozeScheduleItem): SnoozeScheduleRequest => ({
  type: 'shlk:schedule',
  protocol: SNOOZE_PROTOCOL_VERSION,
  item
})

export function isSnoozeMessage(value: unknown): value is SnoozeMessage {
  if (!value || typeof value !== 'object') return false
  const message = value as Partial<SnoozeMessage>
  if (message.protocol !== SNOOZE_PROTOCOL_VERSION) return false
  if (message.type === 'shlk:ping') return true
  return message.type === 'shlk:schedule' && isSnoozeScheduleItem(message.item)
}

export function isSnoozeScheduleItem(value: unknown): value is SnoozeScheduleItem {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<SnoozeScheduleItem>
  if (typeof item.id !== 'string' || !item.id.trim()) return false
  if (typeof item.awake !== 'number' || !Number.isFinite(item.awake) || item.awake <= 0) return false
  if (typeof item.location !== 'string') return false
  try {
    const url = new URL(item.location)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export function isSuccessfulSnoozeResponse(value: unknown): value is SnoozeMessageResponse {
  if (!value || typeof value !== 'object') return false
  const response = value as Partial<SnoozeMessageResponse>
  return response.ok === true && response.protocol === SNOOZE_PROTOCOL_VERSION
}
