/**
 * @fileoverview A helper to retrieve current settings
 */

import {
  Capabilities,
  JSONPart,
  Outcome,
  RuntimeFlags,
} from "@breadboard-ai/types";
import { ok } from "./utils";

export { readSettings, readFlags };

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
      generateForEach: false,
      mcp: false,
      gulfRenderer: false,
      force2DGraph: false,
      consistentUI: false,
      agentMode: false,
      backendTransforms: false,
      opalAdk: false,
      googleOne: false,
    };
  }

  return json as RuntimeFlags;
}
