/**
 * @fileoverview Connector Save Export.
 */
import {
  DescribeOutputs,
  LLMContent,
  Outcome,
  Schema,
} from "@breadboard-ai/types";
import { err, ok } from "../a2/utils.js";
import {
  appendSpreadsheetValues,
  create,
  createPresentation,
  getDoc,
  getPresentation,
  getSpreadsheetMetadata,
  updateDoc,
  updatePresentation,
  updateSpreadsheet,
} from "./api.js";
import { contextToRequests, DOC_MIME_TYPE } from "./docs.js";
import { inferSheetValues, SHEETS_MIME_TYPE } from "./sheets.js";
import { SimpleSlideBuilder, SLIDES_MIME_TYPE } from "./slides.js";
import { inferSlideStructure } from "./slides-schema.js";
import {
  DocEditMode,
  DocWriteMode,
  type ConnectorConfiguration,
} from "./types.js";
import { A2ModuleArgs } from "../runnable-module-factory.js";

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
        const docEditMode =
          info?.configuration?.docEditMode || DocEditMode.Same;
        const docWriteMode =
          info?.configuration?.docWriteMode || DocWriteMode.Append;

        const gettingCollector = await (docEditMode === DocEditMode.New
          ? createNewDoc(
              moduleArgs,
              connectorId,
              graphId,
              title ?? "Untitled Document"
            )
          : getCollector(
              moduleArgs,
              connectorId,
              graphId,
              title ?? "Untitled Document",
              DOC_MIME_TYPE,
              info?.configuration?.file?.id
            ));

        if (!ok(gettingCollector)) return gettingCollector;
        const { id, end } = gettingCollector;

        // Determine insertion index and extra requests based on write mode.
        // For a brand-new doc (DocEditMode.New) we always append from index 1.
        // The Docs API requires insert index < segment end index.
        // end is body.content.at(-1).endIndex (the end-of-body marker).
        // Valid insert range is [1, end - 1]. For an empty doc end=1, so we clamp to 1.
        let startIndex = Math.max(1, end! - 1); // default: append just before the end-of-body marker
        const extraRequests: unknown[] = [];

        if (docEditMode === DocEditMode.Same) {
          switch (docWriteMode) {
            case DocWriteMode.Prepend:
              startIndex = 1;
              break;
            case DocWriteMode.Overwrite:
              startIndex = 1;
              // Delete all existing body content before inserting.
              // The range { startIndex: 1, endIndex: end - 1 } is only non-empty
              // when end - 1 > 1, i.e. end > 2. A doc with only the trailing
              // paragraph marker has end === 2 and nothing to delete.
              if (end! > 2) {
                extraRequests.push({
                  deleteContentRange: {
                    range: { startIndex: 1, endIndex: end! - 1 },
                  },
                });
              }
              break;
          }
        }

        const insertRequests = await contextToRequests(context, startIndex);
        const requests = [...extraRequests, ...insertRequests];
        const updating = await updateDoc(moduleArgs, id, { requests });
        if (!ok(updating)) return updating;
        return { context: contextFromId(id, DOC_MIME_TYPE) };
      }
      case SLIDES_MIME_TYPE: {
        const slideDeckMode = info?.configuration?.slideDeckMode || "same";
        const slideWriteMode = info?.configuration?.slideWriteMode || "append";

        const [gettingCollector, result] = await Promise.all([
          slideDeckMode === "new"
            ? createNewPresentation(
                moduleArgs,
                connectorId,
                graphId,
                title ?? "Untitled Presentation"
              )
            : getCollector(
                moduleArgs,
                connectorId,
                graphId,
                title ?? "Untitled Presentation",
                SLIDES_MIME_TYPE,
                info?.configuration?.file?.id
              ),
          inferSlideStructure(moduleArgs, context),
        ]);
        if (!ok(gettingCollector)) return gettingCollector;
        if (!ok(result)) return result;
        const { id, end, last, slideIds } = gettingCollector;

        // Determine insertion index and slides to delete based on write mode
        let insertionIndex: number | undefined;
        let deleteSlideIds: string[] = [];
        if (slideDeckMode === "same") {
          switch (slideWriteMode) {
            case "prepend":
              insertionIndex = 0;
              break;
            case "overwrite":
              deleteSlideIds = slideIds || [];
              break;
            case "append":
            default:
              // Default behavior: append after existing slides
              break;
          }
        }

        const slideBuilder = new SimpleSlideBuilder(
          end,
          last,
          insertionIndex,
          deleteSlideIds
        );
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
          inferSheetValues(moduleArgs, context),
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
  slideIds?: string[];
  docId?: string;
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
    const findFile = await moduleArgs.shell.getDriveCollectorFile(
      mimeType,
      connectorId,
      graphId
    );
    if (!findFile.ok) return err(findFile.error);
    id = findFile.id;
    if (!id) {
      const createdFile = await create(moduleArgs, {
        name: title,
        mimeType,
        appProperties: {
          "google-drive-connector": fileKey,
        },
      });
      if (!ok(createdFile)) return createdFile;
      if (mimeType === DOC_MIME_TYPE) {
        const gettingDoc = await getDoc(moduleArgs, createdFile.id);
        if (!ok(gettingDoc)) return gettingDoc;

        return {
          id: createdFile.id,
          end: gettingDoc.body?.content?.at(-1)?.endIndex ?? 1,
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
          slideIds: (gettingPresenation.slides || [])
            .map((s) => s.objectId)
            .filter(Boolean) as string[],
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
    const gettingDoc = await getDoc(moduleArgs, id);
    if (!ok(gettingDoc)) return gettingDoc;

    return {
      id,
      end: gettingDoc.body?.content?.at(-1)?.endIndex ?? 1,
    };
  } else if (mimeType === SLIDES_MIME_TYPE) {
    const gettingPresentation = await getPresentation(moduleArgs, id);
    if (!ok(gettingPresentation)) return gettingPresentation;
    const end = gettingPresentation.slides?.length || 0;
    const slideIds = (gettingPresentation.slides || [])
      .map((s) => s.objectId)
      .filter(Boolean) as string[];
    return { id, end, slideIds };
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

/**
 * Always creates a new Google Doc without looking up existing files.
 * Used when docEditMode is "new".
 */
async function createNewDoc(
  moduleArgs: A2ModuleArgs,
  connectorId: string,
  graphId: string,
  title: string
): Promise<Outcome<CollectorData>> {
  const fileKey = `doc${connectorId}${graphId}`;
  const createdFile = await create(moduleArgs, {
    name: title,
    mimeType: DOC_MIME_TYPE,
    appProperties: {
      "google-drive-connector": fileKey,
    },
  });
  if (!ok(createdFile)) return createdFile;
  const gettingDoc = await getDoc(moduleArgs, createdFile.id);
  if (!ok(gettingDoc)) return gettingDoc;
  const end = gettingDoc.body?.content?.at(-1)?.endIndex ?? 1;
  return { id: createdFile.id, end };
}

/**
 * Always creates a new presentation without looking up existing files.
 * Used when slideDeckMode is "new".
 */
async function createNewPresentation(
  moduleArgs: A2ModuleArgs,
  _connectorId: string,
  _graphId: string,
  title: string
): Promise<Outcome<CollectorData>> {
  const gettingPresentation = await createPresentation(moduleArgs, title);
  if (!ok(gettingPresentation)) return gettingPresentation;
  return {
    id: gettingPresentation.presentationId!,
    end: 1,
    last: gettingPresentation.slides?.at(-1)?.objectId || undefined,
    slideIds: (gettingPresentation.slides || [])
      .map((s) => s.objectId)
      .filter(Boolean) as string[],
  };
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
