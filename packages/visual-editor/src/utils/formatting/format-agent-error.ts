/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ErrorMetadata } from "@breadboard-ai/types";

export { formatAgentError, classifyCaughtError };

/**
 * Safely converts an unknown caught value into a human-readable error string.
 *
 * Unlike `(e as Error).message`, this handles every throw shape:
 * - `Error` objects (walks the `.cause` chain)
 * - Plain strings
 * - `Outcome` error objects (`{ $error: string }`)
 * - Objects with a `.message` property
 * - `null`, `undefined`, and other primitives
 */
function formatAgentError(e: unknown): string {
  if (typeof e === "string") return e.trim();

  if (e instanceof Error) {
    const cause = e.cause ? `: ${formatAgentError(e.cause)}` : "";
    return `${e.message}${cause}`;
  }

  if (typeof e === "object" && e !== null) {
    if (
      "$error" in e &&
      typeof (e as { $error: unknown }).$error === "string"
    ) {
      return (e as { $error: string }).$error.trim();
    }
    if (
      "message" in e &&
      typeof (e as { message: unknown }).message === "string"
    ) {
      return (e as { message: string }).message;
    }
  }

  return String(e);
}

/**
 * Classifies a raw caught value into structured `ErrorMetadata`.
 *
 * Uses `e.name` instead of `instanceof` to handle cross-realm errors
 * (e.g. from Comlink workers or OAuth shell iframes where `instanceof
 * TypeError` returns `false` even for genuine TypeErrors).
 *
 * - `TypeError` with "Failed to fetch" / "NetworkError" → `"network"`
 * - `Error` with name `"AbortError"` → `"abort"`
 * - Everything else → `{ origin: "client" }` (no kind, lets downstream decide)
 */
function classifyCaughtError(e: unknown): ErrorMetadata {
  if (e instanceof Error && e.name === "TypeError") {
    const msg = e.message.toLowerCase();
    if (msg.includes("failed to fetch") || msg.includes("networkerror")) {
      return { kind: "network", origin: "client" };
    }
  }

  if (
    e instanceof Error &&
    (e.name === "AbortError" ||
      ("code" in e && (e as { code: unknown }).code === "ABORT_ERR"))
  ) {
    return { kind: "abort", origin: "client" };
  }

  return { origin: "client" };
}
