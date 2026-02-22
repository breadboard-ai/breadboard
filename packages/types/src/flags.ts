/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * The list of run-time flags currently available in Breadboard.
 * Use this type to add a new flag or remove an existing flag.
 * The flag must be boolean. The default value is `false`.
 *
 * When changing flags, also make changes in
 *
 * 1) packages/visual-editor/src/ui/config/client-deployment-configuration.ts,
 * where default values are set.
 *
 * Add a comment to explain what the flag does.
 */
export type RuntimeFlags = {
  /**
   * Enable MCP support
   */
  mcp: boolean;
  /**
   * Use 2D matrices for graph rendering.
   */
  force2DGraph: boolean;
  /**
   * Experimental Consistent UI output mode
   */
  consistentUI: boolean;
  /**
   * Agent mode
   */
  agentMode: boolean;
  /**
   * Enables Google One Quotas
   */
  googleOne: boolean;
  /**
   * Enables Opal-ADK support
   */
  opalAdk: boolean;
  /**
   * Enables output templates for consistent output.
   */
  outputTemplates: boolean;
  /**
   * Requres users consent to use of get_webpage tool
   */
  requireConsentForGetWebpage: boolean;
  /**
   * Requres users consent to use of open_webpage tool
   */
  requireConsentForOpenWebpage: boolean;
  /**
   * Enables SSE streaming for planner calls.
   */
  streamPlanner: boolean;
  /**
   * Enables SSE streaming for GenerateWebpage (output node HTML generation).
   */
  streamGenWebpage: boolean;
  /**
   * Enables the "Add from Drive" option in lite mode (it is always enabled in
   * non-lite mode).
   */
  enableDrivePickerInLiteMode: boolean;
  /**
   * Enables "export to Drive" capability for the agent
   */
  enableGoogleDriveTools: boolean;
  /**
   * Enables auto-resumption of failed agent runs
   */
  enableResumeAgentRun: boolean;

  /**
   * Enables NotebookLM integration
   */
  enableNotebookLm: boolean;

  /**
   * Enables the graph editor agent for conversational graph building
   */
  enableGraphEditorAgent: boolean;

  /**
   * Use the remix text editor (model-driven, Lit-rendered)
   */
  textEditorRemix: boolean;
};

/**
 * A helper to work with runtime flags. Mental model:
 * - Initial flag values are provided by the environment.
 * - User can override flags locally and clear overrides.
 */
export type RuntimeFlagManager = {
  /**
   * Gets current flags as provided by the environment.
   */
  env(): Readonly<RuntimeFlags>;
  /**
   * Gets the list of flags that are currently overriden
   * locally.
   */
  overrides(): Promise<Partial<Readonly<RuntimeFlags>>>;
  /**
   * Current values of runtime flags, combining flags provided by
   * the environment and overrides.
   */
  flags(): Promise<Readonly<RuntimeFlags>>;
  /**
   * Override the flag value locally. Setting the flag to the
   * same value as the one provided by the environment,
   *
   */
  override(flag: keyof RuntimeFlags, value: boolean): Promise<void>;
  /**
   * Clear local override.
   */
  clearOverride(flag: keyof RuntimeFlags): Promise<void>;
};

/**
 * Metadata for a runtime flag: a human-readable title and short description.
 *
 * `visibility` controls where the flag appears in the settings UI:
 * - `"public"` — always shown in the Experimental tab.
 * - `"experimental"` — only shown after enabling experimental components
 *   (Cmd+Shift+E / Ctrl+Shift+E).
 */
export type RuntimeFlagMeta = {
  title: string;
  description: string;
  visibility: "public" | "experimental";
};

/**
 * Human-readable metadata for every runtime flag. Keyed by flag name so that
 * TypeScript enforces an entry exists for each flag.
 */
export const RUNTIME_FLAG_META: Record<keyof RuntimeFlags, RuntimeFlagMeta> = {
  mcp: {
    title: "MCP Support",
    description: "Enable Model Context Protocol support",
    visibility: "experimental",
  },
  force2DGraph: {
    title: "2D Graph Rendering",
    description: "Use 2D matrices for graph rendering",
    visibility: "experimental",
  },
  consistentUI: {
    title: "Consistent UI",
    description: "Experimental consistent UI output mode",
    visibility: "experimental",
  },
  agentMode: {
    title: "Agent Mode",
    description: "Enable agent mode",
    visibility: "public",
  },
  googleOne: {
    title: "Google One Quotas",
    description: "Enable Google One quota limits",
    visibility: "experimental",
  },
  opalAdk: {
    title: "Opal-ADK",
    description: "Enable Opal-ADK support",
    visibility: "experimental",
  },
  outputTemplates: {
    title: "Output Templates",
    description: "Enable output templates for consistent output",
    visibility: "experimental",
  },
  requireConsentForGetWebpage: {
    title: "Consent for Get Webpage",
    description: "Require user consent to use the get_webpage tool",
    visibility: "experimental",
  },
  requireConsentForOpenWebpage: {
    title: "Consent for Open Webpage",
    description: "Require user consent to use the open_webpage tool",
    visibility: "experimental",
  },
  streamPlanner: {
    title: "Stream Planner",
    description: "Enable SSE streaming for planner calls",
    visibility: "experimental",
  },
  streamGenWebpage: {
    title: "Stream Generate Webpage",
    description: "Enable SSE streaming for HTML generation",
    visibility: "experimental",
  },
  enableDrivePickerInLiteMode: {
    title: "Drive Picker (Lite Mode)",
    description: "Enable 'Add from Drive' in lite mode",
    visibility: "experimental",
  },
  enableGoogleDriveTools: {
    title: "Google Drive Tools",
    description: "Enable 'export to Drive' capability",
    visibility: "public",
  },
  enableResumeAgentRun: {
    title: "Resume Agent Run",
    description: "Enable auto-resumption of failed agent runs",
    visibility: "experimental",
  },
  enableNotebookLm: {
    title: "NotebookLM",
    description: "Enable NotebookLM integration",
    visibility: "public",
  },
  enableGraphEditorAgent: {
    title: "Graph Editor Agent",
    description: "Enable conversational graph building",
    visibility: "experimental",
  },
  textEditorRemix: {
    title: "Text Editor (Remix)",
    description: "Use the newer, model-driven text editor",
    visibility: "experimental",
  },
};
