/**
 * @fileoverview Connector Load Export
 */
import {
  Capabilities,
  DescribeOutputs,
  LLMContent,
  Outcome,
  Schema,
  StoredDataCapabilityPart,
} from "@breadboard-ai/types";
import { err, ok } from "../a2/utils";
import { exp, query } from "./api";
import { DOC_MIME_TYPE, markdownToContext } from "./docs";
import type { ConnectorConfiguration } from "./types";
import { A2ModuleFactoryArgs } from "../runnable-module-factory";

export { invoke as default, describe };

type Inputs = {
  id: string;
  info: {
    configuration?: ConnectorConfiguration;
  };
};

type Outputs = {
  context: LLMContent[];
};

async function invoke(
  { id, info: { configuration } }: Inputs,
  _caps: Capabilities,
  moduleArgs: A2ModuleFactoryArgs
): Promise<Outcome<Outputs>> {
  const gettingDoc = await getCollector(moduleArgs, id, configuration?.file);
  if (!ok(gettingDoc)) return gettingDoc;
  return { context: gettingDoc };
}

/**
 * Gets the Google Doc id that serves as the collector: the
 * doc to which context is appended.
 */
async function getCollector(
  moduleArgs: A2ModuleFactoryArgs,
  connectorId: string,
  file: ConnectorConfiguration["file"] | undefined
): Promise<Outcome<LLMContent[]>> {
  const { id: fileId, mimeType } = file || {};
  let id;
  if (!fileId) {
    const findFile = await query(
      moduleArgs,
      `appProperties has { key = 'google-drive-connector' and value = '${connectorId}' } and trashed = false`
    );
    if (!ok(findFile)) return findFile;
    const file = findFile.files.at(0);
    if (!file) {
      return [];
    }
    id = file.id;
  } else {
    id = fileId;
  }
  const exporter = new Exporter(moduleArgs, id, mimeType);
  return exporter.export();
}

class Exporter {
  constructor(
    private readonly moduleArgs: A2ModuleFactoryArgs,
    public readonly id: string,
    public readonly mimeType: string | undefined
  ) {}

  isDoc() {
    return this.mimeType === DOC_MIME_TYPE;
  }

  async export(): Promise<Outcome<LLMContent[]>> {
    const { id } = this;
    if (this.isDoc()) {
      const gettingDoc = await exp(this.moduleArgs, id, "text/makdown");
      if (!ok(gettingDoc)) return gettingDoc;
      if (!(typeof gettingDoc === "string")) {
        return err(`Invalid output from document export. Must be a string`);
      }
      return markdownToContext(gettingDoc);
    } else {
      const exportingPdf = await exp(this.moduleArgs, id, "application/pdf");
      if (!ok(exportingPdf)) return exportingPdf;
      return [{ parts: [exportingPdf as StoredDataCapabilityPart] }];
    }
  }
}

async function describe() {
  return {
    metadata: {
      tags: ["connector-load"],
    },
    inputSchema: {
      type: "object",
      properties: {
        context: {
          type: "array",
          items: { type: "object", behavior: ["llm-content"] },
          title: "Context in",
        },
      },
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
  } satisfies DescribeOutputs;
}
