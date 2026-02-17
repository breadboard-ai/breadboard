# Utils

> **Helper utilities** — Common functions and debugging infrastructure.

This directory contains utility modules used across the SCA architecture.

---

## Modules

### `helpers/helpers.ts`

Core utility functions for hydration and controller detection:

| Export | Purpose |
|--------|---------|
| `isHydrating(fn)` | Safely checks if a signal returns `PENDING_HYDRATION` |
| `isHydratedController(obj)` | Type guard for `HydratedController` interface |
| `PendingHydrationError` | Error thrown when accessing un-hydrated `@field` |

```typescript
import { isHydrating, PendingHydrationError } from "./helpers/helpers.js";

// Safe check for pending hydration
if (isHydrating(() => controller.someField)) {
  return html`<loading-spinner></loading-spinner>`;
}
```

### `logging/logger.ts`

Debug logging infrastructure with conditional output:

```typescript
import { getLogger, Formatter } from "./logging/logger.js";

const logger = getLogger(controller);

logger.log(Formatter.info("Something happened"));
logger.log(Formatter.warning("Be careful"));
logger.log(Formatter.error("Something broke", error));
logger.log(Formatter.verbose("Debug details", data));
```

**Note:** Logging respects `controller.global.debug.enabled` — verbose logs only appear when debugging is active.

### `sentinel.ts`

The `PENDING_HYDRATION` symbol used by `@field` decorator:

```typescript
export const PENDING_HYDRATION: unique symbol = Symbol("pending_hydration");
```

This sentinel value indicates that a persisted field is still loading from storage.

### `serialization.ts`

Utilities for serializing/deserializing data for storage.

---

## Directory Structure

```
utils/
├── utils.ts            # Re-exports (Helpers, Logging)
├── app-screen.ts       # Screen/view mode utilities
├── common.ts           # Common utility functions
├── decode-error.ts     # Error decoding utilities
├── elastic-progress.ts # Progress bar utility
├── format-error.ts     # Error formatting
├── graph-asset.ts      # Graph asset helpers
├── lite-view-type.ts   # Lite mode view type utilities
├── helpers/
│   └── helpers.ts      # isHydrating, PendingHydrationError
├── logging/
│   └── logger.ts       # getLogger, Formatter
├── sentinel.ts         # PENDING_HYDRATION symbol
└── serialization.ts    # Storage serialization
```
