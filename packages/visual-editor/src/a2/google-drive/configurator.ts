/**
 * @fileoverview Add a description for your module here.
 */

import { Schema } from "@breadboard-ai/types";
import { createConfigurator } from "../a2/connector-manager.js";
import { SLIDES_MIME_TYPE } from "./slides.js";
import type { ConnectorConfiguration } from "./types.js";

export { invoke as default, describe };

const CONNECTOR_TITLE = "Google Drive";

const { invoke, describe } = createConfigurator<
  ConnectorConfiguration,
  ConnectorConfiguration
>({
  title: CONNECTOR_TITLE,
  initialize: async () => {
    return { title: "Untitled Drive File", configuration: {} };
  },
  read: async (_caps, { id: _id, configuration }) => {
    const properties: Record<string, Schema> = {
      file: {
        type: "object",
        title: "Google Drive File",
        description: "Select Google Drive File",
        behavior: ["google-drive-file-id"],
      },
    };

    if (configuration.file?.mimeType === SLIDES_MIME_TYPE) {
      properties["editEachTime"] = {
        type: "string",
        title: "Edit each time",
        enum: ["New slide deck", "Same slide deck"],
        default: "New slide deck",
        behavior: ["hint-advanced", "reactive"],
      };

      if (configuration.editEachTime === "Same slide deck") {
        properties["writeMode"] = {
          type: "string",
          title: "Write mode",
          enum: [
            { id: "Prepend", title: "Prepend", info: "Add to the beginning" },
            { id: "Append", title: "Append", info: "Add to the end" },
            { id: "Overwrite", title: "Overwrite", info: "Replace everything" },
          ],
          default: "Prepend",
          behavior: ["hint-advanced"],
        };
      }
    }

    return {
      schema: {
        type: "object",
        properties,
      },
      values: configuration,
    };
  },
  preview: async (_caps, { configuration }) => {
    const { id, mimeType } = configuration.file || {};
    if (!id || !mimeType)
      return [
        {
          parts: [{ text: "Untitled Document" }],
        },
      ];
    return [{ parts: [{ fileData: { fileUri: id, mimeType } }] }];
  },
  write: async (_caps, { id, values }) => {
    console.log("WRITE", id, values);
    return values;
  },
});
