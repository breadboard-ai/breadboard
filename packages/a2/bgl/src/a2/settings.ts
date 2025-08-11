/**
 * @fileoverview A helper to retrieve current settings
 */

import { ok } from "./utils";

import read from "@read";

export { readSettings, readFlags };

/**
 * Keep in sync with packages/types/src/flags.ts
 */
export type RuntimeFlags = {
  /**
   * Use the next-gen, planner-based runtime (PlanRunner),
   * instead of the current, VM-based runtime (LocalRunner).
   */
  usePlanRunner: boolean;
  /**
   * Add "Save As Code" option to the "Output" step.
   */
  saveAsCode: boolean;
  /**
   * Add "For each" capability to the "Generate" step.
   */
  generateForEach: boolean;
  /**
   * Enable MCP support
   */
  mcp: boolean;
};

async function readSettings(): Promise<Outcome<Record<string, boolean>>> {
  const reading = await read({ path: "/env/settings/general" });
  if (!ok(reading)) return reading;

  const json = (reading.data?.at(0)?.parts?.at(0) as JSONPart).json;
  if (!json) return {};

  return json as Record<string, boolean>;
}

async function readFlags(): Promise<Outcome<RuntimeFlags>> {
  const reading = await read({ path: "/env/flags" });
  if (!ok(reading)) return reading;

  const json = (reading.data?.at(0)?.parts?.at(0) as JSONPart).json;
  if (!json) {
    // Return default values.
    return {
      usePlanRunner: false,
      saveAsCode: false,
      generateForEach: false,
      mcp: false,
    };
  }

  return json as RuntimeFlags;
}
