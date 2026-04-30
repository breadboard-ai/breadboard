# Opal SDK — Bundle Rendering Bridge

This directory contains the shared infrastructure for rendering React component
bundles in sandboxed iframes. It's used by both the Opal web shell and HiveTool.

## Architecture

```
┌─────────────────────┐     postMessage      ┌──────────────────────┐
│     Host (Lit)       │ ◄──────────────────► │  Iframe (React)      │
│                      │                      │                      │
│  MessageBridge       │  sdk.call ──────►    │  window.opalSDK      │
│  SdkHandlers map     │  ◄── sdk.call.resp   │  (generic Proxy)     │
│                      │                      │                      │
│  render ────────►    │                      │  CJS eval + mount    │
│  update-props ───►   │                      │  Error boundary      │
└─────────────────────┘                      └──────────────────────┘
```

The iframe runtime exposes `window.opalSDK` as a **generic RPC proxy**. Any
method call on it is forwarded to the host as a `sdk.call` message. The host
looks up the method in its `SdkHandlers` registry and sends back the result.

**The iframe runtime never needs to change when adding new SDK methods.**

## Files

| File | Purpose |
|---|---|
| `bundle-types.ts` | Message protocol types and `SdkHandlers` registry type |
| `message-bridge.ts` | Host-side typed postMessage bridge (ready gating, dispose) |
| `iframe-runtime.ts` | `buildIframeHtml()` — self-contained sandbox HTML generator |

## Adding a New SDK Method

To expose a new method on `window.opalSDK` (e.g., `opalSDK.getTheme()`):

### 1. Register a handler on the host

In `surface-pane.ts` (or wherever you build the `SdkHandlers` map):

```ts
handlers.set("getTheme", async () => {
  return { mode: "dark", accent: "#3b5fc0" };
});
```

### 2. That's it

The iframe component can now call:

```js
const theme = await window.opalSDK.getTheme();
// → { mode: "dark", accent: "#3b5fc0" }
```

No changes to `iframe-runtime.ts`, `bundle-types.ts`, or `message-bridge.ts`.

## How It Works

### Iframe side (`window.opalSDK`)

The SDK is a `Proxy` with a `get` trap. Any property access returns a function
that:

1. Serializes the method name and arguments
2. Generates a `requestId` (UUID)
3. Sends `{ type: "sdk.call", method, args, requestId }` to the host
4. Returns a `Promise` that resolves when `sdk.call.response` arrives

### Host side (`SdkHandlers`)

`<bees-bundle-frame>` receives `sdk.call` messages and dispatches them:

1. Looks up `method` in the `sdkHandlers` Map
2. Calls the handler with the spread `args`
3. Sends `{ type: "sdk.call.response", requestId, result }` back
4. If the handler throws, sends `{ type: "sdk.call.response", requestId, error }`
5. If no handler is registered, sends an error response

### Fire-and-forget methods

Methods like `navigateTo` or `emit` that don't return meaningful data still
go through the same round-trip. The handler returns `undefined` (or void),
which resolves the caller's Promise immediately. The component can `await`
or ignore the return value — both work.

## Security Model

The iframe uses `sandbox="allow-scripts"` **without** `allow-same-origin`.
This means:

- ✅ JavaScript execution (React rendering, opalSDK calls)
- ✅ `postMessage` to/from the host
- ❌ No network access (fetch, XHR, CDN scripts)
- ❌ No access to host DOM or cookies
- ❌ No `localStorage` / `sessionStorage`

React is embedded inline as UMD source (fetched at the host level, cached
per session). Google Fonts `<link>` tags are included but won't load in the
sandbox — components fall back to system fonts.

## Message Protocol

### Host → Iframe

| Type | Fields | Purpose |
|---|---|---|
| `render` | `code`, `css?`, `props` | Evaluate CJS bundle and mount component |
| `update-props` | `props` | Re-render with new props (no re-eval) |
| `sdk.call.response` | `requestId`, `result?`, `error?` | Return value for an SDK call |

### Iframe → Host

| Type | Fields | Purpose |
|---|---|---|
| `ready` | — | Iframe runtime initialized |
| `error` | `message`, `stack?` | Uncaught error or component crash |
| `sdk.call` | `requestId`, `method`, `args` | SDK method invocation |
