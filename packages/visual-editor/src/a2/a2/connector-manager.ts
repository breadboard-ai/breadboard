/**
 * @fileoverview Manages connectors.
 */

import { err, ok } from "./utils.js";
import type { ExportDescriberResult, ToolOutput } from "./common.js";
import {
  Capabilities,
  JsonSerializable,
  LLMContent,
  Outcome,
  Schema,
} from "@breadboard-ai/types";
import { A2ModuleArgs } from "../runnable-module-factory.js";

export { createConfigurator };

type InitializeInput = {
  stage: "initialize";
  id: string;
};

type InitializeOutput<C extends Record<string, unknown>> = {
  title: string;
  configuration: C;
};

type ReadInput<C extends Record<string, unknown>> = {
  stage: "read";
  id: string;
  configuration: C;
};

type ReadOutput<V extends Record<string, unknown>> = {
  schema: Schema;
  values: V;
};

type PreviewInput<C extends Record<string, unknown>> = {
  stage: "preview";
  id: string;
  configuration: C;
};

type PreviewOutput = LLMContent[];

type WriteInput<V extends Record<string, unknown>> = {
  stage: "write";
  id: string;
  values: V;
};

type WriteOutput = Record<string, unknown>;

type Inputs<
  C extends Record<string, unknown>,
  V extends Record<string, unknown>,
> = {
  context?: {
    parts?: {
      json?: InitializeInput | ReadInput<C> | PreviewInput<C> | WriteInput<V>;
    }[];
  }[];
};

type Outputs<
  C extends Record<string, unknown>,
  V extends Record<string, unknown>,
> =
  | {
      context: {
        parts: { json: InitializeOutput<C> | ReadOutput<V> | WriteOutput }[];
      }[];
    }
  | {
      context: PreviewOutput;
    };

function cx<
  C extends Record<string, unknown>,
  V extends Record<string, unknown>,
>(json: InitializeOutput<C> | ReadOutput<V> | WriteOutput): Outputs<C, V> {
  return { context: [{ parts: [{ json }] }] };
}

export type Configurator<
  C extends Record<string, unknown>,
  V extends Record<string, unknown>,
> = {
  title: string;
  initialize: (
    caps: Capabilities,
    input: InitializeInput
  ) => Promise<Outcome<InitializeOutput<C>>>;
  read?: (
    caps: Capabilities,
    input: ReadInput<C>
  ) => Promise<Outcome<ReadOutput<V>>>;
  write?: (
    caps: Capabilities,
    input: WriteInput<V>
  ) => Promise<Outcome<WriteOutput>>;
  preview?: (
    caps: Capabilities,
    input: PreviewInput<C>
  ) => Promise<Outcome<PreviewOutput>>;
};

export type ConnectorInfo<
  C extends Record<string, JsonSerializable> = Record<string, JsonSerializable>,
> = {
  url: string;
  configuration: C;
};

export type ListMethodOutput = {
  list: ListToolResult[];
};

export type ListToolResult = {
  url: string;
  description: ExportDescriberResult;
  passContext: boolean;
};

export type InvokeMethodOutput = ToolOutput;

export type CanSaveMethodOutput = {
  canSave: boolean;
};

export type ToolHandler<
  C extends Record<string, JsonSerializable>,
  A extends Record<string, JsonSerializable> = Record<string, JsonSerializable>,
> = {
  title: string;
  list(
    caps: Capabilities,
    moduleArgs: A2ModuleArgs,
    id: string,
    info: ConnectorInfo<C>
  ): Promise<Outcome<ListMethodOutput>>;
  invoke(
    caps: Capabilities,
    moduleArgs: A2ModuleArgs,
    id: string,
    info: ConnectorInfo<C>,
    name: string,
    args: A
  ): Promise<Outcome<InvokeMethodOutput>>;
};

function createConfigurator<
  C extends Record<string, unknown> = Record<string, unknown>,
  V extends Record<string, unknown> = Record<string, unknown>,
>(configurator: Configurator<C, V>) {
  return {
    invoke: createConfiguratorInvoke(configurator),
    describe: createConfiguratorDescribe(configurator),
  };
}

function createConfiguratorDescribe<
  C extends Record<string, unknown> = Record<string, unknown>,
  V extends Record<string, unknown> = Record<string, unknown>,
>(configurator: Configurator<C, V>) {
  const { title } = configurator;
  return async function () {
    return {
      title: title,
      description: "",
      metadata: {
        tags: ["connector-configure"],
      },
      inputSchema: {
        type: "object",
      } satisfies Schema,
      outputSchema: {
        type: "object",
        properties: {
          context: {
            type: "array",
            items: { type: "object", behavior: ["llm-content"] },
            title: "Context out",
          },
        },
      } satisfies Schema,
    };
  };
}

function createConfiguratorInvoke<
  C extends Record<string, unknown> = Record<string, unknown>,
  V extends Record<string, unknown> = Record<string, unknown>,
>(configurator: Configurator<C, V>) {
  return async function (
    { context }: Inputs<C, V>,
    caps: Capabilities
  ): Promise<Outcome<Outputs<C, V>>> {
    const inputs = context?.at(-1)?.parts?.at(0)?.json;
    if (!inputs || !("stage" in inputs)) {
      return err(
        `Can't configure ${configurator.title || ""} connector: invalid input structure`
      );
    }

    if (inputs.stage === "initialize") {
      const initializing = await configurator.initialize(caps, inputs);
      if (!ok(initializing)) return initializing;
      return cx(initializing);
    } else if (inputs.stage === "read") {
      const reading = await configurator.read?.(caps, inputs);
      if (!reading) {
        return cx({
          schema: {},
          values: {},
        });
      }
      if (!ok(reading)) return reading;
      return cx(reading);
    } else if (inputs.stage === "preview") {
      const previewing = await configurator.preview?.(caps, inputs);
      if (!previewing || !ok(previewing)) {
        return { context: [{ parts: [{ text: "" }] }] };
      }
      return { context: previewing };
    } else if (inputs.stage === "write") {
      const writing = await configurator.write?.(caps, inputs);
      if (!writing) return cx({});
      if (!ok(writing)) return writing;
      return cx(writing);
    }
    return err(`Unknown stage: ${inputs["stage"]}`);
  };
}
