# Agent Practices

This directory contains the practices, workflows, and conventions that shape how
humans and agents work together in this codebase.

## Practices

| Practice      | What it does                                                                                                               | Skill        |
| ------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------ |
| **Daily Dig** | Proactive bug hunt — scout, catch, tag, log.                                                                               | `daily-dig/` |
| **Déjà Code** | Detect and pave desire paths — find repeated multi-statement patterns and extract shared utilities backed by ESLint rules. | `deja-code/` |
| **Codemods**  | Mechanical, multi-file, type-aware refactors via `ts-morph`. See `codemods/README.md`.                                     | `codemod/`   |

## Workflows

Slash-command workflows that can be invoked directly:

| Command                    | Description                                       |
| -------------------------- | ------------------------------------------------- |
| `/deja-code`               | Find desire paths and pave them with ESLint rules |
| `/daily-dig`               | Run a Daily Dig session                           |
| `/coverage-driven-testing` | Run coverage after writing tests and fill gaps    |
| `/pr-summary`              | Create a PR description for current changes       |
| `/testing-conventions`     | Conventions for writing tests with `node:test`    |

## Custom ESLint Rules

Rules in `packages/visual-editor/eslint-rules/` are organized by prefix:

- **`deja-code-*`** — Déjà Code rules. Flag inline reimplementations of existing
  utilities. Each points to the shared helper in its error message.
- **SCA rules** — Enforce the Services-Controllers-Actions architecture. See
  `packages/visual-editor/src/sca/README.md`.
