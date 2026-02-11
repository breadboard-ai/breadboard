/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GraphDescriptor,
  InputValues,
  MutableGraph,
  NodeDescriberResult,
  NodeHandlerContext,
  Schema,
} from "@breadboard-ai/types";
import { filterEmptyValues, ok } from "@breadboard-ai/utils";
import { CapabilitiesManager } from "@breadboard-ai/types/sandbox.js";

export { invokeMainDescriber };

async function invokeMainDescriber(
  context: NodeHandlerContext,
  mutable: MutableGraph,
  graph: GraphDescriptor,
  inputs: InputValues,
  inputSchema?: Schema,
  outputSchema?: Schema,
  capabilities?: CapabilitiesManager,
  asType?: boolean
): Promise<NodeDescriberResult | undefined | false> {
  const { main, modules: declarations } = graph;
  if (!declarations || !main) {
    return false;
  }
  const module = await mutable.store.sandbox.createRunnableModule(
    mutable,
    graph,
    context,
    capabilities
  );
  if (!ok(module)) return;

  try {
    const result = (await module.describe(main, {
      inputs,
      inputSchema,
      outputSchema,
      asType,
    })) as NodeDescriberResult;
    const metadata: Omit<NodeDescriberResult, "inputSchema" | "outputSchema"> =
      filterEmptyValues({
        title: result.title ?? graph.title,
        description: result.description ?? graph.description,
        metadata: filterEmptyValues({
          icon: result?.metadata?.icon ?? graph.metadata?.icon,
          help: result?.metadata?.help ?? graph.metadata?.help,
          tags: result?.metadata?.tags ?? graph.metadata?.tags,
        }),
      });
    return {
      ...metadata,
      ...result,
    };
  } catch {
    // swallow the error. It's okay that some modules don't have
    // custom describers.
  }
  return false;
}
