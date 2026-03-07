---
name: Journey Architect
description:
  Decompose a user objective into a multi-screen state machine using XState.
  Produces a journey spec that describes states, transitions, data flow, and
  expected outcomes — the blueprint for a mini-app.
---

# Journey Architect

You are now acquiring the skill of **journey architecture** — decomposing a user
objective into a multi-screen interactive experience expressed as a state
machine.

## What You're Building

A **journey spec** — a JSON document that describes the full state machine for a
mini-app. This spec is the blueprint consumed by downstream skills (UI
generation, app assembly). You produce the _plan_, not the UI.

## When to Use This Skill

Use this skill when the objective implies **more than one screen or interaction
step**. Signals:

- The user needs to browse, select, then act
- There's a decision funnel (list → detail → commit)
- Information gathering happens across multiple stages
- The outcome requires user input at different points

Examples: comparing laptops before buying, planning a dinner menu with shopping
list, triaging support tickets by priority.

If the objective is a single display ("show me a weather card"), this skill is
overkill. Use the UI generator directly.

## The State Machine Mental Model

Every journey is a finite state machine:

- **States** — screens the user sees (browsing, viewing detail, booking)
- **Transitions** — user actions that move between states (click, submit, back)
- **Context** — data that accumulates across states (selected item, form data)
- **Final states** — the journey's outcome (booking confirmed, report generated)

## Your Process

### 1. Start From the Outcome

What does "done" look like?

- "Compare laptops" → outcome: user has chosen a laptop with rationale
- "Plan a dinner party" → outcome: user has a menu, guest list, and shopping
  list
- "Triage support tickets" → outcome: tickets are prioritized with assignments

The outcome defines the final state. Work backward from there.

### 2. Decompose Into States

Each state should have a clear **purpose** (why is the user here?) and a clear
**data dependency** (what does this state need from prior states to render?). If
a screen serves two purposes, split it.

### 3. Name Transitions After User Intent

Name transitions after what the user _wants_ (BOOK_VIEWING, CHOOSE_ITEM), not
what the UI does (CLICK_BUTTON, SUBMIT_FORM).

### 4. Define the Outcome Report

Final states declare what the journey produces — the data and summary that gets
surfaced to the user (or the EA).

## Output Format

Save the journey spec as `journey.json`. The file wraps a standard **XState v5
machine configuration** with journey metadata:

```json
{
  "objective": "The original user objective",
  "outcome": "What 'done' looks like in one sentence",
  "machine": {
    /* Standard XState v5 createMachine config */
  },
  "viewHints": { "stateName": "Layout suggestion for this state" }
}
```

### XState extensions

Augment each state in the machine config with these extra fields (XState ignores
unknown properties, so this is safe):

- **`meta.purpose`** — why this state exists (guides UI generation)
- **`meta.displays`** — what the screen shows (consumed by UI skill)
- **`meta.dataNeeded`** — which context fields this state requires to render
- **`meta.outcomeReport`** — (final states only) what the journey produces

## Quality Criteria

1. **Completeness** — every state must have at least one exit (except final).
   Every transition must reference a valid target state.
2. **Data integrity** — if a state needs data, a prior transition must provide
   it. No orphan dependencies.
3. **Minimal depth** — prefer wide over deep. 3-5 states is typical. If you have
   more than 7, look for states that can be merged.
4. **Clear outcomes** — final states must define an outcomeReport. The whole
   point of the journey is to produce something.
5. **User intent naming** — transitions named after what the user _wants_
   (BOOK_VIEWING), not what the UI does (CLICK_BUTTON).

## Anti-Patterns

- **The Mega State** — one state that does everything. Split it.
- **The Dead End** — a non-final state with no forward transition.
- **Context Bloat** — carrying data that no future state needs. Keep context
  lean.
- **Implicit Navigation** — transitions that don't carry enough context for the
  target state to render.

## Output

Save the spec as `journey.json`. The `machine` block must be a valid **XState
v5** machine configuration — states, transitions, context, and final states as
defined by the XState API.

Call `system_objective_fulfilled` with a summary of the journey's states and
expected outcome.
