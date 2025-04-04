/**
 * @fileoverview Add a description for your module here.
 */

import { err, ok, isLLMContentArray } from "./utils";
import read from "@read";
import describeConnector, { type DescribeOutputs } from "@describe";
import invokeConnector from "@invoke";
export { ConnectorManager, createConfigurator };

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

type WriteInput<V extends Record<string, unknown>> = {
  stage: "write";
  id: string;
  values: V;
};

type WriteOutput = {};

type Inputs<
  C extends Record<string, unknown>,
  V extends Record<string, unknown>,
> = {
  context?: {
    parts?: { json?: InitializeInput | ReadInput<C> | WriteInput<V> }[];
  }[];
};

type Outputs<
  C extends Record<string, unknown>,
  V extends Record<string, unknown>,
> = {
  context: {
    parts: { json: InitializeOutput<C> | ReadOutput<V> | WriteOutput }[];
  }[];
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
  initialize: (input: InitializeInput) => Promise<Outcome<InitializeOutput<C>>>;
  read?: (input: ReadInput<C>) => Promise<Outcome<ReadOutput<V>>>;
  write?: (input: WriteInput<V>) => Promise<Outcome<WriteOutput>>;
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
  return async function ({
    context,
  }: Inputs<C, V>): Promise<Outcome<Outputs<C, V>>> {
    const inputs = context?.at(-1)?.parts?.at(0)?.json;
    if (!inputs || !("stage" in inputs)) {
      return err(
        `Can't configure ${configurator.title || ""} connector: invalid input structure`
      );
    }

    if (inputs.stage === "initialize") {
      const initializing = await configurator.initialize(inputs);
      if (!ok(initializing)) return initializing;
      return cx(initializing);
    } else if (inputs.stage === "read") {
      const reading = await configurator.read?.(inputs);
      if (!reading) {
        return cx({
          schema: {},
          values: {},
        });
      }
      if (!ok(reading)) return reading;
      return cx(reading);
    } else if (inputs.stage === "write") {
      const writing = await configurator.write?.(inputs);
      if (!writing) return cx({});
      if (!ok(writing)) return writing;
      return cx({});
    }
    return err(`Unknown stage: ${inputs["stage"]}`);
  };
}

type AssetParamPart = {
  path: string;
};

type ConnectorInfo = {
  /**
   * The URL of the connector
   */
  url: string;
  /**
   * The configuration of the connector
   */
  configuration: unknown;
};

type InvocationArgs = {
  $board: string;
  id: string;
  info: ConnectorInfo;
};

type LoadOutput = {
  context?: LLMContent[];
};

class ConnectorManager {
  constructor(public readonly part: AssetParamPart) {}

  async #getInvocationArgs(tag: string): Promise<Outcome<InvocationArgs>> {
    const path: FileSystemPath = `/assets/${this.part.path}`;
    const reading = await read({ path });
    if (!ok(reading)) return reading;

    const info = getConnectorInfo(reading.data);
    if (!ok(info)) return info;

    const describing = await describeConnector({ url: info.url });
    if (!ok(describing)) return describing;

    const url = getExportUrl(tag, describing);
    if (!ok(url)) return url;

    const id = getConnectorId(this.part);
    if (!ok(id)) return id;

    return { $board: url, id, info };
  }

  async materialize(): Promise<Outcome<unknown>> {
    const args = await this.#getInvocationArgs("connector-load");
    if (!ok(args)) return args;

    const invoking = await invokeConnector(args);
    if (!ok(invoking)) return invoking;

    const output = invoking as LoadOutput;
    if (output && output.context && isLLMContentArray(output.context)) {
      return output.context;
    }
    return err(`Invalid return value from connector load`);
  }

  async schemaProperties(): Promise<Record<string, Schema>> {
    const args = await this.#getInvocationArgs("connector-save");

    if (!ok(args)) return {};

    const describing = await describeConnector({ url: args.$board });
    if (!ok(describing)) return {};

    const props = describing.inputSchema.properties;
    if (!props || Object.keys(props).length === 0) return {};

    delete props.context;
    delete props.id;
    delete props.info;

    return props;
  }

  async save(
    context: LLMContent[],
    options: Record<string, unknown>
  ): Promise<Outcome<void>> {
    const args = await this.#getInvocationArgs("connector-save");
    if (!ok(args)) return args;

    const invoking = await invokeConnector({ ...args, context, ...options });
    if (!ok(invoking)) return invoking;
  }

  static isConnector(part: AssetParamPart) {
    return part.path.startsWith("connectors/");
  }
}

function getConnectorId(part: AssetParamPart): Outcome<string> {
  const id = part.path.split("/").at(-1);
  if (!id) return err(`Invalid connector path: ${part.path}`);
  return id;
}

function getExportUrl(tag: string, result: DescribeOutputs): Outcome<string> {
  const exports = result.exports;
  if (!exports) return err(`Invalid connector structure: must have exports`);
  const assetExport = Object.entries(exports).find(([url, e]) =>
    e.metadata?.tags?.includes(tag)
  );
  if (!assetExport)
    return err(
      `Invalid connector structure: must have export tagged as "${tag}"`
    );
  return assetExport[0];
}

function getConnectorInfo(
  data: LLMContent[] | undefined
): Outcome<ConnectorInfo> {
  const part = data?.at(-1)?.parts.at(0);
  if (!part) return err(`Invalid asset structure`);
  if (!("json" in part)) return err(`Invalid connector info structure`);
  return part.json as ConnectorInfo;
}
