/**
 * @fileoverview Connector Load Export
 */
import { type DescribeOutputs } from "@describe";
import { toText, ok, err, llm } from "./a2/utils";
import { contextToRequests, markdownToContext, DOC_MIME_TYPE } from "./docs";
import { connect, query, exp } from "./api";
import type { ConnectorConfiguration } from "./types";

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

async function invoke({
  id,
  info: { configuration },
}: Inputs): Promise<Outcome<Outputs>> {
  const token = await connect({ title: "Getting auth token" });
  if (!ok(token)) return token;
  const gettingDoc = await getCollector(token, id, configuration?.file);
  if (!ok(gettingDoc)) return gettingDoc;
  return { context: gettingDoc };
}

/**
 * Gets the Google Doc id that serves as the collector: the
 * doc to which context is appended.
 */
async function getCollector(
  token: string,
  connectorId: string,
  file: ConnectorConfiguration["file"] | undefined
): Promise<Outcome<LLMContent[]>> {
  const { id: fileId, mimeType } = file || {};
  let id;
  if (!fileId) {
    const findFile = await query(
      token,
      `appProperties has { key = 'google-drive-connector' and value = '${connectorId}' } and trashed = false`,
      { title: "Find the doc to append to" }
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
  const exporter = new Exporter(token, id, mimeType);
  return exporter.export();
}

class Exporter {
  constructor(
    public readonly token: string,
    public readonly id: string,
    public readonly mimeType: string | undefined
  ) {}

  isDoc() {
    return this.mimeType === DOC_MIME_TYPE;
  }

  async export(): Promise<Outcome<LLMContent[]>> {
    const { token, id } = this;
    if (this.isDoc()) {
      const gettingDoc = await exp(token, id, "text/makdown", {
        title: "Get current doc contents",
      });
      if (!ok(gettingDoc)) return gettingDoc;
      if (!(typeof gettingDoc === "string")) {
        return err(`Invalid output from document export. Must be a string`);
      }
      return markdownToContext(gettingDoc);
    } else {
      const exportingPdf = await exp(token, id, "application/pdf", {
        title: "Get PDF export of the file",
      });
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
