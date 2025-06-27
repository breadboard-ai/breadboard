/**
 * @fileoverview Connector Save Export.
 */
import { type DescribeOutputs } from "@describe";
import { toText, ok, err } from "./a2/utils";
import { contextToRequests, DOC_MIME_TYPE } from "./docs";
import { SLIDES_MIME_TYPE, SimpleSlideBuilder } from "./slides";
import { inferSlideStructure } from "./slides-schema";
import {
  connect,
  query,
  create,
  getDoc,
  updateDoc,
  updatePresentation,
  getPresentation,
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
  const canSave = mimeType === DOC_MIME_TYPE || mimeType === SLIDES_MIME_TYPE;
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
        const requests = await contextToRequests(context, end);
        const updating = await updateDoc(
          token,
          id,
          { requests },
          { title: "Append to Google Doc" }
        );
        if (!ok(updating)) return updating;
        return { context: context || [] };
        break;
      }
      case SLIDES_MIME_TYPE: {
        // TODO: Run these in parallel. They are both slow.
        const gettingCollector = await getCollector(
          token,
          connectorId,
          title ?? "Untitled Presentation",
          SLIDES_MIME_TYPE,
          info?.configuration?.file?.id
        );
        if (!ok(gettingCollector)) return gettingCollector;
        const { id, end } = gettingCollector;
        const result = await inferSlideStructure(context);
        if (!ok(result)) return result;
        const slideBuilder = new SimpleSlideBuilder(end);
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
        break;
      }
    }
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
  mimeType: string,
  fileId?: string
): Promise<Outcome<CollectorData>> {
  let id;
  if (!fileId) {
    const fileKey = `${mimeType === DOC_MIME_TYPE ? "doc" : "slides"}${connectorId}`;
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
  }
  return err(`Unknown mimeType: ${mimeType}`);
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
