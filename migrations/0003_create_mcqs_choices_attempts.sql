-- Migration number: 0003 	 2026-09-03T15:00:00.000Z
--
-- LOCAL ONLY during Sprint 2. Never run `wrangler d1 migrations apply --remote`
-- while Sprint 1 files 0001/0002 may still appear pending in remote history.

CREATE TABLE mcqs (
  id                 TEXT    PRIMARY KEY,
  name               TEXT    NOT NULL,
  question           TEXT    NOT NULL,
  created_by_user_id TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at         INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at         INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX idx_mcqs_created_by_user_id ON mcqs (created_by_user_id);

CREATE TABLE mcq_choices (
  id          TEXT    PRIMARY KEY,
  mcq_id      TEXT    NOT NULL REFERENCES mcqs(id) ON DELETE CASCADE,
  choice_text TEXT    NOT NULL,
  is_correct  INTEGER NOT NULL CHECK (is_correct IN (0, 1)),
  position    INTEGER NOT NULL,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX idx_mcq_choices_mcq_id ON mcq_choices (mcq_id);

CREATE UNIQUE INDEX idx_mcq_choices_one_correct
  ON mcq_choices (mcq_id)
  WHERE is_correct = 1;

CREATE TABLE mcq_attempts (
  id         TEXT    PRIMARY KEY,
  mcq_id     TEXT    NOT NULL REFERENCES mcqs(id) ON DELETE CASCADE,
  choice_id  TEXT    NOT NULL REFERENCES mcq_choices(id) ON DELETE CASCADE,
  user_id    TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_correct INTEGER NOT NULL CHECK (is_correct IN (0, 1)),
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX idx_mcq_attempts_mcq_id ON mcq_attempts (mcq_id);

CREATE INDEX idx_mcq_attempts_user_id ON mcq_attempts (user_id);
