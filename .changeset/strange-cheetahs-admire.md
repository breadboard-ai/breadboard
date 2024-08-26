---
"@breadboard-ai/build": patch
---

Adds a legacy() function to the result of calling kit(). It's a function that asynchronously returns a kit that is automatically built with and type for the old API, allowing new API kits to be used directly in old boards.
