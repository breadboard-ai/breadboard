---
name: use-opal-sdk
title: Using the Opal SDK from a React component
description:
  Learn how to use `window.opalSDK` inside your sandboxed React component to
  read files, call host services, and listen for events from the application.
allowed-tools:
  - files.*
---

# What is `window.opalSDK`?

When your React component runs inside the sandbox, it has no network access and
no direct access to the host application. Instead, the host injects
`window.opalSDK` — a bridge object that lets you:

1. **Call methods** on the host (read files, navigate, etc.)
2. **Listen for events** pushed by the host (data updates, file changes, etc.)

All communication goes through `postMessage` under the hood. You never need to
call `postMessage` directly.

# Calling SDK Methods

Every method call on `window.opalSDK` is asynchronous and returns a `Promise`.

```jsx
// Read a file from the workspace
const content = await window.opalSDK.readFile("data/results.json");

// Parse and use it
const data = JSON.parse(content);
```

## Available Methods

| Method                        | Returns           | Description                                  |
| ----------------------------- | ----------------- | -------------------------------------------- |
| `readFile(path)`              | `Promise<string>` | Read a file from the workspace.              |
| `navigateTo(viewId, params?)` | `Promise<void>`   | Navigate to a different view in the host UI. |
| `emit(event, payload?)`       | `Promise<void>`   | Send a fire-and-forget event to the host.    |

Paths are workspace-relative, same as `files_write_file`. For example, if you
wrote a file with `files_write_file` using `data/results.json`, read it with
`window.opalSDK.readFile("data/results.json")`.

## Error Handling

If a method call fails (e.g., file not found), the Promise rejects with an
`Error`. Always handle errors:

```jsx
try {
  const content = await window.opalSDK.readFile("missing.txt");
} catch (err) {
  console.error("Could not read file:", err.message);
}
```

# Listening for Events

The SDK implements the standard DOM `addEventListener` API. The host pushes
events to your component automatically.

## The `filechange` Event

The most important event is `filechange`. It fires whenever a file in your
working directory changes — for example, when you or another agent writes a file
with `files_write_file`.

```jsx
useEffect(() => {
  function onFileChange(e) {
    console.log("File changed:", e.detail.path);
  }

  window.opalSDK.addEventListener("filechange", onFileChange);

  return () => {
    window.opalSDK.removeEventListener("filechange", onFileChange);
  };
}, []);
```

The event detail contains:

| Field  | Type     | Description                                        |
| ------ | -------- | -------------------------------------------------- |
| `path` | `string` | Workspace-relative path of the file that changed.  |

## Key Points

- Events arrive as standard `CustomEvent` objects.
- The payload is on `e.detail`.
- Always clean up listeners in your `useEffect` return function to prevent
  memory leaks.

# Example: Auto-Refreshing Data Display

Here's a complete component that loads data from a JSON file and automatically
re-reads it whenever the file changes on disk:

```jsx
import React, { useState, useEffect, useCallback } from "react";

export default function DataView() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const loadData = useCallback(async () => {
    try {
      const raw = await window.opalSDK.readFile("data.json");
      setData(JSON.parse(raw));
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  // Load initial data.
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Re-read when the file changes.
  useEffect(() => {
    function onFileChange(e) {
      if (e.detail.path === "data.json") {
        loadData();
      }
    }

    window.opalSDK.addEventListener("filechange", onFileChange);

    return () => {
      window.opalSDK.removeEventListener("filechange", onFileChange);
    };
  }, [loadData]);

  if (error) return <div>Error: {error}</div>;
  if (!data) return <div>Loading…</div>;

  return (
    <div>
      <h2>{data.title}</h2>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}
```

This pattern — load once, then listen for changes — is the standard way to
build reactive components. The host watches the filesystem and pushes
`filechange` events automatically; your component just needs to re-read the
files it cares about.

# Rules

## Always use `window.opalSDK`, never `postMessage`

The SDK handles serialization, request IDs, and error propagation for you. Raw
`postMessage` calls will not be understood by the host.

## All methods are async

Even fire-and-forget methods like `navigateTo` return a Promise. You can `await`
them or ignore the return value — both work.

## Clean up event listeners

If your component unmounts and re-mounts, stale listeners will fire on the old
component instance. Always return a cleanup function from `useEffect`.

## Filter `filechange` by path

The `filechange` event fires for every file in the working directory, not just
yours. Check `e.detail.path` before reacting:

```jsx
function onFileChange(e) {
  if (e.detail.path === "my-data.json") {
    reload();
  }
}
```
