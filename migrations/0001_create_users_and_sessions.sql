-- Migration number: 0001 	 2026-09-01T07:50:00.000Z
--
-- LOCAL ONLY. Never run `wrangler d1 migrations apply --remote` while this file is
-- listed as pending. Production already has `users` (older recorded name
-- `0001_create_users_table.sql` plus a targeted repair). Applying this CREATE TABLE
-- remotely would fail and must not be used to "align" history. See PRD Phase 6.

CREATE TABLE users (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  first_name    TEXT    NOT NULL,
  last_name     TEXT    NOT NULL,
  email         TEXT    NOT NULL,
  password_hash TEXT    NOT NULL,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at    INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Enforces duplicate-email rejection. Emails are trimmed and lowercased by the
-- application before insert or lookup, so this is effectively case-insensitive.
CREATE UNIQUE INDEX idx_users_email ON users (email);

CREATE TABLE sessions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX idx_sessions_user_id ON sessions (user_id);

CREATE INDEX idx_sessions_expires_at ON sessions (expires_at);
