Date created: 2026-09-01
Date last modified: 2026-09-01

# Sprint 1: Authentication (Register, Login, Logout, Protected Dashboard) - Technical PRD

---

## Resolved Decisions

Three points in the original brief were unresolved or conflicted with a confirmed decision.
**All three are now resolved.** There are no open items blocking Phase 1.

### RESOLVED-1: Separate `first_name` and `last_name` — CONFIRMED

The original Sprint 1 requirement said registration collects "first name, last name, email,
password, confirm password," while the detailed brief said "name" in four places.

**Decision: keep `first_name` and `last_name` as separate fields and separate columns.** This
matches the original registration requirement and stays explicit. A single `name` column
cannot be split back apart later without a migration and a parsing heuristic, so the
explicit form is also the reversible one.

Applies to the `users` table, the registration Zod schema, and the register form. The
dashboard greets the user by `first_name`.

### RESOLVED-2: `@playwright/test` approved for automated E2E — CONFIRMED

**Decision: `@playwright/test` is approved and added to the development/test dependencies.**
E2E coverage is required and is automated rather than reduced to a manual checklist.

All nine E2E scenarios (E-1 through E-9) are automated Playwright specs. The original
plan ran them against `npm run preview` on the Workers runtime. **Final Phase 5 evidence
is against the deployed Worker** (`https://aisprint-quizmaker.akshaykumar.workers.dev`);
see D5-7. The agent records the run output as evidence.

Note the cost this accepts: Playwright installs browser binaries (~400MB) and needs a
running server, making it heavier than the Vitest packages. It also has Windows-specific
setup considerations — see RISK-16. Manual browser verification in Phase 5 remains required
in addition to Playwright; the automated suite does not replace a human looking at the app.

### RESOLVED-3: `AUTH_SECRET` removed — CONFIRMED

**Decision: `AUTH_SECRET` is removed from the Sprint 1 authentication design and from the
deployment requirements.**

Sessions are opaque 256-bit random identifiers looked up in D1. There is nothing to sign or
encrypt, so there is no key to configure. Sprint 1 introduces **no new environment variables
and no new secrets** — nothing is added to `.dev.vars` or `.dev.vars.example`, and there is
no `wrangler secret put` step in Phase 6.

---

## Overview/Problem

Teachers cannot use QuizMaker at all right now, because the application has no concept of a
user. Every visitor sees the same anonymous page, there is nowhere to store work against a
person, and nothing can be protected. Before any quiz authoring can be built, a teacher must
be able to create an account, prove who they are on return visits, stay signed in across
requests, and sign out on a shared or school machine with confidence that the session is
genuinely over.

This sprint builds that foundation and nothing else. The dashboard it delivers is a
deliberately empty signed-in landing page: its purpose is to prove that authentication works
end to end, not to begin the product.

---

## Hypothesis

We believe that providing secure, session-based authentication with a protected `/dashboard`
landing page will give teachers reliable, private, and repeatable access to their own
workspace, establishing the per-user identity that every subsequent QuizMaker feature
depends on.

---

## User Story

> As a teacher preparing quizzes for my classes,
> I want to create an account with my name, email, and a password, sign in on any machine I
> use, stay signed in while I work, and sign out completely when I step away from a shared
> staffroom computer,
> so that my work is tied to me, is not visible to whoever uses the computer next, and is
> still there when I come back tomorrow.

**Acceptance from the teacher's point of view:**

- I can register with my details and land straight in my dashboard, already signed in.
- I am told clearly and immediately when I mistype my email or my two passwords do not match.
- I am told if I already have an account with that email, rather than silently creating a
  second one.
- I can sign in later with the same email and password and land in my dashboard.
- If I get my password wrong, I am told the sign-in failed without the site revealing
  whether that email is registered.
- I stay signed in as I move around the app, without re-entering my password.
- I can sign out from the dashboard, and afterwards the browser Back button does not get me
  back in.
- If I try to open the dashboard without signing in, I am sent to the sign-in page.
- If I return after a long absence and my session has expired, I am treated as signed out
  and asked to sign in again, not shown an error.

---

## Scope

### In Scope

**Registration (`/register`)**

- Collect first name, last name, email, password, confirm password (RESOLVED-1)
- Client-side validation with immediate, field-level feedback
- Server-side Zod validation, treating all input as untrusted
- Password hashing with PBKDF2 via Web Crypto
- Duplicate email rejection
- Automatic session creation on success (registration signs the user in)
- Redirect to `/dashboard`

**Login (`/login`)**

- Email and password
- Generic authentication error that does not reveal whether an email is registered
- Session creation on success
- Redirect to `/dashboard`

**Logout**

- Available only when signed in
- Deletes the session row from D1
- Clears the `quizmaker_session` cookie
- Redirects to `/login`
- The old session identifier cannot be reused afterwards
- Missing, invalid, and expired sessions are all treated as logged out

**Dashboard (`/dashboard`)**

- Protected route
- Displays the authenticated user's name
- Logout control
- Placeholder content only

**Route protection**

- Unauthenticated access to `/dashboard` redirects to `/login`
- Authenticated access to `/login` or `/register` redirects to `/dashboard`
- Middleware performs cookie-presence checks only and never queries D1
- All server-side authorization goes through `getCurrentUser()`

**Supporting work**

- `src/lib/d1-client.ts` as the single centralized D1 access module
- D1 migrations for `users` and `sessions`, applied **locally only**
- Vitest test suite: unit, Server Action, and component tests
- Automated Playwright E2E suite covering the full authentication journey

### Out of Scope

Each exclusion below is out of scope because Sprint 1's single objective is proving that a
teacher can get in and out of the application securely. Anything that does not serve that
objective is deferred.

| Excluded | Why it is excluded from Sprint 1 |
|---|---|
| Quiz authoring | The entire point of the sprint is that accounts must exist *before* quizzes. Building both at once would mean neither is verified properly, and quiz data modelling depends on a stable `users.id` that does not exist until this sprint lands. |
| Quiz creation / editing / management | Same reason. These are the Sprint 2+ product; the dashboard is intentionally a shell so there is no half-built authoring surface to unwind. |
| Password reset | Requires an email delivery provider, token issuance and expiry, and a second set of security decisions. That is a sprint of its own, and no email service is installed or approved. |
| OAuth / social login | An entirely different identity model with external provider configuration, callback routes, and account-linking rules. It would replace, not extend, the work here. |
| Email verification | Requires the same email infrastructure as password reset. Unverified emails are acceptable for Sprint 1 because nothing yet depends on an email being reachable. |
| Roles | There is exactly one kind of user (a teacher) and one protected page. A role column with a single possible value is speculative structure. |
| Permissions | Nothing to permit or deny yet: no shared resources and no multi-user data. Authorization in Sprint 1 is binary — signed in or not. |
| Profile editing | Not needed to prove the authentication loop. Adds forms, validation, and re-authentication questions for changing an email, none of which are on the critical path. |
| Account deletion | Raises cascade-delete and data-retention questions that only matter once a user owns data. They own nothing yet. |
| Unrelated UI work | Theming, marketing pages, and navigation chrome would obscure whether authentication itself is correct. |

### Cut

Considered during planning and deliberately removed:

- **JWT / stateless signed session tokens** — Cut because the requirement demands that
  logout "delete/invalidate the session" and that the old session must not work afterwards.
  An issued JWT cannot be revoked before its expiry without a server-side denylist, which
  reintroduces the database lookup that JWTs exist to avoid. Opaque D1 sessions satisfy the
  requirement directly.
- **Hashing session identifiers at rest** — Considered so that a leaked database dump could
  not be replayed as live sessions. Cut for Sprint 1 because the identifier is 256 bits of
  CSPRNG output and is therefore unguessable, and because hashing adds a derivation step to
  the hottest path in the app (every protected request). Accepted risk: anyone with read
  access to the `sessions` table can impersonate an active user until the row expires. Worth
  revisiting when the data stored per user becomes sensitive.
- **Sliding session renewal** — Cut by explicit decision. Absolute 7-day expiry only. Simpler
  to reason about and to test, and it bounds the lifetime of a stolen cookie.
- **`react-hook-form`** — Cut at planning because `.cursor/rules/shadcn.mdc` requires asking
  before adding it. **Later added in Phase 4 (D4-1)** at the user's direction, with
  `@hookform/resolvers`, after behavioral RED.
- **`@cloudflare/vitest-pool-workers`** — Cut because the brief specifies mocking
  `d1-client`, which means tests do not need a real D1 binding or the workerd runtime. This
  is precisely why Workers-runtime verification in Phase 5 is mandatory and cannot be
  skipped — see RISK-8.
- **Rate limiting on login** — Cut as unrequested for Sprint 1. Noted as a real gap: nothing
  here slows down credential stuffing. Belongs in a hardening pass.

---

## Technical Architecture

| Layer | Decision |
|---|---|
| Framework | Next.js 16, App Router, React 19 |
| Rendering | Server Components by default; `'use client'` pushed as far down the tree as possible |
| Mutations | Server Actions for registration, login, and logout |
| HTTP endpoints | No REST register/login/logout API. One internal Route Handler, `GET /api/auth/clear-session` (D5-1), expires an invalid cookie then redirects to `/login`. |
| Hosting | Cloudflare Workers via `@opennextjs/cloudflare` |
| Database | Cloudflare D1 (`aisprintquiz-db`), binding `DB` |
| D1 access | Exclusively through `src/lib/d1-client.ts` |
| Queries | Prepared statements with positional placeholders `?1`, `?2` |
| Validation | Zod, server-side, on every Server Action input |
| Password hashing | PBKDF2 via Web Crypto |
| Sessions | Opaque random identifiers stored in D1. No JWT. |
| Cookie | httpOnly `quizmaker_session` |

**Architectural rules that constrain implementation:**

- No React component, client or server, touches `env.DB`. Every query goes through
  `src/lib/d1-client.ts`. This is both a rule from `.cursor/rules/d1.mdc` and the mechanism
  that makes the test suite possible: `d1-client` is the single seam that gets mocked. A
  Server Action that reaches around it is untestable.
- `src/lib/d1-client.ts` is never imported into a `'use client'` component.
- Bindings are reached via `getCloudflareContext()` from `@opennextjs/cloudflare`, never a
  global `env`.
- Reads use `all()` and take `results[0]`, not `first()`, which behaves inconsistently
  between local and remote D1.
- Cookie presence is never treated as authorization. It gates redirects only.

---

## Technical Requirements

### Database Schema

Both tables are created in a single migration. Timestamps are stored as **integer Unix epoch
seconds** rather than SQLite `DATETIME` text, so that expiry comparison is a plain integer
comparison with no string parsing or timezone ambiguity.

```sql
CREATE TABLE users (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  first_name    TEXT    NOT NULL,
  last_name     TEXT    NOT NULL,
  email         TEXT    NOT NULL,
  password_hash TEXT    NOT NULL,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at    INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Enforces duplicate-email rejection at the database level.
-- Emails are trimmed and lowercased by the application before they ever reach this table,
-- so a plain UNIQUE index is effectively case-insensitive.
CREATE UNIQUE INDEX idx_users_email ON users (email);

CREATE TABLE sessions (
  id         TEXT PRIMARY KEY,          -- opaque 256-bit random, base64url
  user_id    TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,          -- unix epoch seconds, created_at + 7 days
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Supports "delete all sessions for this user" and cascade behaviour.
CREATE INDEX idx_sessions_user_id ON sessions (user_id);

-- Supports sweeping expired rows.
CREATE INDEX idx_sessions_expires_at ON sessions (expires_at);
```

**Schema notes:**

- `sessions.id` **is** the value carried in the cookie. It is generated with
  `crypto.getRandomValues(new Uint8Array(32))` and base64url-encoded. It is not derived from
  the user id, is not sequential, and carries no information.
- `ON DELETE CASCADE` on `user_id` means deleting a user removes their sessions. Note that
  D1 requires `PRAGMA foreign_keys = ON` for this to be enforced; since account deletion is
  out of scope, nothing in Sprint 1 depends on it, but the constraint documents intent.
- **Plaintext passwords are never stored.** There is no column for one. `password_hash` holds
  only the PBKDF2 output in the encoded format below.
- **Session expiry is absolute.** `expires_at` is set once, at creation, to
  `created_at + 604800` (7 days). No code path ever updates it. There is no sliding renewal.
- **Email is normalized before storage and before lookup.** Trim, then lowercase. Both the
  write path and the read path apply the identical transform, or the unique index will be
  bypassed by `Teacher@School.org`.
- **Production schema drift (Phase 6):** Remote `users.created_at` / `updated_at` are
  DATETIME defaults; remote `idx_users_email` is `ON users (lower(email))`. Auth does not
  read those timestamp columns. Local `0001_create_users_and_sessions.sql` was **not**
  applied remotely; production was repaired by targeted DDL (D6-2).

### Password Hash Format

Stored in `users.password_hash` as a single self-describing string:

```
pbkdf2$<iterations>$<salt>$<hash>
```

- `iterations` — decimal integer, recorded per-hash so the cost can be raised later without
  invalidating existing passwords
- `salt` — 16 random bytes, base64url, no padding, unique per user
- `hash` — 32 derived bytes (PBKDF2-HMAC-SHA256), base64url, no padding

**Iteration count: 100,000.**

This is not a free choice. Cloudflare Workers (workerd) hard-rejects PBKDF2 iteration counts
above 100,000 with `NotSupportedError`; the limit exists to bound CPU in a multi-tenant
runtime. OWASP's 2023 guidance for PBKDF2-HMAC-SHA256 is 600,000, so **100,000 is below
current best practice and this is an accepted, documented limitation of hashing on Workers,
not an oversight.** See RISK-6.

This interacts dangerously with the test strategy: Node's Web Crypto has no such cap, so a
value above 100,000 would pass every Vitest run and then throw on the first real
registration in production. The iteration constant must therefore be asserted in a unit test
*and* exercised in Phase 5's Workers-runtime verification.

### API Endpoints

Register, login, and logout are Server Actions, not REST routes.
`.cursor/rules/nextjs.mdc` reserves `src/app/api/` for HTTP endpoints with an external
consumer. Sprint 1 still has **no public auth API**.

**Exception (D5-1):** `GET /api/auth/clear-session` is an internal Route Handler. Invalid
sessions cannot clear cookies inside a Server Component on Workers/OpenNext. The handler
only expires `quizmaker_session` and redirects to `/login`. It does not register, log in,
or delete a D1 session row.

```
registerAction(prevState, formData)  ->  redirect('/dashboard') | { errors }
loginAction(prevState, formData)     ->  redirect('/dashboard') | { errors }
logoutAction()                       ->  redirect('/login')
```

Each returns a serializable error-state object on failure, consumed by `useActionState` in
the form component and rendered through `FieldError`. On success each calls `redirect()`,
which throws a control-flow signal and therefore must be called **outside** any `try/catch`
that would swallow it.

### User Interface Requirements

#### Register page (`/register`)

Server Component page wrapping a `'use client'` form component.

| Field | Type | Client validation | Server validation |
|---|---|---|---|
| First name | text | Required, non-empty after trim | Same Zod schema |
| Last name | text | Required, non-empty after trim | Same Zod schema |
| Email | email | Required, valid email format | Same Zod schema, then normalized |
| Password | password | Required, minimum 8 characters | Same Zod schema |
| Confirm password | password | Required, must equal password | Same Zod schema (`.refine`) |

- Built with the shadcn `field` primitive: `FieldSet`, `FieldGroup`, `Field`, `FieldLabel`,
  `FieldError`. There is no Base UI `Form` component.
- Errors render through `FieldError`, which takes an array of `{ message }` objects.
- Duplicate email surfaces on the email field with exactly:
  `An account with this email already exists.`
- Submit button disabled while the action is pending.
- Link to `/login`.

#### Login page (`/login`)

| Field | Type | Client validation | Server validation |
|---|---|---|---|
| Email | email | Required, valid email format | Zod, then normalized |
| Password | password | Required | Zod, non-empty only |

- The login schema deliberately does **not** enforce the 8-character minimum. Rejecting a
  short password at the login form would tell an attacker that the stored password is at
  least 8 characters, and would lock out any account created before a future policy change.
- Any authentication failure — unknown email, wrong password — produces one identical,
  form-level message:
  `Incorrect email or password.`
- The user stays on `/login` after a failure, with the email field value preserved and the
  password field cleared.
- Link to `/register`.

#### Dashboard page (`/dashboard`)

Server Component. Calls `getCurrentUser()` and, if it returns null, redirects to
`/api/auth/clear-session`, which expires `quizmaker_session` and then redirects to `/login`.
Cookie mutation cannot happen in this Server Component (see D5-1).

- Heading identifying the page as the dashboard
- The authenticated user's name
- A logout control (a `'use client'` button in a form bound to `logoutAction`)
- A single shadcn `Card` with placeholder content stating that quiz features arrive in a
  later sprint
- **No quiz authoring, and no links to any.**

---

## Registration Behavior

Ordered, and the order matters:

1. **Validate input with Zod** — all five fields, including the confirm-password match.
2. **Normalize email** — `.trim().toLowerCase()`.
3. **Hash the password** — PBKDF2 via Web Crypto, fresh 16-byte random salt, 100,000
   iterations, encoded as `pbkdf2$iterations$salt$hash`. The plaintext exists only as a local
   variable and is never logged, never returned, and never written.
4. **Insert the user**, relying on the unique index to reject duplicates.
5. **Catch the unique-constraint violation** and return
   `An account with this email already exists.` on the email field.
6. **Create a session** — 256-bit opaque id, `expires_at = now + 604800`.
7. **Set the `quizmaker_session` cookie.**
8. **Redirect to `/dashboard`.**

**On ordering:** validation and normalization precede hashing so that a malformed submission
does not pay the PBKDF2 cost, which is the most expensive operation in the request.

**On duplicate detection:** the insert is attempted and the constraint violation is caught,
rather than doing a `SELECT` for an existing email and then inserting. A check-then-insert
has a race window in which two concurrent registrations for the same email both see "no
existing user" and both proceed. The unique index is the only thing that actually guarantees
correctness; the catch turns it into a friendly message.

**On the confirm-password field:** it is validated but never stored and never hashed.

---

## Login Behavior

1. **Validate with Zod** — email format, password non-empty.
2. **Normalize email** — the identical `.trim().toLowerCase()` used at registration.
3. **Look up the user** by normalized email.
4. **Verify the password** — parse the stored `pbkdf2$...` string, re-derive with the stored
   salt and iteration count, compare in constant time.
5. **Create an opaque D1 session** — same generation and 7-day absolute expiry as
   registration.
6. **Set the `quizmaker_session` cookie.**
7. **Redirect to `/dashboard`.**

**Generic errors.** Unknown email and wrong password return the identical message,
`Incorrect email or password.`, rendered in the identical place. Nothing in the response —
message text, field association, or status — distinguishes the two cases. This prevents the
login form from being used as an account-enumeration oracle.

**Timing.** A naive implementation returns instantly for an unknown email (no hash to verify)
but takes ~100ms for a wrong password, which leaks the same information the generic message
was meant to hide. Mitigation: when no user is found, still perform one PBKDF2 derivation
against a dummy hash before returning the failure, so both paths cost roughly the same.
Documented as a known partial mitigation — it narrows the signal rather than eliminating it.

**Constant-time comparison.** Comparing derived hashes with `===` is a timing leak.
Cloudflare offers `crypto.subtle.timingSafeEqual`, but it is a Workers-specific extension
that **does not exist in Node**, so using it directly would break every Vitest run. The
implementation must use a portable constant-time byte comparison (fixed-length XOR
accumulation). See RISK-8.

---

## Logout Behavior

Logout is a full authentication operation, not a UI affordance. Clearing the cookie alone
would leave a live session row in D1 that any copy of the cookie value could still use.

1. **Read the `quizmaker_session` cookie.**
2. **Identify the session** from its value.
3. **Delete the D1 session row** — `DELETE FROM sessions WHERE id = ?1`.
4. **Clear the `quizmaker_session` cookie.**
5. **Redirect to `/login`.**

**After logout:**

- The old session identifier no longer resolves. Replaying the exact cookie value fails,
  because the row is gone — not merely because the browser forgot it.
- `/dashboard` redirects to `/login`.
- The user must authenticate again.

**Deleting before clearing** matters. If the cookie is cleared first and the delete then
fails, the session survives server-side with no way for the user to reach it — a live
credential that the user believes is dead. Deleting first means the worst case is a dead
session id in a browser cookie, which is harmless.

**Idempotency.** Logout with a missing, unknown, or already-deleted session must still clear
the cookie and redirect to `/login` without erroring. `DELETE` affecting zero rows is
success.

### Invalid and Expired Session Handling

A session is valid only if the row exists **and** `expires_at > now`. Missing, unknown,
malformed, and expired sessions are all indistinguishable to the user: treated as logged
out, redirected to `/login`, no error page.

Expired rows encountered during lookup are deleted opportunistically, so ordinary traffic
sweeps the table without a scheduled job.

### Data Exposure Rules

Never rendered, logged, returned from a Server Action, or included in an error message:

- Session identifiers
- Password hashes, salts, or iteration counts
- Whether a given email is registered
- Raw D1 errors or SQL text

`getCurrentUser()` returns only `{ id, first_name, last_name, email }`. It never returns
`password_hash`. The queries in `d1-client` select explicit column lists rather than `SELECT
*`, so a future column cannot silently start flowing to the UI.

---

## Routes and Route Protection

Three product routes, plus a root redirect and one cookie-clear hop:

| Route | Type | Unauthenticated | Authenticated |
|---|---|---|---|
| `/` | Redirect | Redirect to `/login` | Redirect to `/dashboard` |
| `/register` | Public | Show register form | Redirect to `/dashboard` |
| `/login` | Public | Show login form | Redirect to `/dashboard` |
| `/dashboard` | Protected | Redirect to `/login` (via `/api/auth/clear-session` when a cookie is present but invalid) | Show dashboard |
| `/api/auth/clear-session` | Internal GET (D5-1) | Expires `quizmaker_session`, then `/login` | Same (expires cookie, then `/login`) |

### Two-Layer Protection

**Layer 1 — Middleware (`src/middleware.ts`): cookie presence only.**

Middleware checks whether the `quizmaker_session` cookie exists and redirects accordingly.
It **must not query D1**. Middleware runs on every matched request, and a database round trip
there would add latency to all traffic. It is a fast-path redirect for the common case, not
a security boundary.

**Layer 2 — `getCurrentUser()`: the actual authorization.**

Every protected Server Component and every Server Action that acts on behalf of a user calls
`getCurrentUser()`, which reads the cookie, looks the session up in D1 through `d1-client`,
checks expiry, and returns the user or null. Null from a Server Component redirects to
`/api/auth/clear-session` (D5-1), which expires the cookie and then redirects to `/login`.

**Cookie presence alone is never sufficient authorization.** A forged, stale, or expired
cookie passes middleware and is then rejected by `getCurrentUser()`. If `/dashboard` relied
on middleware alone, anyone could set `quizmaker_session=anything` in devtools and walk in.
The two layers are not redundant: middleware optimizes, `getCurrentUser()` authorizes.

### Cookie Configuration

| Attribute | Value | Reason |
|---|---|---|
| Name | `quizmaker_session` | Specified |
| Value | Opaque 256-bit base64url session id | No information content |
| `httpOnly` | `true` | JavaScript cannot read it; blunts XSS session theft |
| `secure` | `true` in production, `false` in local dev | A `secure` cookie is dropped over plain `http://localhost`, silently breaking local login. See TROUBLE-5. |
| `sameSite` | `lax` | CSRF resistance while still allowing top-level navigation into the app |
| `path` | `/` | Needed on every route |
| `maxAge` | `604800` (7 days) | Matches `sessions.expires_at` exactly |

The cookie `maxAge` and the database `expires_at` must be written from the same computed
value. If they drift, the browser and the server disagree about when the session ended.
**The database is authoritative** — a cookie that outlives its row is simply invalid.

---

## TDD Approach — Mandatory

Test-driven development is a project-level requirement for this sprint. For every testable
behavior:

1. Write the test first.
2. Run it.
3. **Observe the RED / failing result.**
4. Implement the minimum code required to pass.
5. Run it again.
6. **Observe the GREEN / passing result.**
7. Refactor only after GREEN.
8. Re-run the full suite for regressions.

### Evidence Recording

Each phase carries an evidence table, filled in **as the work happens**, not reconstructed
afterwards:

| Behavior | RED observed | GREEN observed | Regression | Notes |
|---|---|---|---|---|
| *(one row per behavior)* | command + failure summary | command + pass summary | full-suite result | deviations |

**Rules that are not negotiable:**

- **Do not claim TDD compliance if the test was written after the implementation.**
- If a RED test cannot be demonstrated before implementation, **record it as a process
  deviation** in that phase's evidence table, with the reason. A recorded deviation is
  acceptable; a false compliance claim is not.
- A RED result must fail for the *intended* reason. A test that errors on a missing import
  is not meaningful RED — it has not exercised the behavior. Note the distinction when it
  arises.

---

## Testing Strategy

Layered, with each layer covering what the layer below cannot.

### Unit Tests (Vitest) — auth service and helpers

`d1-client` is mocked. **No unit test touches real D1, local or remote.**

| # | Behavior |
|---|---|
| U-1 | Register succeeds and returns the created user |
| U-2 | Password is hashed; stored value matches `pbkdf2$<iters>$<salt>$<hash>` |
| U-3 | Plaintext password appears nowhere in the persisted record |
| U-4 | Iteration count is exactly 100,000 (guards the workerd ceiling) |
| U-5 | Two users with the same password get different salts and different hashes |
| U-6 | Duplicate email is rejected with the specified message |
| U-7 | Email is trimmed and lowercased before storage |
| U-8 | Email lookup normalizes identically, so `  Teacher@School.org ` matches |
| U-9 | Login succeeds with correct credentials |
| U-10 | Login fails with the wrong password |
| U-11 | Login fails with an unknown email |
| U-12 | Both failure modes return the identical generic error |
| U-13 | Session creation produces a unique opaque id with `expires_at = now + 604800` |
| U-14 | Valid session lookup returns the user |
| U-15 | Expired session returns null and the row is deleted |
| U-16 | Unknown or malformed session id returns null without throwing |
| U-17 | Session deletion removes the row; the id no longer resolves |
| U-18 | Deleting an already-deleted session succeeds silently |
| U-19 | `getCurrentUser()` never returns `password_hash` |
| U-20 | Queries use positional placeholders `?1`, `?2` and never string concatenation |

### Server Action Tests (Vitest)

| # | Behavior |
|---|---|
| A-1 | Zod rejects a missing first or last name |
| A-2 | Zod rejects a malformed email |
| A-3 | Zod rejects a password under 8 characters |
| A-4 | Zod rejects mismatched password and confirmation |
| A-5 | Duplicate registration returns the exact specified message |
| A-6 | Valid registration creates the user and a session |
| A-7 | Successful registration redirects to `/dashboard` |
| A-8 | Login with invalid input shape is rejected by Zod |
| A-9 | Login with wrong credentials returns the generic error and no session |
| A-10 | Successful login creates a session |
| A-11 | Successful login redirects to `/dashboard` |
| A-12 | `logoutAction` deletes the D1 session |
| A-13 | `logoutAction` clears the `quizmaker_session` cookie |
| A-14 | Logout redirects to `/login` |
| A-15 | Logout with no session cookie still clears and redirects without error |
| A-16 | The session cookie is set `httpOnly` with a 7-day `maxAge` |

### Component Tests (Vitest + jsdom + React Testing Library + user-event + jest-dom)

Covering the user-visible client-side validation that is explicitly in scope.

| # | Behavior |
|---|---|
| C-1 | Submitting an empty register form shows required-field errors |
| C-2 | An invalid email shows an email-format error |
| C-3 | A password under 8 characters shows a length error |
| C-4 | Mismatched passwords show a mismatch error on the confirm field |
| C-5 | A valid submission invokes the action without client-side errors |
| C-6 | Validation errors are visible to the user and associated with their field |
| C-7 | Submitting an empty login form shows required-field errors |
| C-8 | The login form renders a server-returned generic error |
| C-9 | Password inputs are `type="password"` |
| C-10 | The logout control renders on the dashboard |

**Assert on what the user perceives** — visible text, accessible roles, field association —
not internal React state, hook call counts, or implementation details.

### Browser End-to-End (Playwright)

Automated with `@playwright/test` (RESOLVED-2). An early Phase 5 pass ran against
`npm run preview` so the scenarios hit the **Workers runtime**, not `next dev` on Node.
**Final Phase 5 evidence is against the deployed Worker** (D5-7);
`playwright.config.ts` defaults to `https://aisprint-quizmaker.akshaykumar.workers.dev`
and has no `webServer`. Running E2E against `npm run dev` would forfeit most of its value,
since the runtime-specific defects in RISK-6 and RISK-8 only appear under workerd.

| # | Scenario |
|---|---|
| E-1 | **Registration:** `/register` → valid details → submit → lands on `/dashboard`, name shown |
| E-2 | **Login:** `/login` → valid credentials → submit → lands on `/dashboard` |
| E-3 | **Logout:** `/dashboard` → logout → `/login` → attempt `/dashboard` → redirected to `/login` |
| E-4 | **Invalid login:** wrong credentials → generic error → still on `/login` |
| E-5 | **Protected route, unauthenticated:** `/dashboard` → `/login` |
| E-6 | **Protected route, authenticated:** `/dashboard` accessible |
| E-7 | **Authenticated redirect:** signed in, visit `/login` and `/register` → `/dashboard` |
| E-8 | **Duplicate email:** register an existing email → specified message, no second account |
| E-9 | **Session replay after logout:** capture the cookie, log out, re-set it manually, attempt `/dashboard` → redirected to `/login` |

E-9 is the scenario that actually proves logout invalidated the session server-side rather
than just clearing the browser's copy. In Playwright it is expressed by reading
`quizmaker_session` from the browser context before logout, logging out, re-adding the exact
cookie value to the context, and asserting that `/dashboard` still redirects to `/login`.

**E2E tests need isolation.** Each run registers real accounts (local D1 on preview; remote
D1 when targeting workers.dev), so specs must generate unique emails per run (a timestamp
or UUID local-part) rather than reusing a fixture address. A hardcoded email passes on the
first run and then fails forever against the duplicate-email constraint.

---

## Implementation Phases

### Phase 1 — Database and Auth Service - COMPLETED

**Objective:** A tested auth/session service over D1, with no UI and no Server Actions.

**Tasks (TDD order):**

1. Write unit tests U-1 through U-20 against the not-yet-written auth service.
2. Run them. **Observe RED.** Record the evidence.
3. Add the `d1_databases` binding for `aisprintquiz-db` to `wrangler.jsonc` and run
   `npm run cf-typegen`. *(Human-approved step — see holds below.)*
4. Create the migration for `users` and `sessions`. Apply **locally only**:
   `npx wrangler d1 migrations apply aisprintquiz-db --local`.
5. Implement `src/lib/d1-client.ts` — the centralized D1 access module.
6. Implement `src/lib/auth/password.ts` — PBKDF2 hash and verify.
7. Implement `src/lib/auth/session.ts` — create, look up, delete.
8. Implement `src/lib/services/auth-service.ts` — register and login.
9. Run the tests. **Observe GREEN.** Record the evidence.
10. Refactor, then re-run the full suite for regressions.

**Deliverables:** `d1-client.ts`, `password.ts`, `session.ts`, `auth-service.ts`, one local
migration, unit tests passing, RED/GREEN/regression evidence recorded.

#### Phase 1 Evidence — recorded 2026-09-01

All commands below were actually executed and their output observed. Nothing in this table
is inferred.

| Step | Command | Observed result |
|---|---|---|
| RED (attempt 1) | `npm test` | 4 suites failed, **0 tests ran** — `Cannot find module './password'` etc. |
| RED (attempt 2) | `npm test` | **35 failed, 18 skipped (53 total)** — assertion and `Not implemented` failures |
| GREEN | `npm test` | **53 passed (53)**, 4 files |
| Regression (after refactor) | `npm test` | **53 passed (53)** |
| Lint | `npm run lint` | **0 errors, 0 warnings** |
| Types | `npx tsc --noEmit` | **Clean** |
| Build | `npm run build` | **Compiled successfully**, TypeScript passed |
| Local migration (attempt 1) | `wrangler d1 migrations apply --local` | **FAILED — `table users already exists`.** See deviation D-6 |
| Local migration (attempt 2, after reset) | `wrangler d1 migrations apply --local` | **6 commands executed successfully**, `0001` applied |
| Local schema verification | `wrangler d1 execute --local` | `users`, `sessions`, and all three indexes present |
| Local constraint verification | duplicate `INSERT` on `users.email` | **Rejected:** `UNIQUE constraint failed: users.email: SQLITE_CONSTRAINT` |
| Final regression | `npm test`, `npm run lint` | **53 passed (53)**, lint clean |

**RED quality note.** Attempt 1 is recorded but is **not** counted as meaningful RED: it
failed at module resolution, so no test body ever executed. Throwing stubs were created for
each module's public surface, and attempt 2 produced genuine behavioral failures. This is the
distinction the TDD section of this PRD requires, and it is recorded rather than glossed.

The 18 skipped tests in attempt 2 were `auth-service.test.ts`, whose `beforeAll` calls the
real `hashPassword`; the stub threw, so the suite could not start. They ran and passed at
GREEN.

#### Phase 1 Process Deviations

Recorded per the Evidence Rules. None are hidden.

- **D-1: Vitest default environment is `node`, not `jsdom`.** The PRD specified a jsdom
  environment. jsdom does not implement `SubtleCrypto`, so a global jsdom default would make
  every PBKDF2 test fail on a missing `crypto.subtle`. Component tests in Phase 4 opt into
  jsdom per file with a `@vitest-environment jsdom` docblock. `@vitejs/plugin-react` and the
  `jest-dom` setup file are configured as specified.
- **D-2: `@vitejs/plugin-react` pinned to `^5.2.0`.** Version 6 depends on
  `@rolldown/plugin-babel`, which requires `@babel/core@^8`, while `shadcn` pins Babel 7.
  `npm install` failed with `ERESOLVE`. Version 5 uses Babel 7 and still supports Vite 7.
  Resolved by pinning rather than `--legacy-peer-deps`, which would have masked the conflict.
  **This is RISK-11 materializing exactly as predicted.**
- **D-3: Config file is `vitest.config.mts`, not `.ts`.** Vite warned that ESM syntax was
  being loaded as CommonJS because the project has no `"type": "module"`. The `.mts`
  extension removes the warning without changing the package's module type.
- **D-4: `.wrangler/**` added to `eslint.config.mjs` ignores.** Generated Wrangler temp
  bundles were producing lint warnings. It was already gitignored but not lint-ignored.
- **D-5: Stale `.next/` deleted.** Generated types from an abandoned earlier session
  referenced routes that do not exist (`src/app/quiz/page`, `src/app/api/auth/*`), failing
  `tsc`. `.next/` is regenerable build output.
- **D-6: Local D1 state was reset — RESOLVED by user decision.** The local Miniflare
  database contained a `users` table from an abandoned session dated 2026-08-31: a `username`
  column, `DATETIME` timestamps, no unique index on `email`, no `sessions` table, 19 rows,
  and a `d1_migrations` row for `0001_create_users_table.sql`, a file no longer in the repo.
  The migration could not apply over it. The user was asked and chose to reset;
  `.wrangler/state/v3/d1` was then deleted and `0001` applied cleanly. **Local state only —
  no remote D1 operation was performed at any point.**
- **D-8: The duplicate-email matcher was validated against real D1, not just the mock.**
  `isDuplicateEmailError()` matches on the substring `UNIQUE constraint failed: users.email`.
  The unit test asserts this against a hand-written error, which would pass even if the real
  message differed. A live duplicate `INSERT` on the local database returned
  `UNIQUE constraint failed: users.email: SQLITE_CONSTRAINT (extended:
  SQLITE_CONSTRAINT_UNIQUE)`, confirming the substring is correct. This is the class of gap a
  mocked suite cannot close on its own.
- **D-7: `getCurrentUser()` remains Phase 3, as planned.** Acceptance item U-19 ("never
  returns `password_hash`") is therefore covered at the `getSessionUser()` level in
  `session.test.ts`, which is the function `getCurrentUser()` will wrap.

#### Phase 1 Test Coverage Delivered

53 tests across 4 files, covering U-1 through U-20:

| File | Tests | Covers |
|---|---|---|
| `src/lib/auth/password.test.ts` | 13 | U-2, U-3, U-4, U-5 plus verify and malformed-hash handling |
| `src/lib/auth/email.test.ts` | 4 | U-7, U-8 |
| `src/lib/auth/session.test.ts` | 18 | U-13..U-20 |
| `src/lib/services/auth-service.test.ts` | 18 | U-1, U-2, U-3, U-6..U-12, U-19, U-20 |

### Phase 2 — Server Actions and Cookies - COMPLETED

**Objective:** The three Server Actions and session cookie handling.

**Tasks (TDD order):**

1. Write Server Action tests A-1 through A-16. Run. **Observe RED.** Record.
2. Implement `src/lib/schemas/auth-schema.ts` (Zod, shared client and server).
3. Implement `src/lib/auth-constants.ts` — `SESSION_COOKIE_NAME`.
4. Implement `src/lib/session.ts` — `getCurrentUser()`.
5. Implement `registerAction`, `loginAction`, `logoutAction` in
   `src/lib/actions/auth-actions.ts`, including cookie set and clear.
6. Run. **Observe GREEN.** Record.
7. Refactor, re-run full suite.

**Deliverables:** Zod schemas, session cookie handling, `getCurrentUser()`, three Server
Actions, tests passing, evidence recorded.

#### Phase 2 Evidence — recorded 2026-09-01

All commands below were actually executed and their output observed.

| Step | Command | Observed result |
|---|---|---|
| RED (attempt 1) | `npm test` | 3 new suites failed, **0 new tests ran** — `Cannot find module './auth-schema'` etc. |
| RED (attempt 2) | `npm test` | **59 failed \| 53 passed (112)** — behavioral failures in all 3 new suites |
| GREEN | `npm test` | **112 passed (112)**, 7 files |
| Lint | `npm run lint` | **0 errors, 0 warnings** |
| Types | `npx tsc --noEmit` | **Clean** |
| Build | `npm run build` | **Compiled successfully**, TypeScript passed |

**RED quality note.** As in Phase 1, attempt 1 failed at module resolution and is **not**
counted as meaningful RED. Throwing stubs were created for all four modules
(`SESSION_COOKIE_NAME` was stubbed to `""`, the schemas to throwing `safeParse`, the actions
and `getCurrentUser` to throwing functions), and attempt 2 produced 59 genuine behavioral
failures. The 53 Phase 1 tests passed throughout, confirming no regression.

**Phase 2 test coverage:** 59 new tests across 3 files, covering A-1 through A-16.

| File | Tests | Covers |
|---|---|---|
| `src/lib/schemas/auth-schema.test.ts` | 23 | A-1, A-2, A-3, A-4, A-8, plus normalization and the deliberate absence of a login length rule |
| `src/lib/session.test.ts` | 7 | `getCurrentUser()`: valid, missing, empty, forged, and expired sessions |
| `src/lib/actions/auth-actions.test.ts` | 29 | A-1..A-16, plus ordering, secret-leak, and enumeration checks |

#### Phase 2 Process Deviations

- **D2-1: File layout differs from the original Key Files table, at the user's direction.**
  `src/lib/schemas/auth-schema.ts` rather than `src/lib/validation/auth-schemas.ts`; a single
  `src/lib/actions/auth-actions.ts` rather than three per-route `actions.ts` files;
  `src/lib/auth-constants.ts` rather than `src/lib/auth/cookies.ts`; `src/lib/session.ts`
  rather than `src/lib/auth/current-user.ts`. The Key Files table has been updated to match
  what exists.
- **D2-2: `getCurrentUser()` moved from Phase 3 into Phase 2**, at the user's direction. It is
  implemented and tested. Phase 3 is correspondingly reduced to middleware plus wiring it
  into the protected page.
- **D2-3: RED attempt 1 was module-resolution only.** Same pattern as Phase 1; recorded
  rather than presented as meaningful RED.
- **D2-4: Action tests mock the service and session layers, not `d1-client` directly.** The
  Server Actions never call `d1-client`; they call `registerUser`, `loginUser`,
  `createSession`, and `deleteSession`. Mocking the boundary the code under test actually
  uses is the correct seam, and `d1-client` remains mocked in the Phase 1 suites beneath.
  **No test in the suite touches real D1.**
- **D2-5: Cookie `secure` is conditional on `process.env.NODE_ENV === "production"`**, as
  specified in the Cookie Configuration table. Under Vitest, `NODE_ENV` is `test`, so the
  tests assert `httpOnly`, `sameSite`, `path`, and `maxAge` but not `secure`. The production
  value is verified in Phase 5 under `npm run preview`.

#### Phase 2 Concern Requiring Review

- **C2-1: The `"use server"` directive is not yet exercised by the build.** `next build`
  compiles only what is reachable from a route, and no page imports
  `src/lib/actions/auth-actions.ts` yet, so Next has not applied its Server Action
  constraints to that file. TypeScript and lint cover it, and the unit tests cover its logic,
  but the Next-specific rules — every export in a `"use server"` file must be an async
  function, and arguments must be serializable — will only be enforced once Phase 4 wires the
  actions into a form. Likewise, `redirect()` is asserted against a mock here; its real
  `NEXT_REDIRECT` behavior is verified in Phase 4 and Phase 5. **A green Phase 2 does not
  prove the actions work inside Next.**

### Phase 3 — Route Protection - COMPLETED

**Objective:** `/dashboard` protected; authenticated users bounced off `/login` and
`/register`.

**Tasks (TDD order):**

1. Write route-protection tests. Run. **Observe RED.** Record.
2. ~~Implement `getCurrentUser()`~~ — **done in Phase 2** (`src/lib/session.ts`), see D2-2.
3. Implement `src/middleware.ts` — **cookie presence only, no D1 query.**
4. Implement `src/app/(protected)/layout.tsx` and `src/app/(auth)/layout.tsx`.
5. Wire `src/app/page.tsx` to redirect by authentication state.
6. Run. **Observe GREEN.** Record.
7. Refactor, re-run full suite.

**Deliverables:** middleware, both route-group layouts, root route, protection tests
passing, evidence recorded.

#### Phase 3 Evidence — recorded 2026-09-01 (this session)

All commands below were actually executed and their output observed.

| Step | Command | Observed result |
|---|---|---|
| Baseline after revert (see D3-1) | `npm test` | **112 passed (112)**, 7 files |
| RED (attempt 1) | `npm test` | **4 failed \| 112 passed (116)** — 3 suites failed at module resolution; `page.test.ts` produced 4 genuine behavioral failures |
| RED (attempt 2) | `npm test` | **33 failed \| 112 passed (145)** — behavioral failures in all 4 new suites |
| GREEN | `npm test` | **145 passed (145)**, 11 files |
| Full suite | `npm test` | **145 passed (145)** — Phase 1 and Phase 2 suites unchanged |
| Lint | `npm run lint` | **0 errors, 0 warnings** |
| Types | `npx tsc --noEmit` | **Clean, exit 0** |
| Build | `npm run build` | **Compiled successfully in 9.7s**, TypeScript passed, 3/3 pages generated |

**RED quality note.** Attempt 1 was mixed. `src/app/page.tsx` already existed as the Next.js
starter page, so its 4 tests ran and failed on behavior — real RED with no stub required. The
other three suites failed at module resolution and are **not** counted as meaningful RED.
Throwing stubs were created for `src/middleware.ts` (with `matcher: []`) and both layouts, and
attempt 2 produced **33 genuine behavioral failures**. The 112 Phase 1 and Phase 2 tests passed
at every step, confirming no regression.

**Phase 3 test coverage:** 33 new tests across 4 files.

| File | Tests | Covers |
|---|---|---|
| `src/middleware.test.ts` | 19 | Exact matcher; missing, empty, present, and forged cookie on `/dashboard` and nested routes; both auth routes in both states; and the negative boundaries — no D1 call, no session validation, no value in the redirect location, no logging, synchronous return |
| `src/app/(protected)/layout.test.tsx` | 6 | Missing, invalid, and expired session all redirect to `/login`; authenticated renders children; authorization goes through `getCurrentUser()` |
| `src/app/(auth)/layout.test.tsx` | 4 | Authenticated redirects to `/dashboard`; unauthenticated, invalid, and expired render the auth pages |
| `src/app/page.test.ts` | 4 | Authenticated to `/dashboard`; unauthenticated, invalid, and expired to `/login`; renders nothing itself |

**Build evidence — two findings that mocks could not have produced.**

1. **The middleware is genuinely wired.** The route table printed `ƒ Proxy (Middleware)`,
   confirming Next resolves `src/middleware.ts`. This location matters: in a project with a
   `src/` directory a root-level `middleware.ts` is **silently ignored**, which would have
   removed Layer 1 with no error anywhere.
2. **The root route is dynamic.** `/` is listed as `ƒ (Dynamic)` rather than `○ (Static)`,
   confirming that `getCurrentUser()` → `cookies()` correctly opted the route out of
   prerendering under a real build.

Route groups containing a layout but no page are accepted by the build and contribute no
routes, as expected — `/` and `/_not-found` are the only entries.

#### Phase 3 Process Deviations

- **D3-1: A pre-existing Phase 3 implementation was reverted before TDD began.** At the start
  of this session the disk already contained a complete Phase 3: `src/proxy.ts` (not
  `middleware.ts`), both route-group layouts, an updated `src/app/page.tsx`, and matching
  tests. RED before implementation is not demonstrable against code that already exists, and
  the Evidence Rules forbid reconstructing one. The pre-existing files were deleted;
  `src/app/page.tsx` was restored with `git checkout HEAD -- src/app/page.tsx`. The suite
  returned to the Phase 2 baseline of 112 before any Phase 3 test was written. **The tests and
  implementation recorded above were written in TDD order in this session.** The convergent
  result is a consequence of the same requirements, not of copying. The previous work used
  `proxy.ts` / `export function proxy` to address C3-1; this session uses `src/middleware.ts`
  / `export function middleware` because the Phase 3 brief named that file explicitly.
- **D3-2: RED attempt 1 was partly module-resolution only.** Same pattern as Phases 1 and 2 for
  three of the four suites; recorded rather than presented as meaningful RED. `page.test.ts` is
  the exception and gave real behavioral RED immediately.
- **D3-3: Middleware placed at `src/middleware.ts`, not the repository root.** The Phase 3
  brief said `middleware.ts`. With a `src/` directory Next requires `src/middleware.ts`; a root
  file would not run. Confirmed by the build output above.
- **D3-4: The layouts are tested as plain async functions, not rendered.** Server Components
  cannot be rendered by React Testing Library, per `.cursor/skills/testing`. The tests await
  the function and assert on the redirect side effect and on `isValidElement` of the result.

#### Phase 3 Concerns Requiring Review

- **C3-1: The `middleware` file convention is deprecated in Next.js 16.** The build emits:
  `⚠ The "middleware" file convention is deprecated. Please use "proxy" instead.` Next 16
  renames the file to `src/proxy.ts` and the exported function to `proxy`; the `config`
  matcher export is unchanged, and a codemod exists
  (`npx @next/codemod@canary middleware-to-proxy .`). The current file **works** — the build
  resolves it and reports it as `ƒ Proxy (Middleware)`. It was left as `middleware.ts` because
  the Phase 3 brief named that file explicitly. **Renaming is a decision for the user.** The
  pre-existing work this session reverted had already made that rename; restoring it would
  close this warning and would not change behavior.
- **C2-1 was closed in Phase 4** for compilation and real `redirect()`. See Phase 4 evidence.
  A live successful Server Action POST is still Phase 5.

### Phase 4 — User Interface - COMPLETED

**Objective:** The three pages, using existing repository conventions.

**Tasks:**

1. Write component tests C-1 through C-10. Run. **Observe RED.** Record.
2. Build the register form — shadcn `field` primitives, shared Zod schema, `FieldError`,
   react-hook-form + zodResolver.
3. Build the login form.
4. Build the logout button.
5. Build the dashboard page — `MCQ Home`, user's name, logout, placeholder card.
6. Run component tests. **Observe GREEN.** Record.
7. Refactor, re-run full suite. Run lint, `tsc`, build, and `npm run preview`.

**Constraints:** shadcn/ui on Base UI with the `field` primitive; Tailwind v4 semantic theme
tokens only, no hard-coded colors; `cn()` for class composition; `'use client'` only on the
interactive form components; no edits to `src/components/ui/`. If a component that is not
already installed is needed, add it with the `@shadcn/` namespace.

**Deliverables:** `/register`, `/login`, `/dashboard`, logout control, component tests
passing, evidence recorded.

#### Phase 4 Evidence — recorded 2026-09-01

All commands below were actually executed and their output observed.

| Step | Command | Observed result |
|---|---|---|
| RED (attempt 1) | `npm test` | 6 new suites failed, **0 new tests ran** — module resolution only |
| RED (attempt 2) | `npm test` | **19 failed \| 146 passed (165)** — behavioral failures after empty stubs |
| GREEN | `npm test` | **165 passed (165)**, 17 files |
| Lint | `npm run lint` | **0 errors, 0 warnings** |
| Types | `npx tsc --noEmit` | **Clean, exit 0** |
| Build | `npm run build` | **Compiled successfully in 8.8s.** Routes: `ƒ /`, `ƒ /dashboard`, `ƒ /login`, `ƒ /register` |
| Preview (attempt 1) | `npm run preview` | **FAILED** — `Cannot find package 'esbuild'` (see D4-3) |
| Preview (attempt 2) | `npm run preview` | **Ready on http://127.0.0.1:8787**, `env.DB` bound to local `aisprintquiz-db` |

**RED quality note.** Attempt 1 is **not** counted as meaningful RED. Empty-returning stubs were
created for the six scope modules, and attempt 2 produced 19 genuine assertion failures. One
of the 20 new tests passed against the stub: the dashboard "no quiz authoring" negative
assertion, because an empty page contains no authoring controls. That pass is recorded; it
is not presented as a RED.

**Phase 4 test coverage:** 20 new tests across 6 files, covering C-1 through C-10.

| File | Tests | Covers |
|---|---|---|
| `src/components/auth/register-form.test.tsx` | 8 | C-1..C-6, C-9, plus duplicate-email server error |
| `src/components/auth/login-form.test.tsx` | 5 | C-5, C-7, C-8, C-9, generic error not on the email field |
| `src/components/auth/logout-button.test.tsx` | 2 | Logout control renders and calls `logoutAction` |
| `src/app/(protected)/dashboard/page.test.tsx` | 3 | C-10: `MCQ Home`, name, logout, placeholder; no authoring; unauthenticated redirect |
| `src/app/(auth)/register/page.test.tsx` | 1 | Heading and form present |
| `src/app/(auth)/login/page.test.tsx` | 1 | Heading and form present |

**Workers-runtime verification (curl against `127.0.0.1:8787`):**

| Request | Result |
|---|---|
| `GET /` (no cookie) | **307** `Location: /login` — real `redirect()`, not a mock |
| `GET /dashboard` (no cookie) | **307** `Location: /login` |
| `GET /login` | **200**, heading "Sign in", email/password fields, `$ACTION_REF` present |
| `GET /register` | **200**, heading "Create an account", first name / confirm password |
| `GET /dashboard` with `quizmaker_session=forged-value` | **307** `Location: /login` — cookie passed middleware; `getCurrentUser()` rejected it |
| `GET /login` with `quizmaker_session=forged-value` | **307** `Location: /dashboard` — middleware cookie-presence only |

No live register/login POST was executed on preview. Server Action IDs are opaque; that path
belongs to Phase 5 Playwright.

**C2-1 status: resolved for compilation and `redirect()`.** The build included the action
module via the forms (`$ACTION_REF` in the login HTML). `redirect()` executed for real on `/`
and on a forged-cookie `/dashboard`. A live successful `registerAction` / `loginAction` POST
is still Phase 5.

#### Phase 4 Process Deviations

- **D4-1: `react-hook-form` and `@hookform/resolvers` added, at the user's direction.** The
  original PRD and `shadcn.mdc` said not to introduce `react-hook-form` without asking. Phase
  4 of this sprint explicitly required `react-hook-form` + `zodResolver`. Installed after
  behavioral RED, before implementation. Versions: `react-hook-form@^7.87.0`,
  `@hookform/resolvers@^5.9.1`.
- **D4-2: Registration still uses separate `firstName` and `lastName` fields.** The Phase 4
  brief said "name". RESOLVED-1 remains in force.
- **D4-3: `esbuild` added as a devDependency so `npm run preview` can run.** The first preview
  attempt failed with `Cannot find package 'esbuild' imported from
  @opennextjs/cloudflare/dist/cli/build/bundle-server.js`. OpenNext imports `esbuild` as a
  bare specifier but only lists it as its own *package* `devDependency`, so it is not
  installed for consumers. Adding it is a tooling repair, not a product dependency. Recorded
  rather than hidden.
- **D4-4: `vitest.setup.ts` now calls Testing Library `cleanup()` after each test.** Without
  it, jsdom accumulated buttons across tests and later cases failed with "Found multiple
  elements". Required for honest component tests; does not change application code.
- **D4-5: `src/middleware.ts` left as-is.** C3-1 remains technical debt per this Phase 4 brief.

#### Phase 4 Concerns Requiring Review

- **C3-1 remains technical debt.** The build still warns that the `middleware` file convention
  is deprecated. Not renamed, per instruction.
- **OpenNext on Windows.** Preview printed: `WARN OpenNext is not fully compatible with
  Windows.` The server started and the curl checks passed. Residual RISK-10.
- **No live POST on preview.** Register/login/logout were not submitted against workerd in
  this phase. GET + redirect coverage is recorded; the mutation path is Phase 5.

#### Phase 4 deployment/runtime issue — recorded 2026-09-01

After the first production deploy, `/register` rendered but **Create an account** failed
with `This page couldn’t load` / digest **4068762763**. Local `npm run preview` had already
registered successfully. This was **not** a frontend or Server Action bug.

**Root cause:** Remote `aisprintquiz-db` still had an older `users` table
(`username TEXT NOT NULL`, unique `lower(username)`, no `sessions` table).
`registerAction` → `registerUser` runs
`INSERT INTO users (id, first_name, last_name, email, password_hash)`. That INSERT
reproduced on remote D1 as
`NOT NULL constraint failed: users.username`. Next.js surfaces the thrown D1 error as
digest 4068762763. Even after a successful user insert, `createSession()` would have
failed next because `sessions` did not exist. No auth env vars/secrets are required
(RESOLVED-3); `wrangler secret list` was `[]`. `env.DB` was bound correctly.

**Fix:** Remote-only DDL (not `migrations apply --remote` of local 0001, which would
`CREATE TABLE users` on top of the existing table):

- `DROP INDEX IF EXISTS idx_users_username`
- `ALTER TABLE users DROP COLUMN username`
- `CREATE TABLE sessions` + indexes (same shape as local 0001)

Local-safe `migrations/0002_align_remote_sessions.sql` (`CREATE TABLE IF NOT EXISTS
sessions`) was applied **locally only**. Application auth code was not changed.

**Redeploy:** `npm run deploy` → version `31bfa4df-0079-4f1e-ac2b-413656af46d2`
at `https://aisprint-quizmaker.akshaykumar.workers.dev`.

**Verification (deployed URL, after repair):** register → dashboard (MCQ Home + name,
httpOnly `quizmaker_session`) → logout → `/login` → login → dashboard → logout.
Remote `users` row `phase4-fix+1788264594690@example.test` stored
`pbkdf2$100000$…`. Session row gone after logout.

Phase 4 UI work stays COMPLETE. Production register/login is now verified. Do not treat
local 0001 as having been applied remotely — migration names still differ.

### Phase 5 — Tests and Verification - COMPLETED

**Objective:** Prove the whole thing works, on the runtime it will actually run on.

**Tasks:**

1. Full Vitest suite — unit, Server Action, component.
2. Playwright E2E suite, scenarios E-1 through E-9, run against the **deployed**
   Worker (`https://aisprint-quizmaker.akshaykumar.workers.dev`). Local preview is
   not sufficient evidence for this pass.
3. `npm run lint`.
4. TypeScript check (strict).
5. `npm run build`.
6. Local D1 verification: inspect `users` and `sessions` after a register/login/logout cycle
   and confirm the hash format, the absence of plaintext, and that logout removed the row.
7. `npm run preview` — **Workers runtime verification.**
8. Browser journey: `register → dashboard → logout → login → dashboard`.
9. Browser check: `logout → attempt /dashboard → redirected to /login`.

**Why step 7 cannot be skipped:** the entire Vitest suite runs on Node with a mocked
`d1-client`. It exercises neither workerd nor real D1. The PBKDF2 iteration ceiling
(RISK-6), the absence of `crypto.subtle.timingSafeEqual` in Node (RISK-8), and real D1
placeholder binding behavior are all invisible to a green Vitest run. A green suite is
necessary and not sufficient.

**Manual visual review is still useful.** Playwright automated steps 8 and 9 against the
Workers preview. That is not a substitute for a human noticing a broken layout. The agent
did not perform a separate unaided visual pass; the recorded browser evidence is Playwright
on `http://127.0.0.1:8787`.

**Deliverables:** all suites passing with recorded output, lint and build clean, Workers
verification recorded, browser journeys recorded with who performed them.

#### Phase 5 Evidence — recorded 2026-09-01

All commands below were actually executed and their output observed.

| Step | Command | Observed result |
|---|---|---|
| Baseline | `npx vitest run` | **165 passed (165)**, 17 files — Phase 1–4 still green |
| RED (Playwright, no package) | `npx playwright test` | **Not meaningful RED** — `@playwright/test` was not installed |
| Install | `npm install -D @playwright/test` then `npx playwright install chromium` | Installed `@playwright/test@^1.62.1`; Chromium only |
| RED (first live E2E) | `npx playwright test` against `npm run preview` | **5 passed, 2 failed (7)** — forged cookie timed out; E-9 `spawnSync wrangler.cmd EINVAL` (after an earlier `npx` `ENOENT`) |
| RED (unit, cookie-clear hop) | `npx vitest run` on the new/updated suites | **5 failed \| 13 passed (18)** — `Cannot find module './route'`; `getCurrentUser` still called `cookies().delete()`; layout and dashboard still redirected to `/login` |
| GREEN (E2E, isolated E-9) | `npx playwright test e2e/auth.spec.ts -g "E-9"` | **1 passed (13.3s)** after the JSON parser fix |
| GREEN (E2E, full suite) | `npx playwright test` | **7 passed (23.9s)**, 1 worker, against `http://127.0.0.1:8787` |
| GREEN (Vitest) | `npx vitest run` | **169 passed (169)**, 18 files |
| Lint | `npm run lint` | **exit 0**, 0 errors, 0 warnings |
| Types | `npx tsc --noEmit` | **exit 0**, no diagnostics |
| Build | `npm run build` | **Compiled successfully in 4.2s.** Routes: `ƒ /`, `ƒ /api/auth/clear-session`, `ƒ /dashboard`, `ƒ /login`, `ƒ /register`. C3-1 warning still emitted |
| Preview | `npm run preview` | **Ready on http://127.0.0.1:8787**, `env.DB` bound to local `aisprintquiz-db` |

**RED quality note.** The pre-install Playwright invocation is **not** counted as meaningful
RED. The first live E2E run is meaningful: 5 of 7 specs already passed the real Workers
register → dashboard → logout → login journey; the two failures were the forged-cookie
redirect and the E-9 D1 helper. The unit RED for `/api/auth/clear-session` is also
meaningful: assertion failures, not module-resolution theatre, except for the new route
file which correctly failed to resolve before it existed.

**Phase 5 test coverage:** 7 Playwright tests covering E-1 through E-9, plus 4 new/updated
Vitest cases for the cookie-clear hop (`route.test.ts` 2; layout/dashboard/session
assertions updated). Full suite **169** across **18** files.

| File | Tests | Covers |
|---|---|---|
| `e2e/auth.spec.ts` | 7 | E-1/E-2/E-3 combined browser journey; E-4; E-5; E-6/E-7; E-8; forged cookie; E-9 replay + local D1 session count |
| `playwright.config.ts` | — | `baseURL http://127.0.0.1:8787`, `webServer: npm run preview`, `reuseExistingServer: true`, `workers: 1` |
| `src/app/api/auth/clear-session/route.test.ts` | 2 | 307 to `/login`; `Set-Cookie` expires `quizmaker_session` |
| `src/lib/session.test.ts` | 9 | `getCurrentUser()` still authorizes; does **not** mutate cookies (RSC-safe) |

**Workers-runtime verification (Playwright + curl against `127.0.0.1:8787`):**

| Check | Result |
|---|---|
| Register with valid data | Browser: lands on `/dashboard`, heading **MCQ Home**, first + last name, logout, placeholder only |
| Logout | Browser: `/login`; subsequent `/dashboard` → `/login` |
| Login with same credentials | Browser: `/dashboard` again, name visible |
| Wrong password | Browser: `Incorrect email or password.` stays on `/login` |
| Duplicate email | Browser: `An account with this email already exists.` stays on `/register` |
| Unauthenticated `/dashboard` | Browser + curl: **307** `Location: /login` |
| Authenticated `/login` and `/register` | Browser: bounced to `/dashboard` |
| Forged `quizmaker_session` on `/dashboard` | curl: **307** `Location: /api/auth/clear-session`; then **307** `/login` with `Set-Cookie: quizmaker_session=; Path=/; Expires=Thu, 01 Jan 1970`. Playwright waits for `/login` |
| Replayed logged-out cookie (E-9) | Browser sent to `/login`; local D1 `sessions` count decreased after logout |
| Password / session id in UI | Playwright: page text contains neither the password nor the cookie value |
| Cookie flags | Playwright: `quizmaker_session` is `httpOnly` |

**Local D1 inspection (after E2E, `wrangler d1 execute aisprintquiz-db --local`):**

- `users` rows store `password_hash` as `pbkdf2$100000$<salt>$<hash>` — no plaintext password
  column and no password string in the hash.
- Three most recent hashes used **distinct salts**.
- After the E2E runs: **21** users, **11** sessions (logout deleted rows; leftover rows are
  still-open sessions from tests that did not log out, plus earlier Phase 5 attempts).

**C3-1 status: unchanged technical debt.** `npm run build` still warns: `The "middleware"
file convention is deprecated. Please use "proxy" instead.` `src/middleware.ts` was not
renamed.

#### Phase 5 deployed-target evidence — recorded 2026-09-01

Required target: `https://aisprint-quizmaker.akshaykumar.workers.dev`. Playwright **1.62.1**.
Specs do not query local D1.

| Step | Command | Observed result |
|---|---|---|
| RED (syntax) | `npx playwright test --config playwright.localhost.config.ts` | **Not meaningful RED** — extra `)` in a locator |
| RED (target) | same, after syntax fix | **7 failed (7)** — `net::ERR_CONNECTION_REFUSED` at `http://127.0.0.1:8787` (current config still pointed at local preview; preview was not running) |
| Config | `playwright.config.ts` | `baseURL` default is the workers.dev URL; **no `webServer`**; override via `PLAYWRIGHT_BASE_URL` |
| RED (E-8 on live Worker before code change) | `npx playwright test` | **6 passed, 1 failed** — E-8: page digest **894323915** instead of the duplicate-email message |
| RED (unit) | `npx vitest run` `auth-service.test.ts` unique-index case | **1 failed** — remote error `UNIQUE constraint failed: index 'idx_users_email'` was rethrown |
| GREEN (unit) | `npx vitest run` | **170 passed (170)**, 18 files |
| Lint / types / build | `npm run lint`; `npx tsc --noEmit`; `npm run build` | all **exit 0** |
| Deploy attempt 1 | `npm run deploy` | **FAILED** — Cloudflare API `503` listing deployments |
| Deploy attempt 2 | `npm run deploy` | **exit 0** — version `e815c589-68c0-4b52-84c0-a21b7d8f4abe` |
| GREEN (E2E, post-deploy) | `npx playwright test` | **7 passed (36.1s)** against workers.dev |

**E-1 through E-9 (post-deploy, workers.dev):**

| # | Result | How |
|---|---|---|
| E-1 | **PASS** | Combined browser spec: register → `/dashboard`, MCQ Home + name |
| E-2 | **PASS** | Same spec: login after logout → `/dashboard` |
| E-3 | **PASS** | Same spec: logout → `/login`; `/dashboard` → `/login` |
| E-4 | **PASS** | Wrong password → `Incorrect email or password.`, stays on `/login` |
| E-5 | **PASS** | Unauthenticated `/dashboard` → `/login` |
| E-6 | **PASS** | Authenticated `/dashboard` shows MCQ Home |
| E-7 | **PASS** | Signed-in `/login` and `/register` bounce to `/dashboard` |
| E-8 | **PASS** | Duplicate email shows `An account with this email already exists.` |
| E-9 | **PASS** | Replayed `quizmaker_session` after logout still sends `/dashboard` to `/login` (no local D1 read) |

Cookie values and passwords were asserted *absent* from the page; they were not printed in this evidence.

#### Phase 5 Process Deviations

- **D5-1: `GET /api/auth/clear-session` added so invalid cookies can be expired.**
  `cookies().delete()` inside `getCurrentUser()` (called from a Server Component) throws on
  the Workers/OpenNext runtime — Playwright saw **ERROR 511926584** / `GET /dashboard 500`.
  Leaving the cookie and redirecting to `/login` loops: middleware treats any present cookie
  as authenticated and bounces `/login` back to `/dashboard`. Middleware behavior is
  unchanged (Phase 3 tests require that bounce). The protected layout and dashboard page
  now redirect to the Route Handler; the user-visible destination remains `/login`.
- **D5-2: E-9 originally talked to local D1 via wrangler.** That helper is **removed**.
  The PRD’s E-9 proof is cookie replay after logout, which does not need a D1 count.
  Specs must not depend on the local database.
- **D5-3: Wrangler `--json` is pretty-printed.** Parsing only the first `[` line throws
  `Unexpected end of JSON input`. The helper now slices from the first `[`/`{` to the end.
- **D5-4: First Playwright invocation before install is not meaningful RED.** Same class of
  failure as earlier module-resolution RED attempts.
- **D5-5: An earlier `getCurrentUser()` cookie-delete was written, observed to 500, and
  reverted.** Cookie mutation belongs in a Route Handler or Server Action, not an RSC.
- **D5-6: No separate human visual pass.** Journeys are Playwright-driven.
- **D5-7: Playwright default target is the deployed Worker, not `npm run preview`.**
  This pass required workers.dev evidence. `webServer` was removed so the suite cannot
  silently start a local preview.
- **D5-8: `isDuplicateEmailError` also accepts the remote index-name form.** Remote
  `idx_users_email` is `ON users (lower(email))`, so D1 reports
  `UNIQUE constraint failed: index 'idx_users_email'` rather than `users.email`.
  Without that match, E-8 500’d on production (digest 894323915). Local unique-index
  wording is still accepted. Unrelated UNIQUE errors are still rethrown.

#### Phase 5 Concerns Requiring Review

- **C3-1 remains technical debt.** Middleware deprecation warning on every `next build`.
- **OpenNext on Windows.** Preview still prints that OpenNext is not fully compatible with
  Windows. Residual RISK-10. Preview did start and the E2E suite passed.
- **`/api/auth/clear-session` is a new public GET.** It only expires the cookie and
  redirects to `/login`. It does not delete a D1 row (logout already does that). Worth
  reviewing whether it should be POST-only; GET is what a Server Component `redirect()`
  can issue.
- **Success metrics that require 10/10 manual attempts stay NOT MEASURED.** Playwright
  proved each scenario once per suite run, not ten independent manual trials.
- Worker deploy was later requested explicitly and executed — see Phase 6.

### Phase 6 — Deployment - COMPLETE (no further deploy; migration history left unaligned)

**Objective:** Production release.

The original plan said every step here is performed by the human and that the agent must
not run `npm run deploy`. On 2026-09-01 the user explicitly requested `npm run deploy`.
A later request asked the agent to fix the production register 500. Targeted remote DDL
was applied. `wrangler d1 migrations apply --remote` of local 0001 was **not** run.

A follow-up reconciliation pass (same date) inspected remote history, remaining deploy
warnings, and the local-vs-remote filename clash. **No second deploy. No remote
`migrations apply`. No production DDL.** Production auth already works; forcing
`d1_migrations` into alignment is optional human bookkeeping, not a runtime fix.

#### Phase 6 Evidence — recorded 2026-09-01 (agent-observed; user requested deploy)

| Field | Value |
|---|---|
| Deployment date | 2026-09-01 |
| Environment | Cloudflare Workers production (account `16590d7f308b6257ba2dc7cb69a23c6e`) |
| Command | `npm run deploy` |
| Worker name | `aisprint-quizmaker` |
| Deployed URL | `https://aisprint-quizmaker.akshaykumar.workers.dev` |
| Version ID (first deploy) | `e8a1bdbc-ca96-4a8b-b444-e58e2f5a41c3` |
| Version ID (after D1 repair) | `31bfa4df-0079-4f1e-ac2b-413656af46d2` |
| Version ID (latest recorded — Phase 5 E-8 fix deploy) | `e815c589-68c0-4b52-84c0-a21b7d8f4abe` |
| Pre-deploy tests | `npm test` → **169 passed (169)**, 18 files |
| Pre-deploy lint | `npm run lint` → **exit 0** |
| Pre-deploy types | `npx tsc --noEmit` → **exit 0** |
| Pre-deploy build | `npm run build` → **exit 0**, compiled in 9.3s |
| Deploy result | **exit 0.** `Deployed aisprint-quizmaker triggers` → the workers.dev URL above |
| Bindings in deploy output | `env.DB (aisprintquiz-db)` D1; `env.ASSETS` Assets. Not the local preview DB |

**Runtime verification against the deployed URL (curl, no local preview):**

| Check | Result |
|---|---|
| Worker responding | **PASS** — `Server: cloudflare`, `CF-RAY`, `x-opennext: 1` |
| `GET /` unauthenticated | **307** `Location: /login` |
| `GET /login` | **200**, heading **Sign in** |
| `GET /register` | **200**, **First name** field present |
| `GET /dashboard` unauthenticated | **307** `Location: /login` |
| `GET /login` + forged cookie | **307** `Location: /dashboard` (middleware cookie-presence) |
| `GET /api/auth/clear-session` + forged cookie | **307** to `/login`, expires `quizmaker_session` |
| `GET /dashboard` + forged cookie (before repair) | **500** — no `sessions` table |
| `GET /dashboard` + forged cookie (after repair) | Redirects via `getCurrentUser` / clear-session; no 500 on missing username |
| S-1..S-8 after repair | **PASS** — browser smoke on the workers.dev URL, 2026-09-01 |

**Remote D1 after repair (2026-09-01):**

- Database: `aisprintquiz-db` / `b7047c55-895d-4772-bc09-81c22e3a862d`
- `users` no longer has `username`; `sessions` exists with `user_id` / `expires_at` indexes
- `d1_migrations` still lists only `0001_create_users_table.sql` (name clash with local
  `0001_create_users_and_sessions.sql` is unresolved)
- Live register wrote `phase4-fix+1788264594690@example.test` with `pbkdf2$100000$…`
- After logout, `sessions` count was **0**

**Production smoke test (S-1..S-8):**

| # | Check | Status |
|---|---|---|
| S-1 | Register a new account | **PASS** |
| S-2 | Registration succeeds, session created | **PASS** (httpOnly cookie + D1 user row) |
| S-3 | Log out, then log in | **PASS** |
| S-4 | Login succeeds | **PASS** |
| S-5 | Login redirects to `/dashboard` | **PASS** |
| S-6 | `/dashboard` is protected when signed out | **PASS** (GET 307 `/login`) |
| S-7 | Logout works | **PASS** |
| S-8 | Post-logout `/dashboard` → `/login` | **PASS** |

#### Phase 6 Process Deviations

- **D6-1: Agent ran `npm run deploy` after an explicit user request.** The original Phase 6
  text said the agent never runs that command. The request overrides that hold for this
  deploy only. Remote migrations remain unapplied.
- **D6-2: Remote D1 schema drifted from local 0001.** First deploy: `users.username`
  NOT NULL and no `sessions`. Register threw (digest 4068762763). Repair was targeted
  remote DDL plus local-only 0002, **not** `migrations apply --remote` of 0001.
- **D6-3: Working tree already contained Phase 5 files** (Playwright, `/api/auth/clear-session`).
  This task did not start Phase 5, did not install Playwright, and did not add features.
  The uploaded Worker is the current tree, not a Phase-4-only snapshot.
- **D6-4: Remote `d1_migrations` was not rewritten during reconciliation.** Production
  schema already supports auth. Auto-inserting local filenames into `d1_migrations` would
  only change Wrangler bookkeeping. That write was left as an explicit human action so a
  working production database is not modified unless the operator chooses to.

#### Phase 6 Reconciliation — recorded 2026-09-01 (no deploy)

Read-only remote inspect of `aisprintquiz-db` / `b7047c55-895d-4772-bc09-81c22e3a862d`:

| Check | Result |
|---|---|
| `d1_migrations` | One row: `0001_create_users_table.sql` (`applied_at` 2026-08-27 08:45:57) |
| Application tables | `users`, `sessions` |
| Indexes | `idx_users_email` on `users (lower(email))`; `idx_sessions_user_id`; `idx_sessions_expires_at` |
| `users` columns | `id`, `first_name`, `last_name`, `email`, `password_hash`, `created_at` DATETIME, `updated_at` DATETIME. **No `username`.** |
| `sessions` columns | `id`, `user_id` → `users(id)` ON DELETE CASCADE, `expires_at` INTEGER, `created_at` INTEGER unixepoch |
| Local `migrations list --local` | No migrations to apply (0001 + 0002 already local) |
| Remote `migrations list --remote` | **Would apply** `0001_create_users_and_sessions.sql` and `0002_align_remote_sessions.sql` |

**Decision: do not apply those pending files remotely.** Local 0001 is `CREATE TABLE users`
without `IF NOT EXISTS`. Remote `users` already exists. Applying it would fail and must
never be used to reconcile history. Local 0002 is `CREATE TABLE IF NOT EXISTS sessions`
and is unnecessary on production (sessions already exists).

**Acceptable remaining schema drift (app does not depend on these matching):**

- Remote unique index is `ON users (lower(email))`; local 0001 is `ON users (email)`.
  Application already normalizes email before insert/lookup, and `isDuplicateEmailError()`
  matches both `users.email` and `index 'idx_users_email'`.
- Remote `users.created_at` / `updated_at` are DATETIME defaults; local 0001 uses INTEGER
  unixepoch. Auth code never reads those columns.

**Human-only bookkeeping (optional; not required for auth to keep working):**

If an operator later wants `wrangler d1 migrations apply --remote` to be a no-op, they
must insert metadata rows **without running the SQL files**. Exact statements are in
`scripts/reconcile-remote-d1-migration-history.sql`:

```sql
INSERT INTO d1_migrations (name) VALUES ('0001_create_users_and_sessions.sql');
INSERT INTO d1_migrations (name) VALUES ('0002_align_remote_sessions.sql');
```

Until those rows exist, **never** run `wrangler d1 migrations apply --remote`. Until then,
`migrations list --remote` will continue to show 0001 and 0002 as pending. That listing is
a Wrangler history mismatch, not a missing production table.

**What changed in the reconciliation pass:** comments on local 0001/0002; new
`scripts/reconcile-remote-d1-migration-history.sql`; this PRD section. No application
code, no `wrangler.jsonc` change, no auth behavior change, no production write.

**Why:** production is already working. Preserving that state is more important than
forcing Wrangler history to match local filenames.

**Tests performed:** local `npm test`, `npm run lint`, `npx tsc --noEmit`, and
`npm run build` after the documentation/comment changes (results in the verification
table below). The reconciliation documentation pass did not repeat production S-1..S-8
and did not upload a new Worker. **The final recorded S-1..S-8 results remain PASS**
(post-repair production smoke, table above). **The final recorded E-1..E-9 results
remain PASS** on workers.dev after version `e815c589-68c0-4b52-84c0-a21b7d8f4abe`.

**Remaining risks:** a future `migrations apply --remote` before the human INSERTs
would attempt local 0001 and fail. C3-1 remains a Next 16 deprecation warning only.

#### Phase 6 reconciliation verification (local, after doc/comment changes)

| Command | Result |
|---|---|
| `npm test` | **170 passed (170)**, 18 files |
| `npm run lint` | **exit 0** |
| `npx tsc --noEmit` | **exit 0** |
| `npm run build` | **exit 0**, compiled in 9.3s. Routes unchanged. C3-1 warning and `Using secrets defined in .dev.vars` still printed. `ƒ Proxy (Middleware)` still present. |

#### Phase 6 Concerns — reviewed 2026-09-01

- **Remote vs local migration filenames — documented, not force-aligned.** Production
  schema is already repaired. History alignment is optional human `d1_migrations` INSERTs.
  Local 0001/0002 now carry comments that they must not be applied remotely.
- **C3-1 middleware deprecation — deferred.** Next.js 16 warns that `middleware.ts` should
  become `proxy`. The Phase 3 brief and this PRD require `src/middleware.ts` /
  `export function middleware`. The build still works (`ƒ Proxy (Middleware)`). Renaming
  is not required for Phase 6 and would be a later-phase convention change with tests
  first. **Do not rename in this sprint unless a later brief explicitly requires it.**
- **OpenNext Windows warning — informational only.** `WARN OpenNext is not fully
  compatible with Windows` is residual RISK-10. Preview and the production Worker already
  run. No code or config change.
- **`Using secrets defined in .dev.vars` — expected local Wrangler/OpenNext message.**
  `.dev.vars` is gitignored (`.dev.vars*` with `!.dev.vars.example`). It is a local-dev
  secrets file; Wrangler does not treat it as the production secret store. Sprint 1
  introduces no auth secrets (RESOLVED-3). `.dev.vars.example` only documents
  `NEXTJS_ENV=development`. Values were not inspected, printed, or committed. No
  `wrangler secret put` and no wrangler.jsonc vars change are required. Future deploys
  should keep using the dashboard / `wrangler secret` for any real production secrets;
  do not add application secrets to `.dev.vars` expecting them to become production
  bindings.

---

## Technical Implementation Details

### Key Files

| Path | Purpose |
|---|---|
| `src/lib/d1-client.ts` | **Centralized D1 access.** The only module reaching `env.DB`. The mock seam for all tests. |
| `src/lib/auth/password.ts` | PBKDF2 hash and verify; encodes/parses `pbkdf2$...` |
| `src/lib/auth/session.ts` | Session id generation, creation, lookup with expiry, deletion |
| `src/lib/auth-constants.ts` | `SESSION_COOKIE_NAME`, `SESSION_CLEAR_PATH` |
| `src/lib/session.ts` | `getCurrentUser()` — the authorization primitive |
| `src/lib/services/auth-service.ts` | Register and login domain logic |
| `src/lib/schemas/auth-schema.ts` | Zod schemas shared by client forms and Server Actions |
| `src/lib/actions/auth-actions.ts` | `registerAction`, `loginAction`, `logoutAction`, cookie set/clear |
| `src/app/page.tsx` | Root route; redirects by authentication state |
| `src/app/(auth)/layout.tsx` | Bounces authenticated users to `/dashboard` |
| `src/app/(protected)/layout.tsx` | **Authoritative protection** — `getCurrentUser()` or redirect to `/api/auth/clear-session` |
| `src/app/api/auth/clear-session/route.ts` | Expires `quizmaker_session` (allowed in a Route Handler) and redirects to `/login` |
| `src/app/(auth)/register/page.tsx` | Register page (Server Component) |
| `src/app/(auth)/login/page.tsx` | Login page (Server Component) |
| `src/app/(protected)/dashboard/page.tsx` | Protected dashboard |
| `src/components/auth/register-form.tsx` | `'use client'` register form |
| `src/components/auth/login-form.tsx` | `'use client'` login form |
| `src/components/auth/logout-button.tsx` | `'use client'` logout control |
| `src/middleware.ts` | Cookie-presence redirects only. Must live under `src/`, not the repo root — see D3-3. Deprecated convention in Next 16 — see C3-1. |
| `migrations/0001_create_users_and_sessions.sql` | Initial schema (applied locally). **Never apply remotely.** |
| `migrations/0002_align_remote_sessions.sql` | Local-safe `sessions` IF NOT EXISTS. **Do not apply remotely.** |
| `scripts/reconcile-remote-d1-migration-history.sql` | Optional human-only `d1_migrations` INSERTs. Not executed in Phase 6. |
| `vitest.config.mts` | Vitest with the React plugin and jsdom; excludes the E2E directory (D-3) |
| `playwright.config.ts` | Playwright against the deployed Worker (`workers.dev`); optional `PLAYWRIGHT_BASE_URL` |
| `e2e/auth.spec.ts` | Automated E2E scenarios E-1..E-9 |

### Implementation Patterns

**D1 access — positional placeholders, `all()` not `first()`:**

```typescript
// Illustrative shape only. Positional ?1/?2 placeholders, never string concatenation.
// all().results[0] is used because first() behaves inconsistently between local and remote.
const { results } = await db
  .prepare("SELECT id, first_name, last_name, email FROM users WHERE email = ?1")
  .bind(normalizedEmail)
  .all<UserRow>();

const user = results[0] ?? null;
```

**Binding access:**

```typescript
const { env } = getCloudflareContext();
// env.DB — typed after `npm run cf-typegen`
```

**Redirect placement in a Server Action:**

```typescript
// redirect() throws a control-flow signal. Inside a try/catch it would be swallowed
// and reported as a failure, so it must be called after the try block.
let userId: string;
try {
  userId = await registerUser(input);
} catch (error) {
  return toFieldErrors(error);
}
await createSessionAndSetCookie(userId);
redirect("/dashboard");
```

### Important Notes

- **`crypto.subtle.timingSafeEqual` is Workers-only.** It does not exist in Node, so using it
  would break the Vitest suite. Use a portable fixed-length XOR-accumulating comparison.
- **PBKDF2 iterations are capped at 100,000 by workerd.** Higher values throw
  `NotSupportedError` on Workers but succeed in Node, so tests cannot catch the mistake.
- **`redirect()` throws.** Never call it inside `try/catch`.
- **Normalize email in exactly one place** and call it from both the write and read paths.
  Two copies of `.trim().toLowerCase()` will eventually diverge and quietly defeat the
  unique index.
- **Cookie `maxAge` and `expires_at` derive from one computed value.**
- **`secure: true` breaks local `http://localhost` login.** Condition it on production.
- **Never import `d1-client` into a `'use client'` component.**
- **Middleware must not query D1.**

### Known Limitations

- PBKDF2 at 100,000 iterations is below OWASP's 600,000 recommendation, forced by the
  workerd ceiling.
- Session identifiers are stored unhashed; database read access permits impersonation until
  expiry.
- No login rate limiting; nothing impedes credential stuffing.
- Login timing is equalized by a dummy derivation, which narrows rather than eliminates the
  enumeration signal.
- No email verification, so addresses are unproven.

---

## Acceptance Criteria

### Registration

- [x] A registration form exists at `/register` with first name, last name, email, password, and confirm password
- [x] Client-side validation reports required fields, invalid email, short password, and password mismatch before submission
- [x] Server-side Zod validation independently rejects the same invalid input
- [x] Password confirmation is enforced on the server, not only in the browser
- [x] A duplicate email is rejected with exactly `An account with this email already exists.`
- [x] No plaintext password is stored anywhere in D1, verified by inspecting the `users` table
- [x] `password_hash` matches `pbkdf2$<iterations>$<salt>$<hash>` with iterations = 100,000
- [x] Each user has a unique salt
- [x] A session row is created on successful registration
- [x] Successful registration redirects to `/dashboard`

### Login

- [x] Valid credentials authenticate successfully
- [x] Invalid credentials fail to authenticate
- [x] Wrong password and unknown email produce the identical generic error
- [x] Nothing in the response reveals whether an email is registered
- [x] A session row is created on successful login
- [x] Successful login redirects to `/dashboard`

### Logout

- [x] A signed-in user has a visible logout control on `/dashboard`
- [x] Logout deletes the session row from D1, confirmed by inspecting the table
- [x] Logout clears the `quizmaker_session` cookie
- [x] Logout redirects to `/login`
- [x] The old session id cannot be reused; replaying the cookie value fails (E-9)
- [x] `/dashboard` is protected after logout
- [x] Missing, invalid, and expired sessions are all treated as logged out with no error page

### Route Protection

The four routing criteria were PARTIAL after Phase 4. Phase 5 Playwright ran the
authenticated browser journeys against `npm run preview` and then against the deployed
Worker, so they are now PASS.

- [x] Unauthenticated `/dashboard` redirects to `/login` — PASS: E-5 plus curl 307 `/login`
- [x] Authenticated `/dashboard` is accessible — PASS: E-1 / E-6, live session, **MCQ Home**
- [x] Authenticated `/login` redirects to `/dashboard` — PASS: E-6 after a real registration
- [x] Authenticated `/register` redirects to `/dashboard` — PASS: E-7 after a real registration
- [x] Middleware performs cookie-presence checks only and issues no D1 query — PASS:
  asserted directly against mocked `queryAll`/`queryOne`/`execute`, `getSessionUser`, and
  `getCurrentUser`, none of which are called
- [x] A forged cookie passes middleware and is rejected by `getCurrentUser()` — PASS: unit
  tests plus Playwright forged-cookie spec and curl 307 `/api/auth/clear-session` → `/login`

### Dashboard

- [x] Displays the authenticated user's name
- [x] Provides a logout control
- [x] Contains placeholder content only
- [x] Contains no quiz authoring and no links to any

### Security

- [x] PBKDF2 via Web Crypto is the hashing mechanism
- [x] No plaintext passwords are stored or logged
- [x] Session identifiers are opaque, random, and carry no information
- [x] The session cookie is `httpOnly`
- [x] Login errors are generic
- [x] Every Server Action validates input with Zod before use
- [x] All D1 queries use prepared statements
- [x] All D1 queries use positional placeholders `?1`, `?2`
- [x] No query is built by concatenating user input
- [x] Session identifiers and password hashes never reach the client

### Testing

- [x] RED evidence recorded for every phase
- [x] GREEN evidence recorded for every phase
- [x] Regression evidence recorded for every phase
- [x] Any phase without demonstrable RED is recorded as a process deviation
- [x] Unit tests pass
- [x] Server Action tests pass
- [x] Component tests pass
- [x] Playwright E2E suite passes — first against `npm run preview` (**7/7**, 23.9s),
  then against the deployed Worker (**7/7**, 36.1s, version `e815c589-68c0-4b52-84c0-a21b7d8f4abe`)
- [x] `npm run lint` clean
- [x] `npm run build` succeeds
- [x] Workers runtime verification via `npm run preview` passes — live register/login/logout
  POSTs exercised by Playwright, not GET-only

---

## Success Metrics

**No metric may be marked PASS until it has actually been measured.** Unmeasured entries stay
`NOT MEASURED`. Timing metrics in particular must not be marked achieved by inspection.

| Metric | Target | How Measured | Status |
|---|---|---|---|
| Registration success | Valid submission creates exactly one user with a session, 10/10 attempts | Manual E-1 runs plus `users`/`sessions` inspection | **NOT MEASURED** — Playwright E-1 passed; 10/10 manual trials were not run |
| Login success | Valid credentials authenticate, 10/10 attempts | Manual E-2 runs | **NOT MEASURED** — Playwright E-2 passed; 10/10 manual trials were not run |
| Logout success | Session row deleted and cookie cleared, 10/10 attempts | E-3 plus table inspection | **NOT MEASURED** — Playwright E-3 passed; production logout also covered by S-7 and cookie-replay E-9; 10/10 manual trials were not run |
| Post-logout invalidation | Replayed cookie rejected, 10/10 attempts | E-9 | **NOT MEASURED** — Playwright E-9 passed once per suite; not 10/10 |
| Protected-route behavior | All four redirect rules hold, 100% | E-5, E-6, E-7 | **PASS** — Playwright E-5/E-6/E-7, 2026-09-01 |
| Duplicate-email rejection | 0 duplicate accounts created | E-8 plus unique index verification | **PASS** — Playwright E-8, specified message, unique index already local |
| Unit test pass rate | 100% of U-1..U-20 | `npx vitest run` output | **PASS** — included in latest recorded **170/170**, 18 files, 2026-09-01 (earlier Phase 5 snapshot was 169/169 before the remote unique-index unit case) |
| Server Action test pass rate | 100% of A-1..A-16 | `npx vitest run` output | **PASS** — included in latest recorded **170/170**, 18 files, 2026-09-01 |
| Component test pass rate | 100% of C-1..C-10 | `npx vitest run` output | **PASS** — included in latest recorded **170/170**, 18 files, 2026-09-01 |
| E2E pass rate | 100% of E-1..E-9 | `npx playwright test` against the deployed Worker | **PASS** — 7/7, 36.1s, workers.dev, version `e815c589-68c0-4b52-84c0-a21b7d8f4abe`, 2026-09-01 |
| Production smoke-test pass rate | 100% of S-1..S-8 | Manual, by the user | **PASS** — S-1..S-8 on workers.dev after remote D1 repair, 2026-09-01 |
| Plaintext password occurrences | Exactly 0 | Direct D1 inspection | **PASS** — local `users.password_hash` is `pbkdf2$100000$...` only |

---

## Dependencies

### Production Dependency (installed)

| Package | Purpose |
|---|---|
| `zod` | Server-side validation of all Server Action input; shared with client forms. Required by `.cursor/rules/nextjs.mdc`. Added explicitly in Phase 1. |
| `react-hook-form` | Client forms (Phase 4, D4-1, user-directed) |
| `@hookform/resolvers` | `zodResolver` for the shared Zod schemas (Phase 4, D4-1) |

### Development / Test Dependencies (installed)

| Package | Purpose |
|---|---|
| `vitest` | Test runner for unit, Server Action, and component tests |
| `@vitejs/plugin-react` | JSX/React transform for component tests |
| `jsdom` | DOM environment for component tests |
| `@testing-library/react` | Rendering and querying components as a user sees them |
| `@testing-library/user-event` | Realistic typing and clicking in form tests |
| `@testing-library/jest-dom` | DOM matchers (`toBeInvalid`, `toHaveTextContent`) |
| `@playwright/test` | Automated browser E2E for scenarios E-1..E-9 against the Workers runtime (RESOLVED-2) |

Component testing is required because client-side validation is explicitly in scope. E2E
testing is automated because the full authentication journey crosses boundaries no unit or
component test can reach — real cookies, real redirects, real D1, real workerd.

`@playwright/test` additionally requires a one-time `npx playwright install` to download
browser binaries. That is a tool download rather than a package dependency, but it is a
prerequisite for the suite to run and is part of Phase 5 setup.

These packages are installed. Do not add further dependencies without asking.

### Configuration Changes Required

- `package.json` — `test`, `test:watch`, and `e2e` scripts are present.
  (`package-lock.json` is generated and must not be hand-edited.)
- `vitest.config.mts` — React plugin, setup file for `jest-dom`, E2E directory excluded
  (D-3: `.mts` not `.ts`).
- `playwright.config.ts` — final default `baseURL` is the deployed Worker
  (`https://aisprint-quizmaker.akshaykumar.workers.dev`); **no `webServer`** (D5-7).
  Override with `PLAYWRIGHT_BASE_URL`. Unique emails per run.
- `.gitignore` — Playwright's `test-results/` and `playwright-report/` output.
- `wrangler.jsonc` — `d1_databases` binding for `aisprintquiz-db` is present.
- `cloudflare-env.d.ts` — regenerated via `npm run cf-typegen`. **Never hand-edited.**

### Infrastructure Dependencies

| Resource | Value |
|---|---|
| D1 database name | `aisprintquiz-db` |
| D1 database ID | `b7047c55-895d-4772-bc09-81c22e3a862d` |
| Binding name | `DB` |

The database already exists and was verified manually by the user. **No new D1 database is to
be created.** Remote D1 operations remain human-controlled.

### Environment Variables

**None.** Opaque D1 sessions require no signing secret, so no new entry is added to
`.dev.vars` or `.dev.vars.example`, and no `wrangler secret put` is required for deployment
(RESOLVED-3).

---

## Risks and Mitigation

### Technical Risks

**RISK-1: D1 binding misconfiguration**
The binding must be named `DB` and point at `b7047c55-895d-4772-bc09-81c22e3a862d`. A wrong
or missing binding surfaces as `env.DB is undefined` at runtime, not at build time.
*Mitigation:* add the binding, run `npm run cf-typegen`, confirm `DB` appears in
`cloudflare-env.d.ts`, and verify a query works under `npm run preview` before building on
top of it.

**RISK-2: Local versus remote D1 divergence**
`--local` uses a Miniflare SQLite file; remote is the real database. Schema applied locally
does not exist remotely. Development can look complete while production has no tables.
*Mitigation:* remote schema for Sprint 1 was repaired by targeted DDL, then verified by
S-1..S-8. Do **not** assume `wrangler d1 migrations list --remote` being non-empty means
tables are missing. Until a human inserts the local 0001/0002 names into remote
`d1_migrations`, `apply --remote` is unsafe and must not be run.

**RISK-3: Migration problems**
A partly-applied or hand-edited migration leaves the schema in an unknown state.
*Mitigation:* every schema change is a migration file created with
`wrangler d1 migrations create`. Local databases can be deleted and rebuilt; remote cannot.
**Exception (D6-2):** production was repaired with targeted remote DDL because applying
local `0001_create_users_and_sessions.sql` remotely was unsafe. Do not treat that repair
as permission to apply local 0001 remotely.

**RISK-4: Session expiration bugs**
Comparing epoch seconds against milliseconds is off by a factor of 1000 — sessions expire
instantly or effectively never.
*Mitigation:* one helper produces "now" in epoch seconds and is used everywhere. U-13 and
U-15 assert the boundary directly, including a session that expired one second ago.

**RISK-5: Cookie misconfiguration**
`secure: true` on `http://localhost` means the browser silently discards the cookie: login
appears to succeed, then the dashboard redirects straight back to login with no error.
`sameSite` and `path` errors produce similar ghosts.
*Mitigation:* condition `secure` on production. TROUBLE-5 documents the symptom, because it
presents as a redirect loop rather than a cookie problem.

**RISK-6: PBKDF2 iteration ceiling on Workers**
workerd hard-rejects PBKDF2 iterations above 100,000 with `NotSupportedError`. Node has no
such limit, so an over-target value passes every unit test and throws on the first real
registration in production.
*Mitigation:* pin 100,000 as a named constant, assert it in U-4, and exercise real
registration under `npm run preview` in Phase 5. Accepted limitation: this is below OWASP's
600,000 recommendation and is a constraint of hashing on Workers.

**RISK-7: Authentication security defects**
Session fixation, enumeration via error differences, timing leaks, or hashes escaping to the
client.
*Mitigation:* generic login errors, a dummy derivation on the unknown-email path, explicit
column lists instead of `SELECT *`, `getCurrentUser()` never returning `password_hash`, and
`httpOnly` cookies. Residual risks are listed under Known Limitations rather than claimed as
solved.

**RISK-8: Workers versus Node runtime differences**
The whole suite runs on Node against a mocked `d1-client`. Two concrete traps:
`crypto.subtle.timingSafeEqual` exists on Workers but not Node, and the PBKDF2 cap exists on
Workers but not Node. Each fails in exactly one environment, and the suite covers the other.
*Mitigation:* use only portable Web Crypto APIs, and treat `npm run preview` as a mandatory
gate rather than a formality. A green suite is necessary but not sufficient.

**RISK-9: OpenNext / Cloudflare compatibility**
Server Actions, `cookies()`, and `redirect()` are adapted onto Workers by OpenNext. Behavior
can differ from `next dev` on Node.
*Mitigation:* verify every cookie and redirect path under `npm run preview`, not just
`npm run dev`. Keep `nodejs_compat` in `compatibility_flags`.

**RISK-10: Windows / OpenNext compatibility**
Development is on Windows. OpenNext builds and Wrangler local D1 have historically hit
path-separator and symlink issues on Windows that do not occur on macOS or Linux.
*Mitigation:* run `npm run preview` early in Phase 1, right after the binding is added,
rather than discovering a Windows-specific build failure in Phase 5 with everything already
written. If the local Workers runtime proves unusable on Windows, report it rather than
working around it silently.

**RISK-11: Dependency and version issues**
Vitest with React 19 and Next 16 needs a matching `@vitejs/plugin-react` and correct jsdom
setup; a mismatch produces confusing transform errors that look like test failures.
*Mitigation:* install the test dependencies and get one trivial test green before writing
real tests, so configuration problems are isolated from behavioral ones.

**RISK-12: Production configuration drift**
Sprint 1 needs **no secrets and no environment variables** (RESOLVED-3), so the classic
"forgot to set the production secret" failure does not apply. The residual risk is different:
production depends entirely on the `DB` binding resolving to `aisprintquiz-db` and on the
remote schema having been migrated. Both are silent until the first request touches the
database.
*Mitigation:* the Phase 6 smoke test begins with a registration, which exercises the binding
and both tables immediately. A missing remote migration therefore surfaces on check S-1
rather than reaching a teacher. Do not reintroduce an unused secret; if a later sprint needs
one, it belongs in that sprint's PRD with a stated purpose.

**RISK-16: Playwright environment and flakiness**
Playwright adds a browser download (~400MB via `npx playwright install`), needs a running
`npm run preview` server, and on Windows has historically hit browser-launch and path issues
that do not occur on macOS or Linux. Authentication E2E is also inherently flake-prone:
redirects and cookie writes are asynchronous, so assertions that race the navigation fail
intermittently and erode trust in the suite.
*Mitigation:* install Playwright and get one trivial navigation spec green **before** writing
the nine auth scenarios, so environment problems are isolated from test-logic problems. Use
Playwright's auto-waiting assertions and `waitForURL` rather than fixed sleeps. Generate a
unique email per run so specs are re-runnable against a persistent local database. If
Playwright proves unworkable on Windows, report it rather than silently falling back to a
manual checklist.

### User Experience Risks

**RISK-13: Client and server validation disagree**
Duplicated validation rules drift, so the browser accepts what the server rejects.
*Mitigation:* one Zod schema module imported by both.

**RISK-14: Generic login errors confuse legitimate users**
"Incorrect email or password" is deliberately unhelpful, and a teacher who mistyped their
email cannot tell which field is wrong.
*Mitigation:* accepted — the enumeration protection is worth it. Client-side format
validation catches malformed emails before submission, which handles the most common typo.

**RISK-15: Silent session expiry**
A teacher returning after seven days is bounced to login with no explanation and may believe
their account was deleted.
*Mitigation:* out of scope for Sprint 1 (it needs a message-passing mechanism through the
redirect). Noted as a UX gap. The behavior itself — treat as logged out, redirect, no error
page — is correct per requirements.

---

## Troubleshooting Guide

Populated during implementation as real problems occur. Pre-seeded with the failures this
design is most likely to produce.

### TROUBLE-1: `env.DB is undefined`
**Problem:** Any query throws because the binding is missing.
**Cause:** No `d1_databases` block in `wrangler.jsonc`, a binding name other than `DB`, or
`cf-typegen` not run after adding it.
**Solution:** Add the binding for `aisprintquiz-db` with `database_id`
`b7047c55-895d-4772-bc09-81c22e3a862d` and `binding: "DB"`. Run `npm run cf-typegen`. Confirm
`DB` appears in `cloudflare-env.d.ts`. Access it via `getCloudflareContext()`, never a global
`env`.

### TROUBLE-2: `no such table: users` locally
**Problem:** Queries fail against the local database.
**Cause:** The migration was created but never applied locally, or applied to a different
database name.
**Solution:** `npx wrangler d1 migrations apply aisprintquiz-db --local`. Verify with
`npx wrangler d1 migrations list aisprintquiz-db`. **Never** apply with `--remote`.

### TROUBLE-3: D1 placeholder binding errors
**Problem:** `Wrong number of parameter bindings` or values landing in the wrong columns.
**Cause:** Mixing anonymous `?` with numbered `?1`, or numbering that does not match
`.bind()` order.
**Solution:** Use `?1`, `?2` exclusively. `.bind()` arguments are positional and must match
the numbering exactly.

### TROUBLE-4: Session lookup always returns null
**Problem:** Login succeeds but the dashboard bounces back to login.
**Cause:** The cookie value and `sessions.id` differ (encoding mismatch), or the cookie was
never set because `redirect()` ran before the cookie write, or the row was written to a
different local database.
**Solution:** Compare the cookie value in devtools against the `sessions` table. Confirm the
cookie is set before `redirect()` is called. Confirm both operations hit the same database.

### TROUBLE-5: Login "succeeds" then immediately redirects back to login
**Problem:** A redirect loop between `/login` and `/dashboard` with no error shown.
**Cause:** Most often `secure: true` on the cookie over `http://localhost` — the browser
discards it silently, so the next request arrives with no cookie. Also caused by a `path`
narrower than `/`.
**Solution:** Set `secure` only in production. Check Application → Cookies in devtools: if
`quizmaker_session` is absent right after a successful login, the cookie was rejected, not
lost.

### TROUBLE-6: Sessions expire immediately or never
**Problem:** Every request is unauthenticated, or expiry has no effect.
**Cause:** Milliseconds versus epoch seconds. `Date.now()` returns milliseconds;
`unixepoch()` returns seconds.
**Solution:** One helper for "now in seconds", used by both the writer and the comparator.
Verify `expires_at - created_at === 604800`.

### TROUBLE-7: `NotSupportedError` from `crypto.subtle.deriveBits`
**Problem:** Registration throws on Workers while unit tests pass.
**Cause:** PBKDF2 iterations above workerd's 100,000 ceiling.
**Solution:** Cap at 100,000. This is the canonical example of a defect that only the
Workers-runtime check catches. See RISK-6.

### TROUBLE-8: `crypto.subtle.timingSafeEqual is not a function` in tests
**Problem:** Unit tests fail while the app works under `preview`.
**Cause:** `timingSafeEqual` is a Cloudflare extension absent from Node.
**Solution:** Replace it with a portable constant-time comparison. See RISK-8.

### TROUBLE-9: Build or deployment failure
**Problem:** `npm run build` or `opennextjs-cloudflare build` fails.
**Cause:** A Node-only API in code that reaches the Workers bundle, `nodejs_compat` missing,
or a Windows path issue.
**Solution:** Confirm `nodejs_compat` is in `compatibility_flags`. Check for `fs` or native
module imports. Reproduce with `npm run preview` before deploying. Deployment itself is
human-controlled.

### TROUBLE-10: Redirects not working from a Server Action
**Problem:** A redirect silently fails, or an error surfaces as a form error.
**Cause:** `redirect()` throws a control-flow signal and was called inside `try/catch`, so
the catch swallowed it.
**Solution:** Call `redirect()` after the try block, on the success path only.

### TROUBLE-11: Component tests fail to render
**Problem:** JSX transform errors, `document is not defined`, or missing matchers.
**Cause:** `vitest.config.mts` missing `@vitejs/plugin-react`, environment not set to `jsdom`,
or the `jest-dom` setup file not registered.
**Solution:** Configure all three. Get one trivial rendering test green before writing real
component tests.

### TROUBLE-12: Playwright E2E fails on the second run
**Problem:** The registration spec passes once, then fails with
`An account with this email already exists.` on every subsequent run.
**Cause:** A hardcoded fixture email. The local D1 database persists between runs, so the
account created by the first run is still there.
**Solution:** Generate a unique local-part per run, for example
`teacher+${Date.now()}@example.test`. Do not "fix" this by deleting the database between
runs — the duplicate-email constraint working correctly is the thing being tested in E-8.

### TROUBLE-13: Playwright cannot reach the app / `webServer` times out
**Problem:** Specs fail immediately with a connection error, or Playwright times out waiting
for the server.
**Cause:** `npm run preview` builds before it serves and is much slower to start than
`next dev`, so the default `webServer.timeout` expires. Or the configured port does not match
the port the preview server actually chose.
**Solution:** Raise `webServer.timeout` to accommodate the OpenNext build, and confirm the
`baseURL` matches the preview server's port. Do not switch the target to `npm run dev` — that
would move E2E off the Workers runtime and defeat its purpose.

### TROUBLE-14: Vitest tries to run the Playwright specs
**Problem:** `npx vitest run` fails with errors about `@playwright/test` imports or a missing
`test` export.
**Cause:** Vitest's default include pattern picks up `e2e/*.spec.ts`.
**Solution:** Exclude the E2E directory in `vitest.config.mts`. The two runners must not
collect each other's files.

### TROUBLE-15: Mocked `d1-client` not intercepting
**Problem:** Unit tests attempt real database access.
**Cause:** Something imports `env.DB` directly instead of going through `d1-client`, or the
mock path does not match the import path.
**Solution:** Confirm every query goes through `src/lib/d1-client.ts`. A direct `env.DB` call
anywhere defeats the mock seam and makes that code untestable — this is why the centralized
client is an architectural requirement, not a preference.

### TROUBLE-16: Forged session cookie 500s or redirect-loops
**Problem:** `GET /dashboard` with `quizmaker_session=forged-value` returns 500
(`ERROR 511926584`, "This page couldn’t load") or the browser hits too many redirects.
**Cause:** Two stacked constraints. (1) `cookies().delete()` is not allowed in a Server
Component, so clearing the cookie inside `getCurrentUser()` throws on Workers/OpenNext.
(2) Middleware only checks cookie presence. If the protected layout redirects to `/login`
while the invalid cookie remains, middleware bounces the browser back to `/dashboard`.
**Solution:** Do not mutate cookies in `getCurrentUser()`. Redirect an unauthorized
protected request to `GET /api/auth/clear-session`, which expires the cookie on the
response and then redirects to `/login`. Do not weaken the Phase 3 middleware bounce.

### TROUBLE-17: E-9 cannot inspect local D1 on Windows
**Problem:** Playwright's session-count helper throws `ENOENT` (`npx`), `EINVAL`
(`wrangler.cmd`), or `Unexpected end of JSON input`.
**Cause:** `execFileSync` cannot run `.cmd` shims the way a shell can. Wrangler `--json`
pretty-prints, so the first line is often a lone `[`.
**Solution:** Invoke `node node_modules/wrangler/bin/wrangler.js` directly. Parse from the
first `[` or `{` through the end of stdout, not a single line.

### TROUBLE-18: Production register shows digest 4068762763 / page couldn’t load
**Problem:** `/register` loads, but submitting valid details returns
`This page couldn’t load` with a Next.js digest (observed **4068762763**). Local preview
register works.
**Cause:** Remote D1 `users` required `username TEXT NOT NULL` and had no `sessions`
table (older `0001_create_users_table.sql`). `registerUser` inserts
`(id, first_name, last_name, email, password_hash)` →
`NOT NULL constraint failed: users.username`. The digest is Next.js wrapping that throw.
**Solution:** Do not invent a username in application code. Align remote D1: drop
`idx_users_username` and the `username` column; create `sessions` to match local 0001.
Do not run `migrations apply --remote` on local 0001 while remote already has a different
`0001_*` recorded. Optional later bookkeeping:
`scripts/reconcile-remote-d1-migration-history.sql`. No auth secrets are required.

---

## Evidence Rules

Binding for every agent and human working this PRD:

- **Never claim a test passed unless it actually ran.**
- **Never claim RED unless the failing test was actually observed.**
- **Never claim GREEN unless the passing test was actually observed.**
- **Never claim production verification was agent-observed if the user performed it
  manually.**
- **Label manual and user-performed production evidence appropriately** — "performed manually
  by the user" — in the phase evidence tables.
- **Never mark an unmeasured metric as PASS.** It stays `NOT MEASURED`.
- **Never hide process deviations.** Record them where they occurred, with the reason.
- **Never change evidence retroactively to make TDD appear compliant.** An honest record of a
  test written after the implementation is more valuable than a fabricated RED.
- **Never mark an intentionally PARTIAL criterion as PASS to make the checklist green.**
  PARTIAL with an explanation is a legitimate outcome.
- Verify before claiming completion: run `npm run lint` and `npm run build` and report the
  actual result, never an inferred one.

---

## Notes for AI Agents

1. Read Problem and Hypothesis first to understand intent.
2. Use Scope (In / Out / Cut) to determine boundaries. Do not build out-of-scope items — in
   particular, **no quiz authoring in Sprint 1.**
3. All three previously open items are resolved (RESOLVED-1, RESOLVED-2, RESOLVED-3). Do not
   reopen them: first and last name stay separate columns, Playwright E2E is approved and
   automated, and no `AUTH_SECRET` or any other secret is introduced.
4. Follow TDD strictly. Write the test, observe RED, implement, observe GREEN, refactor,
   re-run.
5. Update phase status markers as work progresses.
6. Fill in evidence tables as work happens, not afterwards.
7. Add implementation details under Technical Implementation Details as code is written.
8. Mark acceptance criteria complete only when the behavior is verified.
9. Add troubleshooting entries when new problems are found and fixed.
10. Use `filepath:line-number` when citing code.
11. Keep this document current; remove information that becomes untrue.
12. **Hard holds:** do not run another `npm run deploy` (Phase 6 deploy already completed
    after an explicit request); do not apply migrations with `--remote`; do not create
    another D1 database; ask before adding any dependency beyond those listed.

---

## Current Status

**Last Updated:** 2026-09-01
**Current Phase:** Phase 6 — Deployment
**Status:** COMPLETE — Sprint 1 Phases 1–6 are done. `npm run deploy` was explicitly
requested and succeeded. Worker:
`https://aisprint-quizmaker.akshaykumar.workers.dev` (latest recorded version
`e815c589-68c0-4b52-84c0-a21b7d8f4abe`). Production S-1..S-8 **PASS**. Playwright
E-1..E-9 **PASS** (7/7, 36.1s). Do not start another phase. Do not redeploy.

### Confirmed Decisions

| Decision | Value |
|---|---|
| Authenticated landing route | `/dashboard` |
| D1 database name | `aisprintquiz-db` (already exists, verified manually) |
| D1 database ID | `b7047c55-895d-4772-bc09-81c22e3a862d` |
| D1 binding name | `DB` |
| Password hashing | PBKDF2 via Web Crypto, format `pbkdf2$iterations$salt$hash` |
| Session model | Opaque D1 session IDs, no JWT |
| Session lifetime | 7-day absolute expiry, no sliding renewal |
| Session cookie | httpOnly `quizmaker_session` |
| Password policy | Minimum 8 characters, no composition requirements |
| Email handling | Trim, lowercase before storage and lookup, unique constraint |
| Name fields | Separate `first_name` and `last_name` (RESOLVED-1) |
| Production dependency | `zod`, `react-hook-form`, `@hookform/resolvers` (Phase 4, user-directed) |
| Dev/test dependencies | `vitest`, `@vitejs/plugin-react`, `jsdom`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `@playwright/test`, `esbuild` (preview tooling, D4-3) |
| Component testing | Required |
| E2E testing | Required and automated with Playwright. First pass against `npm run preview`; final evidence against the deployed Worker (D5-7, RESOLVED-2) |
| Secrets / environment variables | None. `AUTH_SECRET` removed (RESOLVED-3) |
| PBKDF2 iterations | 100,000 — the workerd ceiling; below OWASP guidance, accepted and documented |
| Workers-runtime verification | Mandatory, not replaceable by a green test suite |
| TDD | Mandatory |
| Remote D1 operations | Human-controlled. Production schema repair used targeted DDL (D6-2), not `migrations apply --remote` of local 0001. |
| Deployment | Human-controlled. Phase 6 `npm run deploy` was explicitly requested and executed. Do not redeploy. |

### Open Items

**None.** RESOLVED-1, RESOLVED-2, and RESOLVED-3 close every item that previously blocked
Phase 1.

### Done So Far

- Approved dependencies installed (`zod` plus the six Vitest/RTL packages, plus
  `@playwright/test` and Chromium in Phase 5).
- `d1_databases` binding added to `wrangler.jsonc`; `npm run cf-typegen` run; `DB: D1Database`
  is typed in `cloudflare-env.d.ts`.
- Vitest configured (`vitest.config.mts`, `vitest.setup.ts`, `test` and `test:watch` scripts).
- Phase 1 modules implemented: `d1-client.ts`, `auth/password.ts`, `auth/session.ts`,
  `auth/email.ts`, `auth/errors.ts`, `auth/base64url.ts`, `auth/time.ts`, `auth/types.ts`,
  `services/auth-service.ts`.
- Migration `migrations/0001_create_users_and_sessions.sql` created and **applied locally
  only**; schema and the unique email constraint verified against the local database.
- **Phase 2 complete:** `auth-constants.ts`, `schemas/auth-schema.ts`, `session.ts`
  (`getCurrentUser`), and `actions/auth-actions.ts` (`registerAction`, `loginAction`,
  `logoutAction`, session cookie set and clear).
- **Phase 3 complete:** `src/middleware.ts` (cookie presence only, exact four-entry matcher),
  `src/app/(protected)/layout.tsx`, `src/app/(auth)/layout.tsx`, and `src/app/page.tsx`. A
  pre-existing implementation that used `src/proxy.ts` instead of `middleware.ts` was
  reverted first so TDD could be performed genuinely against the brief's named files —
  see D3-1.
- **Phase 4 complete:** register, login, and dashboard pages; client forms with
  react-hook-form + zodResolver; logout button. `src/middleware.ts` unchanged (C3-1).
- **Phase 5 complete:** Playwright E-1..E-9 against
  `https://aisprint-quizmaker.akshaykumar.workers.dev` (**7/7**, 36.1s) after deploy
  `e815c589-68c0-4b52-84c0-a21b7d8f4abe`. Vitest **170/170**. E-9 does not use local D1.
  C3-1 warning still present.
- **Phase 6 complete:** Worker live at `https://aisprint-quizmaker.akshaykumar.workers.dev`
  (latest recorded version `e815c589-68c0-4b52-84c0-a21b7d8f4abe`). Remote D1 repaired
  earlier by targeted DDL (dropped `username`, created `sessions`). Local 0001 was not
  applied remotely. S-1..S-8 passed. Reconciliation pass documented the filename clash
  and left production `d1_migrations` unchanged. C3-1, OpenNext Windows, and `.dev.vars`
  deploy messages reviewed — no runtime change. No further deploy after reconciliation.

### Remaining after Sprint 1 (not incomplete work)

These do **not** block Sprint 1 completion:

- Optional human bookkeeping: insert local 0001/0002 names into remote `d1_migrations` so
  `apply --remote` becomes a no-op. Until then, never run `migrations apply --remote`.
- C3-1 (`middleware.ts` deprecation) remains technical debt. Do not rename unless a later
  brief requires it.
- OpenNext Windows compatibility warning remains informational (RISK-10).
- `GET /api/auth/clear-session` is a public cookie-expire hop (D5-1). Whether it should
  be POST-only was noted, not changed.
- 10/10 manual success-metric trials stay **NOT MEASURED**.

### Next Steps

1. Sprint 1 is complete. Do not start another phase. Do not redeploy.
2. A human may later run `scripts/reconcile-remote-d1-migration-history.sql` remotely if
   they want Wrangler history aligned. Until then, never `migrations apply --remote`.
3. C3-1 remains open as documented technical debt.
