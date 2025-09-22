/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { SandboxedModule } from "@breadboard-ai/jsandbox";
import {
  GraphDescriptor,
  InputValues,
  ModuleIdentifier,
  MutableGraph,
  NodeDescriberResult,
  Outcome,
} from "@breadboard-ai/types";
import { Schema } from "jsonschema";
import { err, filterEmptyValues, ok } from "@breadboard-ai/utils";
import {
  CapabilitiesManager,
  RunnableModule,
  RunnableModuleFactory,
  Sandbox,
} from "@breadboard-ai/types/sandbox.js";

export { invokeDescriber, invokeMainDescriber };

async function invokeDescriber(
  moduleId: ModuleIdentifier,
  mutable: MutableGraph,
  graph: GraphDescriptor,
  inputs: InputValues,
  inputSchema?: Schema,
  outputSchema?: Schema,
  capabilities?: CapabilitiesManager,
  asType?: boolean
): Promise<NodeDescriberResult | undefined> {
  const declarations = graph.modules;
  if (!declarations) {
    return;
  }
  const module = await mutable.store.sandbox.createRunnableModule(
    mutable,
    graph,
    capabilities
  );
  if (!ok(module)) return;

  try {
    const result = (await module.describe(moduleId, {
      inputs,
      inputSchema,
      outputSchema,
      asType,
    })) as NodeDescriberResult;
    const moduleData = declarations[moduleId]!;
    const metadata: Omit<NodeDescriberResult, "inputSchema" | "outputSchema"> =
      filterEmptyValues({
        title: result.title ?? moduleData.metadata?.title,
        description: result.description ?? moduleData.metadata?.description,
        metadata: filterEmptyValues({
          icon: result.metadata?.icon ?? moduleData.metadata?.icon,
          help: result.metadata?.help ?? moduleData.metadata?.help,
          tags: result.metadata?.tags ?? moduleData.metadata?.tags,
        }),
      });
    return {
      ...metadata,
      ...result,
    };
  } catch (e) {
    // swallow the error. It's okay that some modules don't have
    // custom describers.
    console.warn(
      `Unable to invoke describer for "${moduleId}"`,
      (e as Error).message
    );
  }
}

async function invokeMainDescriber(
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
