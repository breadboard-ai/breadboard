# OpalBackendClient Migration

Migrate all Opal Backend HTTP calls from raw `fetchWithCreds` to a well-typed
`OpalBackendClient` interface, then remove the temporary scaffolding.

## Phases

### Phase 1 — Flag Gating

Gate every `fetchWithCreds` call to the Opal Backend behind
`ENABLE_BACKEND_CLIENT`, using `OpalBackendClient.sendHttpRequest` when the flag
is on and falling back to `fetchWithCreds` when off.

**All 24 endpoints** migrated across **12 files**.

📄 [PHASE-1-flag-gating.md](./PHASE-1-flag-gating.md)

---

### Phase 2a — Dead Code Removal

**Depends on:** Phase 1 (complete), flag enabled and verified.

Make `ENABLE_BACKEND_CLIENT` permanent: collapse every flag-gated `if/else` to
the `OpalBackendClient` path only, remove the `fetchWithCreds` fallback branches
for backend calls, and delete the flag itself.

**End state:** No `fetchWithCreds` calls targeting `BACKEND_API_ENDPOINT`
remain. Third-party `fetchWithCreds` usages (Google Drive, Docs, Sheets, etc.)
are unaffected.

📄 [PHASE-2a-dead-code-removal.md](./PHASE-2a-dead-code-removal.md)

---

### Phase 2b — Typed Interface

**Depends on:** Phase 1 (complete). Independent of Phase 2a.

Replace the open-ended `sendHttpRequest(methodName: string, options)` with
per-RPC typed methods on `OpalBackendClient` (e.g., `checkAppAccess()`,
`generateContent(model, body)`). `sendHttpRequest` becomes a private
implementation detail of `HttpBackendClient`.

**End state:** Callers interact with well-defined methods instead of an
open-ended HTTP interface. Low-level HTTP details (method, URL construction,
query params, body serialization) are fully encapsulated.

📄 [PHASE-2b-typed-interface.md](./PHASE-2b-typed-interface.md)

---

### Phase 3 — Followup Tech Debt & Unmigrated Services

**Depends on:** Phase 2a / Phase 2b.

Address remaining cleanup and migrate unmigrated services discovered during
Phase 2a:

1. **`HttpBackendClient` presence assertion:** Update
   `HttpBackendClient.sendHttpRequest` to unconditionally assume
   `BACKEND_API_ENDPOINT` is present. If unset (`""`), treat this as an internal
   client error and throw explicitly (callers should not detect this condition
   beforehand).
2. **`GraphRunService` migration (Case #3):** Migrate legacy direct
   `fetchWithCreds` graph session plumbing (`/v1beta1/graphSessions/new`,
   `:resume`, `:cancel`, etc.) in `GraphRunService` to transit through
   `OpalBackendClient`.

---

## Key References

- **Skill reference:**
  [`.agent/skills/opal-backend-api/SKILL.md`](../../.agent/skills/opal-backend-api/SKILL.md)
- **Endpoint catalog:**
  [`docs/dev/backend_reference.md`](../../docs/dev/backend_reference.md)
- **Client interface:**
  [`packages/types/src/opal-backend-client.ts`](../../packages/types/src/opal-backend-client.ts)
- **Client implementation:**
  [`packages/visual-editor/src/ui/utils/http-backend-client.ts`](../../packages/visual-editor/src/ui/utils/http-backend-client.ts)
