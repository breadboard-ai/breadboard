/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  GraphDescriptor,
  MutableGraph,
  NodeHandlerContext,
  Outcome,
  OutputValues,
} from "@breadboard-ai/types";
import {
  DescriberInputs,
  DescriberOutputs,
  InvokeInputs,
  InvokeOutputs,
  RunnableModule,
  RunnableModuleFactory,
  RunnableModuleTelemetry,
} from "@breadboard-ai/types/sandbox.js";
import { err, filterUndefined, ok } from "@breadboard-ai/utils";

import { OpalShellHostProtocol } from "@breadboard-ai/types/opal-shell-protocol.js";
import { urlComponentsFromString } from "../engine/loader/loader.js";
import { McpClientManager } from "../mcp/index.js";
import { a2 } from "./a2.js";
import { type ConsentController } from "../sca/controller/subcontrollers/global/global.js";
import { AgentContext } from "./agent/agent-context.js";
import { NotebookLmApiClient } from "../sca/services/notebooklm-api-client.js";

export { createA2ModuleFactory, A2ModuleFactory };

const URL_PREFIX = "embed://a2/";
const URL_SUFFIX = ".bgl.json";

export type A2ModuleFactoryArgs = {
  mcpClientManager: McpClientManager;
  fetchWithCreds: typeof globalThis.fetch;
  shell: OpalShellHostProtocol;
  getConsentController: () => ConsentController;
  agentContext: AgentContext;
  notebookLmApiClient: NotebookLmApiClient;
};

export type A2ModuleArgs = A2ModuleFactoryArgs & {
  context: NodeHandlerContext;
};

function createA2ModuleFactory(
  args: A2ModuleFactoryArgs
): RunnableModuleFactory {
  return new A2ModuleFactory(args);
}

class A2ModuleFactory implements RunnableModuleFactory {
  constructor(private readonly args: A2ModuleFactoryArgs) {}

  /**
   * Creates A2ModuleArgs from NodeHandlerContext.
   * Used for static component dispatch to bypass graph-based handlers.
   */
  createModuleArgs(context: NodeHandlerContext): A2ModuleArgs {
    return { ...this.args, context };
  }

  getDir(url?: string): Outcome<string> {
    if (!url) {
      return err(`Unable to get module info: no URL`);
    }
    const { mainGraphUrl } = urlComponentsFromString(url);
    let prefix;
    if (mainGraphUrl.startsWith(URL_PREFIX)) {
      prefix = URL_PREFIX;
    } else {
      return err(`Unable to get module info: invalid prefix for URL "${url}"`);
    }
    if (!mainGraphUrl.endsWith(URL_SUFFIX)) {
      return err(`Unable to get module info: invalid suffix for URL "${url}"`);
    }
    return mainGraphUrl.slice(prefix.length, -URL_SUFFIX.length);
  }

  async createRunnableModule(
    _mutable: MutableGraph,
    graph: GraphDescriptor,
    context: NodeHandlerContext
  ): Promise<Outcome<RunnableModule>> {
    const dir = this.getDir(graph.url);
    if (!ok(dir)) return dir;
    const args: A2ModuleArgs = {
      ...this.args,
      context,
    };
    return new A2Module(dir, args);
  }
}

type InvokeFunction = (
  inputs: InvokeInputs,
  args?: A2ModuleArgs
) => Promise<OutputValues>;

type DescribeFunction = (
  inputs: DescriberInputs,
  args?: A2ModuleArgs
) => Promise<DescriberOutputs>;

class A2Module implements RunnableModule {
  constructor(
    private readonly dir: string,
    private readonly args: A2ModuleArgs
  ) {}

  getModule(name: string, method: "invoke" | "describe"): unknown | undefined {
    const exp = method === "invoke" ? "default" : "describe";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const module = (a2 as any)[this.dir]?.[name]?.[exp];
    return module;
  }

  async invoke(
    name: string,
    inputs: InvokeInputs,
    telemetry?: RunnableModuleTelemetry
  ): Promise<InvokeOutputs> {
    const func = this.getModule(name, "invoke");
    if (!func) {
      return err(
        `Function "${URL_PREFIX}${this.dir}${URL_SUFFIX}#${name}/invoke" not found.`
      );
    }
    await telemetry?.startModule();
    const result = await (func as InvokeFunction)(inputs, this.args);
    await telemetry?.endModule();
    return result;
  }

  async describe(
    name: string,
    inputs: DescriberInputs
  ): Promise<DescriberOutputs> {
    const func = this.getModule(name, "describe");
    if (!func) {
      return {
        inputSchema: {},
        outputSchema: {},
      };
    }
    return (func as DescribeFunction)(filterUndefined(inputs), this.args);
  }
}
