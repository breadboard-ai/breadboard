---
"@breadboard-ai/build": patch
---

Improve handling of defaults in describe functions. Defaults are now always passed into the describe function, and types will be optional or not based on whether there is a default (default means it can never be undefined).
