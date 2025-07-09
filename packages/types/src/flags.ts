/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * The list of run-time flags currently available in Breadboard.
 * Use this type To add a new flag or remove an existing flag.
 * The flag must be boolean. The default value is `false`.
 *
 * Add a comment to explain what the flag does.
 */
export type RuntimeFlags = {
  /**
   * Use the next-gen, planner-based runtime (PlanRuntime),
   * instead of the current, VM-based runtime (LocalRunner).
   */
  usePlanRunner?: boolean;
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
  env(): RuntimeFlags;
  /**
   * Gets the list of flags that are currently overriden
   * locally.
   */
  overrides(): Partial<RuntimeFlags>;
  /**
   * Override the flag value locally. Setting the flag to the
   * same value as the one provided by the environment,
   *
   */
  override(flag: keyof RuntimeFlags, value: boolean): void;
  /**
   * Clear local override.
   */
  clearOverride(flag: keyof RuntimeFlags): void;
};
