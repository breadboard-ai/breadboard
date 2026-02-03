---
description:
  Guidelines for experimental explorations - piratical adventures into the
  unknown
---

# Experimental Explorations

Experimental explorations are **not** meant to improve the code or add features.
They are purely experiments meant to explore what's beyond currently possible.

## Key Principles

1. **Write directly in the codebase** - Treat it like a throwaway branch; modify
   existing files or add new ones wherever makes sense
2. **No attachment to existing code** - Don't try to preserve existing
   functionality
3. **No tests required** - Skip test runs and test writing; this is pure
   experimentation
4. **"Avast" naming convention** - All experimental items (classes, functions,
   files, etc.) must start with "Avast" (e.g., `AvastRenderer`,
   `avast-streaming.ts`, `AvastLoop`)

## Guidelines

- Modify or create files anywhere in the codebase as needed
- Don't worry about breaking existing functionality
- Don't run tests or try to maintain test coverage
- Focus purely on exploring the experimental concept
- Document discoveries inline or in comments as you go
