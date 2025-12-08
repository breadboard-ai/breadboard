/**
 * @fileoverview A helper to retrieve current settings
 */

import {
  Capabilities,
  JSONPart,
  Outcome,
  RuntimeFlags,
} from "@breadboard-ai/types";
import { ok } from "./utils.js";
import { A2ModuleArgs } from "../runnable-module-factory.js";

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

async function readFlags({
  context,
}: A2ModuleArgs): Promise<Readonly<RuntimeFlags> | undefined> {
  if (!context.flags) return;
  return context.flags.flags();
}
