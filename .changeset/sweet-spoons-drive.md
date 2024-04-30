---
"@breadboard-ai/build": patch
---

Allow setting id on inputs, which can be used to customize the input node id,
or to create multiple input nodes. If two input objects reference the same
id, then they will both be placed into a BGL input node with that ID. If no
id is specified, the usual "input-0" is used.
