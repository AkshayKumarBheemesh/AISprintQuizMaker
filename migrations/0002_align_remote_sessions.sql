-- Migration number: 0002 	 2026-09-01T12:00:00.000Z
--
-- Local-safe IF NOT EXISTS only. Do not apply remotely to "fix" production:
-- production `sessions` already exists from the targeted repair. See PRD Phase 6.
-- Remote D1 was created from an older users-only schema (required username, no
-- sessions). Local 0001 already has sessions. This file is a no-op locally
-- (IF NOT EXISTS). Username is not dropped here because local users has no
-- username column; that repair is remote-only.

CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id);

CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions (expires_at);
