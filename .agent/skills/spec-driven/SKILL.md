---
name: spec-driven
description:
  Spec-driven development for Python projects. Write protocols and conformance
  tests first, then migrate code to satisfy them. The spec is the source of
  truth across conversation sessions.
---

# 📐 Spec-Driven Development

Write the target interface first, prove it with a conformance test, then migrate
existing code to satisfy the spec. Each step is independently shippable.

## When to use

- Extracting a library from entangled code
- Defining boundaries between packages or modules
- Replacing concrete dependencies with abstract contracts
- Any refactor where "what should the boundary look like?" is the hard question

## Why

Reduce risk of breaking the running system while refactoring entangled code.

## Step 0: Brainstorm

Before writing code, brainstorm the protocol shape with the user. This is an
interactive design session — the agent does code archaeology, the user provides
architectural vision.

Activities:

- **Trace the import graph.** Find every place the concrete type is used. Map
  which modules would be freed by the protocol.
- **Identify friction.** Where does the current code resist the proposed
  boundary? Surface these explicitly — they're design inputs, not obstacles.
- **Discuss the boundary.** Explore the questions of where things belong. The
  best protocols emerge from "should X go here or there?" conversations.
- **Name the decisions.** When a design question is resolved ("functions stay in
  the library because they're framework capabilities"), record it with its
  rationale.

The outcome is a **spec doc**. After producing each revision of the spec doc,
stop and discuss it with the user. The idea is that the spec doc is the work
order, and the user needs to approve it.

## The Spec Doc

The spec doc lives at `packages/{name}/spec/{topic}.md`. It's the work order for
the cycle — everything a future session needs to pick up the work without
re-brainstorming.

Contents:

### Goal

One sentence: what boundary is being created and why.

### Design Decisions

Each decision that shaped the protocol, with rationale. These are the "why" that
a future session shouldn't re-debate.

```markdown
### Functions stay in the library

The function layer (task creation, event routing, file I/O) is framework
infrastructure, not model-provider-specific. A different model provider would
use the same functions. Only the _handler shape_ (types like FunctionGroup)
comes from the external dependency.
```

### Protocol Inventory

The tracking table — what's been specified, tested, and migrated:

```markdown
| Protocol        | Replaces               | Specified | Tested  | Migrated |
| --------------- | ---------------------- | --------- | ------- | -------- |
| `SessionRunner` | `session.py` implicit  | ✅        | ✅      | Pending  |
| `FunctionGroup` | `opal.FunctionGroup`   | ✅        | Pending | Pending  |
| `FileSystem`    | `opal.FileSystemProto` | Pending   | —       | —        |
```

### Protocol Shapes

For each protocol, the sketched signature — enough detail that a future session
can write the `Protocol` class without re-reading all the source:

```markdown
#### `SessionRunner`

- `async run(configuration, channel) -> SessionResult`
- Configuration includes: segments, function groups, model, file system
- Channel provides: context queue for mid-session updates
- Result includes: status, turns, outcome, suspend/pause state
```

### Migration Notes

Known friction, import delegation patterns, utility functions that need
bees-native equivalents. Anything that would surprise someone executing the
migration.

At the start of each session, check the spec doc. Pick the next pending protocol
from the inventory.

## The Cycle

### 1. Specify

Write a Python `Protocol` class that defines the boundary.

Rules:

- **Mirror existing shapes.** Design the protocol to be structurally compatible
  with the current implementation. Python's structural subtyping means existing
  code can satisfy the protocol without changes.
- **No new concepts.** If you can't express the boundary with concepts already
  in the codebase, the boundary is wrong.
- **Document the contract.** Each protocol method gets a docstring that states
  what it promises, not what it does internally.

```python
from typing import Protocol, runtime_checkable

@runtime_checkable
class SessionRunner(Protocol):
    """Contract: run a task's session and report back."""

    async def run(
        self,
        configuration: SessionConfiguration,
        channel: ContextChannel,
    ) -> SessionResult: ...
```

### 2. Test

Write a conformance test that:

1. **Verifies the spec is satisfiable** — a minimal mock implementation
   satisfies the protocol.
2. **Verifies existing types conform** — the concrete class you're abstracting
   from satisfies the new protocol (structural check via `isinstance` or
   `issubclass`).
3. **Documents edge cases** — what happens on failure? Empty inputs? Timeouts?

```python
def test_mock_satisfies_protocol():
    """A minimal mock satisfies the protocol."""
    class MockRunner:
        async def run(self, configuration, channel):
            return SessionResult(...)

    assert isinstance(MockRunner(), SessionRunner)

def test_existing_impl_satisfies_protocol():
    """The concrete class we're abstracting from still works."""
    from legacy_module import ConcreteRunner
    assert isinstance(ConcreteRunner(...), SessionRunner)
```

### 3. Migrate

Rewrite imports to use the protocol instead of the concrete type. This is
mechanical:

```diff
-from legacy_module import ConcreteRunner
+from mylib.protocols import SessionRunner
```

After migration:

- The module works exactly as before (structural compatibility).
- The module no longer imports the concrete dependency.
- The conformance test proves the migration is safe.

### 4. Verify

Run the full test suite. If it passes, the migration is complete for that
protocol. Update the spec doc's inventory.

## Principles

**The spec is the artifact, not the PR.** A session that produces a protocol +
conformance test has shipped something valuable, even if the migration hasn't
started.

**Each session is independently valuable.** Don't plan multi-session arcs that
only pay off at the end. Each session should ship: a protocol, a migration, or a
conformance test.

**Don't break the running system.** Protocols coexist with legacy imports. The
migration is a series of import rewrites, not a rewrite of logic. If a migration
requires changing logic, the protocol is wrong — go back to step 1.

**Work bottom-up.** Start with protocols that have the most importers — they
eliminate the most legacy coupling. Save the big structural protocols for last.

**Mirror, then evolve.** First release: the protocol mirrors the existing type
exactly. Second release (optional): evolve the protocol to a better shape now
that the abstraction boundary exists. Don't try to do both at once.
