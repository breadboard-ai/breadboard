import { TemplateResult } from "lit";
import type { SessionLogEntry } from "../../../../sca/types.js";
import { renderDefaultCall } from "./renderers/default-call.js";
import { renderUpsertAgentStep } from "./renderers/upsert-agent-step.js";
import { renderUpsertLegacyStep } from "./renderers/upsert-legacy-step.js";
import { renderWaitForUserInput } from "./renderers/wait-for-user-input.js";
import { renderGraphGetOverview } from "./renderers/graph-get-overview.js";
import { renderGraphRemoveStep } from "./renderers/graph-remove-step.js";
import { renderGraphEditProperties } from "./renderers/graph-edit-properties.js";


export type FunctionRenderer = (
  entry: SessionLogEntry,
  timeString: string
) => TemplateResult;

export const FUNCTION_RENDERERS = new Map<string, FunctionRenderer>([
  ["upsert_agent_step", renderUpsertAgentStep],
  ["upsert_legacy_step", renderUpsertLegacyStep],
  ["wait_for_user_input", renderWaitForUserInput],
  ["graph_get_overview", renderGraphGetOverview],
  ["graph_remove_step", renderGraphRemoveStep],
  ["graph_edit_properties", renderGraphEditProperties],
]);

export function renderCall(entry: SessionLogEntry, timeString: string): TemplateResult {
  const renderer = FUNCTION_RENDERERS.get(entry.name) || renderDefaultCall;
  return renderer(entry, timeString);
}
