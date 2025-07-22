/**
 * @fileoverview Add a description for your module here.
 */

import { createConfigurator } from "../a2/connector-manager";
import type { ConnectorConfiguration } from "./types";

export { invoke as default, describe };

const CONNECTOR_TITLE = "File System";

const { invoke, describe } = createConfigurator<
  ConnectorConfiguration,
  ConnectorConfiguration
>({
  title: CONNECTOR_TITLE,
  initialize: async () => {
    return { title: "File System", configuration: {} };
  },
  read: async ({ id: _id, configuration }) => {
    return {
      schema: {
        type: "object",
        properties: {},
      },
      values: configuration,
    };
  },
  preview: async () => {
    return [
      {
        parts: [{ text: "File System" }],
      },
    ];
  },
  write: async ({ values }) => {
    return values;
  },
});
