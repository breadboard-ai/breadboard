/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * View Manager — creates, manages, and navigates between sandboxed iframes.
 *
 * Each view gets its own iframe with strict sandbox attributes. The View
 * Manager owns the full iframe lifecycle: creation, navigation, error
 * handling, and teardown. Only one view is active at a time.
 */

import type { ViewBundle, ViewDescriptor, IframeMessage } from "../types.js";
import { MessageBridge } from "./message-bridge.js";
import { transformJSX, transformBundle } from "../pipeline/transform.js";

export { ViewManager };

interface ActiveView {
  viewId: string;
  iframe: HTMLIFrameElement;
  bridge: MessageBridge;
}

type ViewEventHandler = (event: string, payload?: unknown) => void;

class ViewManager {
  #container: HTMLElement;
  #bundle: ViewBundle | null = null;
  #activeView: ActiveView | null = null;
  #onEvent: ViewEventHandler;
  #onNavigate: (fromViewId: string, toViewId: string) => void;

  constructor(
    container: HTMLElement,
    options: {
      onEvent?: ViewEventHandler;
      onNavigate?: (fromViewId: string, toViewId: string) => void;
    } = {}
  ) {
    this.#container = container;
    this.#onEvent = options.onEvent ?? (() => {});
    this.#onNavigate = options.onNavigate ?? (() => {});
  }

  /** Load a bundle and render its first view. */
  async loadBundle(bundle: ViewBundle) {
    this.#teardown();
    this.#bundle = bundle;

    if (bundle.views.length === 0) {
      console.warn("[ark-vm] Bundle has no views");
      return;
    }

    await this.#renderView(bundle.views[0]);
  }

  /** Navigate to a specific view in the current bundle. */
  async navigateTo(viewId: string) {
    if (!this.#bundle) {
      console.warn("[ark-vm] No bundle loaded");
      return;
    }

    const view = this.#bundle.views.find((v) => v.id === viewId);
    if (!view) {
      console.warn(`[ark-vm] View "${viewId}" not found in bundle`);
      return;
    }

    const fromViewId = this.#activeView?.viewId ?? "(none)";
    this.#teardown();
    await this.#renderView(view);
    this.#onNavigate(fromViewId, viewId);
  }

  /** Get the currently active view ID. */
  get activeViewId(): string | null {
    return this.#activeView?.viewId ?? null;
  }

  /** Get all view descriptors in the current bundle. */
  get views(): ViewDescriptor[] {
    return this.#bundle?.views ?? [];
  }

  /** Destroy the current view and clean up. */
  destroy() {
    this.#teardown();
    this.#bundle = null;
  }

  // ─── Private ─────────────────────────────────────────────────────────────

  async #renderView(view: ViewDescriptor) {
    const iframe = document.createElement("iframe");

    iframe.sandbox.add("allow-scripts");
    iframe.sandbox.add("allow-same-origin");

    iframe.style.cssText =
      "width: 100%; height: 100%; border: none; display: block;";
    this.#container.appendChild(iframe);

    // Build asset URL map for the SDK.
    const assetUrls: Record<string, string> = {};
    if (this.#bundle?.assets) {
      for (const [name, asset] of Object.entries(this.#bundle.assets)) {
        assetUrls[name] = asset.url;
      }
    }

    // Create the message bridge.
    const bridge = new MessageBridge(iframe, (msg) =>
      this.#handleIframeMessage(view.id, msg)
    );

    this.#activeView = { viewId: view.id, iframe, bridge };

    // Navigate the iframe to our sandboxed page.
    iframe.src = "/iframe.html";

    // Wait for the iframe to signal readiness.
    await new Promise<void>((resolve) => {
      const onReady = (event: MessageEvent) => {
        if (
          event.source === iframe.contentWindow &&
          event.data?.type === "ready"
        ) {
          window.removeEventListener("message", onReady);
          resolve();
        }
      };
      window.addEventListener("message", onReady);
    });

    // Transform and send to the iframe.
    try {
      let compiledCode: string;
      let componentName: string;

      if (view.files) {
        // Multi-file bundle: use esbuild.build with virtual modules.
        compiledCode = await transformBundle(view.files, assetUrls);
        componentName = "App";
      } else if (view.jsx) {
        // Single-source: use esbuild.transform.
        compiledCode = await transformJSX(view.jsx);
        componentName = this.#extractComponentName(view.jsx);
      } else {
        console.warn("[ark-vm] View has neither files nor jsx");
        return;
      }

      bridge.send({
        type: "render",
        code: compiledCode,
        componentName,
        props: view.props ?? {},
        assets: assetUrls,
      });
    } catch (err) {
      console.error("[ark-vm] Transform failed:", err);
    }
  }

  #handleIframeMessage(viewId: string, msg: IframeMessage) {
    switch (msg.type) {
      case "ready":
        // Already handled in the render flow.
        break;

      case "navigate":
        console.log(
          `[ark-vm] View "${viewId}" wants to navigate to "${msg.viewId}"`
        );
        this.navigateTo(msg.viewId);
        break;

      case "emit":
        console.log(
          `[ark-vm] View "${viewId}" emitted "${msg.event}":`,
          msg.payload
        );
        this.#onEvent(msg.event, msg.payload);
        break;

      case "error":
        console.error(
          `[ark-vm] View "${viewId}" error:`,
          msg.message,
          msg.stack
        );
        break;
    }
  }

  /**
   * Extract the root component name from JSX source.
   *
   * Looks for the last `export default function X`, `function X`,
   * or `const X =` declaration.
   */
  #extractComponentName(jsx: string): string {
    // Try export default function first.
    const exportDefault = jsx.match(/export\s+default\s+function\s+([A-Z]\w*)/);
    if (exportDefault) return exportDefault[1];

    // Fall back to last function declaration starting with uppercase.
    const functions = [...jsx.matchAll(/function\s+([A-Z]\w*)/g)];
    if (functions.length > 0) return functions[functions.length - 1][1];

    // Fall back to last const starting with uppercase.
    const consts = [...jsx.matchAll(/(?:const|let)\s+([A-Z]\w*)\s*=/g)];
    if (consts.length > 0) return consts[consts.length - 1][1];

    return "App";
  }

  #teardown() {
    if (this.#activeView) {
      this.#activeView.bridge.destroy();
      this.#activeView.iframe.remove();
      this.#activeView = null;
    }
  }
}
