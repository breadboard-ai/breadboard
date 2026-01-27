/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { makeTrigger } from "../binder.js";
import { ok, filterUndefined, toJson } from "@breadboard-ai/utils";
import type {
  LLMContent,
  JsonSerializable,
  NodeConfiguration,
  NodeExpectedOutput,
  NodeMetadata,
} from "@breadboard-ai/types";
import { UpdateNode } from "../../../ui/transforms/index.js";
import { Utils } from "../../utils.js";

export const bind = makeTrigger();

/**
 * Arguments passed to the autonamer module.
 */
export interface AutonameArguments {
  nodeConfigurationUpdate: {
    type: string;
    configuration: NodeConfiguration;
  };
}

/**
 * Result when the autonamer doesn't have enough context.
 */
export interface NotEnoughContextResult {
  notEnoughContext: true;
}

/**
 * Result when the autonamer successfully generates a name.
 */
export interface NodeConfigurationUpdateResult {
  title: string;
  description: string;
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
 * Trigger that automatically generates names for nodes when their
 * configuration changes. Reacts to the `lastNodeConfigChange` signal.
 */
export function registerAutonameTrigger() {
  const LABEL = "Trigger: Autoname";

  bind.register("Autoname Trigger", async () => {
    const { controller, services } = bind;
    const { lastNodeConfigChange, editor, readOnly } = controller.editor.graph;
    const logger = Utils.Logging.getLogger(controller);

    // Guard conditions - don't autoname if conditions aren't met.
    if (!lastNodeConfigChange || readOnly || !editor) {
      return;
    }

    const { nodeId, graphId, configuration, titleUserModified } =
      lastNodeConfigChange;
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
        Utils.Logging.Formatter.verbose(
          "Results discarded due to graph change"
        ),
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
        Utils.Logging.Formatter.verbose(
          "Not enough context to autoname",
          nodeId
        ),
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
        Utils.Logging.Formatter.warning(
          "Failed to apply autoname",
          applying.error
        ),
        LABEL
      );
    }
  });
}
