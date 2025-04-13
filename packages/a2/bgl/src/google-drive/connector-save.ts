/**
 * @fileoverview Connector Save Export.
 */
import { type DescribeOutputs } from "@describe";
import { toText, ok, err } from "./a2/utils";
import { contextToRequests, DOC_MIME_TYPE } from "./docs";
import { connect, query, create, getDoc, updateDoc } from "./api";
import type { ConnectorConfiguration } from "./types";

export { invoke as default, describe };

type Inputs = {
  id: string;
  info?: { configuration?: ConnectorConfiguration };
  method: "canSave" | "save";
  context?: LLMContent[];
};

type Outputs =
  | {
      context: LLMContent[];
    }
  | {
      canSave: boolean;
    };

async function invoke({
  method,
  id: connectorId,
  context,
  info,
}: Inputs): Promise<Outcome<Outputs>> {
  const mimeType = info?.configuration?.file?.mimeType;
  const canSave = mimeType === DOC_MIME_TYPE || mimeType === undefined;
  if (method === "save") {
    if (!canSave) {
      return err(`Unable to save files of type "${mimeType}"`);
    }
    const token = await connect({ title: "Get Auth Token" });
    const gettingCollector = await getCollector(
      token,
      connectorId,
      "Untitled Document",
      info?.configuration?.file?.id
    );
    if (!ok(gettingCollector)) return gettingCollector;
    const { id, end } = gettingCollector;
    const requests = await contextToRequests(context, end);
    const updating = await updateDoc(
      token,
      id,
      { requests },
      { title: "Append to Google Doc" }
    );
    if (!ok(updating)) return updating;
    return { context: context || [] };
  } else if (method == "canSave") {
    return { canSave };
  }
  return err(`Unknown method: "${method}"`);
}

type CollectorData = {
  id: string;
  end: number;
};

/**
 * Gets or creates the Google Doc id that serves as the collector: the
 * doc to which context is appended.
 */
async function getCollector(
  token: string,
  connectorId: string,
  title: string,
  fileId?: string
): Promise<Outcome<CollectorData>> {
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
      const createdFile = await create(
        token,
        {
          name: title,
          mimeType: DOC_MIME_TYPE,
          appProperties: {
            "google-drive-connector": connectorId,
          },
        },
        { title: "Create new doc to which to append" }
      );
      if (!ok(createdFile)) return createdFile;

      return {
        id: createdFile.id,
        end: 1,
      };
    }
    id = file.id;
  } else {
    id = fileId;
  }
  const gettingDoc = await getDoc(token, id, {
    title: "Get current doc contents",
  });
  if (!ok(gettingDoc)) return gettingDoc;
  const end =
    (
      gettingDoc as { body: { content: { endIndex: number }[] } }
    ).body.content.reduce(
      (acc, element) => Math.max(acc, element.endIndex || 0),
      1
    ) - 1;
  return { id, end };
}

async function describe() {
  return {
    title: "Save To Google Drive",
    metadata: {
      tags: ["connector-save"],
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
