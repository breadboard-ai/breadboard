/**
 * @fileoverview Add a description for your module here.
 */

import { err, ok } from "./a2/utils";
import { createConfigurator } from "./a2/connector-manager";

export { invoke as default, describe };

const CONNECTOR_TITLE = "Google Drive";

type Configuration = {
  file?: {
    preview: string;
    id: string;
    mimeType: string;
  };
};

const { invoke, describe } = createConfigurator<Configuration>({
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
  write: async ({ id, values }) => {
    console.log("WRITE", id, values);
    return {};
  },
});
