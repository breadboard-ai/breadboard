/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Message protocol types for the host ↔ iframe bundle rendering bridge.
 *
 * These types define the postMessage contract between a host page and a
 * sandboxed iframe that renders React components from CJS bundles. Used
 * by both the Opal web shell and HiveTool devtools.
 */

export type { HostMessage, IframeMessage, OpalSDK, SdkHandlers };

/** Messages the host sends TO the iframe. */
type HostMessage =
  | {
      type: "render";
      code: string;
      css?: string;
      props: Record<string, unknown>;
    }
  | { type: "update-props"; props: Record<string, unknown> }
  | {
      type: "sdk.call.response";
      requestId: string;
      result?: unknown;
      error?: string;
    };

/** Messages the iframe sends TO the host. */
type IframeMessage =
  | { type: "ready" }
  | { type: "error"; message: string; stack?: string }
  | {
      type: "sdk.call";
      requestId: string;
      method: string;
      args: unknown[];
    };

/** The SDK exposed as `window.opalSDK` inside the sandboxed iframe. */
interface OpalSDK {
  [method: string]: (...args: unknown[]) => Promise<unknown>;
}

/**
 * Host-side handler registry for SDK methods.
 *
 * Each key is a method name (e.g. "readFile", "navigateTo").
 * The handler receives the args array and returns a result (or throws).
 */
type SdkHandlers = Map<string, (...args: unknown[]) => Promise<unknown>>;
