/**
 * @fileoverview Handles templated content
 */

export { invoke as default, describe, Template };

import { type Params } from "./common";
import { ok, err, isLLMContent, isLLMContentArray } from "./utils";
import { ConnectorManager } from "./connector-manager";
import readFile from "@read";

type LLMContentWithMetadata = LLMContent & {
  $metadata: unknown;
};

export type Requireds = {
  required?: Schema["required"];
};

type Location = {
  part: LLMContent["parts"][0];
  parts: LLMContent["parts"];
};

export type InParamPart = {
  type: "in";
  path: string;
  title: string;
};

export type ToolParamPart = {
  type: "tool";
  path: string;
  title: string;
  instance?: string;
};

export type AssetParamPart = {
  type: "asset";
  path: string;
  title: string;
};

export type ParameterParamPart = {
  type: "param";
  path: string;
  title: string;
};

export type ParamPart =
  | InParamPart
  | ToolParamPart
  | AssetParamPart
  | ParameterParamPart;

export type TemplatePart = DataPart | ParamPart;

export type ToolCallback = (param: ToolParamPart) => Promise<Outcome<string>>;

function unique<T>(params: T[]): T[] {
  return Array.from(new Set(params));
}

function isTool(param: ParamPart): param is ToolParamPart {
  return param.type === "tool" && !!param.path;
}

function isIn(param: ParamPart): param is InParamPart {
  return param.type === "in" && !!param.path;
}

function isAsset(param: ParamPart): param is AssetParamPart {
  return param.type === "asset" && !!param.path;
}

function isParameter(param: ParamPart): param is ParameterParamPart {
  return param.type === "param" && !!param.path;
}

function isParamPart(param: ParamPart): param is ParamPart {
  return isTool(param) || isIn(param) || isAsset(param) || isParameter(param);
}

const PARSING_REGEX = /{(?<json>{(?:.*?)})}/gim;

class Template {
  #parts: TemplatePart[];
  #role: LLMContent["role"];

  constructor(public readonly template: LLMContent | undefined) {
    if (!template) {
      this.#role = "user";
      this.#parts = [];
      return;
    }
    this.#parts = this.#splitToTemplateParts(template);
    this.#role = template.role;
  }

  #mergeTextParts(parts: TemplatePart[]) {
    const merged = [];
    for (let part of parts) {
      if ("text" in part) {
        const last = merged[merged.length - 1];
        if (last && "text" in last) {
          last.text += part.text;
        } else {
          // We do a copy here otherwise the part is mutated, which
          // causes problems if the same part appears in the list twice.
          part = JSON.parse(JSON.stringify(part));
          merged.push(part);
        }
      } else {
        merged.push(part);
      }
    }
    return merged as DataPart[];
  }

  /**
   * Takes an LLM Content and splits it further into parts where
   * each {{param}} substitution is a separate part.
   */
  #splitToTemplateParts(content: LLMContent): TemplatePart[] {
    const parts: TemplatePart[] = [];
    for (const part of content.parts) {
      if (!("text" in part)) {
        parts.push(part);
        continue;
      }
      const matches = part.text.matchAll(PARSING_REGEX);
      let start = 0;
      for (const match of matches) {
        const json = match.groups?.json;
        const op = match.groups?.op;
        const arg = match.groups?.arg;
        const end = match.index;
        if (end > start) {
          parts.push({ text: part.text.slice(start, end) });
        }
        if (json) {
          let maybeTemplatePart;
          try {
            maybeTemplatePart = JSON.parse(json);
            if (isParamPart(maybeTemplatePart)) {
              // Do some extra parsing for connector tools
              // if (isTool(maybeTemplatePart)) {
              //   const [path, connector] = maybeTemplatePart.path.split("|");
              //   if (connector && connector.startsWith("connectors/")) {
              //     maybeTemplatePart.path = path;
              //     maybeTemplatePart.instance = connector;
              //   }
              //   console.log("TOOL", maybeTemplatePart);
              // }
              parts.push(maybeTemplatePart);
            } else {
              maybeTemplatePart = null;
            }
          } catch (e) {
            // do nothing
          } finally {
            if (!maybeTemplatePart) {
              parts.push({ text: part.text.slice(end, end + match[0].length) });
            }
          }
        }
        start = end + match[0].length;
      }
      if (start < part.text.length) {
        parts.push({ text: part.text.slice(start) });
      }
    }
    return parts;
  }

  #getLastNonMetadata(value: LLMContent[]): LLMContent | null {
    const content = value as LLMContentWithMetadata[];
    for (let i = content.length - 1; i >= 0; i--) {
      if (content[i].role !== "$metadata") {
        return content[i] as LLMContent;
      }
    }
    return null;
  }

  async #replaceParam(
    param: ParamPart,
    params: Params,
    whenTool: ToolCallback
  ): Promise<Outcome<unknown>> {
    if (isIn(param)) {
      const { type, title: name, path } = param;
      const paramName: `p-z-${string}` = `p-z-${path}`;
      if (paramName in params) {
        return params[paramName];
      }
      return name;
    } else if (isAsset(param)) {
      if (ConnectorManager.isConnector(param)) {
        return new ConnectorManager(param).materialize();
      }
      const path: FileSystemPath = `/assets/${param.path}`;
      const reading = await readFile({ path });
      if (!ok(reading)) {
        return err(`Unable to find asset "${param.title}"`);
      }
      return reading.data;
    } else if (isTool(param)) {
      const substituted = await whenTool(param);
      if (!ok(substituted)) return substituted;
      return substituted || param.title;
    } else if (isParameter(param)) {
      const path: FileSystemPath = `/env/parameters/${param.path}`;
      const reading = await readFile({ path });
      if (!ok(reading)) {
        console.error(`Unknown parameter "${param.title}"`);
        return null;
      }
      return reading.data;
    }
    return null;
  }

  async substitute(
    params: Params,
    whenTool: ToolCallback
  ): Promise<Outcome<LLMContent>> {
    const replaced: DataPart[] = [];
    for (const part of this.#parts) {
      if ("type" in part) {
        const value = await this.#replaceParam(part, params, whenTool);
        if (value === null) {
          // Ignore if null.
          continue;
        } else if (!ok(value)) {
          return value;
        } else if (typeof value === "string") {
          replaced.push({ text: value });
        } else if (isLLMContent(value)) {
          replaced.push(...value.parts);
        } else if (isLLMContentArray(value)) {
          const last = this.#getLastNonMetadata(value);
          if (last) {
            replaced.push(...last.parts);
          }
        } else {
          replaced.push({ text: JSON.stringify(value) });
        }
      } else {
        replaced.push(part);
      }
    }
    const parts = this.#mergeTextParts(replaced);
    return { parts, role: this.#role };
  }

  #toId(param: string) {
    return `p-z-${param}`;
  }

  #toTitle(id: string) {
    const spaced = id?.replace(/[_-]/g, " ");
    return (
      (spaced?.at(0)?.toUpperCase() ?? "") +
      (spaced?.slice(1)?.toLowerCase() ?? "")
    );
  }

  #forEachParam(handler: (param: ParamPart) => void) {
    for (const part of this.#parts) {
      if ("type" in part) {
        handler(part);
      }
    }
  }

  requireds(): Requireds {
    const required: string[] = [];
    let hasValues = false;
    this.#forEachParam((param) => {
      if (!isIn(param)) return;
      hasValues = true;
      required.push(this.#toId(param.title!));
    });
    return hasValues ? { required } : {};
  }

  schemas(): Record<string, Schema> {
    const result: [string, Schema][] = [];
    this.#forEachParam((param) => {
      const name = param.title!;
      const id = this.#toId(param.path!);
      if (!isIn(param)) return;
      result.push([
        id,
        {
          title: this.#toTitle(name),
          description: `The value to substitute for the parameter "${name}"`,
          type: "object",
          behavior: ["llm-content"],
        },
      ]);
    });
    return Object.fromEntries(result);
  }

  static part(part: ParamPart) {
    return `{${JSON.stringify(part)}}`;
  }

  /**
   * This is roughly the same method as `schemas`, but for connectors.
   * TODO: UNIFY
   */
  async schemaProperties(): Promise<Record<string, Schema>> {
    let result: Record<string, Schema> = {};
    for (const part of this.#parts) {
      if (!("type" in part)) continue;
      if (!isAsset(part)) continue;
      if (!ConnectorManager.isConnector(part)) continue;
      const props = await new ConnectorManager(part).schemaProperties();
      result = { ...result, ...props };
    }
    return result;
  }

  async save(
    context?: LLMContent[],
    options?: Record<string, unknown>
  ): Promise<Outcome<void>> {
    if (!context) return;

    const errors: string[] = [];
    for (const part of this.#parts) {
      if (!("type" in part)) continue;
      if (!isAsset(part)) continue;
      if (!ConnectorManager.isConnector(part)) continue;
      const saving = await new ConnectorManager(part).save(
        context,
        options || {}
      );
      if (!ok(saving)) {
        errors.push(saving.$error);
      }
    }
    if (errors.length > 0) {
      return err(errors.join("\n"));
    }
  }
}

/**
 * API for test harness
 */

function fromTestParams(params: Record<string, string>): Params {
  return Object.fromEntries(
    Object.entries(params).map(([key, value]) => {
      return [`p-z-${key}`, value];
    })
  );
}

type TestInputs = {
  inputs: { content: LLMContent; params: Record<string, string> };
};

type TestOutputs = {
  outputs: LLMContent;
};

/**
 * Only used for testing.
 */
async function invoke({
  inputs: { content, params },
}: TestInputs): Promise<Outcome<TestOutputs>> {
  const template = new Template(content);
  const result = await template.substitute(
    fromTestParams(params),
    async (params) => {
      return params.path;
    }
  );
  if (!ok(result)) {
    return result;
  }
  return { outputs: result };
}

/**
 * Only used for testing.
 */
async function describe() {
  return {
    inputSchema: {
      type: "object",
      properties: { inputs: { type: "object", title: "Test inputs" } },
    } satisfies Schema,
    outputSchema: {
      type: "object",
      properties: { outputs: { type: "object", title: "Test outputs" } },
    } satisfies Schema,
  };
}
