/**
 * @fileoverview Add a description for your module here.
 */

import { err, ok } from "./a2/utils";
import { createConfigurator } from "./a2/connector-manager";

import read from "@read";
import write from "@write";

export { invoke as default, describe };

const CONNECTOR_TITLE = "MCP Server";

type McpConfiguration = {
  endpoint?: string;
};

const { invoke, describe } = createConfigurator<McpConfiguration>({
  title: CONNECTOR_TITLE,
  initialize: async () => {
    return { title: CONNECTOR_TITLE, configuration: {} };
  },
  read: async ({ id, configuration }) => {
    return {
      schema: {
        type: "object",
        properties: {
          endpoint: {
            type: "string",
            title: "URL",
            description: "The URL of MCP Server SSE endpoint",
          },
        },
      },
      values: configuration,
    };
  },
});
