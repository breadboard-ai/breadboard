# Framework Improvements

Concrete improvements to the bees framework. These are well-understood gaps with
clear scope — not speculative, just not yet prioritized.

## Event Delivery

The event system works but is [settling](./flux.md#event-delivery). Three
specific concerns:

- **Discovery**: Agents must declare `watch_events` in their template to receive
  events. There's no way for an agent to discover what event types exist at
  runtime.
- **Subscription scope**: `events_broadcast` goes to all subscribers.
  `tasks_send_event` goes to a specific child. There's no middle ground (e.g.,
  broadcast to a subtree, or to tasks matching a filter).
- **Event typing**: Events are untyped dicts. As the system grows, there's
  pressure for a schema — both for documentation and for runtime validation.

These are not urgent but will compound if left unaddressed.

## Filesystem Scoping

The shared filesystem with slug-based write fencing is
[settling](./flux.md#filesystem-sharing). One open question from the
[patterns.md](./patterns.md#isolated-file-systems) dead ends:

**Isolates**: A future need may arise for subagents that intentionally do _not_
inherit the parent filesystem. No use case has required this yet, but the
pressure may come as agents handle more sensitive or compartmentalized workloads.
The current model is too open for some scenarios (e.g., an agent working on
credentials should not share its workspace upward).

## Template Open Questions

From [flux.md](./flux.md#task-templates):

- **Hooks**: The `on_ticket_done` / `on_event` Python hook mechanism has unclear
  boundaries. Should hooks be replaced by event-driven templates? By a more
  structured plugin system? The current mechanism works but feels like an escape
  hatch rather than a design.
- **Root template**: The `SYSTEM.yaml` → `boot_root_template` mechanism is a
  special case that probably shouldn't be special. Why isn't the root template
  just an `autostart` entry — the same mechanism used for all other automatic
  task creation?
- **Top-level entry points**: There's no clean external API for "start this
  work." Today it requires calling `run_playbook` (code) or the server endpoints
  (HTTP). The library API should make this a first-class operation.

## Naming Migration

The codebase uses legacy names (`ticket`, `playbook`, `playbook_id`) while the
documentation uses the new names (`task`, `template`, `template_id`). This is a
mechanical migration — well-suited for a codemod — but it needs to happen across
Python source, TypeScript source, YAML config, REST endpoints, and SSE event
types. The migration should be coordinated as a single change to avoid a
prolonged mixed-terminology state.

## Dead Code Removal

The [DAG-based workflow model](./patterns.md#dag-based-workflows) left fossils
in the codebase: `depends_on`, `blocked` status, `promote_blocked_tickets`,
topological sort logic, and the old `GUIDE.md` playbook syntax. These should be
removed once we're confident no downstream consumer depends on them.
