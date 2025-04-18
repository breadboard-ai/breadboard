/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GraphDescriptor,
  InputValues,
  ModuleIdentifier,
} from "@breadboard-ai/types";
import { MutableGraph } from "../inspector/types.js";
import { Schema } from "jsonschema";
import { NodeDescriberResult } from "../types.js";
import { SandboxedModule } from "@breadboard-ai/jsandbox";
import { CapabilitiesManager } from "./types.js";
import { filterEmptyValues } from "../inspector/utils.js";

export { invokeDescriber, invokeMainDescriber };

async function addImportedModules(
  modules: Record<string, string>,
  mutable: MutableGraph
): Promise<void> {
  const inspectable = mutable.graphs.get("");
  if (!inspectable) return;

  const imports = await inspectable.imports();
  imports.forEach((imported, importName) => {
    if ("$error" in imported) return;

    for (const [moduleName, spec] of Object.entries(imported.modules())) {
      const modulePath = `${importName}/${moduleName}`;
      modules[modulePath] = spec.code();
    }
  });
}

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
  const modules = Object.fromEntries(
    Object.entries(declarations).map(([name, spec]) => [name, spec.code])
  );
  await addImportedModules(modules, mutable);
  const module = new SandboxedModule(
    mutable.store.sandbox,
    capabilities?.createSpec() || {},
    modules
  );
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
  const modules = Object.fromEntries(
    Object.entries(declarations).map(([name, spec]) => [name, spec.code])
  );
  await addImportedModules(modules, mutable);
  const module = new SandboxedModule(
    mutable.store.sandbox,
    capabilities?.createSpec() || {},
    modules
  );
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
  } catch (e) {
    // swallow the error. It's okay that some modules don't have
    // custom describers.
  }
  return false;
}
