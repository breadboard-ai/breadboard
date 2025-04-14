/**
 * @fileoverview A helper to retrieve current settings
 */

import { ok } from "./utils";

import read from "@read";

export { readSettings };

async function readSettings(): Promise<Outcome<Record<string, boolean>>> {
  const reading = await read({ path: "/env/settings/general" });
  if (!ok(reading)) return reading;

  const json = (reading.data?.at(0)?.parts?.at(0) as JSONPart).json;
  if (!json) return {};

  return json as Record<string, boolean>;
}
