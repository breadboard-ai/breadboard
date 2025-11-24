/**
 * @fileoverview Connector Save Export.
 */
import {
  Capabilities,
  DescribeOutputs,
  LLMContent,
  Outcome,
  Schema,
} from "@breadboard-ai/types";
import { err, ok } from "../a2/utils";
import {
  appendSpreadsheetValues,
  addSheet,
  create,
  getDoc,
  getPresentation,
  getSpreadsheetMetadata,
  query,
  updateDoc,
  updatePresentation,
} from "./api";
import { contextToRequests, DOC_MIME_TYPE } from "./docs";
import { inferSheetValues, SHEETS_MIME_TYPE } from "./sheets";
import { SimpleSlideBuilder, SLIDES_MIME_TYPE } from "./slides";
import { inferSlideStructure } from "./slides-schema";
import type { ConnectorConfiguration } from "./types";
import { A2ModuleArgs } from "../runnable-module-factory";

export { invoke as default, describe };

type Inputs = {
  id: string;
  info?: { configuration?: ConnectorConfiguration };
  method: "canSave" | "save";
  title?: string;
  graphId?: string;
  context?: LLMContent[];
};

type Outputs =
  | {
      context: LLMContent[];
    }
  | {
      canSave: boolean;
    };

function contextFromId(id: string, mimeType: string): LLMContent[] {
  return [{ parts: [{ storedData: { handle: `drive:/${id}`, mimeType } }] }];
}

async function invoke(
  { method, id: connectorId, context, title, graphId, info }: Inputs,
  caps: Capabilities,
  moduleArgs: A2ModuleArgs
): Promise<Outcome<Outputs>> {
  graphId ??= "";
  const mimeType = info?.configuration?.file?.mimeType || DOC_MIME_TYPE;
  const canSave =
    mimeType === DOC_MIME_TYPE ||
    mimeType === SLIDES_MIME_TYPE ||
    mimeType === SHEETS_MIME_TYPE;
  if (method === "save") {
    if (!canSave) {
      return err(`Unable to save files of type "${mimeType}"`);
    }
    switch (mimeType) {
      case DOC_MIME_TYPE: {
        const gettingCollector = await getCollector(
          moduleArgs,
          connectorId,
          graphId,
          title ?? "Untitled Document",
          DOC_MIME_TYPE,
          info?.configuration?.file?.id
        );
        if (!ok(gettingCollector)) return gettingCollector;
        const { id, end } = gettingCollector;
        const requests = await contextToRequests(caps, context, end!);
        const updating = await updateDoc(moduleArgs, id, { requests });
        if (!ok(updating)) return updating;
        return { context: contextFromId(id, DOC_MIME_TYPE) };
      }
      case SLIDES_MIME_TYPE: {
        const [gettingCollector, result] = await Promise.all([
          getCollector(
            moduleArgs,
            connectorId,
            graphId,
            title ?? "Untitled Presentation",
            SLIDES_MIME_TYPE,
            info?.configuration?.file?.id
          ),
          inferSlideStructure(caps, moduleArgs, context),
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
        const updating = await updatePresentation(moduleArgs, id, { requests });
        if (!ok(updating)) return updating;
        return { context: contextFromId(id, SLIDES_MIME_TYPE) };
      }
      case SHEETS_MIME_TYPE: {
        const [gettingCollector, result] = await Promise.all([
          getCollector(
            moduleArgs,
            connectorId,
            graphId,
            title ?? "Untitled Spreadsheet",
            SHEETS_MIME_TYPE,
            info?.configuration?.file?.id
          ),
          inferSheetValues(caps, moduleArgs, context),
        ]);
        if (!ok(gettingCollector)) return gettingCollector;
        if (!ok(result)) return result;
        console.log("VALUES", result);
        const { id } = gettingCollector;
<<<<<<< HEAD
<<<<<<< HEAD
        const dateStr = new Date()
          .toLocaleString("en-GB", {
            day: "numeric",
            month: "numeric",
            hour: "numeric",
            minute: "numeric",
            second: "numeric",
          })
          .replace(/,/g, "");
        const newSheetTitle = `${title || "Data"} ${dateStr}`;
=======
>>>>>>> 9f29a968f (b/459871602-Google Doc Prepend instead of append, Sheet - new Sheet on every run with date/time added to the title)

        const newSheetTitle = generateSheetName();
        const creatingSheet = await addSheet(moduleArgs, id, newSheetTitle);

=======
        const newSheetTitle = generateSheetName();
        const creatingSheet = await addSheet(moduleArgs, id, newSheetTitle);

>>>>>>> 99d2e2ed1 (b/459871602-Google Doc Prepend instead of append, Sheet - new Sheet on every run with date/time added to the title)
        if (!ok(creatingSheet)) return creatingSheet;

        const appending = await appendSpreadsheetValues(
          moduleArgs,
          id,
          newSheetTitle,
          { values: result }
        );

        if (!ok(appending)) return appending;
        return { context: contextFromId(id, SHEETS_MIME_TYPE) };
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
  sheetName?: string;
};

/**
 * Gets or creates the Google Doc id that serves as the collector: the
 * doc to which context is appended.
 */
async function getCollector(
  moduleArgs: A2ModuleArgs,
  connectorId: string,
  graphId: string,
  title: string,
  mimeType: string,
  fileId?: string
): Promise<Outcome<CollectorData>> {
  let id;
  if (!fileId) {
    const fileKey = `${getTypeKey(mimeType)}${connectorId}${graphId}`;
    const findFile = await query(
      moduleArgs,
      `appProperties has { key = 'google-drive-connector' and value = '${fileKey}' } and trashed = false`
    );
    if (!ok(findFile)) return findFile;
    const file = findFile.files.at(0);
    if (!file) {
      const createdFile = await create(moduleArgs, {
        name: title,
        mimeType,
        appProperties: {
          "google-drive-connector": fileKey,
        },
      });
      if (!ok(createdFile)) return createdFile;
      if (mimeType === DOC_MIME_TYPE) {
        return {
          id: createdFile.id,
          end: 1,
        };
      } else if (mimeType === SLIDES_MIME_TYPE) {
        const gettingPresenation = await getPresentation(
          moduleArgs,
          createdFile.id
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
    return { id, end: 1 };
  } else if (mimeType === SLIDES_MIME_TYPE) {
    const gettingPresentation = await getPresentation(moduleArgs, id);
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

function generateSheetName(): string {
  const now = new Date();

  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = String(now.getFullYear()).slice(-2);
  
  const datePart = `${day}.${month}.${year}`;

  const timePart = now.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
  .toLowerCase()
  .replace(/\s+/g, '');

  return `${datePart} ${timePart}`;
}