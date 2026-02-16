/**
 * @fileoverview A helper to retrieve current settings
 */

import { RuntimeFlags } from "@breadboard-ai/types";
import { A2ModuleArgs } from "../runnable-module-factory.js";

export { readFlags };

async function readFlags({
  context,
}: A2ModuleArgs): Promise<Readonly<RuntimeFlags> | undefined> {
  if (!context.flags) return;
  return context.flags.flags();
}
