# Services Layer

> **Infrastructure and external communication** — The capabilities of the
> application.

Services provide access to file systems, network APIs, graph processing, and
other external resources. They are **stateless** with respect to the UI and
injected once at application boot.

---

## Design Principles

### 1. Statelessness

Services don't hold UI state. State belongs in Controllers. Services provide
_capabilities_, not _state_.

```typescript
// ✅ Service provides capability
const graph = await services.graphStore.get(url);

// ❌ Service doesn't track "current graph" — that's Controller state
// services.graphStore.currentGraph  // WRONG
```

### 2. Single Responsibility

Each service handles one infrastructure concern:

- `fileSystem` — file I/O
- `googleDriveClient` — Drive API
- `autonamer` — node naming AI
- `graphStore` — graph caching and loading

### 3. Injected Once

Services are created at boot in `services()` and passed to Actions via
dependency injection. They're not recreated per-request.

---

## Service Catalog

Notable services include:

| Service                  | Class/Type               | Purpose                                  |
| ------------------------ | ------------------------ | ---------------------------------------- |
| `actionTracker`          | `ActionTracker`          | Records user actions for analytics       |
| `autonamer`              | `Autonamer`              | Smart name generation for nodes          |
| `flowGenerator`          | `FlowGenerator`          | AI-powered flow/graph generation         |
| `globalConfig`           | `GlobalConfig`           | Static deployment configuration          |
| `guestConfig`            | `GuestConfiguration`     | Configuration provided by shell host     |
| `googleDriveClient`      | `GoogleDriveClient`      | Google Drive API interactions            |
| `googleDriveBoardServer` | `GoogleDriveBoardServer` | Board storage via Google Drive           |
| `mcpClientManager`       | `McpClientManager`       | MCP (Model Context Protocol) connections |
| `signinAdapter`          | `SigninAdapter`          | Unified authentication provider          |
| `shellHost`              | `OpalShellHostProtocol`  | Communication with the host shell        |
| `sandbox`                | `A2ModuleFactory`        | Module factory for A2 component dispatch |
| `agentContext`           | `AgentContext`           | Agent lifecycle and trace management     |

---

## Accessing Services

### From Actions

```typescript
import { makeAction } from "../binder.js";

export const bind = makeAction();

export async function autonamePendingNodes() {
  const { services } = bind;

  const result = await services.autonamer.autoname(input, signal);
  // ...
}
```

### From Bootstrap Code

```typescript
// In sca.ts
const services = Services.services(config, controller.global.flags, getConsent);
```

---

## Bootstrap Injection Pattern

Some services need controller access, but controllers aren't created yet during
service initialization. We resolve this with **getter injection**:

```typescript
// In sca.ts
const services = Services.services(
  config,
  controller.global.flags, // Direct reference (already created)
  () => controller.global.consent // Getter for lazy resolution
);
```

The service factory receives a function that returns the controller:

```typescript
// In services.ts
export function services(
  config: RuntimeConfig,
  flags: RuntimeFlagManager,
  getConsentController: () => ConsentController // Lazy getter
) {
  const sandbox = createA2ModuleFactory({
    // ...
    getConsentController, // Passed to sandbox for later use
  });
}
```

---

## Adding a New Service

### 1. Create the Service Class/Function

```typescript
// services/my-service.ts
export class MyService {
  constructor(private fetchWithCreds: typeof fetch) {}

  async doWork(input: string): Promise<Result> {
    const response = await this.fetchWithCreds("/api/work", {
      method: "POST",
      body: JSON.stringify({ input }),
    });
    return response.json();
  }
}
```

### 2. Add to AppServices Interface

```typescript
// services/services.ts
export interface AppServices {
  // ... existing services
  myService: MyService;
}
```

### 3. Instantiate in Factory

```typescript
export function services(config, flags, getConsentController) {
  // ... existing setup

  const myService = new MyService(fetchWithCreds);

  instance = {
    // ... existing services
    myService,
  };
}
```

### 4. Use from Actions

```typescript
export async function useMyService() {
  const { services } = bind;
  return services.myService.doWork("input");
}
```

---

## Directory Structure

```
services/
├── services.ts                     # AppServices interface & factory
├── autonamer.ts                    # Node autonaming service
├── graph-editing-agent-service.ts   # Agent-assisted graph editing
├── integration-managers.ts          # Integration/MCP management
├── notebooklm-api-client.ts         # NotebookLM API client
├── run-service.ts                   # Run execution helpers
└── status-updates-service.ts        # Status update polling
```

Most service implementations live outside the `sca/` directory (in `engine/`,
`ui/utils/`, etc.) and are composed together in the `services()` factory.
