import session, { type SessionData } from 'express-session'
import type { Database } from 'bun:sqlite'

const SIX_MONTHS_MS = 1000 * 60 * 60 * 24 * 30 * 6
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000

type SessionCallback = (error?: unknown, value?: SessionData | null) => void

export class SQLiteSessionStore extends session.Store {
  private readonly cleanupTimer: ReturnType<typeof setInterval>
  private cleanupRunning = false

  constructor(private readonly sqlite: Database) {
    super()
    this.cleanupTimer = setInterval(() => this.cleanupExpired(), CLEANUP_INTERVAL_MS)
    this.cleanupTimer.unref()
  }

  get(sid: string, callback: SessionCallback): void {
    try {
      const row = this.sqlite.query(`
        SELECT session_json, expires_at
        FROM sessions WHERE sid = ?
      `).get(sid) as { session_json: string, expires_at: number } | null

      if (!row || row.expires_at <= Date.now()) {
        if (row) this.sqlite.query('DELETE FROM sessions WHERE sid = ?').run(sid)
        callback(undefined, null)
        return
      }
      callback(undefined, JSON.parse(row.session_json) as SessionData)
    } catch (error) {
      callback(error)
    }
  }

  set(sid: string, value: SessionData, callback?: (error?: unknown) => void): void {
    try {
      const expiresAt = value.cookie.expires?.getTime()
        ?? Date.now() + (value.cookie.maxAge ?? SIX_MONTHS_MS)
      this.sqlite.query(`
        INSERT INTO sessions (sid, session_json, expires_at, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(sid) DO UPDATE SET
          session_json = excluded.session_json,
          expires_at = excluded.expires_at,
          updated_at = excluded.updated_at
      `).run(sid, JSON.stringify(value), expiresAt, Date.now())
      callback?.()
    } catch (error) {
      callback?.(error)
    }
  }

  destroy(sid: string, callback?: (error?: unknown) => void): void {
    try {
      this.sqlite.query('DELETE FROM sessions WHERE sid = ?').run(sid)
      callback?.()
    } catch (error) {
      callback?.(error)
    }
  }

  touch(sid: string, value: SessionData, callback?: (error?: unknown) => void): void {
    try {
      const expiresAt = value.cookie.expires?.getTime()
        ?? Date.now() + (value.cookie.maxAge ?? SIX_MONTHS_MS)
      this.sqlite.query(`
        UPDATE sessions SET expires_at = ?, updated_at = ? WHERE sid = ?
      `).run(expiresAt, Date.now(), sid)
      callback?.()
    } catch (error) {
      callback?.(error)
    }
  }

  cleanupExpired(now = Date.now()): void {
    if (this.cleanupRunning) return
    this.cleanupRunning = true
    try {
      this.sqlite.query('DELETE FROM sessions WHERE expires_at <= ?').run(now)
    } finally {
      this.cleanupRunning = false
    }
  }

  close(): void {
    clearInterval(this.cleanupTimer)
  }
}
