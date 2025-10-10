/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  MutableGraph,
  GraphDescriptor,
  Outcome,
  InputValues,
  OutputValues,
  NodeMetadata,
} from "@breadboard-ai/types";
import {
  CapabilitiesManager,
  CapabilitySpec,
  DescriberInputs,
  DescriberOutputs,
  InvokeInputs,
  InvokeOutputs,
  RunnableModule,
  RunnableModuleFactory,
  RunnableModuleTelemetry,
  Values,
} from "@breadboard-ai/types/sandbox.js";
import { err, filterUndefined, ok } from "@breadboard-ai/utils";

import { a2 } from "./a2";
import { urlComponentsFromString } from "@breadboard-ai/loader";
import { McpClientManager } from "@breadboard-ai/mcp";

export { createA2ModuleFactory };

const URL_PREFIX = "embed://a2/";
const URL_SUFFIX = ".bgl.json";

export type A2ModuleFactoryArgs = {
  mcpClientManager: McpClientManager;
};

function createA2ModuleFactory(
  args: A2ModuleFactoryArgs
): RunnableModuleFactory {
  return new A2ModuleFactory(args);
}

class A2ModuleFactory implements RunnableModuleFactory {
  constructor(private readonly args: A2ModuleFactoryArgs) {}

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
    capabilities?: CapabilitiesManager
  ): Promise<Outcome<RunnableModule>> {
    const dir = this.getDir(graph.url);
    if (!ok(dir)) return dir;
    return new A2Module(dir, this.args, capabilities);
  }
}

/**
 * This is the signature of the type that is actually called.
 */
export type CallableCapability = (inputs: Values) => Promise<Values | void>;

export type CallableCapabilities = {
  fetch: CallableCapability;
  invoke: CallableCapability;
  input: CallableCapability;
  output: CallableCapability;
  describe: CallableCapability;
  query: CallableCapability;
  read: CallableCapability;
  write: CallableCapability;
  blob: CallableCapability;
};

async function invokeCapability(
  caps: CapabilitySpec | undefined,
  name: keyof CapabilitySpec,
  inputs: Values,
  telemetry?: RunnableModuleTelemetry
) {
  const capability = caps?.[name];
  if (!capability) {
    return { $error: `Capability "${name}" is not avaialble` };
  }
  const isOutput = name === "output";
  const metadata = inputs.$metadata;
  if (metadata && !isOutput) {
    delete inputs.$metadata;
  }
  const path =
    (await telemetry?.startCapability(
      name,
      inputs as InputValues,
      metadata as NodeMetadata
    )) || 0;
  let outputs;
  try {
    outputs = await capability(inputs, telemetry?.invocationPath(path) || []);
  } catch (e) {
    outputs = {
      $error: `Unable to invoke capability "${name}": ${(e as Error).message}`,
    };
  }
  await telemetry?.endCapability(
    name,
    path,
    inputs as InputValues,
    outputs as OutputValues
  );
  return outputs;
}

const CAPABILITY_NAMES: (keyof CallableCapabilities)[] = [
  "fetch",
  "invoke",
  "input",
  "output",
  "describe",
  "query",
  "read",
  "write",
  "blob",
];

function createCallableCapabilities(
  caps?: CapabilitySpec,
  telemetry?: RunnableModuleTelemetry
): CallableCapabilities {
  return Object.fromEntries(
    CAPABILITY_NAMES.map((name) => {
      return [
        name,
        (inputs) => invokeCapability(caps, name, inputs, telemetry),
      ];
    })
  ) as CallableCapabilities;
}

type InvokeFunction = (
  inputs: InvokeInputs,
  capabilities?: CapabilitySpec,
  args?: A2ModuleFactoryArgs
) => Promise<OutputValues>;

type DescribeFunction = (
  inputs: DescriberInputs,
  capabilities?: CapabilitySpec
) => Promise<DescriberOutputs>;

class A2Module implements RunnableModule {
  constructor(
    private readonly dir: string,
    private readonly args: A2ModuleFactoryArgs,
    private readonly capabilities?: CapabilitiesManager
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
    const result = await (func as InvokeFunction)(
      inputs,
      createCallableCapabilities(this.capabilities?.createSpec(), telemetry),
      this.args
    );
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
    return (func as DescribeFunction)(
      filterUndefined(inputs),
      this.capabilities?.createSpec()
    );
  }
}
