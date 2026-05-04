/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Generates a self-contained HTML document for a sandboxed bundle iframe.
 *
 * The returned HTML embeds React + ReactDOM inline (passed as pre-fetched
 * source strings) and includes the full iframe runtime: CJS require shim,
 * `window.opalSDK` proxy, React rendering with error boundary, and the
 * host message handler.
 *
 * Usage:
 *   const html = buildIframeHtml(reactUmdSource, reactDomUmdSource);
 *   const blob = new Blob([html], { type: "text/html" });
 *   const url = URL.createObjectURL(blob);
 *   iframe.src = url;
 */

export { buildIframeHtml };

/**
 * Build a complete, self-contained HTML document for the bundle sandbox.
 *
 * @param reactSource - The full UMD source of React (e.g. react.production.min.js)
 * @param reactDomSource - The full UMD source of ReactDOM (e.g. react-dom.production.min.js)
 */
function buildIframeHtml(reactSource: string, reactDomSource: string): string {
  // Escape </script> in the embedded sources — the HTML parser would
  // otherwise treat it as the end of the script block.
  const safeReact = reactSource.replace(/<\/script/gi, "<\\/script");
  const safeReactDom = reactDomSource.replace(/<\/script/gi, "<\\/script");

  // The runtime script is inlined as a string. It mirrors the logic from
  // web/src/iframe/entry.ts but works without ESM imports — React is
  // available as a global from the preceding UMD scripts.
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Sandbox</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
  <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap" rel="stylesheet" />

  <style>
    /* ── MD3 Design Tokens (Dark — Slate) ────────────────────────────────── */
    :root {
      --cg-font-sans: 'Inter', system-ui, -apple-system, sans-serif;
      --cg-font-mono: 'JetBrains Mono', ui-monospace, monospace;
      --cg-text-display-lg-size: 40px;  --cg-text-display-lg-weight: 400;
      --cg-text-display-md-size: 30px;  --cg-text-display-md-weight: 400;
      --cg-text-display-sm-size: 20px;  --cg-text-display-sm-weight: 400;
      --cg-text-headline-lg-size: 32px;  --cg-text-headline-lg-weight: 400;
      --cg-text-headline-md-size: 28px;  --cg-text-headline-md-weight: 400;
      --cg-text-headline-sm-size: 24px;  --cg-text-headline-sm-weight: 400;
      --cg-text-title-lg-size: 22px;  --cg-text-title-lg-weight: 500;
      --cg-text-title-md-size: 16px;  --cg-text-title-md-weight: 500;
      --cg-text-title-sm-size: 14px;  --cg-text-title-sm-weight: 500;
      --cg-text-body-lg-size: 16px;  --cg-text-body-lg-weight: 400;
      --cg-text-body-md-size: 14px;  --cg-text-body-md-weight: 400;
      --cg-text-body-sm-size: 12px;  --cg-text-body-sm-weight: 400;
      --cg-text-label-lg-size: 14px;  --cg-text-label-lg-weight: 500;
      --cg-text-label-md-size: 12px;  --cg-text-label-md-weight: 500;
      --cg-text-label-sm-size: 11px;  --cg-text-label-sm-weight: 500;
      --cg-color-surface-dim: #0b0c0f;
      --cg-color-surface: #0f1115;
      --cg-color-surface-bright: #14171c;
      --cg-color-surface-container-lowest: #0b0c0f;
      --cg-color-surface-container-low: #0f1115;
      --cg-color-surface-container: #14171c;
      --cg-color-surface-container-high: #1e293b;
      --cg-color-surface-container-highest: #253347;
      --cg-color-on-surface: #e2e8f0;
      --cg-color-on-surface-muted: #94a3b8;
      --cg-color-primary: #3b82f6;
      --cg-color-primary-container: #1e3a5f;
      --cg-color-on-primary: #ffffff;
      --cg-color-on-primary-container: #93c5fd;
      --cg-color-secondary: #94a3b8;
      --cg-color-secondary-container: #1e293b;
      --cg-color-on-secondary: #e2e8f0;
      --cg-color-on-secondary-container: #cbd5e1;
      --cg-color-tertiary: #c4b5fd;
      --cg-color-tertiary-container: #2d2540;
      --cg-color-on-tertiary: #ede9fe;
      --cg-color-on-tertiary-container: #e9d5ff;
      --cg-color-error: #ef4444;
      --cg-color-error-container: #450a0a;
      --cg-color-on-error: #ffffff;
      --cg-color-on-error-container: #fca5a5;
      --cg-color-outline: #334155;
      --cg-color-outline-variant: #1e293b;
      --cg-sp-0: 0px;    --cg-sp-1: 4px;    --cg-sp-2: 8px;
      --cg-sp-3: 12px;   --cg-sp-4: 16px;   --cg-sp-5: 20px;
      --cg-sp-6: 24px;   --cg-sp-7: 28px;   --cg-sp-8: 32px;
      --cg-sp-9: 36px;   --cg-sp-10: 40px;  --cg-sp-11: 44px;
      --cg-sp-12: 48px;  --cg-sp-13: 52px;  --cg-sp-14: 56px;
      --cg-sp-15: 60px;  --cg-sp-16: 64px;
      --cg-radius-xs: 4px;   --cg-radius-sm: 8px;
      --cg-radius-md: 12px;  --cg-radius-lg: 16px;
      --cg-radius-xl: 28px;  --cg-radius-full: 999px;
      --cg-elevation-1: 0 1px 3px 1px rgba(0,0,0,0.15), 0 1px 2px rgba(0,0,0,0.3);
      --cg-elevation-2: 0 2px 6px 2px rgba(0,0,0,0.15), 0 1px 2px rgba(0,0,0,0.3);
      --cg-elevation-3: 0 4px 8px 3px rgba(0,0,0,0.15), 0 1px 3px rgba(0,0,0,0.3);
      --cg-motion-duration-short: 150ms;
      --cg-motion-duration-medium: 300ms;
      --cg-motion-duration-long: 500ms;
      --cg-motion-easing-standard: cubic-bezier(0.2, 0.0, 0, 1.0);
      --cg-motion-easing-decel: cubic-bezier(0.0, 0.0, 0, 1.0);
      --cg-motion-easing-accel: cubic-bezier(0.3, 0.0, 0.8, 0.15);
      --cg-card-bg: var(--cg-color-surface-container);
      --cg-card-radius: var(--cg-radius-md);
      --cg-card-padding: var(--cg-sp-4);
      --cg-card-shadow: var(--cg-elevation-1);
      --cg-button-radius: var(--cg-radius-full);
      --cg-button-padding: var(--cg-sp-3) var(--cg-sp-6);
      --cg-button-bg: var(--cg-color-primary);
      --cg-button-color: var(--cg-color-on-primary);
      --cg-button-font-size: var(--cg-text-label-lg-size);
      --cg-button-font-weight: var(--cg-text-label-lg-weight);
      --cg-input-bg: var(--cg-color-surface-container-high);
      --cg-input-border: var(--cg-color-outline-variant);
      --cg-input-radius: var(--cg-radius-sm);
      --cg-input-padding: var(--cg-sp-3) var(--cg-sp-4);
      --cg-input-color: var(--cg-color-on-surface);
      --cg-input-placeholder: var(--cg-color-on-surface-muted);
      --cg-badge-bg: var(--cg-color-tertiary-container);
      --cg-badge-color: var(--cg-color-on-tertiary-container);
      --cg-badge-radius: var(--cg-radius-full);
      --cg-badge-padding: var(--cg-sp-1) var(--cg-sp-2);
      --cg-badge-font-size: var(--cg-text-label-sm-size);
      --cg-divider-color: var(--cg-color-outline-variant);
      --cg-divider-thickness: 1px;
      --cg-divider-style: solid;
      --cg-border-style: solid;
      --cg-border-width: 1px;
      --cg-heading-transform: none;
      --cg-heading-letter-spacing: normal;
      --cg-img-radius: var(--cg-radius-md);
      --cg-img-border: none;
      --cg-img-shadow: none;
      --cg-img-filter: none;
      --cg-hover-scale: 1.02;
      --cg-hover-brightness: 1.1;
      --cg-hover-shadow: var(--cg-elevation-2);
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      height: 100%;
      font-family: var(--cg-font-sans);
      font-size: var(--cg-text-body-md-size);
      color: var(--cg-color-on-surface);
      background: var(--cg-color-surface);
      -webkit-font-smoothing: antialiased;
    }
    #root { min-height: 100%; }
    #error {
      display: none;
      position: fixed;
      inset: 0;
      padding: var(--cg-sp-4);
      background: var(--cg-color-error-container);
      color: var(--cg-color-on-error-container);
      font-family: var(--cg-font-mono);
      font-size: var(--cg-text-body-sm-size);
      white-space: pre-wrap;
      overflow: auto;
      z-index: 9999;
    }
  </style>
</head>
<body>
  <div id="root"></div>
  <div id="error"></div>

  <!-- React UMD — inlined to avoid network fetches from the sandboxed blob: origin -->
  <script>${safeReact}</${""}script>
  <script>${safeReactDom}</${""}script>

  <script>
  // ── Iframe Runtime ────────────────────────────────────────────────────
  // Mirrors web/src/iframe/entry.ts but runs standalone (no ESM imports).
  // React and ReactDOM are globals from the UMD scripts above.
  (function() {
    "use strict";

    // ── Require shim ──
    // esbuild CJS output calls require("react"). Intercept it.
    function requireShim(id) {
      if (id === "react" || id.startsWith("react/")) return React;
      if (id === "react-dom/client") return ReactDOM;
      console.warn('[bees-iframe] Unknown require("' + id + '")');
      return {};
    }

    // ── Opal SDK (EventTarget + RPC Proxy) ──
    // The SDK is backed by a real EventTarget so that components can
    // subscribe to host-pushed events via the standard DOM API:
    //
    //   window.opalSDK.addEventListener("ticketUpdated", (e) => { ... });
    //
    // Any other property access returns an RPC function that forwards
    // { type: "sdk.call", method, args, requestId } to the host.
    // Adding new SDK methods requires only a host-side handler;
    // adding new events requires only a host-side bridge.emit() call.
    var pendingCalls = new Map();
    var sdkTarget = new EventTarget();

    window.opalSDK = new Proxy(sdkTarget, {
      get: function(target, prop) {
        if (typeof prop !== "string") return undefined;
        // Standard object protocol — don't intercept.
        if (prop === "then" || prop === "toJSON") return undefined;

        // EventTarget methods — delegate to the real object.
        if (prop in target) {
          var val = target[prop];
          return typeof val === "function" ? val.bind(target) : val;
        }

        // Everything else — RPC proxy.
        return function() {
          var args = Array.prototype.slice.call(arguments);
          var requestId = crypto.randomUUID();
          return new Promise(function(resolve, reject) {
            pendingCalls.set(requestId, { resolve: resolve, reject: reject });
            window.parent.postMessage({
              type: "sdk.call",
              method: prop,
              args: args,
              requestId: requestId
            }, "*");
          });
        };
      }
    });

    // ── React state ──
    var currentComponent = null;
    var currentRoot = null;
    var currentProps = {};

    // ── Error boundary ──
    var ErrorBoundary = (function(_super) {
      function EB(props) {
        _super.call(this, props);
        this.state = { error: null };
      }
      EB.prototype = Object.create(_super.prototype);
      EB.prototype.constructor = EB;

      EB.getDerivedStateFromError = function(error) {
        return { error: error };
      };

      EB.prototype.componentDidCatch = function(error) {
        window.parent.postMessage(
          { type: "error", message: error.message, stack: error.stack },
          "*"
        );
        var errorEl = document.getElementById("error");
        if (errorEl) {
          errorEl.style.display = "block";
          errorEl.textContent = error.message + "\\n\\n" + error.stack;
        }
      };

      EB.prototype.render = function() {
        if (this.state.error) {
          return React.createElement("div", {
            style: {
              padding: "16px", margin: "16px",
              background: "var(--cg-color-error-container)",
              color: "var(--cg-color-on-error-container)",
              borderRadius: "var(--cg-radius-sm)",
              fontFamily: "var(--cg-font-mono)",
              fontSize: "var(--cg-text-body-sm-size)",
              whiteSpace: "pre-wrap"
            }
          }, "⚠ Component crashed:\\n\\n" + this.state.error.message);
        }
        return this.props.children;
      };

      return EB;
    })(React.Component);

    // ── Render handler ──
    function handleRender(msg) {
      var code = msg.code;
      var css = msg.css;
      var props = msg.props;

      try {
        // Inject CSS if provided.
        if (css) {
          var styleEl = document.getElementById("bundle-css");
          if (!styleEl) {
            styleEl = document.createElement("style");
            styleEl.id = "bundle-css";
            document.head.appendChild(styleEl);
          }
          styleEl.textContent = css;
        }

        // CJS shims: esbuild output uses require() and module.exports.
        var moduleShim = { exports: {} };
        var fn = new Function("React", "require", "module", "exports", code);
        fn(React, requireShim, moduleShim, moduleShim.exports);

        var Component = moduleShim.exports.default || moduleShim.exports;
        var rootEl = document.getElementById("root");

        if (currentRoot) {
          currentRoot.unmount();
        }

        var root = ReactDOM.createRoot(rootEl);
        currentComponent = Component;
        currentRoot = root;
        currentProps = props;

        root.render(
          React.createElement(ErrorBoundary, null,
            React.createElement(Component, props)
          )
        );

        var errorEl = document.getElementById("error");
        if (errorEl) errorEl.style.display = "none";
      } catch (err) {
        window.parent.postMessage(
          { type: "error", message: err.message, stack: err.stack },
          "*"
        );
        var errorEl = document.getElementById("error");
        if (errorEl) {
          errorEl.style.display = "block";
          errorEl.textContent = err.message + "\\n\\n" + err.stack;
        }
      }
    }

    function rerender() {
      if (!currentComponent || !currentRoot) return;
      currentRoot.render(
        React.createElement(ErrorBoundary, null,
          React.createElement(currentComponent, currentProps)
        )
      );
    }

    // ── Message handler ──
    function handleMessage(event) {
      var data = event.data;
      if (!data || typeof data !== "object" || !("type" in data)) return;

      switch (data.type) {
        case "render":
          handleRender(data);
          break;
        case "update-props":
          currentProps = data.props;
          rerender();
          break;
        case "sdk.call.response":
          var pending = pendingCalls.get(data.requestId);
          if (pending) {
            pendingCalls.delete(data.requestId);
            if (data.error) {
              pending.reject(new Error(data.error));
            } else {
              pending.resolve(data.result);
            }
          }
          break;
        case "sdk.event":
          sdkTarget.dispatchEvent(
            new CustomEvent(data.event, { detail: data.detail })
          );
          break;
      }
    }

    // ── Bootstrap ──
    window.addEventListener("message", handleMessage);
    window.parent.postMessage({ type: "ready" }, "*");
  })();
  </${""}script>
</body>
</html>`;
}
