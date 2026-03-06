/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Application entry point.
 *
 * This file is deliberately thin. All it does is:
 *
 * 1. Import the `<cg-app>` Lit component (which imports the rest of the
 *    component tree: sidebar → library, preview → inspector).
 * 2. Import `state.ts` to trigger registry hydration from localStorage.
 * 3. Import `styles.css` for global CSS custom properties and resets.
 *
 * All business logic lives in {@link ./actions.ts}, all reactive state in
 * {@link ./state.ts}, and all rendering in the `components/` directory.
 *
 * ## Architecture
 *
 * ```
 *   main.ts (entry)
 *     ├── state.ts      (signal-polyfill reactive state)
 *     ├── actions.ts     (generate, imagine, uploadImage)
 *     └── components/
 *         ├── cg-app.ts      (shell — grid layout)
 *         ├── cg-sidebar.ts  (form, thinking, image drop)
 *         ├── cg-library.ts  (component list w/ search + groups)
 *         └── cg-preview.ts  (iframe, code, theme, TweakPane, resize)
 * ```
 *
 * The preview iframe runs React (loaded from `/iframe.html`) — the host
 * UI is pure Lit + Signals, no React outside the iframe.
 */

import "./styles.css";
import "./components/cg-app.js";

// Trigger registry hydration from localStorage.
import "./core/registry.js";
