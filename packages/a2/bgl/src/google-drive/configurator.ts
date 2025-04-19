/**
 * @fileoverview Add a description for your module here.
 */

import { err, ok } from "./a2/utils";
import { createConfigurator } from "./a2/connector-manager";
import type { ConnectorConfiguration } from "./types";

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
  read: async ({ id, configuration }) => {
    return {
      schema: {
        type: "object",
        properties: {
          file: {
            type: "object",
            title: "Google Drive File",
            description: "Select Google Drive File",
            behavior: ["google-drive-file-id"],
          },
        },
      },
      values: configuration,
    };
  },
  preview: async ({ configuration }) => {
    const { id, mimeType } = configuration.file || {};
    if (!id || !mimeType)
      return [
        {
          parts: [{ text: "Untitled Document" }],
        },
      ];
    return [{ parts: [{ fileData: { fileUri: id, mimeType } }] }];
  },
  write: async ({ id, values }) => {
    console.log("WRITE", id, values);
    return values;
  },
});
