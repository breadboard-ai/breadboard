---
"@breadboard-ai/build": patch
---

The anyOf function now hoists out any common "type" it finds, to help with code in breadboard that assumes there is always a top-level type (e.g. when visual editor looks for llm-content).
