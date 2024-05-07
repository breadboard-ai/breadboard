---
"@breadboard-ai/build": patch
---

Node invoke functions can now return $error. All node instances now automatically have an outputs.$error. Throwing from an invoke function will now convert the exception to an $error result; the stack trace is logged to the server, but not shown to the end-user.
