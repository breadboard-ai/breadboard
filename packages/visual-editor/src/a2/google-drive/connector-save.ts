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
import { err, ok } from "../a2/utils.js";
import {
  appendSpreadsheetValues,
  create,
  getPresentation,
  getSpreadsheetMetadata,
  updateDoc,
  updatePresentation,
  updateSpreadsheet,
} from "./api.js";
import { contextToRequests, DOC_MIME_TYPE } from "./docs.js";
import { inferSheetValues, SHEETS_MIME_TYPE } from "./sheets.js";
import {
  SimpleSlideBuilder,
  SLIDES_MIME_TYPE,
  SlidesRequest,
} from "./slides.js";
import { inferSlideStructure } from "./slides-schema.js";
import type { ConnectorConfiguration } from "./types.js";
import { A2ModuleArgs } from "../runnable-module-factory.js";

export { invoke as default, describe };

type Inputs = {
  id: string;
  info?: { configuration?: ConnectorConfiguration };
  method: "canSave" | "save";
  title?: string;
  graphId?: string;
  context?: LLMContent[];
  slidesEditMode?: string;
  slidesWriteMode?: string;
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
  {
    method,
    id: connectorId,
    context,
    title,
    graphId,
    info,
    slidesEditMode,
    slidesWriteMode,
  }: Inputs,
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
        const requests = await contextToRequests(context, end!);
        const updating = await updateDoc(moduleArgs, id, { requests });
        if (!ok(updating)) return updating;
        return { context: contextFromId(id, DOC_MIME_TYPE) };
      }
      case SLIDES_MIME_TYPE: {
        const forceNew = slidesEditMode !== "Same slide deck";
        const [gettingCollector, result] = await Promise.all([
          getCollector(
            moduleArgs,
            connectorId,
            graphId,
            title ?? "Untitled Presentation",
            SLIDES_MIME_TYPE,
            info?.configuration?.file?.id,
            forceNew
          ),
          inferSlideStructure(caps, moduleArgs, context),
        ]);
        if (!ok(gettingCollector)) return gettingCollector;
        if (!ok(result)) return result;
        const { id, last, slides } = gettingCollector;

        let insertionIndex: number | undefined;
        let objectsToDelete: string[] = [];

        if (forceNew) {
          // If it's a new deck, we want to remove the default slide (which is 'last').
          if (last) objectsToDelete.push(last);
        } else {
          // Same slide deck
          if (slidesWriteMode === "Overwrite") {
            objectsToDelete = slides || [];
            insertionIndex = 0;
          } else if (slidesWriteMode === "Prepend") {
            insertionIndex = 0;
          }
          // Default is Append (insertionIndex undefined)
        }

        const slideBuilder = new SimpleSlideBuilder(
          gettingCollector.end,
          objectsToDelete,
          insertionIndex
        );
        for (const slide of result.slides) {
          slideBuilder.addSlide(slide);
        }
        const requests = slideBuilder.build([]);

        // Move delete requests to the end to avoid deleting the only slide before creating new ones.
        const deleteRequests: SlidesRequest[] = [];
        const otherRequests: SlidesRequest[] = [];
        for (const request of requests) {
          if ("deleteObject" in request) {
            deleteRequests.push(request);
          } else {
            otherRequests.push(request);
          }
        }
        const orderedRequests = [...otherRequests, ...deleteRequests];

        console.log("REQUESTS", orderedRequests);
        const updating = await updatePresentation(moduleArgs, id, {
          requests: orderedRequests,
        });
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
        const sheetInfo = await getSpreadsheetMetadata(moduleArgs, id);
        if (!ok(sheetInfo)) return sheetInfo;

        const newSheetTitle = generateSheetName();
        const creatingSheet = await updateSpreadsheet(moduleArgs, id, [
          { addSheet: { properties: { title: newSheetTitle, index: 0 } } },
        ]);

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
  slides?: string[];
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
  fileId?: string,
  forceNew = false
): Promise<Outcome<CollectorData>> {
  let id;
  if (!fileId) {
    const fileKey = `${getTypeKey(mimeType)}${connectorId}${graphId}`;
    let foundId: string | null = null;
    if (!forceNew) {
      const findFile = await moduleArgs.shell.getDriveCollectorFile(
        mimeType,
        connectorId,
        graphId
      );
      if (!findFile.ok) return err(findFile.error);
      foundId = findFile.id;
    }

    id = foundId;
    if (!id) {
      const appProperties = forceNew
        ? undefined
        : {
            "google-drive-connector": fileKey,
          };
      const createdFile = await create(moduleArgs, {
        name: title,
        mimeType,
        appProperties,
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
        const slides =
          gettingPresenation.slides?.map((s) => s.objectId!).filter(Boolean) ||
          [];
        return {
          id: gettingPresenation.presentationId!,
          end: 1,
          last: slides.at(-1),
          slides,
        };
      } else if (mimeType === SHEETS_MIME_TYPE) {
        return { id: createdFile.id, end: 1 };
      } else {
        return err(`Unknown mimeType: ${mimeType}`);
      }
    }
  } else {
    id = fileId;
  }
  if (mimeType === DOC_MIME_TYPE) {
    return { id, end: 1 };
  } else if (mimeType === SLIDES_MIME_TYPE) {
    const gettingPresentation = await getPresentation(moduleArgs, id);
    if (!ok(gettingPresentation)) return gettingPresentation;
    const end = gettingPresentation.slides?.length || 0;
    const slides =
      gettingPresentation.slides?.map((s) => s.objectId!).filter(Boolean) || [];
    return { id, end, slides };
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

  const day = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const year = String(now.getFullYear()).slice(-2);

  const datePart = `${day}.${month}.${year}`;

  const timePart = now
    .toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    .toLowerCase()
    .replace(/\s+/g, "");

  return `${datePart} ${timePart}`;
}
