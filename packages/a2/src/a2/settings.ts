/**
 * @fileoverview A helper to retrieve current settings
 */

import { Capabilities, JSONPart, Outcome } from "@breadboard-ai/types";
import { ok } from "./utils";

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
  /**
   * Use GULF Renderer.
   */
  gulfRenderer: boolean;
};

async function readSettings(
  caps: Capabilities
): Promise<Outcome<Record<string, boolean>>> {
  const reading = await caps.read({ path: "/env/settings/general" });
  if (!ok(reading)) return reading;

  const json = (reading.data?.at(0)?.parts?.at(0) as JSONPart).json;
  if (!json) return {};

  return json as Record<string, boolean>;
}

async function readFlags(caps: Capabilities): Promise<Outcome<RuntimeFlags>> {
  const reading = await caps.read({ path: "/env/flags" });
  if (!ok(reading)) return reading;

  const json = (reading.data?.at(0)?.parts?.at(0) as JSONPart).json;
  if (!json) {
    // Return default values.
    return {
      usePlanRunner: false,
      saveAsCode: false,
      generateForEach: false,
      mcp: false,
      gulfRenderer: false,
    };
  }

  return json as RuntimeFlags;
}
