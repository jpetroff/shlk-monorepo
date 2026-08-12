import { describe, expect, test } from 'vitest'
import {
  isSnoozeMessage,
  isSnoozeScheduleItem,
  isSuccessfulSnoozeResponse,
  pingRequest,
  scheduleRequest,
  SNOOZE_PROTOCOL_VERSION
} from '../src/js/snooze.protocol'

const item = { id: 'link-one', location: 'https://example.com', awake: 2_000_000_000_000 }

describe('snooze extension protocol', () => {
  test('builds and validates versioned ping and schedule messages', () => {
    expect(isSnoozeMessage(pingRequest())).toBe(true)
    expect(isSnoozeMessage(scheduleRequest(item))).toBe(true)
    expect(isSuccessfulSnoozeResponse({ ok: true, protocol: SNOOZE_PROTOCOL_VERSION })).toBe(true)
  })

  test('rejects incompatible, malformed, and privileged URLs', () => {
    expect(isSnoozeMessage({ ...pingRequest(), protocol: 2 })).toBe(false)
    expect(isSnoozeScheduleItem({ ...item, id: '' })).toBe(false)
    expect(isSnoozeScheduleItem({ ...item, awake: Number.NaN })).toBe(false)
    expect(isSnoozeScheduleItem({ ...item, location: 'chrome://settings' })).toBe(false)
    expect(isSnoozeScheduleItem({ ...item, location: 'javascript:alert(1)' })).toBe(false)
  })
})
