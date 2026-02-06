/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  GraphIdentifier,
  JsonSerializable,
  LLMContent,
  NodeExpectedOutput,
  NodeIdentifier,
  NodeMetadata,
} from "@breadboard-ai/types";
import { filterUndefined, ok, toJson } from "@breadboard-ai/utils";
import { UpdateNode } from "../../../ui/transforms/index.js";

import { makeAction } from "../binder.js";
import { Utils } from "../../utils.js";
import { asAction, ActionMode } from "../../coordination.js";
import { onNodeConfigChange } from "./triggers.js";

export const bind = makeAction();

/**
 * Configuration for autoname action.
 */
export interface AutonameConfig {
  nodeId: NodeIdentifier;
  graphId: GraphIdentifier;
  configuration: Record<string, unknown>;
  titleUserModified: boolean;
}

/**
 * Represents the expected structure of the autonamer result.
 */
export interface NotEnoughContextResult {
  notEnoughContext: boolean;
}

export interface NodeConfigurationUpdateResult {
  title: string;
  description: string;
  expected_output?: NodeExpectedOutput[];
}

// NodeExpectedOutput is imported from @breadboard-ai/types

export interface AutonameArguments {
  nodeConfigurationUpdate: {
    configuration: Record<string, unknown>;
    type: string;
  };
  expected_output?: NodeExpectedOutput[];
}

/**
 * Union of possible autonamer results.
 */
export type AutonameResult =
  | NotEnoughContextResult
  | NodeConfigurationUpdateResult;

/**
 * Converts an object to LLMContent format for the autonamer.
 */
function asLLMContent<T>(o: T): LLMContent[] {
  return [{ parts: [{ json: o as JsonSerializable }] }];
}

/**
 * Performs autoname operation on a node.
 *
 * This action is called by the autoname trigger when a node's configuration
 * changes. It:
 * 1. Gets the node type for context
 * 2. Calls the autonamer service
 * 3. Updates the node metadata with the generated title/description
 */
export async function autoname(config: AutonameConfig): Promise<void> {
  const LABEL = "Action: Autoname";
  const { controller, services } = bind;
  const { editor, readOnly } = controller.editor.graph;
  const logger = Utils.Logging.getLogger(controller);

  // Guard conditions
  if (readOnly || !editor) {
    return;
  }

  const { nodeId, graphId, configuration, titleUserModified } = config;
  const { autonamer } = services;
  const flags = await controller.global.flags.flags();

  // Skip if output templates disabled AND title was user-modified.
  if (!flags.outputTemplates && titleUserModified) {
    return;
  }

  // Get node type for autonaming context.
  const inspector = editor.inspect(graphId);
  const node = inspector.nodeById(nodeId);
  if (!node) {
    logger.log(
      Utils.Logging.Formatter.warning(`Unable to find node "${nodeId}"`),
      LABEL
    );
    return;
  }

  const type = node.descriptor.type;

  // Abort if graph changes during autonaming.
  const abortController = new AbortController();
  let graphChanged = false;
  editor.addEventListener(
    "graphchange",
    () => {
      graphChanged = true;
      abortController.abort();
    },
    { once: true }
  );

  const outputs = await autonamer.autoname(
    asLLMContent({
      nodeConfigurationUpdate: { configuration, type },
    } satisfies AutonameArguments),
    abortController.signal
  );

  if (graphChanged) {
    logger.log(
      Utils.Logging.Formatter.verbose("Results discarded due to graph change"),
      LABEL
    );
    return;
  }

  if (!ok(outputs)) {
    logger.log(
      Utils.Logging.Formatter.error("Autoname error:", outputs.$error),
      LABEL
    );
    return;
  }

  const result = toJson<AutonameResult>(outputs);
  if (!result) {
    logger.log(Utils.Logging.Formatter.warning("Result not found"), LABEL);
    return;
  }

  logger.log(
    Utils.Logging.Formatter.verbose("Autoname result:", result),
    LABEL
  );

  if ("notEnoughContext" in result) {
    logger.log(
      Utils.Logging.Formatter.verbose("Not enough context to autoname", nodeId),
      LABEL
    );
    return;
  }

  // Clip trailing period that may crop up in LLM response.
  if (result.description.endsWith(".")) {
    result.description = result.description.slice(0, -1);
  }

  // Build metadata update, excluding title if user already modified it.
  const metadata: NodeMetadata = filterUndefined({
    title: titleUserModified ? undefined : result.title,
    userModified: true,
    expected_output: result.expected_output,
  });

  const applying = await editor.apply(
    new UpdateNode(nodeId, graphId, null, metadata, null)
  );

  if (!applying.success) {
    logger.log(
      Utils.Logging.Formatter.warning("Failed to apply autoname", applying.error),
      LABEL
    );
  }
}

// =============================================================================
// Triggered Actions
// =============================================================================

/**
 * Wrapper action that reads lastNodeConfigChange and calls autoname.
 * This is the trigger-activated entry point for autonaming.
 *
 * **Triggers:**
 * - `onNodeConfigChange`: Fires when a node's configuration changes
 */
export const autonameFromTrigger = asAction(
  "Node.autoname",
  {
    mode: ActionMode.Immediate,
    triggeredBy: () => onNodeConfigChange(bind),
  },
  async (): Promise<void> => {
    const { controller } = bind;
    const { lastNodeConfigChange } = controller.editor.graph;

    // Guard: only trigger when there's a config change to process
    if (!lastNodeConfigChange) {
      return;
    }

    const { nodeId, graphId, configuration, titleUserModified } =
      lastNodeConfigChange;

    // Delegate to the main autoname function
    await autoname({
      nodeId,
      graphId,
      configuration,
      titleUserModified,
    });
  }
);

