/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Transform Pipeline — JSX to renderable CJS code.
 *
 * Two modes:
 *
 * 1. Single-source (`transformJSX`): sends a single JSX string
 *    through the Vite endpoint's esbuild.transform path.
 *
 * 2. Multi-file (`transformBundle`): sends a file map + asset URLs
 *    through the Vite endpoint's esbuild.build path with virtual
 *    module plugins. esbuild resolves all imports (components, CSS,
 *    assets) natively — no regex import rewriting needed.
 */

export { transformJSX, transformBundle };

/** Prepended to all single-source JSX before transform. */
const REACT_IMPORT = [
  "import React, {",
  "  useState, useEffect, useRef, useCallback, useMemo,",
  "  useContext, useReducer, useLayoutEffect,",
  "  memo, forwardRef, createContext, Fragment",
  "} from 'react';",
].join("\n");

/**
 * Transform a single JSX source string to CJS.
 * Used for simple/mock views with inline JSX.
 */
async function transformJSX(jsx: string): Promise<string> {
  const codeWithImports = `${REACT_IMPORT}\n\n${jsx}`;

  const res = await fetch("/api/transform", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: codeWithImports }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`JSX transform failed: ${text}`);
  }

  const data = await res.json();
  return data.code;
}

/**
 * Transform a multi-file bundle (files + assets map) into a single
 * CJS string. esbuild resolves all imports via virtual module plugins.
 *
 * @param files - Source map keyed by relative path (e.g. "App.jsx")
 * @param assetUrls - Asset URL map keyed by relative path (e.g. "assets/logo.svg")
 * @returns Bundled CJS code ready for the iframe.
 */
async function transformBundle(
  files: Record<string, string>,
  assetUrls: Record<string, string>
): Promise<string> {
  const res = await fetch("/api/transform", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ files, assets: assetUrls }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Bundle transform failed: ${text}`);
  }

  const data = await res.json();
  return data.code;
}
