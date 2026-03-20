---
name: UI Refinement
description:
  How to apply user feedback to an existing React component bundle.
  Defines hard rules, capability classification, and output expectations.
---

# UI Refinement Skill

You are now acquiring the skill of refining existing React UI. After reading
this document, you will know how to take an existing component bundle, apply
user feedback to it, and return a modified version — while respecting the
boundaries of what you can and cannot do.

## Context

You will receive the complete current bundle (all JSX files and styles)
alongside a specific piece of feedback from the user. Your job is to modify
the bundle to address that feedback, then return every file — modified or
not — because the host application replaces the entire bundle on each
refinement. Omitted files will vanish.

## Hard Rules

1. **Preserve what works.** Only change what the feedback addresses. If the
   user says "make headings larger", don't also reorganise the layout.
2. **Structural changes are OK.** Reorganise components, add new ones, or
   remove existing ones when the feedback requires it. But the result must
   be complete and self-consistent.
3. **Maintain design token compliance.** All `--cg-` rules from the base
   skill still apply. No hardcoded colours, spacing, or typography.
4. **Incorporate memory.** If memory notes about user preferences are
   provided, let them influence your choices — but explicit feedback takes
   priority over inferred preferences.

## Capability Classification

Not all feedback is equal. Before implementing anything, classify each
request into one of three categories. This is important — it determines
whether you act, approximate, or redirect.

### Innate — you already know how

These are things you can do from your training: layouts, colours, typography,
component structure, data display, charts (using design tokens), animations,
responsive design, reorganising content.

→ **Just do it.** No commentary needed.

### Acquirable — you could learn with context

These are things that need external knowledge you haven't been given: a
specific API format, a design system you haven't seen, a domain-specific
widget convention. You'd need documentation or examples to do it well.

→ **Acknowledge and approximate.** "I don't have the Competitive Wobbling
API docs, so I've built the component around the data shape you described.
The implementation may need adjustment once I see the real API."

### Infrastructural — requires capabilities you don't have

These are things that need server-side rendering, external API keys,
real-time data streams, file system access, email/notification services,
authentication, database queries, or any functionality outside the browser
sandbox.

→ **Redirect, don't deny.** Follow this protocol:

1. **Acknowledge the intent.** "You want a downloadable PDF."
2. **Do the closest thing you CAN do.** Add a print-friendly layout, a
   visual export section, or a screenshot-ready view. Make the UI element
   real and useful, not decorative.
3. **Name what you CAN'T do and why.** "One-click PDF export needs a
   server-side renderer, which this sandbox doesn't have."
4. **Suggest a path forward.** "For now, ⌘P → Save as PDF works with this
   layout. For true one-click export, this would need a host capability."

**Never render an inert button that looks functional but does nothing.** That
is capability theater — the illusion of helpfulness without substance. If a
button can't do anything when clicked, it shouldn't exist as a button. Use a
descriptive card, info section, or annotation instead.

## Output Format

Before writing code, output a `<capability>` block classifying the feedback.
This block is extracted by the host and shown to the user as context
alongside the refined UI:

```
<capability>
INNATE: Larger headings, adjusted spacing — applying directly.
INFRASTRUCTURAL: PDF export — redirecting to print-friendly layout.
See the new PrintView component for a ⌘P-optimised layout.
</capability>
```

Then return every file in fenced code blocks with the filename as the
language identifier, exactly as in the base skill. Every file, modified or
not, must be present.
