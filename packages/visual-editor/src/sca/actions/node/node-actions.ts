/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  EditSpec,
  GraphIdentifier,
  JsonSerializable,
  LLMContent,
  NodeExpectedOutput,
  NodeIdentifier,
  NodeMetadata,
} from "@breadboard-ai/types";
import { filterUndefined, ok, toJson } from "@breadboard-ai/utils";
import {
  UpdateNode,
  ChangeEdge,
  ChangeEdgeAttachmentPoint,
} from "../../../ui/transforms/index.js";
import type { StateEvent } from "../../../ui/events/events.js";
import { MAIN_BOARD_ID } from "../../../ui/constants/constants.js";

import { makeAction, withBlockingAction } from "../binder.js";
import { Utils } from "../../utils.js";
import { asAction, ActionMode, stateEventTrigger } from "../../coordination.js";
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
 * This action can be:
 * - Called directly with a config
 * - Triggered by onNodeConfigChange (reads config from controller state)
 *
 * It:
 * 1. Gets the node type for context
 * 2. Calls the autonamer service
 * 3. Updates the node metadata with the generated title/description
 *
 * **Triggers:**
 * - `onNodeConfigChange`: Fires when a node's configuration changes
 */
export const autoname = asAction(
  "Node.autoname",
  {
    mode: ActionMode.Immediate,
    triggeredBy: () => onNodeConfigChange(bind),
  },
  async (config?: AutonameConfig): Promise<void> => {
    const LABEL = "Action: Autoname";
    const { controller, services } = bind;
    const { editor, readOnly, lastNodeConfigChange } = controller.editor.graph;
    const logger = Utils.Logging.getLogger(controller);

    // When triggered (no config), read from controller state
    const effectiveConfig = config ?? lastNodeConfigChange;

    // Guard: no config from either source
    if (!effectiveConfig) {
      return;
    }

    // Guard conditions
    if (readOnly || !editor) {
      return;
    }

    const { nodeId, graphId, configuration, titleUserModified } =
      effectiveConfig;
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
  }
);

// =============================================================================
// Event-Triggered Actions
// =============================================================================

/**
 * Changes node configuration.
 *
 * **Triggers:** `node.change` StateEvent
 */
export const onNodeChange = asAction(
  "Node.onNodeChange",
  {
    mode: ActionMode.Immediate,
    triggeredBy: () => {
      const { services } = bind;
      return stateEventTrigger(
        "Node Change",
        services.stateEventBus,
        "node.change"
      );
    },
  },
  async (evt?: Event): Promise<void> => {
    const { controller } = bind;
    if (controller.editor.graph.readOnly) return;

    const { editor } = controller.editor.graph;
    if (!editor) return;

    const detail = (evt as StateEvent<"node.change">).detail;
    await withBlockingAction(controller, async () => {
      const transform = new UpdateNode(
        detail.id,
        detail.subGraphId ?? "",
        detail.configurationPart,
        detail.metadata,
        detail.ins
      );
      const result = await editor.apply(transform);
      if (!result.success) {
        throw new Error(result.error);
      }
      // Set the signal so the autoname trigger can react.
      controller.editor.graph.lastNodeConfigChange = {
        nodeId: detail.id,
        graphId: detail.subGraphId ?? "",
        configuration: detail.configurationPart,
        titleUserModified: transform.titleUserModified,
      };
    });
  }
);

/**
 * Adds a new node and selects it.
 *
 * **Triggers:** `node.add` StateEvent
 */
export const onNodeAdd = asAction(
  "Node.onNodeAdd",
  {
    mode: ActionMode.Immediate,
    triggeredBy: () => {
      const { services } = bind;
      return stateEventTrigger("Node Add", services.stateEventBus, "node.add");
    },
  },
  async (evt?: Event): Promise<void> => {
    const { controller } = bind;
    const { editor } = controller.editor.graph;
    if (!editor) return;

    const detail = (evt as StateEvent<"node.add">).detail;
    await withBlockingAction(controller, async () => {
      await editor.edit(
        [{ type: "addnode", graphId: detail.graphId, node: detail.node }],
        `Add step: ${detail.node.metadata?.title ?? detail.node.id}`
      );
      controller.editor.selection.selectNodes([detail.node.id]);
    });
  }
);

/**
 * Moves the selected nodes and assets.
 *
 * **Triggers:** `node.moveselection` StateEvent
 */
export const onMoveSelection = asAction(
  "Node.onMoveSelection",
  {
    mode: ActionMode.Immediate,
    triggeredBy: () => {
      const { services } = bind;
      return stateEventTrigger(
        "Node Move Selection",
        services.stateEventBus,
        "node.moveselection"
      );
    },
  },
  async (evt?: Event): Promise<void> => {
    const { controller } = bind;
    const { editor } = controller.editor.graph;
    if (!editor) return;

    const detail = (evt as StateEvent<"node.moveselection">).detail;
    await withBlockingAction(controller, async () => {
      const edits: EditSpec[] = [];
      for (const update of detail.updates) {
        if (update.type === "node") {
          const inspector = editor.inspect(update.graphId);
          const node = inspector.nodeById(update.id);
          const existingMetadata = node?.metadata() ?? {};
          const existingVisual = (existingMetadata.visual ?? {}) as Record<
            string,
            unknown
          >;
          edits.push({
            type: "changemetadata",
            id: update.id,
            graphId: update.graphId,
            metadata: {
              ...existingMetadata,
              visual: { ...existingVisual, x: update.x, y: update.y },
            },
          });
        } else {
          const graph = editor.raw();
          const asset = graph.assets?.[update.id];
          if (!asset?.metadata) continue;
          edits.push({
            type: "changeassetmetadata",
            path: update.id,
            metadata: {
              ...asset.metadata,
              visual: { x: update.x, y: update.y },
            },
          });
        }
      }
      await editor.edit(edits, "Update selection position");
    });
  }
);

/**
 * Adds, removes, or changes an edge.
 *
 * **Triggers:** `node.changeedge` StateEvent
 */
export const onChangeEdge = asAction(
  "Node.onChangeEdge",
  {
    mode: ActionMode.Immediate,
    triggeredBy: () => {
      const { services } = bind;
      return stateEventTrigger(
        "Node Change Edge",
        services.stateEventBus,
        "node.changeedge"
      );
    },
  },
  async (evt?: Event): Promise<void> => {
    const { controller } = bind;
    const { editor } = controller.editor.graph;
    if (!editor) return;

    const detail = (evt as StateEvent<"node.changeedge">).detail;
    await withBlockingAction(controller, async () => {
      const graphId = detail.subGraphId ?? "";
      const transform = new ChangeEdge(
        detail.changeType,
        graphId,
        detail.from,
        detail.to
      );
      const result = await editor.apply(transform);
      if (!result.success) {
        throw new Error(result.error);
      }
    });
  }
);

/**
 * Changes the attachment point of an edge.
 *
 * **Triggers:** `node.changeedgeattachmentpoint` StateEvent
 */
export const onChangeEdgeAttachmentPoint = asAction(
  "Node.onChangeEdgeAttachmentPoint",
  {
    mode: ActionMode.Immediate,
    triggeredBy: () => {
      const { services } = bind;
      return stateEventTrigger(
        "Node Change Edge Attachment Point",
        services.stateEventBus,
        "node.changeedgeattachmentpoint"
      );
    },
  },
  async (evt?: Event): Promise<void> => {
    const { controller } = bind;
    const { editor } = controller.editor.graph;
    if (!editor) return;

    const detail = (evt as StateEvent<"node.changeedgeattachmentpoint">).detail;
    await withBlockingAction(controller, async () => {
      const transform = new ChangeEdgeAttachmentPoint(
        detail.graphId === MAIN_BOARD_ID ? "" : detail.graphId,
        detail.edge,
        detail.which,
        detail.attachmentPoint
      );
      const result = await editor.apply(transform);
      if (!result.success) {
        throw new Error(result.error);
      }
    });
  }
);
