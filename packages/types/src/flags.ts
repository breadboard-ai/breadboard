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
   * Use GULF for rendering.
   */
  gulfRenderer: boolean;
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
