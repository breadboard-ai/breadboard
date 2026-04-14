# Agent Projection: Typed Middleware for the Opal Shell

## The Problem

The server currently ships a flat bag of `TicketData` objects to the frontend via SSE. The frontend then does significant work to make sense of this bag:

- Filters out `coordination` and `digest` tickets (framework internals)
- Builds a recursive tree from `parent_task_id` chains
- Scans tags to determine agent capabilities (`chat`, `bundle`)
- Introspects `suspend_event` to extract prompts and choices
- Detects `signal_type === "digest_ready"` to know when to reload the stage

This is the client doing the middleware's job. The frontend treats the agent graph as an unknown, arbitrary tree — but it isn't. The tree is **designed and declared** in `TEMPLATES.yaml`. It is always three levels deep, each with a known role.

## Key Insight: Tags as Interchange Vocabulary

Tags function like CSS class names. They are the shared contract between the template author, the middleware, and the client:

- **Template author** declares `tags: [chat, bundle]` to describe agent capabilities
- **Middleware** reads tags to decide what data to include (e.g., `chat` → include prompt + history)
- **Client** reads tags to decide how to render (e.g., `chat` → show chat thread, `bundle` → show iframe stage)

Tags stay in the wire format. They're the anchor — not an implementation detail to abstract away. But the *consequences* of tags (extracting prompts, resolving bundles, filtering infrastructure) are middleware concerns.

## The Three Levels

From `TEMPLATES.yaml`, the application's agent topology is fixed:

```
Level 1: Assistant (opie)
         Tags: opie, chat
         Always exactly one. The root conversational agent.

Level 2: Journeys (journey-manager) + Background (knowledge)
         Tags: journey, chat
         Zero or more. Each owns a user objective.
         Knowledge is background infrastructure — not visible.

Level 3: Workers (researcher, journey-designer, ui-generator, digest-tile-writer)
         Tags: worker + optional bundle
         Leaf agents. Each performs a specific task within a journey.
         digest-tile-writer is infrastructure — not visible.
```

The middleware knows this structure. It should project it as a **typed shape**, not a generic recursive tree.

## Proposed Wire Format

### SSE `init` Event

```typescript
interface AgentProjection {
  assistant: AgentNode;
  journeys: JourneyNode[];
}

interface AgentNode {
  id: string;
  title: string;
  status: string;              // "running" | "suspended" | "completed" | ...
  tags: string[];              // The interchange vocabulary

  // Pre-resolved by middleware when agent is suspended for user
  prompt?: string;             // Extracted from suspend_event
  choices?: Choice[];          // Extracted from suspend_event.waitForChoice
  chat_history?: ChatEntry[];  // Included for chat-tagged agents
}

interface JourneyNode extends AgentNode {
  workers: AgentNode[];        // Level 3 agents, pre-filtered (no infra)
}

interface Choice {
  id: string;
  text: string;
}

interface ChatEntry {
  role: "agent" | "user";
  text: string;
}
```

### SSE Incremental Events

```
agent:updated  →  { agent: AgentNode, location: AgentLocation }
agent:added    →  { agent: AgentNode, location: AgentLocation }
```

Where `AgentLocation` tells the client where this agent fits:

```typescript
interface AgentLocation {
  level: "assistant" | "journey" | "worker";
  parent_id?: string;  // For workers: which journey they belong to
}
```

The client upserts by `id` using `location` to know which list to update. No tree-walking, no filtering.

### Events the Client Never Sees

| Current Event/Data | Disposition |
|---|---|
| Coordination tickets (`kind: "coordination"`) | Filtered by middleware. Never sent. |
| Digest signals (`signal_type: "digest_ready"`) | Middleware handles internally — triggers bundle rebuild server-side or sends an `agent:updated` for the affected agent. |
| `digest-tile-writer` agents | Infrastructure — filtered out at the worker level. |
| `knowledge` agent | Background agent — filtered out at the journey level. |
| `suspend_event` raw object | Middleware extracts `prompt` and `choices` — client never sees the raw event shape. |
| `playbook_run_id`, `parent_task_id`, `kind`, `signal_type` | Framework internals. Not in the wire format. |

### Session Events (Thoughts/Tool Calls)

```
session:event  →  { agent_id: string, event: SessionEvent }
```

```typescript
type SessionEvent =
  | { type: "thought"; text: string }
  | { type: "tool_call"; name: string }
  | { type: "tool_result"; name: string; summary?: string };
```

Pre-typed instead of the current `Record<string, unknown>` that the client has to introspect for `"thought" in event` / `"functionCall" in event`.

## What Changes

### Server (Middleware)

The server gains a **projection layer** that transforms the internal task model into the typed agent structure:

1. **Agent filtering**: On every broadcast, filter out coordination, digest signals, knowledge, and digest-tile-writer agents.
2. **Level classification**: Use tags to place agents: `opie` → assistant, `journey` → journeys, `worker` → workers.
3. **Prompt extraction**: When an agent has `status: "suspended"` + `assignee: "user"`, extract the prompt text and choices from `suspend_event` and include them inline.
4. **Session event typing**: Wrap raw session events into the typed `SessionEvent` union.

This is ~50-100 lines of projection logic in the server, replacing ~300 lines of derivation logic in the client.

### Frontend

#### Deleted
- `sca/utils/agent-tree.ts` (127 lines) — entire file
- Tree derivation in sidebar `render()` — replaced by iterating the typed structure
- `suspend_event` introspection in `chat-actions.ts` — prompt/choices arrive pre-extracted
- `signal_type` detection in `stage-actions.ts` — middleware handles digest refresh
- `kind !== "coordination"` filters everywhere

#### Simplified
- **Sidebar**: Three flat lists (assistant header, journey sections, worker items) instead of recursive `#renderNode`. ~350 lines → ~100 lines.
- **Chat actions**: `deriveThreads` no longer needs to scan all tickets for `chat` tags and extract prompts. The middleware sends chat-tagged agents with their prompt pre-resolved.
- **Stage actions**: `processDigestUpdates` no longer scans for `signal_type === "digest_ready"`. The middleware sends an `agent:updated` when the digest agent's bundle is ready.
- **Subagent panel**: `workers` array is given, not derived by `deriveChildAgents`.

#### `TicketData` → `AgentNode`
The `TicketData` type (25+ fields, framework-internal vocabulary) is replaced by `AgentNode` (~8 fields, app-semantic vocabulary). The `common/types.ts` shared type becomes the typed projection, not a metadata dump.

### Templates

Add `worker` tag to leaf-level templates that should be visible:

```yaml
# In TEMPLATES.yaml, add to researcher, journey-designer, ui-generator:
tags:
  - worker
```

`digest-tile-writer` does NOT get this tag — it stays invisible.

## Migration Path

1. **Add `worker` tags** to the three visible leaf templates.
2. **Build the projection layer** in the server alongside the current flat emission.
3. **Ship a new SSE event type** (`init_v2` or a query parameter) so the frontend can opt in.
4. **Migrate the frontend** to consume the typed projection.
5. **Remove the old flat emission** and delete the client-side derivation code.

Steps 2-3 allow rolling this out without a coordinated server+client deploy.

## Resolved Decisions

**Knowledge agent**: Not a tree node. Projected as a status indicator on the
assistant level (e.g., "knowledge is updating"). The user sees activity without
tree clutter.

**Digest refresh**: When a digest is ready, the middleware sends `agent:updated`
for the affected journey (whose bundle changed). No special `bundle:ready` event
— it's a natural agent state change.

**Session events**: Broadcast to all connected clients for all agents — no
focus-based filtering. Like Slack: the user sees activity indicators changing
everywhere, giving a sense of the whole system being alive. The client decides
which events to render prominently (active chat) vs. subtly (background dot
animation).
