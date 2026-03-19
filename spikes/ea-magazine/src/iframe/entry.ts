/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Iframe entry point — runs inside the sandboxed iframe.
 *
 * Exposes React + XState as globals, sets up a require shim for the
 * generated CJS bundle, and listens for host messages.
 */

import React from "react";
import { createRoot } from "react-dom/client";

export {};

// ─── Globals ─────────────────────────────────────────────────────────────────

(window as unknown as Record<string, unknown>).React = React;

// ─── imageUrl helper ─────────────────────────────────────────────────────────

function imageUrl(prompt: string): string {
  return `/api/image?prompt=${encodeURIComponent(prompt)}`;
}
(window as unknown as Record<string, unknown>).imageUrl = imageUrl;

// ─── Prefab Component Registry ──────────────────────────────────────────────

/**
 * Lightweight prefab components using React.createElement + --cg- tokens.
 * These are the generic primitives available in prefab mode.
 */

function Column(props: Record<string, unknown>) {
  const { gap = "0px", align, justify, style = {}, children, ...rest } = props;
  return React.createElement(
    "div",
    {
      style: {
        display: "flex",
        flexDirection: "column",
        gap,
        alignItems: align,
        justifyContent: justify,
        ...(style as object),
      },
      ...rest,
    },
    children as React.ReactNode
  );
}

function Row(props: Record<string, unknown>) {
  const {
    gap = "0px",
    align,
    justify,
    wrap,
    style = {},
    children,
    ...rest
  } = props;
  return React.createElement(
    "div",
    {
      style: {
        display: "flex",
        flexDirection: "row",
        gap,
        alignItems: align,
        justifyContent: justify,
        flexWrap: wrap ? "wrap" : undefined,
        ...(style as object),
      },
      ...rest,
    },
    children as React.ReactNode
  );
}

function CardPrefab(props: Record<string, unknown>) {
  const {
    elevation = 1,
    padding,
    radius,
    style = {},
    onClick,
    children,
    ...rest
  } = props;
  return React.createElement(
    "div",
    {
      style: {
        background: "var(--cg-card-bg)",
        borderRadius: radius ?? "var(--cg-card-radius)",
        padding: padding ?? "var(--cg-card-padding)",
        boxShadow: `var(--cg-elevation-${elevation})`,
        cursor: onClick ? "pointer" : undefined,
        ...(style as object),
      },
      onClick: onClick as (() => void) | undefined,
      ...rest,
    },
    children as React.ReactNode
  );
}

function ImagePrefab(props: Record<string, unknown>) {
  const { src, alt = "", aspectRatio, radius, style = {}, ...rest } = props;

  const [loaded, setLoaded] = React.useState(false);
  const [error, setError] = React.useState(false);

  const containerStyle: Record<string, unknown> = {
    position: "relative" as const,
    width: "100%",
    aspectRatio: (aspectRatio as string) ?? "16 / 9",
    borderRadius: radius ?? "var(--cg-img-radius)",
    overflow: "hidden",
    background: error
      ? "var(--cg-color-surface-container)"
      : "linear-gradient(90deg, var(--cg-color-surface-container) 25%, var(--cg-color-surface-container-high) 50%, var(--cg-color-surface-container) 75%)",
    backgroundSize: "200% 100%",
    animation: loaded ? "none" : "shimmer 1.5s ease-in-out infinite",
    ...(style as object),
  };

  return React.createElement(
    "div",
    { style: containerStyle, ...rest },
    !error &&
      React.createElement("img", {
        src: src as string,
        alt: alt as string,
        loading: "lazy",
        onLoad: () => setLoaded(true),
        onError: () => setError(true),
        style: {
          width: "100%",
          height: "100%",
          objectFit: "cover" as const,
          display: "block",
          opacity: loaded ? 1 : 0,
          transition: "opacity 0.4s ease",
        },
      }),
    error &&
      React.createElement(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            height: "100%",
            color: "var(--cg-on-surface-variant)",
            fontSize: "12px",
          },
        },
        alt as string
      )
  );
}

function IconPrefab(props: Record<string, unknown>) {
  const { name, size = 20, color, filled, style = {}, ...rest } = props;
  return React.createElement(
    "span",
    {
      className: "material-symbols-outlined",
      style: {
        fontSize: `${size}px`,
        color: color as string,
        fontVariationSettings: filled ? "'FILL' 1" : undefined,
        ...(style as object),
      },
      ...rest,
    },
    name as string
  );
}

function ChipPrefab(props: Record<string, unknown>) {
  const {
    label,
    color,
    variant = "filled",
    icon,
    style = {},
    ...rest
  } = props;
  return React.createElement(
    "span",
    {
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        padding: "var(--cg-badge-padding)",
        borderRadius: "var(--cg-badge-radius)",
        fontSize: "var(--cg-badge-font-size)",
        fontWeight: 500,
        background:
          variant === "filled"
            ? (color ?? "var(--cg-badge-bg)")
            : "transparent",
        border:
          variant === "outlined"
            ? `1px solid ${color ?? "var(--cg-color-outline)"}`
            : "none",
        color: variant === "filled" ? "var(--cg-badge-color)" : (color as string),
        ...(style as object),
      },
      ...rest,
    },
    icon
      ? React.createElement(
          "span",
          {
            className: "material-symbols-outlined",
            style: { fontSize: "14px" },
          },
          icon as string
        )
      : null,
    label as string
  );
}

function ButtonPrefab(props: Record<string, unknown>) {
  const {
    variant = "filled",
    icon,
    label,
    onClick,
    disabled,
    style = {},
    ...rest
  } = props;
  const isFilled = variant === "filled";
  return React.createElement(
    "button",
    {
      onClick: onClick as (() => void) | undefined,
      disabled: disabled as boolean,
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--cg-sp-2)",
        padding: "var(--cg-button-padding)",
        borderRadius: "var(--cg-button-radius)",
        fontSize: "var(--cg-button-font-size)",
        fontWeight: "var(--cg-button-font-weight)",
        background: isFilled ? "var(--cg-button-bg)" : "transparent",
        color: isFilled ? "var(--cg-button-color)" : "var(--cg-color-primary)",
        border: isFilled
          ? "none"
          : variant === "outlined"
            ? "1px solid var(--cg-color-outline)"
            : "none",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        ...(style as object),
      },
      ...rest,
    },
    icon
      ? React.createElement(
          "span",
          {
            className: "material-symbols-outlined",
            style: { fontSize: "18px" },
          },
          icon as string
        )
      : null,
    label as string
  );
}

function TabsPrefab(props: Record<string, unknown>) {
  const { tabs = [], activeTab, onChange, style = {} } = props;
  return React.createElement(
    "div",
    {
      style: {
        display: "flex",
        gap: "var(--cg-sp-1)",
        borderBottom: "1px solid var(--cg-color-outline-variant)",
        ...(style as object),
      },
    },
    ...(tabs as { label: string; value: string }[]).map((tab) =>
      React.createElement(
        "button",
        {
          key: tab.value,
          onClick: () => (onChange as (v: string) => void)?.(tab.value),
          style: {
            padding: "var(--cg-sp-3) var(--cg-sp-4)",
            border: "none",
            background: "none",
            fontSize: "var(--cg-text-label-lg-size)",
            fontWeight: "var(--cg-text-label-lg-weight)",
            cursor: "pointer",
            color:
              activeTab === tab.value
                ? "var(--cg-color-primary)"
                : "var(--cg-color-on-surface-muted)",
            borderBottom:
              activeTab === tab.value
                ? "2px solid var(--cg-color-primary)"
                : "2px solid transparent",
          },
        },
        tab.label
      )
    )
  );
}

function DialogPrefab(props: Record<string, unknown>) {
  const { open, onClose, title, style = {}, children } = props;
  if (!open) return null;
  return React.createElement(
    "div",
    {
      style: {
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.3)",
        zIndex: 1000,
      },
      onClick: onClose as (() => void) | undefined,
    },
    React.createElement(
      "div",
      {
        style: {
          background: "var(--cg-color-surface-bright)",
          borderRadius: "var(--cg-radius-xl)",
          padding: "var(--cg-sp-6)",
          maxWidth: "480px",
          width: "90%",
          boxShadow: "var(--cg-elevation-3)",
          ...(style as object),
        },
        onClick: (e: MouseEvent) => e.stopPropagation(),
      },
      title
        ? React.createElement(
            "h2",
            {
              style: {
                margin: "0 0 var(--cg-sp-4) 0",
                fontSize: "var(--cg-text-headline-sm-size)",
              },
            },
            title as string
          )
        : null,
      children as React.ReactNode
    )
  );
}

// Simple passthrough stubs for less common primitives
function SwitchPrefab(props: Record<string, unknown>) {
  const { checked, onChange, label, style = {} } = props;
  return React.createElement(
    "label",
    { style: { display: "flex", alignItems: "center", gap: "var(--cg-sp-2)", cursor: "pointer", ...(style as object) } },
    React.createElement("input", {
      type: "checkbox",
      checked: checked as boolean,
      onChange: (e: Event) =>
        (onChange as (v: boolean) => void)?.((e.target as HTMLInputElement).checked),
      style: { accentColor: "var(--cg-color-primary)" },
    }),
    label as string
  );
}

function CheckboxPrefab(props: Record<string, unknown>) {
  const { checked, onChange, label, style = {} } = props;
  return React.createElement(
    "label",
    { style: { display: "flex", alignItems: "center", gap: "var(--cg-sp-2)", cursor: "pointer", ...(style as object) } },
    React.createElement("input", {
      type: "checkbox",
      checked: checked as boolean,
      onChange: (e: Event) =>
        (onChange as (v: boolean) => void)?.((e.target as HTMLInputElement).checked),
    }),
    label as string
  );
}

function InputPrefab(props: Record<string, unknown>) {
  const { value, onChange, placeholder, type = "text", style = {}, ...rest } = props;
  return React.createElement("input", {
    type: type as string,
    value: value as string,
    placeholder: placeholder as string,
    onChange: (e: Event) =>
      (onChange as (v: string) => void)?.((e.target as HTMLInputElement).value),
    style: {
      padding: "var(--cg-sp-3) var(--cg-sp-4)",
      borderRadius: "var(--cg-radius-sm)",
      border: "1px solid var(--cg-color-outline)",
      background: "var(--cg-color-surface-container-lowest)",
      fontSize: "var(--cg-text-body-md-size)",
      ...(style as object),
    },
    ...rest,
  });
}

function TextFieldPrefab(props: Record<string, unknown>) {
  const { value, onChange, placeholder, rows = 3, style = {}, ...rest } = props;
  return React.createElement("textarea", {
    value: value as string,
    placeholder: placeholder as string,
    rows: rows as number,
    onChange: (e: Event) =>
      (onChange as (v: string) => void)?.((e.target as HTMLTextAreaElement).value),
    style: {
      padding: "var(--cg-sp-3) var(--cg-sp-4)",
      borderRadius: "var(--cg-radius-sm)",
      border: "1px solid var(--cg-color-outline)",
      background: "var(--cg-color-surface-container-lowest)",
      fontSize: "var(--cg-text-body-md-size)",
      resize: "vertical",
      ...(style as object),
    },
    ...rest,
  });
}

function SliderPrefab(props: Record<string, unknown>) {
  const { value, onChange, min = 0, max = 100, step = 1, style = {} } = props;
  return React.createElement("input", {
    type: "range",
    value: value as number,
    min: min as number,
    max: max as number,
    step: step as number,
    onChange: (e: Event) =>
      (onChange as (v: number) => void)?.(Number((e.target as HTMLInputElement).value)),
    style: { width: "100%", accentColor: "var(--cg-color-primary)", ...(style as object) },
  });
}

function RadioButtonPrefab(props: Record<string, unknown>) {
  const { checked, onChange, label, name, value, style = {} } = props;
  return React.createElement(
    "label",
    { style: { display: "flex", alignItems: "center", gap: "var(--cg-sp-2)", cursor: "pointer", ...(style as object) } },
    React.createElement("input", {
      type: "radio",
      name: name as string,
      value: value as string,
      checked: checked as boolean,
      onChange: (e: Event) =>
        (onChange as (v: string) => void)?.((e.target as HTMLInputElement).value),
      style: { accentColor: "var(--cg-color-primary)" },
    }),
    label as string
  );
}

function MenuPrefab(props: Record<string, unknown>) {
  const { open, onClose, style = {}, children } = props;
  if (!open) return null;
  return React.createElement(
    "div",
    {
      style: {
        position: "absolute",
        background: "var(--cg-color-surface-bright)",
        borderRadius: "var(--cg-radius-sm)",
        boxShadow: "var(--cg-elevation-2)",
        padding: "var(--cg-sp-1) 0",
        zIndex: 100,
        minWidth: "160px",
        ...(style as object),
      },
      onClick: onClose as (() => void) | undefined,
    },
    children as React.ReactNode
  );
}

function MenuItemPrefab(props: Record<string, unknown>) {
  const { label, icon, onClick, style = {} } = props;
  return React.createElement(
    "button",
    {
      onClick: onClick as (() => void) | undefined,
      style: {
        display: "flex",
        alignItems: "center",
        gap: "var(--cg-sp-3)",
        width: "100%",
        padding: "var(--cg-sp-3) var(--cg-sp-4)",
        border: "none",
        background: "none",
        cursor: "pointer",
        fontSize: "var(--cg-text-body-md-size)",
        textAlign: "left" as const,
        ...(style as object),
      },
    },
    icon
      ? React.createElement(
          "span",
          { className: "material-symbols-outlined", style: { fontSize: "18px" } },
          icon as string
        )
      : null,
    label as string
  );
}

function VideoPrefab(props: Record<string, unknown>) {
  const { src, poster, autoPlay, loop, muted, style = {}, ...rest } = props;
  return React.createElement("video", {
    src: src as string,
    poster: poster as string,
    autoPlay: autoPlay as boolean,
    loop: loop as boolean,
    muted: muted as boolean,
    controls: true,
    style: {
      width: "100%",
      borderRadius: "var(--cg-img-radius)",
      ...(style as object),
    },
    ...rest,
  });
}

// Map of prefab components for the require shim
const prefabs: Record<string, unknown> = {
  "@prefab/Column": { default: Column, __esModule: true },
  "@prefab/Row": { default: Row, __esModule: true },
  "@prefab/Card": { default: CardPrefab, __esModule: true },
  "@prefab/Image": { default: ImagePrefab, __esModule: true },
  "@prefab/Icon": { default: IconPrefab, __esModule: true },
  "@prefab/Chip": { default: ChipPrefab, __esModule: true },
  "@prefab/Button": { default: ButtonPrefab, __esModule: true },
  "@prefab/Tabs": { default: TabsPrefab, __esModule: true },
  "@prefab/Dialog": { default: DialogPrefab, __esModule: true },
  "@prefab/Switch": { default: SwitchPrefab, __esModule: true },
  "@prefab/Checkbox": { default: CheckboxPrefab, __esModule: true },
  "@prefab/Input": { default: InputPrefab, __esModule: true },
  "@prefab/TextField": { default: TextFieldPrefab, __esModule: true },
  "@prefab/Slider": { default: SliderPrefab, __esModule: true },
  "@prefab/RadioButton": { default: RadioButtonPrefab, __esModule: true },
  "@prefab/Menu": { default: MenuPrefab, __esModule: true },
  "@prefab/MenuItem": { default: MenuItemPrefab, __esModule: true },
  "@prefab/Video": { default: VideoPrefab, __esModule: true },
};

// ─── Require Shim ────────────────────────────────────────────────────────────

function requireShim(id: string): unknown {
  if (id === "react" || id.startsWith("react/")) return React;
  if (id === "react-dom/client") return { createRoot };
  if (prefabs[id]) return prefabs[id];
  console.warn(`[em-iframe] Unknown require("${id}")`);
  return {};
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface RenderMessage {
  type: "render";
  code: string;
  props: Record<string, unknown>;
}

interface UpdatePropsMessage {
  type: "update-props";
  props: Record<string, unknown>;
}

interface UpdateThemeMessage {
  type: "update-theme";
  css: string;
}

type HostMessage = RenderMessage | UpdatePropsMessage | UpdateThemeMessage;

// ─── React State ─────────────────────────────────────────────────────────────

let currentComponent: React.ComponentType<Record<string, unknown>> | null =
  null;
let currentRoot: ReturnType<typeof createRoot> | null = null;
let currentProps: Record<string, unknown> = {};

// ─── Error Boundary ──────────────────────────────────────────────────────────

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    window.parent.postMessage(
      { type: "error", message: error.message, stack: error.stack },
      "*"
    );

    const errorEl = document.getElementById("error");
    if (errorEl) {
      errorEl.style.display = "block";
      errorEl.textContent = error.message + "\n\n" + error.stack;
    }
  }

  render() {
    if (this.state.error) {
      return React.createElement(
        "div",
        {
          style: {
            padding: "16px",
            margin: "16px",
            background: "#450a0a",
            color: "#fecaca",
            borderRadius: "8px",
            fontFamily: "monospace",
            fontSize: "13px",
            whiteSpace: "pre-wrap" as const,
          },
        },
        `⚠ Component crashed:\n\n${this.state.error.message}`
      );
    }
    return this.props.children;
  }
}

// ─── Message Handler ─────────────────────────────────────────────────────────

function handleMessage(event: MessageEvent<HostMessage>) {
  const { data } = event;
  if (!data || typeof data !== "object" || !("type" in data)) return;

  switch (data.type) {
    case "render":
      handleRender(data);
      break;
    case "update-props":
      currentProps = data.props;
      rerender();
      break;
    case "update-theme": {
      let el = document.getElementById("theme-override");
      if (!el) {
        el = document.createElement("style");
        el.id = "theme-override";
        document.head.appendChild(el);
      }
      el.textContent = (data as UpdateThemeMessage).css;
      break;
    }
  }
}

function handleRender(msg: RenderMessage) {
  const { code, props } = msg;

  try {
    const moduleShim = { exports: {} as Record<string, unknown> };
    const fn = new Function("React", "require", "module", "exports", "imageUrl", code);
    fn(React, requireShim, moduleShim, moduleShim.exports, imageUrl);

    const Component = (moduleShim.exports.default ??
      moduleShim.exports) as React.ComponentType<Record<string, unknown>>;

    const rootEl = document.getElementById("root")!;

    if (currentRoot) {
      currentRoot.unmount();
    }

    const root = createRoot(rootEl);
    currentComponent = Component;
    currentRoot = root;
    currentProps = props;

    root.render(
      React.createElement(
        ErrorBoundary,
        null,
        React.createElement(Component, props)
      )
    );

    const errorEl = document.getElementById("error");
    if (errorEl) errorEl.style.display = "none";
  } catch (err) {
    window.parent.postMessage(
      {
        type: "error",
        message: (err as Error).message,
        stack: (err as Error).stack,
      },
      "*"
    );

    const errorEl = document.getElementById("error");
    if (errorEl) {
      errorEl.style.display = "block";
      errorEl.textContent =
        (err as Error).message + "\n\n" + (err as Error).stack;
    }
  }
}

function rerender() {
  if (!currentComponent || !currentRoot) return;
  const Component = currentComponent;
  currentRoot.render(
    React.createElement(
      ErrorBoundary,
      null,
      React.createElement(Component, currentProps)
    )
  );
}

// ─── Bootstrap ───────────────────────────────────────────────────────────────

window.addEventListener("message", handleMessage);
window.parent.postMessage({ type: "ready" }, "*");
