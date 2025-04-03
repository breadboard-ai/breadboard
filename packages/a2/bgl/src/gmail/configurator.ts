/**
 * @fileoverview Add a description for your module here.
 */

import { err, ok } from "./a2/utils";
import { createConfiguratorInvoke } from "./a2/connector-manager";

import read from "@read";
import write from "@write";

export { invoke as default, describe };

const invoke = createConfiguratorInvoke({
  title: "GMail",
  initialize: async () => {
    return { title: "GMail", configuration: {} };
  },
});

async function describe() {
  return {
    title: "Configure a Temp File",
    description:
      "Helps configure a new temp file or edit configuration of an existing temp file",
    metadata: {
      tags: ["connector-configure"],
    },
    inputSchema: {
      type: "object",
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
  };
}
