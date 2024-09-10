---
"@breadboard-ai/build": patch
---

Add a Breadboard Type Expression to represent JSON schema itself.

For now this is using our Schema type, and a generic object schema
with the json-schema behavior. In the future we can switch this to
the official JSON Schema types, and a {$ref} schema for the official
JSON Schema schema.
