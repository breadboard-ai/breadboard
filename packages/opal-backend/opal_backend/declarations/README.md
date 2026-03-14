# Shared Declarations

This directory contains the **source of truth** for agent function
declarations, metadata, and instructions. Both the TypeScript (visual-editor)
and Python (opal-backend) runtimes consume these files.

## File types

| Pattern | Content |
|---|---|
| `*.functions.json` | Gemini `FunctionDeclaration[]` wire format |
| `*.metadata.json` | UI metadata (icon, title) per function |
| `*.instruction.md` | System instruction text for the function group |

## After editing

The Python backend reads these files at runtime — no extra step needed.

The TypeScript frontend uses **generated** scaffolding. After editing any file
here, regenerate the TS side:

```bash
npm run import-declarations -w packages/visual-editor
```

This updates `packages/visual-editor/src/a2/agent/functions/generated/`.
