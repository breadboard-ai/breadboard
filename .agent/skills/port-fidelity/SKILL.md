---
name: port-fidelity
description:
  Audit, diff, and port changes between TypeScript and Python codebases to keep
  them in sync during the migration.
---

# Port Fidelity

Systematic comparison of TypeScript and Python implementations to detect drift
and port changes faithfully.

## When to Use

- Before shipping a Python change that touches ported logic
- After a TS change to a file listed in `packages/opal-backend/PROVENANCE.md`
- When asked to audit or sync the two codebases
- During a `/daily-dig` that targets `opal-backend`

## Workflow

### 1. Identify the pair

Open `packages/opal-backend/PROVENANCE.md` and find the row for the module
you're investigating. Note the TS source path.

### 2. Read both sides

Open the Python module and its TS counterpart side by side. Focus on:

- **Public API shape**: function names, parameter lists, return types
- **Control flow**: early returns, error branches, fallback logic
- **Constants/config**: model names, endpoint paths, schema shapes
- **Wire format**: `to_dict()` / JSON output must match both sides exactly

### 3. Classify differences

| Category                                                  | Action                                 |
| --------------------------------------------------------- | -------------------------------------- |
| **Intentional** (architectural, e.g., Protocol vs inline) | Document in PROVENANCE.md notes column |
| **Drift** (TS was updated, Python wasn't)                 | Port the change                        |
| **Bug** (Python diverges from TS behavior)                | File as finding, write a test          |
| **Enhancement** (Python is ahead of TS)                   | Confirm intent with maintainer         |

### 4. Port changes

When porting a TS change to Python:

1. Copy the TS diff (logical, not textual)
2. Translate idioms:
   - `Promise<T>` → `async def ... -> T`
   - `Record<K,V>` → `dict[K, V]`
   - `interface` → `Protocol` or `@dataclass`
   - `?.` → explicit `if x is not None` guards
   - `Array.map/filter` → list comprehensions
   - `throw new Error` → `raise ValueError`
3. Update the Python module's docstring provenance line if the TS source changed
4. Run tests: `npm run test -w packages/opal-backend`

### 5. Report

Produce a structured summary:

```markdown
## Port Fidelity Report: <module>

**Python**: `opal_backend/<module>.py` **TypeScript**:
`visual-editor/src/a2/agent/<ts-file>.ts`

### Status

- [ ] API shape matches
- [ ] Control flow matches
- [ ] Constants/config matches
- [ ] Wire format matches

### Differences Found

| #   | Category | Description                  | Action         |
| --- | -------- | ---------------------------- | -------------- |
| 1   | drift    | TS added retry logic in v2.3 | Port to Python |

### Changes Made

- Ported retry logic from TS commit abc123
- Added test for retry behavior
```

## Common Gotchas

- **Wire format is sacred.** Both sides emit JSON that the client parses. A
  field name mismatch (camelCase vs snake_case) breaks the protocol.
- **Shared schemas.** In TS, schemas are spread inline in each function file. In
  Python, they're centralized in `shared_schemas.py`. When a TS schema changes,
  update it there, not in individual function files.
- **Model names.** Hardcoded in both codebases. When TS updates a model name,
  grep both sides.
- **Protocol modules have no TS pair.** `http_client.py`, `backend_client.py`,
  and `interaction_store.py` are new for Python. Don't look for a TS counterpart
  — but do verify they're consistent with how TS uses the same backend APIs.
