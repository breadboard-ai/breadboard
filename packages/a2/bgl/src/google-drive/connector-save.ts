/**
 * @fileoverview Connector Save Export.
 */
import { type DescribeOutputs } from "@describe";
import { toText, ok, err } from "./a2/utils";
import { contextToRequests, DOC_MIME_TYPE } from "./docs";
import { SLIDES_MIME_TYPE, SimpleSlideBuilder } from "./slides";
import { SHEETS_MIME_TYPE } from "./sheets";
import { inferSlideStructure } from "./slides-schema";
import { inferSheetValues } from "./sheets";
import {
  connect,
  query,
  create,
  getDoc,
  updateDoc,
  updatePresentation,
  getPresentation,
  createPresentation,
  appendSpreadsheetValues,
} from "./api";
import type { ConnectorConfiguration } from "./types";

export { invoke as default, describe };

type Inputs = {
  id: string;
  info?: { configuration?: ConnectorConfiguration };
  method: "canSave" | "save";
  title?: string;
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
  title,
  info,
}: Inputs): Promise<Outcome<Outputs>> {
  const mimeType = info?.configuration?.file?.mimeType || DOC_MIME_TYPE;
  const canSave =
    mimeType === DOC_MIME_TYPE ||
    mimeType === SLIDES_MIME_TYPE ||
    mimeType === SHEETS_MIME_TYPE;
  if (method === "save") {
    if (!canSave) {
      return err(`Unable to save files of type "${mimeType}"`);
    }
    const token = await connect({ title: "Get Auth Token" });
    switch (mimeType) {
      case DOC_MIME_TYPE: {
        const gettingCollector = await getCollector(
          token,
          connectorId,
          title ?? "Untitled Document",
          DOC_MIME_TYPE,
          info?.configuration?.file?.id
        );
        if (!ok(gettingCollector)) return gettingCollector;
        const { id, end } = gettingCollector;
        const requests = await contextToRequests(context, end!);
        const updating = await updateDoc(
          token,
          id,
          { requests },
          { title: "Append to Google Doc" }
        );
        if (!ok(updating)) return updating;
        return { context: context || [] };
      }
      case SLIDES_MIME_TYPE: {
        const [gettingCollector, result] = await Promise.all([
          getCollector(
            token,
            connectorId,
            title ?? "Untitled Presentation",
            SLIDES_MIME_TYPE,
            info?.configuration?.file?.id
          ),
          inferSlideStructure(context),
        ]);
        if (!ok(gettingCollector)) return gettingCollector;
        if (!ok(result)) return result;
        const { id, end, last } = gettingCollector;
        const slideBuilder = new SimpleSlideBuilder(end, last);
        for (const slide of result.slides) {
          slideBuilder.addSlide(slide);
        }
        const requests = slideBuilder.build([]);
        console.log("REQUESTS", requests);
        const updating = await updatePresentation(
          token,
          id,
          { requests },
          { title: "Append to Google Presentation" }
        );
        if (!ok(updating)) return updating;
        return { context: context || [] };
      }
      case SHEETS_MIME_TYPE: {
        const [gettingCollector, result] = await Promise.all([
          getCollector(
            token,
            connectorId,
            title ?? "Untitled Spreadsheet",
            SHEETS_MIME_TYPE,
            info?.configuration?.file?.id
          ),
          inferSheetValues(context),
        ]);
        if (!ok(gettingCollector)) return gettingCollector;
        if (!ok(result)) return result;
        const { id, end, last } = gettingCollector;
        console.log("VALUES", result);
        const appending = await appendSpreadsheetValues(
          token,
          id,
          "Sheet1",
          { values: result },
          {
            title: "Append to Google Presentation",
          }
        );
        if (!ok(appending)) return appending;
        return { context: context || [] };
      }
    }
  } else if (method == "canSave") {
    return { canSave };
  }
  return err(`Unknown method: "${method}"`);
}

type CollectorData = {
  id: string;
  end?: number;
  last?: string;
};

/**
 * Gets or creates the Google Doc id that serves as the collector: the
 * doc to which context is appended.
 */
async function getCollector(
  token: string,
  connectorId: string,
  title: string,
  mimeType: string,
  fileId?: string
): Promise<Outcome<CollectorData>> {
  let id;
  if (!fileId) {
    const fileKey = `${getTypeKey(mimeType)}${connectorId}`;
    const findFile = await query(
      token,
      `appProperties has { key = 'google-drive-connector' and value = '${fileKey}' } and trashed = false`,
      { title: "Find the doc to append to" }
    );
    if (!ok(findFile)) return findFile;
    const file = findFile.files.at(0);
    if (!file) {
      const createdFile = await create(
        token,
        {
          name: title,
          mimeType,
          appProperties: {
            "google-drive-connector": fileKey,
          },
        },
        { title: "Create new file to which to append" }
      );
      if (!ok(createdFile)) return createdFile;
      if (mimeType === DOC_MIME_TYPE) {
        return {
          id: createdFile.id,
          end: 1,
        };
      } else if (mimeType === SLIDES_MIME_TYPE) {
        const gettingPresenation = await getPresentation(
          token,
          createdFile.id,
          {
            title: "Reading presentation",
          }
        );
        if (!ok(gettingPresenation)) return gettingPresenation;
        return {
          id: gettingPresenation.presentationId!,
          end: 1,
          last: gettingPresenation.slides?.at(-1)?.objectId || undefined,
        };
      } else if (mimeType === SHEETS_MIME_TYPE) {
        return { id: createdFile.id, end: 1 };
      } else {
        return err(`Unknown mimeType: ${mimeType}`);
      }
    }
    id = file.id;
  } else {
    id = fileId;
  }
  if (mimeType === DOC_MIME_TYPE) {
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
  } else if (mimeType === SLIDES_MIME_TYPE) {
    const gettingPresentation = await getPresentation(token, id, {
      title: "Get current doc contents",
    });
    if (!ok(gettingPresentation)) return gettingPresentation;
    const end = gettingPresentation.slides?.length || 0;
    return { id, end };
  } else if (mimeType === SHEETS_MIME_TYPE) {
    return { id, end: 1 };
  }
  return err(`Unknown mimeType: ${mimeType}`);

  function getTypeKey(mimeType: string) {
    if (mimeType === DOC_MIME_TYPE) return "doc";
    if (mimeType === SHEETS_MIME_TYPE) return "sheet";
    if (mimeType === SLIDES_MIME_TYPE) return "slides";
    return "";
  }
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
