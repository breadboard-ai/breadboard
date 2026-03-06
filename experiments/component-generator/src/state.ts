/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Reactive application state.
 *
 * All UI state lives here as `@signal accessor` fields on a singleton
 * class. The `@signal` decorator from `signal-utils` wraps each field
 * in a `Signal.State` under the hood — read with plain property access,
 * write with assignment. `SignalWatcher(LitElement)` components that
 * access these properties during `render()` re-render automatically.
 *
 * ## Signal → UI mapping
 *
 * ```
 * AppState.loading           → cg-generation-overlay (disables buttons)
 * AppState.imagineLoading     → cg-generation-overlay (imagine button)
 * AppState.thinking           → cg-generation-overlay (thinking panel)
 * AppState.selectedTag        → cg-library  (highlights active)
 *                             → cg-preview  (renders component)
 * AppState.searchQuery        → cg-library  (filters list)
 * AppState.codeVisible        → cg-preview  (toggles code panel)
 * AppState.inspectorVisible   → cg-preview  (toggles TweakPane)
 * AppState.uploadedImage      → cg-generation-overlay (shows preview)
 * AppState.conceptImage       → cg-generation-overlay + cg-preview
 * AppState.useLayoutTokens    → cg-settings-overlay (toggle)
 * AppState.generationOverlayOpen → cg-app (overlay visibility)
 * AppState.settingsOverlayOpen   → cg-app (settings overlay)
 * ```
 */

import { signal } from "signal-utils";

export { AppState, appState, type ImageRef, type ThinkingState };

/** A base64-encoded image with its MIME type. */
interface ImageRef {
  base64: string;
  mimeType: string;
}

/** The model's thinking state during streaming generation. */
interface ThinkingState {
  status: string;
  thoughts: string;
}

/**
 * Singleton reactive state container.
 *
 * Each field uses `@signal accessor` — reads subscribe watchers,
 * writes notify them. No `.get()` / `.set()` ceremony.
 */
class AppState {
  // ─── Generation ───────────────────────────────────────────────────

  /** Whether a component generation is in progress. */
  @signal
  accessor loading = false;

  /** Whether an "Imagine" concept image generation is in progress. */
  @signal
  accessor imagineLoading = false;

  /** Current thinking/streaming state, or null when idle. */
  @signal
  accessor thinking: ThinkingState | null = null;

  // ─── Images ───────────────────────────────────────────────────────

  /** User-uploaded reference image. */
  @signal
  accessor uploadedImage: ImageRef | null = null;

  /** AI-generated concept image from the Imagine flow. */
  @signal
  accessor conceptImage: ImageRef | null = null;

  // ─── UI ───────────────────────────────────────────────────────────

  /** Tag of the currently selected component in the library. */
  @signal
  accessor selectedTag: string | null = null;

  /** Current search/filter query in the library. */
  @signal
  accessor searchQuery = "";

  /** Whether the code panel overlay is visible. */
  @signal
  accessor codeVisible = false;

  /** Whether the TweakPane inspector is visible. */
  @signal
  accessor inspectorVisible = false;

  // ─── Settings ─────────────────────────────────────────────────

  /** Whether to include layout design tokens in the system prompt. */
  @signal
  accessor useLayoutTokens = false;

  // ─── Overlays ─────────────────────────────────────────────────

  /** Whether the generation overlay is open. */
  @signal
  accessor generationOverlayOpen = false;

  /** Whether the settings overlay is open. */
  @signal
  accessor settingsOverlayOpen = false;
}

/** The singleton instance — import this, not the class. */
const appState = new AppState();
