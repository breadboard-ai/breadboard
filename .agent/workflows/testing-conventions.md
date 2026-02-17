---
description: Conventions for writing tests, including proper mocking with node:test
---

# Testing Conventions

## Mocking

Always use `mock` from `node:test` for mocking methods on existing objects.
**Do not** directly overwrite properties on globals like `document`, `window`,
`navigator`, or `globalThis`. Direct overwrites bypass the test framework's
automatic restoration and can leak state between tests.

### ✅ Correct — use `mock.method`

```ts
import { mock, test, afterEach } from "node:test";

afterEach(() => {
  mock.restoreAll();
});

test("example", () => {
  mock.method(document, "createElement", (tag: string) => {
    // custom implementation
  });

  mock.method(globalThis, "fetch", async () => {
    return new Response(JSON.stringify({ ok: true }));
  });

  mock.method(navigator.clipboard, "writeText", async () => {});
});
```

### ❌ Incorrect — direct overwrite

```ts
test("example", () => {
  // BAD: direct overwrite, must manually restore in finally block
  const original = document.createElement.bind(document);
  document.createElement = ((tag: string) => {
    // ...
  }) as typeof document.createElement;

  try {
    // test code
  } finally {
    document.createElement = original;
  }
});
```

### Exception: Polyfilling missing APIs

When an API doesn't exist in the test environment (e.g., `navigator.clipboard`
in JSDOM), it's acceptable to use `Object.defineProperty` to polyfill it in
the suite's `before()` hook. Once polyfilled, individual tests should still use
`mock.method` on the polyfilled object.

```ts
before(() => {
  // Polyfill — acceptable because the API doesn't exist in JSDOM
  if (!navigator.clipboard) {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: async () => {}, read: async () => [] },
      writable: true,
      configurable: true,
    });
  }
});

test("uses clipboard", () => {
  // Mock individual methods on the polyfilled object
  mock.method(navigator.clipboard, "writeText", async () => {});
});
```
