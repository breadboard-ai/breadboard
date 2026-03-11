/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Ark Protocol Types
 *
 * Shared type definitions for the host↔iframe message protocol,
 * the view bundle format, and the Ark SDK interface.
 */

// ─── View Bundle ──────────────────────────────────────────────────────────────
// What the backend sends us. A bundle is a collection of views the agent
// produced for a single task, plus any assets those views reference.

export interface ViewBundle {
  /** Unique ID for this bundle (from the backend). */
  id: string;

  /** Where this bundle came from — 'run' or 'journey'. */
  source?: "run" | "journey";

  /** The views to render. */
  views: ViewDescriptor[];

  /** Shared assets keyed by reference name. */
  assets?: Record<string, Asset>;
}

export interface ViewDescriptor {
  /** Unique view ID within this bundle. */
  id: string;

  /** Human-readable label (e.g. "Property Card", "Booking Form"). */
  label: string;

  /** Single-source JSX (for simple/mock views). */
  jsx?: string;

  /**
   * Multi-file source map (for real bundles from the backend).
   * Keys are relative paths (e.g. "App.jsx", "components/Header.jsx",
   * "styles.css"). Values are source text. Import resolution is handled
   * by the esbuild build step.
   */
  files?: Record<string, string>;

  /** Props/data to pass to the root component. */
  props?: Record<string, unknown>;

  /** Which other view IDs this view can navigate to. */
  navigatesTo?: string[];
}

export interface Asset {
  /** MIME type. */
  type: string;

  /** URL served by the backend. */
  url: string;
}

// ─── Host → Iframe Messages ──────────────────────────────────────────────────

export type HostMessage = RenderMessage | UpdatePropsMessage;

export interface RenderMessage {
  type: "render";

  /** Compiled CJS code (post-esbuild transform). */
  code: string;

  /** Name of the root component to render. */
  componentName: string;

  /** Props to pass to the root component. */
  props: Record<string, unknown>;

  /** Asset URLs keyed by reference name. */
  assets: Record<string, string>;
}

export interface UpdatePropsMessage {
  type: "update-props";
  props: Record<string, unknown>;
}

// ─── Iframe → Host Messages ──────────────────────────────────────────────────

export type IframeMessage =
  | ReadyMessage
  | NavigateMessage
  | EmitMessage
  | ErrorMessage;

export interface ReadyMessage {
  type: "ready";
}

export interface NavigateMessage {
  type: "navigate";
  viewId: string;
  params?: Record<string, unknown>;
}

export interface EmitMessage {
  type: "emit";
  event: string;
  payload?: unknown;
}

export interface ErrorMessage {
  type: "error";
  message: string;
  stack?: string;
}

// ─── Ark SDK (injected into iframe as window.ark) ────────────────────────────

export interface ArkSDK {
  /** Navigate to another view in this bundle. */
  navigateTo(viewId: string, params?: Record<string, unknown>): void;

  /** Send structured data to the host (e.g. form submission). */
  emit(event: string, payload?: unknown): void;

  /** Get an asset URL by reference name. */
  asset(name: string): string | undefined;
}
