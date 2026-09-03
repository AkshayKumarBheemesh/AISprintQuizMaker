Date created: 2026-09-03
Date last modified: 2026-09-03 (Phase 1 complete)

# Sprint 2: Multiple-Choice Questions (MCQ CRUD) - Technical PRD

This document is the source of truth for Sprint 2. It continues Sprint 1. It does not
replace Sprint 1 authentication, session management, D1 access, Server Actions, the
service layer, shadcn conventions, or the protected-dashboard routing model.

Sprint 1 PRD: `docs/SPRINT_1_AUTHENTICATION_PRD.md`  
Template: `ai-workspace/TEMPLATE_TECHNICAL_PRD.md`

**This file is the PRD only.** Creating it is not authorization to implement, migrate,
or deploy.

---

## Resolved Decisions

These items were open in the original Sprint 2 brain dump or in the implementation-plan
assumptions. They are now confirmed and must not be re-litigated during implementation.

### RESOLVED-1: Server Actions, not a REST MCQ API — CONFIRMED

Sprint 1 and `.cursor/rules/nextjs.mdc` use Server Actions for mutations. The original
Sprint 2 brief asked for “routes/endpoints” and “API/routes” tests. That wording conflicted
with the established architecture.

**Decision: implement MCQ mutations as Server Actions.** Do not add `/api/mcqs/*`. The only
existing Route Handler remains `GET /api/auth/clear-session`. Action tests cover the
authenticated / unauthenticated / validation cases the brief listed under “API/routes”.

### RESOLVED-2: No repository layer — CONFIRMED

Sprint 1 services call `src/lib/d1-client.ts` directly.

**Decision: `mcq-service` talks to `d1-client`. Do not introduce a repository layer.**

### RESOLVED-3: Sprint 1 auth is unchanged — CONFIRMED

**Decision: do not modify login, register, logout, cookie name, session lifetime, password
hashing, or `getCurrentUser()` unless a Sprint 2 defect makes that strictly necessary.**
MCQ authorization *uses* `getCurrentUser()`. It does not replace it.

### RESOLVED-4: Ownership is per creating teacher — CONFIRMED

The original brief said “view all MCQs” without saying whose.

**Decision: an MCQ belongs to the teacher who created it.** List, get, update, delete, and
attempt are scoped to that owner. `created_by_user_id` is always `getCurrentUser().id`.
Never accept a user id from the client.

### RESOLVED-5: Attempts carry `user_id` — CONFIRMED

The original brief said to add `user_id` only if the existing model supported it.

**Decision: `mcq_attempts.user_id` is required** and is always `getCurrentUser().id`.
Sprint 2 does not invent a second identity mechanism.

### RESOLVED-6: Attempt correctness is server-computed — CONFIRMED

**Decision: `mcq_attempts.is_correct` is copied from the stored choice’s `is_correct` after
the server verifies that the choice belongs to that MCQ.** A client-supplied correctness
flag is ignored and must not be persisted.

### RESOLVED-7: Preview includes attempt recording — CONFIRMED

The original brief allowed a read-only preview and separately required recording attempts,
without naming a surface.

**Decision: `/dashboard/mcqs/[id]/preview` is not an edit form.** It shows name, question,
and choices, and it is the Sprint 2 surface for selecting a choice and recording an
attempt.

### RESOLVED-8: Choice `position` is stored — CONFIRMED

**Decision: `mcq_choices.position` is an integer display order.** The create/edit form
order is what is stored and what preview/list consumers read.

### RESOLVED-9: Zod on client and server; Sprint 1 TDD — CONFIRMED

**Decision: one shared Zod schema validates create/update input on the client and in the
Server Action.** Tests are written first (Vitest), colocated, and must pass before Sprint 2
is called done.

### RESOLVED-10: shadcn only; add only what Sprint 2 needs — CONFIRMED

**Decision: no second UI library.** Add only `dropdown-menu`, `textarea`, and `radio-group`
via `npx shadcn@latest add @shadcn/...`. Delete confirmation uses the already-installed
`Dialog`. `table`, `button`, `field`, and `input` already exist.

### RESOLVED-11: Local migration only; no deploy in this sprint — CONFIRMED

**Decision: apply `0003` locally only during implementation.** Do not run
`wrangler d1 migrations apply` with `--remote`. Do not run `npm run deploy` unless a later
request explicitly asks for it.

### RESOLVED-12: Nested routes stay under `/dashboard` — CONFIRMED

**Decision: list is `/dashboard`; create/edit/preview nest under `/dashboard/mcqs/...`.**
Existing middleware already matches `/dashboard/:path*`. The protected layout already
authorizes those pages. Do not widen the matcher unless a test proves it is required.

### RESOLVED-13: Field length caps (DR-1) — CONFIRMED

Validate after trim:

- name: maximum 200 characters
- question: maximum 2000 characters
- choice text: maximum 500 characters

### RESOLVED-14: Playwright MCQ E2E (DR-2) — CONFIRMED

Playwright MCQ journeys are in the Sprint 2 Definition of Done. They run against **local
preview + local D1**. Do not target production. Do not deploy to make them green.

### RESOLVED-15: Preview does not reveal the key before submit (DR-3) — CONFIRMED

Do not mark the correct choice before submission. After `recordAttemptAction` succeeds,
show whether the selected answer was correct or incorrect.

### RESOLVED-16: Repeat attempts, no history UI (DR-4) — CONFIRMED

Multiple attempts against the same MCQ are allowed. Sprint 2 UI shows only the latest
submission result. No attempt-history table.

### RESOLVED-17: Preserve choice IDs on edit (DR-5) — CONFIRMED

Keep existing choice IDs when those choices are still present. Removed choices (and their
attempts) may be deleted. Do not retarget an old attempt to another choice.

---

## Decision Required

**None.** DR-1 through DR-5 were resolved on 2026-09-03 as RESOLVED-13 through RESOLVED-17.

---

## Overview/Problem

Sprint 1 gave teachers an account, a session, and a protected dashboard. That dashboard is
still a stub titled “MCQ Home”. A signed-in teacher cannot store a question, attach
choices, mark a correct answer, preview the item, delete it, or record that they tried it.

Without that, QuizMaker still has identity and no product. Sprint 2 is the first authoring
surface: a teacher manages their own multiple-choice questions and can try an item in
preview.

---

## Hypothesis

We believe that letting an authenticated teacher create, list, edit, preview, delete, and
attempt their own multiple-choice questions — with server-side validation and ownership —
will turn the Sprint 1 dashboard into a usable question workspace and establish the MCQ
data model later quiz features can reuse.

---

## Sprint 2 Objective

Deliver authenticated MCQ CRUD plus attempt recording for the signed-in teacher, using the
Sprint 1 architecture unchanged:

- View that teacher’s MCQs
- Create an MCQ with 2–6 choices and exactly one correct choice
- Edit an existing MCQ and its choices
- Preview an MCQ without entering edit mode
- Delete an MCQ after confirmation, without orphaned choices or attempts
- Record an attempt against an owned MCQ, with correctness decided on the server

---

## User Stories

> As a teacher preparing questions for my classes,
> I want to create, review, change, try, and delete my own multiple-choice questions,
> so that my items live in my signed-in workspace and nobody else can change them.

**Acceptance from the teacher’s point of view:**

- After I sign in, `/dashboard` lists my questions by name and question text.
- I can start a new MCQ from a Create control and land on a form with two empty choices.
- I can add choices up to six and remove choices only while at least two remain.
- I must pick exactly one correct choice before save succeeds.
- If I leave name, question, or a choice blank, I am told in plain language, on the form.
- Save creates or updates the item and returns me to the list.
- Cancel returns me to the list and does not save.
- Edit loads the existing name, question, choices, and correct mark.
- Preview shows the item as a student would see the prompt — not the edit form.
- On preview I can pick a choice and submit an attempt, then see whether I was right.
- Delete asks me to confirm. Nothing is removed until I confirm. After delete the row is
  gone and its choices and attempts are gone.
- If I am signed out, I cannot open the list, the form, or preview. I am sent to sign in.
- I never see another teacher’s questions.

---

## Scope

### In Scope

**Data**

- One local D1 migration creating `mcqs`, `mcq_choices`, and `mcq_attempts`
- Foreign keys, indexes, timestamps, `created_by_user_id`, attempt `user_id`, choice
  `position`
- Application-enforced 2–6 choices and exactly one correct choice; database support where
  it does not fight Sprint 1 conventions

**Service**

- `listMcqs`, `getMcq`, `createMcq`, `updateMcq`, `deleteMcq`, `recordAttempt`
- Ownership checks on every read and write
- Server-computed attempt correctness

**Server Actions**

- `createMcqAction`, `updateMcqAction`, `deleteMcqAction`, `recordAttemptAction`
- Zod validation before the service runs
- `getCurrentUser()` before any write; unauthenticated users follow the Sprint 1
  clear-session path

**UI**

- Dashboard list table, Create button, three-dot row menu (Edit, Preview, Delete)
- Delete confirmation dialog
- Shared create/edit form
- Preview page with attempt submission
- shadcn components listed in this PRD

**Tests**

- Vitest coverage listed in Testing Requirements
- Updates to dashboard tests that currently forbid authoring controls

**Docs**

- This PRD, kept current as implementation proceeds
- Optional one-paragraph `AGENTS.md` project-description update after implementation
  (not a prerequisite)

### Out of Scope

| Excluded | Why it is excluded from Sprint 2 |
|---|---|
| Changing Sprint 1 auth behavior | Auth already works. Sprint 2 consumes `getCurrentUser()`. |
| REST `/api/mcqs` | Conflicts with Sprint 1 and `nextjs.mdc` (RESOLVED-1). |
| Repository / ORM layer | Conflicts with Sprint 1 service + `d1-client` (RESOLVED-2). |
| Sharing, classes, or student accounts | Ownership is the creating teacher only. No second role. |
| Assignments, quizzes-as-collections, or publishing | This sprint is the MCQ item, not a quiz paper. |
| AI generation of questions | No AI SDK work is requested. |
| Import / export | Not requested. |
| Rich text / images / LaTeX in questions or choices | Plain text only. |
| Attempt analytics, scores, or a history page | DR-4 default is the last-submit result only. |
| Editing another teacher’s MCQ by id | Must look like not-found, not a permission essay. |
| Account deletion / cascade from `users` as a product feature | FK `ON DELETE CASCADE` documents intent; no account-deletion UI. |
| Password reset, OAuth, email verification, roles | Still Sprint 1 exclusions. |
| Remote D1 migration or production deploy | RESOLVED-11. |
| New npm UI libraries | RESOLVED-10. |
| `d1-client.batch()` unless a later decision adds it | Sequential `execute` matches Sprint 1. See Cut. |
| Playwright MCQ against production | RESOLVED-14: local preview + local D1 only. |
| Unbounded field lengths | RESOLVED-13: name 200, question 2000, choice 500. |

### Cut

Considered during planning and deliberately removed:

- **Public REST MCQ API** — Cut because it duplicates Server Actions and creates a second
  auth surface. The brief’s “API” tests are expressed as Server Action tests.
- **`d1-client` `batch()` helper** — Cut for Sprint 2 so the D1 seam stays the three
  functions Sprint 1 tests already mock (`queryAll`, `queryOne`, `execute`). Atomicity is
  approximated by ordered writes and explicit child deletes. Revisit if partial writes
  become a real defect.
- **Partial unique index as the only correctness guarantee** — A `UNIQUE (mcq_id) WHERE
  is_correct = 1` index is allowed as defense in depth. It does not replace Zod/service
  checks, because SQLite/D1 partial-index support and `PRAGMA foreign_keys` behavior must
  not be the only line of defense.
- **Student-facing take-quiz mode** — Cut. Preview+attempt is a teacher check of their own
  item, not a class assignment.
- **Blocking edits after the first attempt** — Cut unless DR-5 is reversed. Teachers need
  to fix typos after trying an item.

---

## Technical Architecture

Sprint 2 inherits Sprint 1. New work fits these cells; it does not add a column.

| Layer | Sprint 1 decision | Sprint 2 application |
|---|---|---|
| Framework | Next.js 16 App Router, React 19 | Same |
| Rendering | Server Components by default; `'use client'` at the leaves | List page is a Server Component. Table actions, form, delete dialog, and preview attempt UI are client components. |
| Mutations | Server Actions | `createMcqAction`, `updateMcqAction`, `deleteMcqAction`, `recordAttemptAction` |
| HTTP endpoints | No public auth API; `GET /api/auth/clear-session` only | No public MCQ API |
| Database | Cloudflare D1 `aisprintquiz-db`, binding `DB` | Same database, new tables |
| D1 access | Only `src/lib/d1-client.ts` | Same. Numbered placeholders `?1`, `?2` |
| Validation | Zod on every Server Action | Shared `mcq-schema` |
| Auth | Opaque D1 sessions; `getCurrentUser()` | Same primitive; then ownership |
| Cookie | httpOnly `quizmaker_session` | Unchanged |
| UI | shadcn Base UI `base-nova` | Same; three added primitives |
| Tests | Vitest; `d1-client` mocked | Same |

**Architectural rules that still constrain implementation:**

- No React component touches `env.DB`.
- `d1-client` is never imported into a `'use client'` file.
- Bindings come from `getCloudflareContext()`, never a global `env`.
- Reads use `all()` / `results[0]`, not `first()`.
- Cookie presence is never authorization.
- `redirect()` is called outside `try/catch`.
- Ask before adding an npm dependency. shadcn source files are not a new library.
- Never edit `cloudflare-env.d.ts`, `next-env.d.ts`, or `package-lock.json` by hand.

---

## Functional Requirements

| ID | Requirement |
|---|---|
| F-1 | A signed-in teacher sees a table of their MCQs on `/dashboard`. |
| F-2 | Each row shows name, question, and an actions menu. |
| F-3 | A Create control navigates to `/dashboard/mcqs/new`. |
| F-4 | The create form starts with two choice rows. |
| F-5 | The teacher can add choices until there are six. |
| F-6 | The teacher can remove a choice only when more than two remain. |
| F-7 | Exactly one choice can be marked correct. The control is exclusive (radio behavior). |
| F-8 | Save on create persists the MCQ and choices and redirects to `/dashboard`. |
| F-9 | Cancel on create or edit returns to `/dashboard` without writing. |
| F-10 | Edit is reached from the row menu and opens `/dashboard/mcqs/[id]/edit`. |
| F-11 | Edit loads the stored name, question, choices (in `position` order), and correct mark. |
| F-12 | Save on edit updates the MCQ and its choices and redirects to `/dashboard`. |
| F-13 | Preview is reached from the row menu and opens `/dashboard/mcqs/[id]/preview`. |
| F-14 | Preview is not the edit form. It shows name, question, and available choices. |
| F-15 | Preview can submit a selected choice as an attempt (RESOLVED-7). |
| F-16 | After a recorded attempt, the teacher is told whether the selection was correct. |
| F-17 | Delete is reached from the row menu and requires confirmation before the action runs. |
| F-18 | Confirmed delete removes the MCQ, its choices, and its attempts, then returns to the list. |
| F-19 | Name, question, and every choice’s text are required after trim. |
| F-20 | Server and client reject fewer than 2 choices, more than 6 choices, blank choice text, and a correct-choice count other than 1. |
| F-21 | Unauthenticated access to all `/dashboard` MCQ routes is rejected the Sprint 1 way. |
| F-22 | A teacher cannot list, read, update, delete, or attempt another teacher’s MCQ. |
| F-23 | `created_by_user_id` and attempt `user_id` are never taken from the form. |
| F-24 | Attempt `is_correct` is never taken from the form. |

---

## Database Requirements

### Conventions (from Sprint 1)

- Table names: plural snake_case
- IDs: `TEXT PRIMARY KEY`, generated in the service with `crypto.randomUUID()`
- Timestamps: `INTEGER NOT NULL DEFAULT (unixepoch())` (Unix epoch seconds)
- Foreign keys with `ON DELETE CASCADE` to document intent
- Indexes on foreign keys used for lookup
- Prepared statements only; positional placeholders
- Migration file created with Wrangler’s migration naming; **local apply only**

Sprint 1 note still applies: D1 CASCADE is only enforced when `PRAGMA foreign_keys = ON`.
The service must delete attempts, then choices, then the MCQ so orphans cannot remain if
the pragma is off.

### Migration

One new file:

`migrations/0003_create_mcqs_choices_attempts.sql`

Do not edit `0001` or `0002`. Those files must not be applied remotely (see Sprint 1 Phase
6). Adding `0003` does not authorize a remote apply of the whole history.

### `mcqs`

| Column | Type | Rules |
|---|---|---|
| `id` | TEXT PK | `crypto.randomUUID()` in the service |
| `name` | TEXT NOT NULL | Required after trim |
| `question` | TEXT NOT NULL | Required after trim |
| `created_by_user_id` | TEXT NOT NULL | `REFERENCES users(id) ON DELETE CASCADE` |
| `created_at` | INTEGER NOT NULL | Default `unixepoch()` |
| `updated_at` | INTEGER NOT NULL | Default `unixepoch()`; set on update |

Index: `idx_mcqs_created_by_user_id` on `created_by_user_id`.

### `mcq_choices`

| Column | Type | Rules |
|---|---|---|
| `id` | TEXT PK | `crypto.randomUUID()` |
| `mcq_id` | TEXT NOT NULL | `REFERENCES mcqs(id) ON DELETE CASCADE` |
| `choice_text` | TEXT NOT NULL | Required after trim |
| `is_correct` | INTEGER NOT NULL | `CHECK (is_correct IN (0, 1))` |
| `position` | INTEGER NOT NULL | 0-based or 1-based, consistent in the service; stored in form order |
| `created_at` | INTEGER NOT NULL | Default `unixepoch()` |
| `updated_at` | INTEGER NOT NULL | Default `unixepoch()`; set on update |

Index: `idx_mcq_choices_mcq_id` on `mcq_id`.

Optional defense in depth (not a substitute for validation):

```sql
CREATE UNIQUE INDEX idx_mcq_choices_one_correct
  ON mcq_choices (mcq_id)
  WHERE is_correct = 1;
```

The 2–6 choice count is **not** a table CHECK. It is a row-count rule enforced by Zod and
the service on create and update.

### `mcq_attempts`

| Column | Type | Rules |
|---|---|---|
| `id` | TEXT PK | `crypto.randomUUID()` |
| `mcq_id` | TEXT NOT NULL | `REFERENCES mcqs(id) ON DELETE CASCADE` |
| `choice_id` | TEXT NOT NULL | `REFERENCES mcq_choices(id) ON DELETE CASCADE` |
| `user_id` | TEXT NOT NULL | `REFERENCES users(id) ON DELETE CASCADE` |
| `is_correct` | INTEGER NOT NULL | `CHECK (is_correct IN (0, 1))`; server-computed |
| `created_at` | INTEGER NOT NULL | Default `unixepoch()` |

Indexes: `idx_mcq_attempts_mcq_id`, `idx_mcq_attempts_user_id`.

There is no `updated_at`. An attempt is append-only.

### Relationships

```
users 1──* mcqs              (mcqs.created_by_user_id)
mcqs  1──* mcq_choices       (mcq_choices.mcq_id)
mcqs  1──* mcq_attempts      (mcq_attempts.mcq_id)
mcq_choices 1──* mcq_attempts (mcq_attempts.choice_id)
users 1──* mcq_attempts      (mcq_attempts.user_id)
```

### Illustrative DDL

Illustrative only. The migration is written during implementation, after tests exist for
the service that will use it.

```sql
CREATE TABLE mcqs (
  id                 TEXT PRIMARY KEY,
  name               TEXT    NOT NULL,
  question           TEXT    NOT NULL,
  created_by_user_id TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at         INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at         INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX idx_mcqs_created_by_user_id ON mcqs (created_by_user_id);

CREATE TABLE mcq_choices (
  id          TEXT PRIMARY KEY,
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
  id         TEXT PRIMARY KEY,
  mcq_id     TEXT    NOT NULL REFERENCES mcqs(id) ON DELETE CASCADE,
  choice_id  TEXT    NOT NULL REFERENCES mcq_choices(id) ON DELETE CASCADE,
  user_id    TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_correct INTEGER NOT NULL CHECK (is_correct IN (0, 1)),
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX idx_mcq_attempts_mcq_id ON mcq_attempts (mcq_id);
CREATE INDEX idx_mcq_attempts_user_id ON mcq_attempts (user_id);
```

---

## Backend / Service Requirements

Module: `src/lib/services/mcq-service.ts`  
Tests: `src/lib/services/mcq-service.test.ts`  
Access: `queryAll` / `queryOne` / `execute` only. Mock `d1-client` in tests.

The service does not read cookies. Callers pass `userId` from `getCurrentUser()`.

| Function | Behavior |
|---|---|
| `listMcqs(userId)` | Rows where `created_by_user_id = userId`. Newest first (`created_at` DESC). No other teacher’s rows. |
| `getMcq(id, userId)` | MCQ plus choices ordered by `position`. `null` if missing or not owned. |
| `createMcq(userId, input)` | Insert MCQ with `created_by_user_id = userId`. Insert 2–6 choices. Reject invalid choice counts or a correct-choice count other than 1. |
| `updateMcq(id, userId, input)` | No-op as not-found if missing or not owned. Update name/question/`updated_at`. Keep existing choice ids when the client still sends them (DR-5 default). Insert new choices, update kept ones, delete removed ones (and their attempts via explicit delete or CASCADE). Re-validate 2–6 and exactly one correct. |
| `deleteMcq(id, userId)` | Not-found if missing or not owned. Delete attempts for that `mcq_id`, then choices, then the MCQ. |
| `recordAttempt(userId, mcqId, choiceId)` | Not-found if the MCQ is missing or not owned. Reject if `choiceId` is not a choice of that MCQ. Insert attempt with `user_id = userId` and `is_correct` from the stored choice. |

**Security rules inside the service:**

- Every query that returns or mutates an MCQ includes `created_by_user_id = ?`.
- `SELECT` lists explicit columns. Never `SELECT *`.
- Never persist client `created_by_user_id`, `user_id`, or attempt `is_correct`.
- Boolean `is_correct` is stored as `0` or `1`.

**Not-found vs forbidden:** if the row exists but belongs to someone else, return the same
result as missing (`null` / `{ ok: false, error: "NOT_FOUND" }`). Do not confirm that the
id exists.

---

## Server Action Requirements

Module: `src/lib/actions/mcq-actions.ts`  
Tests: `src/lib/actions/mcq-actions.test.ts`  
Pattern: same as `auth-actions` — `"use server"`, Zod, then service, then `redirect()` or
a serializable state object.

Actions never import `d1-client`. They call `getCurrentUser()` and `mcq-service`.

### Shared auth behavior

1. `const user = await getCurrentUser()`
2. If `user` is null: `redirect(SESSION_CLEAR_PATH)` — `/api/auth/clear-session`
3. Never trust a user id field from `FormData`

### `createMcqAction(prevState, formData)`

- Parse name, question, and the choice list from `FormData`.
- `mcqWriteSchema.safeParse(...)`. On failure return field errors; do not call the service.
- `createMcq(user.id, parsed.data)`.
- On success `redirect("/dashboard")`.

### `updateMcqAction(prevState, formData)`

- Same validation as create, plus the MCQ id (from the form or a bound argument).
- `updateMcq(id, user.id, parsed.data)`.
- Not-found (including other-owner) returns a form-level error; do not leak ownership.
- On success `redirect("/dashboard")`.

### `deleteMcqAction(formData)` or `(mcqId)`

- Require a non-empty id.
- `deleteMcq(id, user.id)`.
- Not-found is treated as already gone for the redirect case, or as a form-level error if
  the UI needs to stay put. Prefer redirect to `/dashboard` after an authenticated delete
  attempt so the list refreshes.
- Confirmation is a UI concern. The action still performs the delete; it does not assume
  the dialog cannot be bypassed.

### `recordAttemptAction(prevState, formData)`

- Require `mcqId` and `choiceId`.
- Do not accept `isCorrect` from the client.
- `recordAttempt(user.id, mcqId, choiceId)`.
- On success return `{ ok: true, isCorrect: boolean }` and stay on preview (no redirect
  away from the result).
- On not-found / invalid choice return `{ ok: false, error }` with a safe message.

### Error messages (user-facing)

Keep copy specific enough to fix the form, never specific enough to confirm another
teacher’s id.

| Situation | Message |
|---|---|
| Name empty | `Name is required.` |
| Question empty | `Question is required.` |
| Fewer than 2 choices | `Add at least two choices.` |
| More than 6 choices | `You can add at most six choices.` |
| A choice’s text empty | `Choice text is required.` |
| Correct count ≠ 1 | `Select exactly one correct choice.` |
| Not found / not owned | `That question could not be found.` |
| Invalid choice on attempt | `Select a valid choice.` |

Exact strings are the contract for tests, same idea as Sprint 1’s
`An account with this email already exists.`

---

## Frontend Requirements

### Dashboard list (`/dashboard`)

Replace the Sprint 1 placeholder card. Keep the heading area that shows the teacher’s
name and the existing `LogoutButton`.

- shadcn `Table` with columns **Name**, **Question**, **Actions**
- A **Create** button (or link styled as a button) to `/dashboard/mcqs/new`
- Empty state when the teacher has no MCQs: table or a short message plus the same Create
  control (implementation detail; both are acceptable)
- Each row’s Actions cell is a vertical three-dot menu (`dropdown-menu`)

Menu items:

| Item | Behavior |
|---|---|
| Edit | Navigate to `/dashboard/mcqs/[id]/edit` |
| Preview | Navigate to `/dashboard/mcqs/[id]/preview` |
| Delete | Open confirmation dialog; do not delete yet |

Sprint 1 dashboard tests that assert “no quiz authoring controls” are **superseded** and
must be rewritten. Do not leave them failing or skip them.

### Delete confirmation

- Use the existing shadcn `Dialog` (or `AlertDialog` only if `Dialog` cannot express
  confirm/cancel accessibly — prefer `Dialog` to avoid a fourth added component)
- Copy must say the question will be permanently deleted
- Confirm runs `deleteMcqAction`
- Cancel / dismiss closes the dialog and does not call the action

### Create / edit form (`/dashboard/mcqs/new` and `/dashboard/mcqs/[id]/edit`)

Same `'use client'` form component, two pages.

| Field | Control | Default (create) | Edit |
|---|---|---|---|
| Name | `Input` | empty | loaded |
| Question | `textarea` | empty | loaded |
| Choices | list of `Input` + correct radio | two empty rows | loaded in `position` order |
| Correct choice | `radio-group` across choices | none selected (invalid until the teacher picks one) | the stored correct choice |

Controls:

- **Add choice** — disabled or hidden at 6
- **Remove** on a row — disabled or hidden at 2
- **Save** — `createMcqAction` or `updateMcqAction`
- **Cancel** — `Link` to `/dashboard`, no write

Client validation uses the same Zod schema as the server (`zodResolver`), then
`useActionState` for server errors, same as register/login.

Hidden or omitted from the form: user id, `is_correct` as a free text field, attempt
fields.

### Preview (`/dashboard/mcqs/[id]/preview`)

- Read-only name, question, and choice labels
- Not the create/edit form; no Save of MCQ fields
- Choice selection + submit records an attempt (RESOLVED-7)
- After success, show correct / incorrect using the server result (DR-3, DR-4 defaults)
- If `getMcq` returns null, treat as not found (redirect to `/dashboard` or a simple
  not-found state — do not render another teacher’s data)

### Layout / chrome

- Pages live under `src/app/(protected)/`, so the Sprint 1 protected layout runs
- No new global nav, theme, or marketing page

---

## Routing Requirements

| Route | Type | Unauthenticated | Authenticated, owner | Authenticated, not owner |
|---|---|---|---|---|
| `/dashboard` | Protected list | Sprint 1: cookie miss → `/login`; invalid session → `/api/auth/clear-session` → `/login` | Own MCQs | n/a (list is already scoped) |
| `/dashboard/mcqs/new` | Protected create | Same | Form | n/a |
| `/dashboard/mcqs/[id]/edit` | Protected edit | Same | Form loaded | Same as missing: no edit UI |
| `/dashboard/mcqs/[id]/preview` | Protected preview | Same | Preview + attempt | Same as missing |

Middleware matcher stays:

```
/dashboard
/dashboard/:path*
/login
/register
```

Do not add `/dashboard/mcqs` as a separate matcher entry unless tests prove the existing
`:path*` pattern misses it.

---

## shadcn Component Requirements

**Already installed — reuse:**

`button` `card` `dialog` `field` `input` `label` `separator` `table` `badge`

**Add during implementation (ask is already granted by RESOLVED-10):**

```bash
npx shadcn@latest add @shadcn/dropdown-menu
npx shadcn@latest add @shadcn/textarea
npx shadcn@latest add @shadcn/radio-group
```

Use the `@shadcn/` namespace. Do not rewrite files under `src/components/ui/` except by
the generator.

**Do not add** `react-hook-form` again — it is already a Sprint 1 dependency. Do not add
another table, menu, or form library.

---

## Validation Requirements

Shared schema: `src/lib/schemas/mcq-schema.ts`  
Tests: `src/lib/schemas/mcq-schema.test.ts`

Used by the form and by the Server Actions.

| Rule | Client | Server | Service |
|---|---|---|---|
| Name required after trim | yes | yes | yes (trust parsed input) |
| Question required after trim | yes | yes | yes |
| At least 2 choices | yes | yes | yes |
| At most 6 choices | yes | yes | yes |
| Each `choice_text` required after trim | yes | yes | yes |
| Exactly one `isCorrect` / `is_correct` | yes | yes | yes |
| Max lengths | name 200, question 2000, choice 500 | same | same |

Trim name, question, and choice text. Do not invent other transforms.

---

## Authorization / Security Requirements

| Rule | Enforcement |
|---|---|
| Must be signed in for every MCQ page and action | Middleware cookie check + protected layout `getCurrentUser()` + action `getCurrentUser()` |
| Forged / expired cookie | Sprint 1: layout/action redirect to `/api/auth/clear-session` |
| Owner-only list | `WHERE created_by_user_id = ?` |
| Owner-only get/update/delete/attempt | Same predicate; other-owner ≡ not found |
| No client user id | Actions pass `user.id` only |
| No client attempt correctness | Service reads `mcq_choices.is_correct` |
| Choice must belong to the MCQ | Service checks `choice.mcq_id === mcq.id` |
| Prepared statements | `d1-client` + numbered placeholders |
| No `d1-client` in client components | Import rule |
| Do not log session ids or dump full rows to the client | Same as Sprint 1 |

Sprint 2 does **not** add roles, sharing tokens, or a second session type.

---

## TDD / Testing Requirements

Mandatory process, identical to Sprint 1:

1. Write the test.
2. Run it. Observe meaningful RED (not a missing-import crash presented as RED).
3. Implement the minimum code.
4. Observe GREEN.
5. Refactor only after GREEN.
6. Re-run the suite.

Colocate tests. Mock `d1-client` in service tests. Mock the service (and
`getCurrentUser` / `redirect`) in action tests. Component tests use Testing Library +
`userEvent` and assert what the teacher can perceive.

Default Vitest environment remains Node. Component files use
`/** @vitest-environment jsdom */`.

### Schema tests

- Accept a valid name, question, and 2–6 choices with exactly one correct
- Reject missing name / question
- Reject 0 or 1 choice; reject 7 choices
- Reject empty choice text (including whitespace-only)
- Reject zero or more than one correct choice

### Service tests

| # | Behavior |
|---|---|
| S-1 | Create persists MCQ + choices with `created_by_user_id` from the argument |
| S-2 | Get returns the MCQ and choices in `position` order |
| S-3 | List returns only that user’s MCQs |
| S-4 | Update changes name/question/choices |
| S-5 | Delete issues deletes for attempts, choices, then MCQ |
| S-6 | Create/update reject <2 or >6 choices |
| S-7 | Create/update reject a correct-choice count other than 1 |
| S-8 | Record attempt stores the selected `choice_id` |
| S-9 | Correct choice → `is_correct = 1`; incorrect → `0` |
| S-10 | Client-looking `is_correct` / `user_id` are not written from input |
| S-11 | Get/update/delete/attempt on another user’s id behave as not found |
| S-12 | Attempt with a choice that is not on that MCQ is rejected |
| S-13 | Queries use `?1` / `?2` and do not interpolate values |

### Server Action tests

| # | Behavior |
|---|---|
| A-1 | Authenticated create/update/delete call the service and redirect to `/dashboard` on success |
| A-2 | `getCurrentUser()` null → no service call; redirect to `/api/auth/clear-session` |
| A-3 | Zod failures return field errors and do not call the service |
| A-4 | Update/delete of a missing or foreign MCQ return the safe not-found message |
| A-5 | `recordAttemptAction` returns server-computed `isCorrect` and does not send a client flag to the service |
| A-6 | Actions never call `d1-client` |

### Component / page tests

| # | Behavior |
|---|---|
| C-1 | MCQ table renders name, question, and an actions trigger |
| C-2 | Create control targets `/dashboard/mcqs/new` |
| C-3 | Edit menu item targets `/dashboard/mcqs/[id]/edit` |
| C-4 | Preview menu item targets `/dashboard/mcqs/[id]/preview` |
| C-5 | Delete opens confirmation and does not call the delete action until confirm |
| C-6 | Create form renders name, question, Save, Cancel |
| C-7 | New form shows exactly two choices |
| C-8 | Add choice works until six; cannot add a seventh |
| C-9 | Remove is blocked at two choices |
| C-10 | Selecting a correct choice is exclusive |
| C-11 | Cancel is a navigation to `/dashboard` (or equivalent) and does not submit |
| C-12 | Preview renders name, question, and choices and does not render the edit Save control |
| C-13 | Dashboard no longer asserts “placeholder only / no authoring” |

### Regression

- Existing Sprint 1 Vitest files stay green.
- Auth E2E is not rewritten as part of Sprint 2 unless a Sprint 2 change breaks it.

---

## Implementation Phases

All phases are **PLANNED**. Do not start them until this PRD is approved for
implementation. Each phase is TDD: tests first.

### Phase 1: Schema and MCQ service - COMPLETED

**Objective:** Validated write model and mocked-D1 service. No UI.

**Tasks:**

1. Write schema tests. Observe RED.
2. Implement `mcq-schema`. Observe GREEN.
3. Write service tests S-1..S-13. Observe RED.
4. Create `0003` migration. Apply **locally only**.
5. Implement `mcq-service`. Observe GREEN.
6. Full-suite regression.

**Deliverables:** schema, service, local migration, service tests passing.

#### Phase 1 Evidence — recorded 2026-09-03

| Step | Command | Observed result |
|---|---|---|
| Schema RED | `npx vitest run src/lib/schemas/mcq-schema.test.ts` | Failed: `Cannot find module './mcq-schema'` |
| Schema GREEN | same | **21 passed (21)** |
| Service RED | `npx vitest run src/lib/services/mcq-service.test.ts` | Failed: `Cannot find module '.../mcq-service'` |
| Service GREEN | schema + service files | **39 passed (39)** across both files |
| Local migration list | `wrangler d1 migrations list aisprintquiz-db --local` | Pending: `0003_create_mcqs_choices_attempts.sql` |
| Local migration apply | `wrangler d1 migrations apply aisprintquiz-db --local` | **0003 ✅**, 9 commands. Not `--remote`. |
| Local schema | `wrangler d1 execute --local` | `mcqs`, `mcq_choices`, `mcq_attempts` and indexes present |
| Regression | `npm test` | **209 passed (209)**, 20 files |
| Lint | `npm run lint` | **exit 0** |
| Types | `npx tsc --noEmit` | **exit 0** |

### Phase 2: Server Actions - COMPLETED

**Objective:** Authenticated, validated mutations.

**Tasks:**

1. Write action tests A-1..A-6. Observe RED.
2. Implement `mcq-actions` and `mcq/errors` messages. Observe GREEN.
3. Full-suite regression.

**Deliverables:** four Server Actions, action tests passing.

#### Phase 2 Evidence — recorded 2026-09-03

| Step | Command | Observed result |
|---|---|---|
| Action RED | `npx vitest run src/lib/actions/mcq-actions.test.ts` | Failed: `Cannot find module '.../mcq-actions'` |
| Action GREEN | same | **16 passed (16)** |
| Regression | `npm test` | **225 passed (225)**, 21 files |
| Lint | `npm run lint` | **exit 0** |
| Types | `npx tsc --noEmit` | **exit 0** |

### Phase 3: UI components - COMPLETED

**Objective:** List, form, menu, delete dialog, preview.

**Tasks:**

1. Add the three shadcn primitives.
2. Write component tests C-1..C-12. Observe RED.
3. Implement components. Observe GREEN.

**Deliverables:** `src/components/mcq/*` and tests.

#### Phase 3 Evidence — recorded 2026-09-03

| Step | Command | Observed result |
|---|---|---|
| Component RED | `npx vitest run src/components/mcq` | Failures: missing preview module, wrong props/labels on stubs |
| Component GREEN | same | **19 passed (19)**, 5 files |
| Regression | `npm test` | **244 passed (244)**, 26 files |
| Lint | `npm run lint` | **exit 0** |
| Types | `npx tsc --noEmit` | **exit 0** |

### Phase 4: Pages and dashboard replacement - COMPLETED

**Objective:** Wired routes under `(protected)`.

**Tasks:**

1. Rewrite dashboard page tests (C-13). Observe RED.
2. Replace dashboard stub with the list.
3. Add new / edit / preview pages.
4. Observe GREEN. Full-suite regression.

**Deliverables:** four routes working against the actions and service.

#### Phase 4 Evidence — recorded 2026-09-03

| Step | Command | Observed result |
|---|---|---|
| Page RED | `npx vitest run src/app/(protected)/dashboard` | Failures: missing `./page` modules for new/edit/preview; dashboard still rendered the Sprint 1 stub |
| Page GREEN | same | **11 passed (11)**, 4 files |
| Regression | `npm test` | **252 passed (252)**, 29 files |
| Lint | `npm run lint` | **exit 0** |
| Types | `npx tsc --noEmit` | **exit 0** |

No Playwright MCQ specs were added. No `npm run deploy`. No remote D1 apply.

### Phase 5: Verification - PLANNED

**Objective:** Proof, not inspection.

**Tasks:**

1. `npm test`
2. `npm run lint`
3. `npm run build`
4. Browser verification of list → create → edit → preview/attempt → delete
5. Record results in this PRD

Do not deploy. Do not apply `0003` remotely.

---

## Technical Implementation Details

### Key files expected

#### Create

| Path | Purpose |
|---|---|
| `migrations/0003_create_mcqs_choices_attempts.sql` | Local-only schema |
| `src/lib/schemas/mcq-schema.ts` | Shared Zod schema |
| `src/lib/schemas/mcq-schema.test.ts` | Schema tests |
| `src/lib/services/mcq-service.ts` | MCQ domain + D1 access |
| `src/lib/services/mcq-service.test.ts` | Service tests |
| `src/lib/actions/mcq-actions.ts` | Server Actions |
| `src/lib/actions/mcq-actions.test.ts` | Action tests |
| `src/lib/mcq/errors.ts` | User-facing message constants |
| `src/app/(protected)/dashboard/mcqs/new/page.tsx` | Create page |
| `src/app/(protected)/dashboard/mcqs/[id]/edit/page.tsx` | Edit page |
| `src/app/(protected)/dashboard/mcqs/[id]/preview/page.tsx` | Preview page |
| `src/components/mcq/mcq-table.tsx` | List table |
| `src/components/mcq/mcq-table.test.tsx` | Table tests |
| `src/components/mcq/mcq-row-actions.tsx` | Three-dot menu |
| `src/components/mcq/mcq-row-actions.test.tsx` | Menu tests |
| `src/components/mcq/mcq-form.tsx` | Create/edit form |
| `src/components/mcq/mcq-form.test.tsx` | Form tests |
| `src/components/mcq/delete-mcq-dialog.tsx` | Confirm delete |
| `src/components/mcq/delete-mcq-dialog.test.tsx` | Dialog tests |
| `src/components/mcq/mcq-preview.tsx` | Preview + attempt UI |
| `src/components/mcq/mcq-preview.test.tsx` | Preview tests |
| `src/components/ui/dropdown-menu.tsx` | Generated |
| `src/components/ui/textarea.tsx` | Generated |
| `src/components/ui/radio-group.tsx` | Generated |

Exact component filenames may split or join if tests stay colocated and the public
behavior above is preserved. Do not invent a second feature folder outside
`src/components/mcq` and `src/lib`.

#### Modify

| Path | Purpose |
|---|---|
| `src/app/(protected)/dashboard/page.tsx` | Stub → list |
| `src/app/(protected)/dashboard/page.test.tsx` | Authoring assertions |
| `AGENTS.md` | Optional: replace the “unmodified starter” paragraph after implementation |

#### Do not modify (unless a proven Sprint 2 defect requires it)

- `src/lib/services/auth-service.ts`
- `src/lib/actions/auth-actions.ts`
- `src/lib/session.ts`
- `src/lib/auth/**`
- `src/app/api/auth/clear-session/**`
- `src/app/(auth)/**`
- `migrations/0001_create_users_and_sessions.sql`
- `migrations/0002_align_remote_sessions.sql`
- `wrangler.jsonc` (no new binding)
- Generated env files

`src/middleware.ts` changes only if `/dashboard/:path*` is shown not to cover the new
pages — prove that with a test first.

`src/lib/d1-client.ts` stays the three helpers unless a later decision adds `batch()`.

### Implementation patterns

**Ownership in SQL:**

```sql
SELECT id, name, question, created_by_user_id, created_at, updated_at
FROM mcqs
WHERE id = ?1 AND created_by_user_id = ?2
```

**Action shape (illustrative):**

```typescript
"use server";

export async function createMcqAction(prevState: McqFormState, formData: FormData) {
  const user = await getCurrentUser();
  if (!user) {
    redirect(SESSION_CLEAR_PATH);
  }

  const parsed = mcqWriteSchema.safeParse(readMcqFields(formData));
  if (!parsed.success) {
    return { errors: toFieldErrors(parsed.error.issues), values: readSafeValues(formData) };
  }

  await createMcq(user.id, parsed.data);
  redirect("/dashboard");
}
```

**Form pattern:** `react-hook-form` + `zodResolver(mcqWriteSchema)` + `useActionState`,
identical to `register-form.tsx`.

### Important notes

- `redirect()` throws. Keep it outside `try/catch`.
- Integer Unix timestamps, not `DATETIME` text.
- `is_correct` is `0`/`1`, not a JS boolean in SQL params unless bound as 0/1.
- Dashboard tests that forbid a Create button are wrong for Sprint 2; change the tests.
- Remote Wrangler history still lists Sprint 1 files as pending. Never “fix” that by
  applying 0001–0003 remotely.

---

## Acceptance Criteria

### List

- [ ] Signed-in `/dashboard` shows a table of the current teacher’s MCQs
- [ ] Each row shows name, question, and a three-dot actions menu
- [ ] Create navigates to `/dashboard/mcqs/new`
- [ ] Another teacher’s MCQs never appear

### Create / edit

- [ ] New form shows two choices
- [ ] Choices can be added up to six and not beyond
- [ ] Choices can be removed down to two and not below
- [ ] Exactly one correct choice is required
- [ ] Name and question are required
- [ ] Each choice has required text
- [ ] Client and server both enforce the rules above
- [ ] Save create persists and returns to `/dashboard`
- [ ] Save edit persists changes and returns to `/dashboard`
- [ ] Cancel returns to `/dashboard` without persisting
- [ ] Edit loads existing values
- [ ] `created_by_user_id` is the session user, not a form field

### Preview / attempt

- [ ] Preview is not the edit form
- [ ] Preview shows name, question, and choices
- [ ] Selecting a choice and submitting records an attempt
- [ ] Stored `is_correct` matches the stored choice, not the client
- [ ] Stored `user_id` is the session user
- [ ] A foreign or unknown MCQ does not preview another teacher’s item

### Delete

- [ ] Delete is in the three-dot menu
- [ ] Confirmation is required
- [ ] Dismissing the dialog does not delete
- [ ] Confirmed delete removes the MCQ, choices, and attempts
- [ ] Delete of a foreign id does not remove that row

### Auth / security

- [ ] Unauthenticated list/new/edit/preview follow Sprint 1 protection
- [ ] Unauthenticated actions do not write
- [ ] Sprint 1 login / logout / session behavior still passes its existing tests
- [ ] All writes use prepared statements with positional placeholders

### Quality

- [ ] Schema, service, action, and component tests listed above pass
- [ ] `npm test` green
- [ ] `npm run lint` clean
- [ ] `npm run build` succeeds
- [ ] Browser verification of the main journey is recorded
- [ ] RED/GREEN evidence recorded per phase

---

## Definition of Done

Sprint 2 is done only when all of the following are true:

1. This PRD’s in-scope functional requirements F-1..F-24 are implemented.
2. The listed Vitest suites pass, including rewritten dashboard tests.
3. Existing Sprint 1 tests still pass.
4. `npm run lint` and `npm run build` have been run and the actual results recorded.
5. Local `0003` is the only migration applied for this sprint, and only locally.
6. No remote migration and no `npm run deploy` were run unless a later explicit request
   said otherwise.
7. Browser verification of create, edit, preview/attempt, and delete has been done (or
   the closest substitute recorded if browser tools are unavailable).
8. Acceptance criteria checkboxes above are marked only from evidence, not inspection.
9. Open Decision Required items still use the documented defaults, or have been resolved
   in this file.

Playwright MCQ coverage **is** in the Definition of Done (RESOLVED-14) and must run
against local preview + local D1, not production.

---

## Success Metrics

No metric is PASS until measured.

| Metric | Target | How measured | Status |
|---|---|---|---|
| Create success | Valid form creates one MCQ and 2–6 choices | Service tests + browser create | NOT MEASURED |
| Ownership isolation | 0 foreign rows in list/get/update/delete/attempt | Service + action tests | NOT MEASURED |
| Validation | 100% of invalid shapes rejected client-side and in the action | Schema + action + form tests | NOT MEASURED |
| Delete completeness | 0 leftover choices or attempts for a deleted MCQ | Service tests asserting delete SQL / sequence | NOT MEASURED |
| Attempt correctness | Stored flag matches stored choice | Service tests S-8/S-9 | NOT MEASURED |
| Sprint 1 regression | Existing auth tests remain 100% pass | `npm test` | NOT MEASURED |
| Lint / build | exit 0 | `npm run lint`, `npm run build` | NOT MEASURED |

---

## Dependencies

### External

- Cloudflare D1 `aisprintquiz-db` (already bound as `DB`)
- No new env vars or secrets

### Internal (Sprint 1 — reuse, do not fork)

- `src/lib/d1-client.ts`
- `src/lib/session.ts` → `getCurrentUser()`
- `src/lib/auth-constants.ts` → `SESSION_CLEAR_PATH`
- `src/app/(protected)/layout.tsx`
- `src/middleware.ts`
- `src/components/auth/logout-button.tsx`
- Existing shadcn primitives
- `react-hook-form`, `@hookform/resolvers`, `zod`

### To add

- shadcn `dropdown-menu`, `textarea`, `radio-group` (source files)

---

## Risks and Mitigation

### Technical

- **Risk:** Remote migration history still shows Sprint 1 files pending. A remote apply
  could replay `0001` and fail or worse.
  **Mitigation:** Never apply migrations remotely in this sprint. Keep the Sprint 1
  warning comments.

- **Risk:** `PRAGMA foreign_keys` may be off; CASCADE alone can leave orphans.
  **Mitigation:** Service deletes children explicitly.

- **Risk:** Sequential `execute` is not a transaction; a crash mid-create can leave an
  MCQ with fewer than two choices.
  **Mitigation:** Accept for Sprint 2 (batch() was cut). Tests cover the success path.
  Revisit if this appears in preview/production.

- **Risk:** Dashboard tests currently forbid authoring UI and will fail when the stub is
  replaced.
  **Mitigation:** Rewrite those tests in the same phase as the page change.

- **Risk:** Adding shadcn files without `@shadcn/` is a no-op.
  **Mitigation:** Use the namespaced add command.

### User experience

- **Risk:** Teachers attempting their own items is odd pedagogically.
  **Mitigation:** In scope anyway (RESOLVED-7). This is a check of the item, not a class
  quiz. Do not build student mode.

- **Risk:** Revealing the answer on preview makes attempts meaningless (DR-3).
  **Mitigation:** Default is hide until after submit.

---

## Migration / Deployment Rules

| Action | Allowed in Sprint 2 implementation? |
|---|---|
| Create `migrations/0003_create_mcqs_choices_attempts.sql` | Yes, during Phase 1 |
| `wrangler d1 migrations apply aisprintquiz-db --local` | Yes, during Phase 1, after tests exist |
| `wrangler d1 migrations apply --remote` | **No** |
| `npm run deploy` | **No** unless later explicitly requested |
| Edit remote D1 by hand | **No** |
| Change `wrangler.jsonc` bindings | **No** (DB already exists) |
| `npm run cf-typegen` | Not required; no new binding |
| Reconcile remote `d1_migrations` history | Human-only, out of this sprint |

---

## Ambiguities and Conflicts in the Original Sprint 2 Brief

Documented so they are not “fixed” again during implementation.

1. **“Routes / API / endpoints” vs Sprint 1 Server Actions.**  
   Conflict with `docs/SPRINT_1_AUTHENTICATION_PRD.md` and `.cursor/rules/nextjs.mdc`.
   **Resolved by RESOLVED-1.**

2. **“View all MCQs” vs per-user work from Sprint 1.**  
   Sprint 1’s hypothesis is that work is tied to the signed-in teacher.
   **Resolved by RESOLVED-4.**

3. **Preview “may be read-only” vs “record attempts”. **  
   Two surfaces were implied; none was named.
   **Resolved by RESOLVED-7.**

4. **“If the domain supports `user_id` on attempts.”**  
   Sprint 1 `AuthUser.id` exists.
   **Resolved by RESOLVED-5.**

5. **Sprint 1 dashboard acceptance: “placeholder only / no quiz authoring.”**  
   That was correct for Sprint 1 and is **superseded** by this PRD. Update those tests.
   Do not treat the old checkbox as a regression.

6. **Sprint 1 out-of-scope “quiz authoring”.**  
   That exclusion applied to Sprint 1 only. It is the purpose of Sprint 2.

7. **Choice count and “exactly one correct” as table constraints.**  
   SQLite cannot cheaply CHECK “2–6 child rows”. Those rules live in Zod + service.
   Optional unique partial index for one correct choice is defense in depth.

---

## Assumptions and Decisions

### Confirmed (do this)

See Resolved Decisions RESOLVED-1..RESOLVED-12.

### Documented defaults (not silent requirements)

These were plan assumptions. They are now explicit. Change them only by updating this
table and the Decision Required section.

| Topic | Default |
|---|---|
| List sort | `created_at` DESC |
| Choice id stability | Keep ids that the edit form still sends (DR-5) |
| D1 writes | Sequential `execute`; no `batch()` |
| Orphan prevention | Explicit child deletes plus FK CASCADE |
| One-correct DB aid | Partial unique index allowed |
| Question field UI | shadcn `textarea` |
| Name uniqueness | Not unique |
| Repeat attempts | Allowed; no history table (DR-4) |
| Preview answer key | Hidden until after the current submit (DR-3) |
| Field maxima | name 200, question 2000, choice 500 (RESOLVED-13) |
| Playwright MCQ | Required; local preview + local D1 only (RESOLVED-14) |
| `AGENTS.md` | Optional follow-up after implementation |

### Still Decision Required

None. See RESOLVED-13 through RESOLVED-17.

---

## Troubleshooting Guide

Filled in during implementation when a defect is found and fixed.

### (none yet)

**Problem:**  
**Cause:**  
**Solution:**  
**Code Reference:**

---

## Notes for AI Agents

1. Read Overview, Hypothesis, and Scope before writing code.
2. Sprint 1 is complete. Reuse it. Do not rebuild auth.
3. Do not implement until the user explicitly asks to start Sprint 2 implementation.
4. Do not deploy. Do not apply migrations remotely.
5. DR-1 through DR-5 are resolved (RESOLVED-13..17). Do not reopen them or invent extra
   product behavior.
6. TDD: tests first; record RED/GREEN; do not claim done from inspection.
7. Update phase status, acceptance checkboxes, and this troubleshooting section as work
   happens.
8. Cite code as `filepath:line-number` when this PRD is updated after implementation.
9. Ask before adding any npm dependency that is not already in `package.json`.

---

## Current Status

**Last Updated:** 2026-09-03  
**Current Phase:** Phase 4 — Next.js routes/pages  
**Status:** COMPLETED  
**Next Steps:** Wait for explicit approval before Phase 5 (Playwright/E2E).

Phase 4 is done. `/dashboard` now lists the signed-in teacher’s MCQs. Create,
edit, and preview pages are wired to Phase 2 actions and Phase 3 components.
No Playwright MCQ specs, no remote migration, no deploy.
